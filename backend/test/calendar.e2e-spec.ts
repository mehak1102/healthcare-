import { getModelToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { Role } from '../src/modules/access-control/roles';
import { PasswordService } from '../src/modules/auth/password.service';
import { User } from '../src/modules/users/user.schema';
import { createTestApp, TEST_ORIGIN } from './test-app';

const API = '/api/v1';
const PASSWORD = 'quiet river morning tea';

let mongo: MongoMemoryReplSet;
let app: NestExpressApplication;
let users: Model<User>;
let counter = 0;

const uniqueEmail = () => `staff.${Date.now()}.${counter++}@example.test`;

interface SignedIn {
  agent: TestAgent;
  csrf: string;
}

async function signInAs(roles: Role[]): Promise<SignedIn> {
  const email = uniqueEmail();
  await users.create({
    email,
    fullName: 'Catalog Admin',
    passwordHash: await app.get(PasswordService).hash(PASSWORD),
    roles,
    passwordChangedAt: new Date(),
    termsAcceptedVersion: 'test',
    privacyNoticeAcceptedVersion: 'test',
    termsAcceptedAt: new Date(),
  });
  const agent = request.agent(app.getHttpServer());
  const res = await agent
    .post(`${API}/auth/login`)
    .set('Origin', TEST_ORIGIN)
    .send({ email, password: PASSWORD })
    .expect(200);
  return { agent, csrf: res.body.csrfToken as string };
}

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  ({ app } = await createTestApp(mongo.getUri(), 'sukoon_e2e_calendar'));
  users = app.get(getModelToken(User.name));
});

afterAll(async () => {
  await app?.close();
  await mongo?.stop();
});

describe('calendar', () => {
  it('lists India public holidays without auth', async () => {
    const res = await request(app.getHttpServer())
      .get(`${API}/calendar/public-holidays?from=2026-10-01&days=10`)
      .expect(200);
    expect(res.body.region).toBe('IN');
    expect(res.body.timezone).toBe('Asia/Kolkata');
    expect(res.body.source).toBe('static');
    expect(res.body.items.some((row: { date: string }) => row.date === '2026-10-02')).toBe(true);
  });

  it('lets catalog admins manage holidays and switches the public list to database', async () => {
    const admin = await signInAs(['platform_admin']);
    const created = await admin.agent
      .post(`${API}/admin/public-holidays`)
      .set('Origin', TEST_ORIGIN)
      .set('X-CSRF-Token', admin.csrf)
      .send({ date: '2028-01-26', name: 'Republic Day' })
      .expect(201);

    const listed = await admin.agent
      .get(`${API}/admin/public-holidays`)
      .set('Origin', TEST_ORIGIN)
      .expect(200);
    expect(listed.body.some((row: { date: string }) => row.date === '2028-01-26')).toBe(true);

    const publicList = await request(app.getHttpServer())
      .get(`${API}/calendar/public-holidays?from=2028-01-01&days=60`)
      .expect(200);
    expect(publicList.body.source).toBe('database');
    expect(publicList.body.items.some((row: { date: string }) => row.date === '2028-01-26')).toBe(
      true,
    );

    await admin.agent
      .delete(`${API}/admin/public-holidays/${created.body.id}`)
      .set('Origin', TEST_ORIGIN)
      .set('X-CSRF-Token', admin.csrf)
      .expect(200);
  });

  it('denies patients the admin holiday list', async () => {
    const email = uniqueEmail();
    const agent = request.agent(app.getHttpServer());
    await agent
      .post(`${API}/auth/register`)
      .set('Origin', TEST_ORIGIN)
      .send({
        fullName: 'Patient',
        email,
        password: PASSWORD,
        acceptTerms: true,
      })
      .expect(201);
    await agent.get(`${API}/admin/public-holidays`).set('Origin', TEST_ORIGIN).expect(403);
  });
});
