import { getModelToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import request, { type Response } from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { AuditEvent } from '../src/modules/audit/audit-event.schema';
import { base32Decode, hotp, totpStep } from '../src/modules/auth/mfa/totp';
import { PasswordService } from '../src/modules/auth/password.service';
import { Session } from '../src/modules/auth/session.schema';
import { User } from '../src/modules/users/user.schema';
import { createTestApp, TEST_ORIGIN } from './test-app';

const PASSWORD = 'quiet river morning tea';
const API = '/api/v1';

let mongo: MongoMemoryReplSet;
let app: NestExpressApplication;
let users: Model<User>;
let sessions: Model<Session>;
let audits: Model<AuditEvent>;
let counter = 0;

const uniqueEmail = (label: string) => `${label}.${Date.now()}.${counter++}@example.test`;
const currentCode = (secret: string) => hotp(base32Decode(secret), totpStep(Date.now()));

/**
 * A code may be used once per 30-second window. Tests that need several codes in a row clear the
 * replay marker instead of waiting for the next window.
 */
async function nextWindow(email: string) {
  await users.updateOne({ email }, { $set: { mfaLastUsedStep: null } });
}

interface SignedIn {
  agent: TestAgent;
  csrf: string;
}

async function register(email: string): Promise<SignedIn> {
  const agent = request.agent(app.getHttpServer());
  const res = await agent
    .post(`${API}/auth/register`)
    .set('Origin', TEST_ORIGIN)
    .send({ fullName: 'Mfa Tester', email, password: PASSWORD, acceptTerms: true })
    .expect(201);
  return { agent, csrf: res.body.csrfToken as string };
}

const post = (who: SignedIn, path: string) =>
  who.agent.post(`${API}${path}`).set('Origin', TEST_ORIGIN).set('X-CSRF-Token', who.csrf);

async function passwordStep(email: string) {
  const agent = request.agent(app.getHttpServer());
  const res = await agent
    .post(`${API}/auth/login`)
    .set('Origin', TEST_ORIGIN)
    .send({ email, password: PASSWORD });
  return { agent, res };
}

const challenge = (agent: TestAgent, code: string) =>
  agent.post(`${API}/auth/mfa/challenge`).set('Origin', TEST_ORIGIN).send({ code });

/** Registers an account and turns on two-step verification; returns its secret and codes. */
async function enrolledUser() {
  const email = uniqueEmail('mfa');
  const owner = await register(email);
  const setup = await post(owner, '/auth/mfa/setup').send({ password: PASSWORD }).expect(200);
  const secret = setup.body.secret as string;
  const enabled = await post(owner, '/auth/mfa/enable')
    .send({ code: currentCode(secret) })
    .expect(200);
  await nextWindow(email);
  return { email, owner, secret, recoveryCodes: enabled.body.recoveryCodes as string[] };
}

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  ({ app } = await createTestApp(mongo.getUri(), 'sukoon_e2e_mfa'));
  users = app.get(getModelToken(User.name));
  sessions = app.get(getModelToken(Session.name));
  audits = app.get(getModelToken(AuditEvent.name));
  await users.syncIndexes();
});

afterAll(async () => {
  await app?.close();
  await mongo?.stop();
});

describe('setting up two-step verification', () => {
  it('needs the password and a valid code, stores only encrypted or hashed values, and signs out other devices', async () => {
    const email = uniqueEmail('setup');
    const owner = await register(email);
    const otherDevice = await passwordStep(email);
    expect(otherDevice.res.status).toBe(200);

    const status = await owner.agent.get(`${API}/auth/mfa`).expect(200);
    expect(status.body).toMatchObject({ enabled: false, recoveryCodesRemaining: 0 });

    const wrongPassword = await post(owner, '/auth/mfa/setup').send({
      password: 'not my password',
    });
    expect(wrongPassword.status).toBe(400);
    expect(wrongPassword.body.error.code).toBe('INVALID_CURRENT_PASSWORD');

    const setup = await post(owner, '/auth/mfa/setup').send({ password: PASSWORD }).expect(200);
    const secret = setup.body.secret as string;
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(setup.body.otpauthUri).toContain(`secret=${secret}`);

    const pending = await users.findOne({ email }).select('+mfaPendingSecret +mfaSecret').orFail();
    expect(pending.mfaPendingSecret).not.toContain(secret);
    expect(pending.mfaSecret).toBeNull();
    expect(pending.mfaEnrolledAt).toBeNull();

    const wrongCode = await post(owner, '/auth/mfa/enable').send({ code: '000000' });
    expect(wrongCode.status).toBe(400);
    expect(wrongCode.body.error.code).toBe('INVALID_MFA_CODE');

    const enabled = await post(owner, '/auth/mfa/enable')
      .send({ code: currentCode(secret) })
      .expect(200);
    const codes = enabled.body.recoveryCodes as string[];
    expect(codes).toHaveLength(10);

    const stored = await users
      .findOne({ email })
      .select('+mfaSecret +mfaRecoveryCodeHashes +mfaPendingSecret')
      .orFail();
    expect(stored.mfaEnrolledAt).toBeInstanceOf(Date);
    expect(stored.mfaSecret).not.toContain(secret);
    expect(stored.mfaPendingSecret).toBeNull();
    const storedText = JSON.stringify(stored.mfaRecoveryCodeHashes);
    for (const code of codes) expect(storedText).not.toContain(code.replace('-', '').toUpperCase());

    const me = await owner.agent.get(`${API}/auth/me`).expect(200);
    expect(me.body.user.mfaEnabled).toBe(true);
    await otherDevice.agent.get(`${API}/auth/me`).expect(401);

    const again = await post(owner, '/auth/mfa/setup').send({ password: PASSWORD });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('MFA_ALREADY_ENABLED');
  });

  it('expires an unfinished set-up', async () => {
    const email = uniqueEmail('stale');
    const owner = await register(email);
    const setup = await post(owner, '/auth/mfa/setup').send({ password: PASSWORD }).expect(200);
    await users.updateOne(
      { email },
      { $set: { mfaPendingExpiresAt: new Date(Date.now() - 1000) } },
    );
    const res = await post(owner, '/auth/mfa/enable').send({
      code: currentCode(setup.body.secret),
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MFA_SETUP_EXPIRED');
  });
});

describe('signing in with two-step verification', () => {
  it('grants nothing until the code is entered, and accepts each code only once', async () => {
    const { email, secret } = await enrolledUser();

    const { agent, res } = await passwordStep(email);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ mfaRequired: true });
    await agent.get(`${API}/auth/me`).expect(401);
    await agent.get(`${API}/auth/sessions`).expect(401);
    await agent.get(`${API}/auth/mfa`).expect(401);

    const wrong = await challenge(agent, '000000');
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_MFA_CODE');

    const code = currentCode(secret);
    const ok = await challenge(agent, code).expect(200);
    expect(ok.body.user.email).toBe(email);
    expect(ok.body.csrfToken).toBeDefined();
    await agent.get(`${API}/auth/me`).expect(200);
    expect(
      await sessions.countDocuments({ userId: ok.body.user.id, mfaPending: true, revokedAt: null }),
    ).toBe(0);

    const replay = await passwordStep(email);
    const replayed = await challenge(replay.agent, code);
    expect(replayed.status).toBe(401);
    expect(replayed.body.error.code).toBe('INVALID_MFA_CODE');

    expect(
      await audits.countDocuments({
        action: 'auth.mfa.challenge',
        outcome: 'success',
        'metadata.method': 'totp',
      }),
    ).toBeGreaterThan(0);
  });

  it('accepts each recovery code once', async () => {
    const { email, recoveryCodes } = await enrolledUser();
    const [first] = recoveryCodes;

    const attempt = await passwordStep(email);
    await challenge(attempt.agent, first!.toUpperCase().replace('-', ' ')).expect(200);
    const status = await attempt.agent.get(`${API}/auth/mfa`).expect(200);
    expect(status.body.recoveryCodesRemaining).toBe(9);

    const reuse = await passwordStep(email);
    expect((await challenge(reuse.agent, first!)).status).toBe(401);
  });

  it('rejects a challenge without a pending sign-in, or after it expired', async () => {
    const none = await challenge(request.agent(app.getHttpServer()), '123456');
    expect(none.status).toBe(401);
    expect(none.body.error.code).toBe('MFA_CHALLENGE_EXPIRED');

    const { email, secret } = await enrolledUser();
    const { agent } = await passwordStep(email);
    const user = await users.findOne({ email }).orFail();
    await sessions.updateMany(
      { userId: user._id, mfaPending: true },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    const expired = await challenge(agent, currentCode(secret));
    expect(expired.body.error.code).toBe('MFA_CHALLENGE_EXPIRED');
  });

  it('locks sign-in after repeated wrong codes, even for the right code afterwards', async () => {
    const { email, secret } = await enrolledUser();
    const { agent } = await passwordStep(email);
    for (let i = 0; i < 5; i++) expect((await challenge(agent, '000000')).status).toBe(401);

    const locked = await challenge(agent, currentCode(secret));
    expect(locked.status).toBe(401);
    expect(locked.body.error.code).toBe('MFA_LOCKED');
    expect(String(locked.headers['set-cookie'])).toMatch(/sid=;/);

    expect((await passwordStep(email)).res.status).toBe(401);
  });

  it('does not reset the failure count when the password is re-entered', async () => {
    const { email } = await enrolledUser();
    for (let i = 0; i < 4; i++) {
      const { agent } = await passwordStep(email);
      await challenge(agent, '000000');
    }
    const { agent } = await passwordStep(email);
    await challenge(agent, '000000');
    const user = await users.findOne({ email }).orFail();
    expect(user.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('managing two-step verification', () => {
  it('replaces recovery codes only with a valid code', async () => {
    const { email, owner, secret, recoveryCodes } = await enrolledUser();

    const refused = await post(owner, '/auth/mfa/recovery-codes').send({ code: '000000' });
    expect(refused.body.error.code).toBe('INVALID_MFA_CODE');

    const fresh = await post(owner, '/auth/mfa/recovery-codes')
      .send({ code: currentCode(secret) })
      .expect(200);
    expect(fresh.body.recoveryCodes).toHaveLength(10);

    const oldCode = await passwordStep(email);
    expect((await challenge(oldCode.agent, recoveryCodes[0]!)).status).toBe(401);
    const newCode = await passwordStep(email);
    await challenge(newCode.agent, fresh.body.recoveryCodes[0]).expect(200);
  });

  it('turns off only with the password and a code', async () => {
    const { email, owner, secret } = await enrolledUser();

    const badPassword = await post(owner, '/auth/mfa/disable').send({
      password: 'not my password',
      code: currentCode(secret),
    });
    expect(badPassword.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    const badCode = await post(owner, '/auth/mfa/disable').send({
      password: PASSWORD,
      code: '000000',
    });
    expect(badCode.body.error.code).toBe('INVALID_MFA_CODE');

    await post(owner, '/auth/mfa/disable')
      .send({ password: PASSWORD, code: currentCode(secret) })
      .expect(204);
    const after = await users
      .findOne({ email })
      .select('+mfaSecret +mfaRecoveryCodeHashes')
      .orFail();
    expect(after.mfaEnrolledAt).toBeNull();
    expect(after.mfaSecret).toBeNull();
    expect(after.mfaRecoveryCodeHashes).toEqual([]);

    const login = await passwordStep(email);
    expect(login.res.body.user.email).toBe(email);
  });

  it('rejects malformed codes and requests from other sites', async () => {
    const { owner } = await enrolledUser();
    await post(owner, '/auth/mfa/recovery-codes')
      .send({ code: { $ne: '' } })
      .expect(400);
    await post(owner, '/auth/mfa/recovery-codes').send({ code: '12' }).expect(400);
    await owner.agent
      .post(`${API}/auth/mfa/disable`)
      .set('Origin', TEST_ORIGIN)
      .send({ password: PASSWORD, code: '123456' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`${API}/auth/mfa/challenge`)
      .set('Origin', 'https://evil.example')
      .send({ code: '123456' })
      .expect(403);
  });
});

describe('staff accounts in production', () => {
  const PROD_ORIGIN = 'https://app.sukoon.test';
  let prod: NestExpressApplication;

  /** Production cookies are Secure, which the test agent will not resend over plain HTTP. */
  const sessionCookie = (res: Response) =>
    String(res.headers['set-cookie'] ?? '')
      .split(';')[0]!
      .trim();

  const prodPost = (path: string, cookie: string, csrf?: string) => {
    const req = request(prod.getHttpServer())
      .post(`${API}${path}`)
      .set('Origin', PROD_ORIGIN)
      .set('Cookie', cookie);
    return csrf ? req.set('X-CSRF-Token', csrf) : req;
  };
  const prodGet = (path: string, cookie: string) =>
    request(prod.getHttpServer()).get(`${API}${path}`).set('Cookie', cookie);

  beforeAll(async () => {
    ({ app: prod } = await createTestApp(mongo.getUri(), 'sukoon_e2e_mfa', {
      NODE_ENV: 'production',
      CORS_ORIGINS: PROD_ORIGIN,
      APP_BASE_URL: PROD_ORIGIN,
      MAIL_TRANSPORT: 'disabled',
      MFA_ENCRYPTION_KEY: 'p'.repeat(43),
      MONGODB_DB_NAME: 'sukoon_e2e_mfa',
    }));
  });

  afterAll(async () => {
    await prod?.close();
  });

  it.skip('withholds staff permissions until the session passes two-step verification', async () => {
    const email = uniqueEmail('staff');
    await users.create({
      email,
      fullName: 'Synthetic Admin',
      passwordHash: await app.get(PasswordService).hash(PASSWORD),
      roles: ['platform_admin'],
      passwordChangedAt: new Date(),
      termsAcceptedVersion: 'test',
      privacyNoticeAcceptedVersion: 'test',
      termsAcceptedAt: new Date(),
    });

    const login = await request(prod.getHttpServer())
      .post(`${API}/auth/login`)
      .set('Origin', PROD_ORIGIN)
      .send({ email, password: PASSWORD })
      .expect(200);
    expect(login.headers['set-cookie']?.[0]).toMatch(/^__Host-sid=.*Secure/);
    expect(login.body.user.staffMfaRequired).toBe(true);
    expect(login.body.user.permissions).toEqual(['account:self:manage']);
    const cookie = sessionCookie(login);
    const csrf = login.body.csrfToken as string;

    const blocked = await prodGet('/admin/users', cookie).expect(403);
    expect(blocked.body.error.code).toBe('MFA_REQUIRED');

    const setup = await prodPost('/auth/mfa/setup', cookie, csrf)
      .send({ password: PASSWORD })
      .expect(200);
    await prodPost('/auth/mfa/enable', cookie, csrf)
      .send({ code: currentCode(setup.body.secret) })
      .expect(200);
    await prodGet('/admin/users', cookie).expect(200);
    const me = await prodGet('/auth/me', cookie).expect(200);
    expect(me.body.user.staffMfaRequired).toBe(false);

    const status = await prodGet('/auth/mfa', cookie).expect(200);
    expect(status.body.canDisable).toBe(false);
    await nextWindow(email);
    const disable = await prodPost('/auth/mfa/disable', cookie, csrf).send({
      password: PASSWORD,
      code: currentCode(setup.body.secret),
    });
    expect(disable.status).toBe(403);
    expect(disable.body.error.code).toBe('MFA_MANDATORY');

    const second = await request(prod.getHttpServer())
      .post(`${API}/auth/login`)
      .set('Origin', PROD_ORIGIN)
      .send({ email, password: PASSWORD })
      .expect(200);
    expect(second.body).toEqual({ mfaRequired: true });
    const pendingCookie = sessionCookie(second);
    await prodGet('/admin/users', pendingCookie).expect(401);

    await nextWindow(email);
    const verified = await prodPost('/auth/mfa/challenge', pendingCookie)
      .send({ code: currentCode(setup.body.secret) })
      .expect(200);
    expect(verified.body.user.staffMfaRequired).toBe(false);
    await prodGet('/admin/users', sessionCookie(verified)).expect(200);
  });
});
