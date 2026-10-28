import { getModelToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { Role } from '../src/modules/access-control/roles';
import { PasswordService } from '../src/modules/auth/password.service';
import { ServiceArea } from '../src/modules/home-visits/service-area.schema';
import { User } from '../src/modules/users/user.schema';
import { createTestApp, TEST_ORIGIN } from './test-app';

const PASSWORD = 'quiet river morning tea';
const API = '/api/v1';

let mongo: MongoMemoryReplSet;
let app: NestExpressApplication;
let users: Model<User>;
let areas: Model<ServiceArea>;
let counter = 0;

const uniqueEmail = () => `ops.${Date.now()}.${counter++}@example.test`;

interface SignedIn {
  agent: TestAgent;
  csrf: string;
}

async function signInAs(roles: Role[]): Promise<SignedIn> {
  const email = uniqueEmail();
  await users.create({
    email,
    fullName: 'Ops tester',
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
    .send({ email, password: PASSWORD, portal: 'staff' })
    .expect(200);
  return { agent, csrf: res.body.csrfToken as string };
}

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  ({ app } = await createTestApp(mongo.getUri(), 'sukoon_e2e_ops'));
  users = app.get(getModelToken(User.name));
  areas = app.get(getModelToken(ServiceArea.name));
});

afterAll(async () => {
  await app?.close();
  await mongo?.stop();
});

describe('operations dashboard', () => {
  it('returns a summary for operations staff and platform admins', async () => {
    await areas.create({
      pinCode: '110001',
      stateCode: 'DL',
      label: 'Ops e2e pin',
      active: true,
    });

    const ops = await signInAs(['operations_staff']);
    const res = await ops.agent.get(`${API}/ops/summary`).expect(200);
    expect(res.body.timezone).toBe('Asia/Kolkata');
    expect(res.body.homeVisits.pilotPinCount).toBeGreaterThanOrEqual(1);
    expect(res.body.homeVisits.bookingOpen).toBe(false);
    expect(res.body.integrations).toMatchObject({
      videoCalls: expect.any(Boolean),
      paymentWebhooks: expect.any(Boolean),
    });

    const admin = await signInAs(['platform_admin']);
    await admin.agent.get(`${API}/ops/summary`).expect(200);
  });

  it('denies patients and unauthenticated callers', async () => {
    await request(app.getHttpServer()).get(`${API}/ops/summary`).expect(401);

    const email = uniqueEmail();
    await users.create({
      email,
      fullName: 'Patient',
      passwordHash: await app.get(PasswordService).hash(PASSWORD),
      roles: ['patient'],
      passwordChangedAt: new Date(),
      termsAcceptedVersion: 'test',
      privacyNoticeAcceptedVersion: 'test',
      termsAcceptedAt: new Date(),
    });
    const patientAgent = request.agent(app.getHttpServer());
    await patientAgent
      .post(`${API}/auth/login`)
      .set('Origin', TEST_ORIGIN)
      .send({ email, password: PASSWORD })
      .expect(200);
    await patientAgent.get(`${API}/ops/summary`).expect(403);
  });
});
