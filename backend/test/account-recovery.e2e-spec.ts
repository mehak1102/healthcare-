import { getModelToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { AuditEvent } from '../src/modules/audit/audit-event.schema';
import { AccountToken } from '../src/modules/auth/account-token.schema';
import { Session } from '../src/modules/auth/session.schema';
import { createTestApp, TEST_ORIGIN } from './test-app';
import { tokenFromLink, type TestMailbox } from './test-mailbox';

const PASSWORD = 'quiet river morning tea';
const NEW_PASSWORD = 'lantern harbour evening walk';
const API = '/api/v1';
const RESET_SUBJECT = /Reset your/;
const VERIFY_SUBJECT = /Confirm your email/;

let mongo: MongoMemoryReplSet;
let app: NestExpressApplication;
let mailbox: TestMailbox;
let tokens: Model<AccountToken>;
let audits: Model<AuditEvent>;
let sessions: Model<Session>;
let counter = 0;

const uniqueEmail = (label: string) => `${label}.${Date.now()}.${counter++}@example.test`;
const server = () => app.getHttpServer();
const post = (path: string) => request(server()).post(`${API}${path}`).set('Origin', TEST_ORIGIN);

async function register(agent: TestAgent, email: string) {
  const res = await agent
    .post(`${API}/auth/register`)
    .set('Origin', TEST_ORIGIN)
    .send({ fullName: 'Recovery Tester', email, password: PASSWORD, acceptTerms: true })
    .expect(201);
  return res.body.csrfToken as string;
}

const login = (email: string, password: string) => post('/auth/login').send({ email, password });

async function resetToken(email: string): Promise<string> {
  await post('/auth/password-reset/request').send({ email }).expect(204);
  return tokenFromLink(await mailbox.waitFor(email, RESET_SUBJECT), '/reset-password');
}

async function eventually(check: () => Promise<boolean>, timeoutMs = 3_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  ({ app, mailbox } = await createTestApp(mongo.getUri(), 'sukoon_e2e_recovery'));
  tokens = app.get(getModelToken(AccountToken.name));
  audits = app.get(getModelToken(AuditEvent.name));
  sessions = app.get(getModelToken(Session.name));
  await tokens.syncIndexes();
});

afterAll(async () => {
  await app?.close();
  await mongo?.stop();
});

describe('password reset', () => {
  it('answers identically for unknown accounts, works once, and signs out every device', async () => {
    const email = uniqueEmail('reset');
    const signedIn = request.agent(server());
    await register(signedIn, email);

    const unknown = uniqueEmail('nobody');
    const unknownRes = await post('/auth/password-reset/request').send({ email: unknown });
    const knownRes = await post('/auth/password-reset/request').send({ email });
    expect(unknownRes.status).toBe(204);
    expect(knownRes.status).toBe(204);
    expect(unknownRes.body).toEqual(knownRes.body);

    const token = tokenFromLink(await mailbox.waitFor(email, RESET_SUBJECT), '/reset-password');
    expect(mailbox.count(unknown)).toBe(0);
    expect(await tokens.countDocuments({ tokenHash: token })).toBe(0);

    const weak = await post('/auth/password-reset/confirm').send({
      token,
      newPassword: `${email.split('@')[0]}-password`,
    });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('VALIDATION_FAILED');

    await post('/auth/password-reset/confirm')
      .send({ token, newPassword: NEW_PASSWORD })
      .expect(204);

    const used = await tokens.findOne({ email, purpose: 'password_reset' }).orFail();
    expect(used.usedAt).toBeInstanceOf(Date);
    expect(await sessions.countDocuments({ userId: used.userId, revokedAt: null })).toBe(0);
    await signedIn.get(`${API}/auth/me`).expect(401);
    expect((await login(email, PASSWORD)).status).toBe(401);
    expect((await login(email, NEW_PASSWORD)).status).toBe(200);

    const reused = await post('/auth/password-reset/confirm').send({
      token,
      newPassword: PASSWORD,
    });
    expect(reused.status).toBe(400);
    expect(reused.body.error.code).toBe('INVALID_OR_EXPIRED_LINK');

    await eventually(
      async () =>
        (await audits.countDocuments({
          action: 'auth.password_reset.request',
          'metadata.reason': 'unknown_account',
        })) > 0,
    );
    expect(await audits.countDocuments({ action: 'auth.password_reset.complete' })).toBeGreaterThan(
      0,
    );
  });

  it('lifts a lockout once the password is reset', async () => {
    const email = uniqueEmail('locked');
    await register(request.agent(server()), email);
    for (let i = 0; i < 5; i++) await login(email, 'wrong password attempt');
    expect((await login(email, PASSWORD)).status).toBe(401);

    const token = await resetToken(email);
    await post('/auth/password-reset/confirm')
      .send({ token, newPassword: NEW_PASSWORD })
      .expect(204);
    expect((await login(email, NEW_PASSWORD)).status).toBe(200);
  });

  it('invalidates older links and rejects expired ones', async () => {
    const email = uniqueEmail('expiry');
    await register(request.agent(server()), email);

    const first = await resetToken(email);
    await post('/auth/password-reset/request').send({ email }).expect(204);
    await eventually(async () => mailbox.count(email, RESET_SUBJECT) === 2);
    const second = tokenFromLink(await mailbox.waitFor(email, RESET_SUBJECT), '/reset-password');
    expect(second).not.toBe(first);

    const stale = await post('/auth/password-reset/confirm').send({
      token: first,
      newPassword: NEW_PASSWORD,
    });
    expect(stale.body.error.code).toBe('INVALID_OR_EXPIRED_LINK');

    await tokens.updateMany(
      { email, usedAt: null },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    const expired = await post('/auth/password-reset/confirm').send({
      token: second,
      newPassword: NEW_PASSWORD,
    });
    expect(expired.body.error.code).toBe('INVALID_OR_EXPIRED_LINK');
  });

  it('validates input and rejects other sites', async () => {
    const malformed = await post('/auth/password-reset/confirm').send({
      token: 'not-a-real-token',
      newPassword: NEW_PASSWORD,
    });
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('INVALID_OR_EXPIRED_LINK');

    await post('/auth/password-reset/request').send({ email: 'not-an-email' }).expect(400);
    await post('/auth/password-reset/request')
      .send({ email: { $gt: '' } })
      .expect(400);
    await post('/auth/password-reset/request')
      .send({ email: uniqueEmail('extra'), role: 'super_admin' })
      .expect(400);

    await request(server())
      .post(`${API}/auth/password-reset/request`)
      .set('Origin', 'https://evil.example')
      .send({ email: uniqueEmail('csrf') })
      .expect(403);
  });
});

describe('email verification', () => {
  it('sends a link on registration that verifies the address once', async () => {
    const email = uniqueEmail('verify');
    const agent = request.agent(server());
    await register(agent, email);

    const me = await agent.get(`${API}/auth/me`).expect(200);
    expect(me.body.user.emailVerified).toBe(false);

    const token = tokenFromLink(await mailbox.waitFor(email, VERIFY_SUBJECT), '/verify-email');
    await post('/auth/email-verification/confirm').send({ token }).expect(204);

    const after = await agent.get(`${API}/auth/me`).expect(200);
    expect(after.body.user.emailVerified).toBe(true);

    const reused = await post('/auth/email-verification/confirm').send({ token });
    expect(reused.body.error.code).toBe('INVALID_OR_EXPIRED_LINK');
  });

  it('resends on request, invalidating the previous link, and is a no-op once verified', async () => {
    const email = uniqueEmail('resend');
    const agent = request.agent(server());
    const csrf = await register(agent, email);
    const original = tokenFromLink(await mailbox.waitFor(email, VERIFY_SUBJECT), '/verify-email');

    await agent
      .post(`${API}/auth/email-verification/request`)
      .set('Origin', TEST_ORIGIN)
      .expect(403);
    await agent
      .post(`${API}/auth/email-verification/request`)
      .set('Origin', TEST_ORIGIN)
      .set('X-CSRF-Token', csrf)
      .expect(204);
    const fresh = tokenFromLink(await mailbox.waitFor(email, VERIFY_SUBJECT), '/verify-email');
    expect(fresh).not.toBe(original);

    const stale = await post('/auth/email-verification/confirm').send({ token: original });
    expect(stale.body.error.code).toBe('INVALID_OR_EXPIRED_LINK');
    await post('/auth/email-verification/confirm').send({ token: fresh }).expect(204);

    const sent = mailbox.count(email, VERIFY_SUBJECT);
    await agent
      .post(`${API}/auth/email-verification/request`)
      .set('Origin', TEST_ORIGIN)
      .set('X-CSRF-Token', csrf)
      .expect(204);
    expect(mailbox.count(email, VERIFY_SUBJECT)).toBe(sent);
  });

  it('requires sign-in to request a verification email', async () => {
    await post('/auth/email-verification/request').expect(401);
  });
});

describe('when email delivery is disabled', () => {
  it('fails closed with the same answer for every address', async () => {
    const { app: noMail } = await createTestApp(mongo.getUri(), 'sukoon_e2e_recovery', {
      MAIL_TRANSPORT: 'disabled',
    });
    try {
      const email = uniqueEmail('nomail');
      await request(noMail.getHttpServer())
        .post(`${API}/auth/register`)
        .set('Origin', TEST_ORIGIN)
        .send({ fullName: 'No Mail', email, password: PASSWORD, acceptTerms: true })
        .expect(201);

      for (const address of [email, uniqueEmail('nomail-unknown')]) {
        const res = await request(noMail.getHttpServer())
          .post(`${API}/auth/password-reset/request`)
          .set('Origin', TEST_ORIGIN)
          .send({ email: address });
        expect(res.status).toBe(503);
        expect(res.body.error.code).toBe('EMAIL_UNAVAILABLE');
      }
    } finally {
      await noMail.close();
    }
  });
});
