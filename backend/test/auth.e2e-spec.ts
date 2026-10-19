import { getModelToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { AuditEvent } from '../src/modules/audit/audit-event.schema';
import { PasswordService } from '../src/modules/auth/password.service';
import { User } from '../src/modules/users/user.schema';
import { createTestApp, TEST_ORIGIN } from './test-app';

const PASSWORD = 'quiet river morning tea';
const API = '/api/v1';

let mongo: MongoMemoryReplSet;
let app: NestExpressApplication;
let users: Model<User>;
let audits: Model<AuditEvent>;
let counter = 0;

const uniqueEmail = (label: string) => `${label}.${Date.now()}.${counter++}@example.test`;
const newAgent = () => request.agent(app.getHttpServer());

async function register(agent: TestAgent, email = uniqueEmail('patient'), password = PASSWORD) {
  const res = await agent
    .post(`${API}/auth/register`)
    .set('Origin', TEST_ORIGIN)
    .send({ fullName: 'Test Patient', email, password, acceptTerms: true });
  return { res, email, csrf: res.body.csrfToken as string };
}

async function login(agent: TestAgent, email: string, password = PASSWORD) {
  const res = await agent
    .post(`${API}/auth/login`)
    .set('Origin', TEST_ORIGIN)
    .send({ email, password });
  return { res, csrf: res.body.csrfToken as string };
}

async function createStaffUser(roles: User['roles']) {
  const email = uniqueEmail('staff');
  const passwordHash = await app.get(PasswordService).hash(PASSWORD);
  await users.create({
    email,
    fullName: 'Synthetic Staff',
    passwordHash,
    roles,
    passwordChangedAt: new Date(),
    termsAcceptedVersion: 'test',
    privacyNoticeAcceptedVersion: 'test',
    termsAcceptedAt: new Date(),
  });
  return email;
}

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  ({ app } = await createTestApp(mongo.getUri(), 'sukoon_e2e'));
  users = app.get(getModelToken(User.name));
  audits = app.get(getModelToken(AuditEvent.name));
  await users.syncIndexes();
});

afterAll(async () => {
  await app?.close();
  await mongo?.stop();
});

describe('health and error handling', () => {
  it('reports liveness and readiness with a request ID', async () => {
    const live = await request(app.getHttpServer()).get(`${API}/health/live`).expect(200);
    expect(live.headers['x-request-id']).toBeDefined();
    const ready = await request(app.getHttpServer()).get(`${API}/health/ready`).expect(200);
    expect(ready.body).toMatchObject({
      status: 'ok',
      checks: { database: 'up' },
      integrations: {
        payments: expect.any(String),
        paymentWebhooks: expect.any(Boolean),
        video: expect.any(String),
        videoCalls: expect.any(Boolean),
      },
    });
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(app.getHttpServer()).get(`${API}/health/live`);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers.etag).toBeUndefined();
  });

  it('returns the standard error shape for unknown routes and malformed JSON', async () => {
    const missing = await request(app.getHttpServer()).get(`${API}/nope`).expect(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
    expect(missing.body.requestId).toBeDefined();

    const malformed = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);
    expect(malformed.body.error.code).toBe('BAD_REQUEST');
    expect(JSON.stringify(malformed.body)).not.toMatch(/stack|at .*\.js/);
  });

  it('rejects oversized request bodies', async () => {
    const res = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: 'a@example.test', password: 'x'.repeat(200_000) })
      .expect(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('registration', () => {
  it('creates a patient session with a hardened cookie and never returns secrets', async () => {
    const agent = newAgent();
    const { res } = await register(agent);
    expect(res.status).toBe(201);
    expect(res.body.user.roles).toEqual(['patient']);
    expect(res.body.csrfToken).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/);

    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/sid=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const me = await agent.get(`${API}/auth/me`).expect(200);
    expect(me.headers['cache-control']).toBe('no-store');
    const stored = await users.findOne({ email: me.body.user.email }).lean();
    expect(stored?.lastLoginAt).toBeInstanceOf(Date);
  });

  it('rejects attempts to self-assign roles (mass assignment)', async () => {
    const res = await newAgent()
      .post(`${API}/auth/register`)
      .send({
        fullName: 'Mallory',
        email: uniqueEmail('m'),
        password: PASSWORD,
        acceptTerms: true,
        roles: ['super_admin'],
      })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details.join(' ')).toMatch(/roles should not exist/);
  });

  it('enforces the password policy and terms acceptance', async () => {
    const email = uniqueEmail('policy');
    const short = await newAgent()
      .post(`${API}/auth/register`)
      .send({ fullName: 'Short', email, password: 'short', acceptTerms: true })
      .expect(400);
    expect(short.body.error.code).toBe('VALIDATION_FAILED');

    await newAgent()
      .post(`${API}/auth/register`)
      .send({ fullName: 'Terms', email, password: PASSWORD, acceptTerms: false })
      .expect(400);

    const local = email.split('@')[0];
    await newAgent()
      .post(`${API}/auth/register`)
      .send({ fullName: 'Local', email, password: `${local}-secret`, acceptTerms: true })
      .expect(400);
  });

  it('reports duplicate emails with a stable code', async () => {
    const { email } = await register(newAgent());
    const { res } = await register(newAgent(), email);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });
});

describe('login and lockout', () => {
  it('returns the same generic error for wrong passwords and unknown accounts', async () => {
    const { email } = await register(newAgent());
    const wrong = await login(newAgent(), email, 'not the right password');
    const unknown = await login(newAgent(), uniqueEmail('ghost'));
    expect(wrong.res.status).toBe(401);
    expect(unknown.res.status).toBe(401);
    expect(wrong.res.body.error).toEqual(unknown.res.body.error);
    expect(wrong.res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects operator injection in credentials', async () => {
    const res = await newAgent()
      .post(`${API}/auth/login`)
      .send({ email: { $ne: null }, password: { $ne: null } })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('locks the account after five failures, even for the correct password', async () => {
    const { email } = await register(newAgent());
    for (let i = 0; i < 5; i++) await login(newAgent(), email, 'definitely wrong pass');
    const locked = await login(newAgent(), email);
    expect(locked.res.status).toBe(401);

    const user = await users.findOne({ email }).lean();
    expect(user?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
    const reasons = await audits
      .find({ action: 'auth.login', actorUserId: user?._id })
      .distinct('metadata.reason');
    expect(reasons).toEqual(expect.arrayContaining(['bad_password', 'account_locked']));
  });
});

describe('CSRF protection', () => {
  it('requires the session-bound token on authenticated unsafe requests', async () => {
    const agent = newAgent();
    const { csrf } = await register(agent);

    const missing = await agent.post(`${API}/auth/logout`).set('Origin', TEST_ORIGIN).expect(403);
    expect(missing.body.error.code).toBe('CSRF_FAILED');
    await agent.post(`${API}/auth/logout`).set('X-CSRF-Token', 'forged').expect(403);

    await agent
      .post(`${API}/auth/logout`)
      .set('Origin', TEST_ORIGIN)
      .set('X-CSRF-Token', csrf)
      .expect(204);
    await agent.get(`${API}/auth/me`).expect(401);
  });

  it('rejects unsafe requests from origins that are not allow-listed', async () => {
    const agent = newAgent();
    const { csrf } = await register(agent);
    await agent
      .post(`${API}/auth/logout`)
      .set('Origin', 'https://evil.example')
      .set('X-CSRF-Token', csrf)
      .expect(403);
    await newAgent()
      .post(`${API}/auth/login`)
      .set('Origin', 'https://evil.example')
      .send({ email: 'a@example.test', password: PASSWORD })
      .expect(403);
  });
});

describe('sessions', () => {
  it('lists own sessions and blocks revoking sessions that belong to someone else', async () => {
    const laptop = newAgent();
    const { email, csrf } = await register(laptop);
    const phone = newAgent();
    await login(phone, email);

    const list = await laptop.get(`${API}/auth/sessions`).expect(200);
    expect(list.body.items).toHaveLength(2);
    expect(list.body.items.filter((s: { current: boolean }) => s.current)).toHaveLength(1);

    const other = newAgent();
    const { csrf: otherCsrf } = await register(other);
    const victimSession = list.body.items[0].id as string;
    await other
      .delete(`${API}/auth/sessions/${victimSession}`)
      .set('X-CSRF-Token', otherCsrf)
      .expect(404);
    await other.delete(`${API}/auth/sessions/not-an-id`).set('X-CSRF-Token', otherCsrf).expect(404);

    const revoked = await laptop
      .post(`${API}/auth/sessions/revoke-others`)
      .set('X-CSRF-Token', csrf)
      .expect(200);
    expect(revoked.body.revoked).toBe(1);
    await phone.get(`${API}/auth/me`).expect(401);
    await laptop.get(`${API}/auth/me`).expect(200);
  });

  it('rotates the session and signs out other devices on password change', async () => {
    const laptop = newAgent();
    const { email, csrf } = await register(laptop);
    const phone = newAgent();
    await login(phone, email);
    const newPassword = 'a different calm passphrase';

    const wrong = await laptop
      .post(`${API}/auth/password`)
      .set('X-CSRF-Token', csrf)
      .send({ currentPassword: 'not my password at all', newPassword })
      .expect(400);
    expect(wrong.body.error.code).toBe('INVALID_CURRENT_PASSWORD');

    const changed = await laptop
      .post(`${API}/auth/password`)
      .set('X-CSRF-Token', csrf)
      .send({ currentPassword: PASSWORD, newPassword })
      .expect(200);
    expect(changed.body.csrfToken).not.toEqual(csrf);

    await phone.get(`${API}/auth/me`).expect(401);
    await laptop.get(`${API}/auth/me`).expect(200);
    expect((await login(newAgent(), email)).res.status).toBe(401);
    expect((await login(newAgent(), email, newPassword)).res.status).toBe(200);
  });
});

describe('role-based access control', () => {
  it('denies patients access to admin endpoints and audits the denial', async () => {
    const agent = newAgent();
    const { email } = await register(agent);
    const res = await agent.get(`${API}/admin/users`).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');

    const user = await users.findOne({ email }).lean();
    expect(await audits.countDocuments({ action: 'authz.denied', actorUserId: user?._id })).toBe(1);
  });

  it('requires authentication for admin endpoints', async () => {
    await request(app.getHttpServer()).get(`${API}/admin/users`).expect(401);
  });

  it('lets platform admins list users, escapes search input, and audits the access', async () => {
    const email = await createStaffUser(['platform_admin']);
    const agent = newAgent();
    expect((await login(agent, email)).res.status).toBe(200);

    const page = await agent.get(`${API}/admin/users?limit=5`).expect(200);
    expect(page.body.items.length).toBeGreaterThan(0);
    expect(page.body.items.length).toBeLessThanOrEqual(5);
    expect(JSON.stringify(page.body)).not.toMatch(/passwordHash/);

    const regex = await agent
      .get(`${API}/admin/users?search=${encodeURIComponent('.*')}`)
      .expect(200);
    expect(regex.body.total).toBe(0);

    await agent.get(`${API}/admin/users?limit=1000`).expect(400);
    await agent.get(`${API}/admin/users?role=god`).expect(400);

    const admin = await users.findOne({ email }).lean();
    expect(
      await audits.countDocuments({ action: 'admin.users.list', actorUserId: admin?._id }),
    ).toBe(2);
  });
});

describe('rate limiting and production safeguards', () => {
  it('throttles credential endpoints per IP', async () => {
    const { app: limited } = await createTestApp(mongo.getUri(), 'sukoon_e2e_limits', {
      AUTH_RATE_LIMIT_PER_MINUTE: '3',
    });
    try {
      const attempt = () =>
        request(limited.getHttpServer())
          .post(`${API}/auth/login`)
          .send({ email: 'nobody@example.test', password: 'wrong password here' });
      for (let i = 0; i < 3; i++) expect((await attempt()).status).toBe(401);
      const blocked = await attempt();
      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('RATE_LIMITED');
      await request(limited.getHttpServer()).get(`${API}/health/live`).expect(200);
    } finally {
      await limited.close();
    }
  });
});
