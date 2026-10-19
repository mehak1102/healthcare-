import { getModelToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { PasswordService } from '../src/modules/auth/password.service';
import { ServiceArea } from '../src/modules/home-visits/service-area.schema';
import { User } from '../src/modules/users/user.schema';
import { createTestApp, TEST_ORIGIN } from './test-app';

const PASSWORD = 'quiet river morning tea';
const API = '/api/v1';

let mongo: MongoMemoryReplSet;
let counter = 0;

const uniqueEmail = () => `hv.${Date.now()}.${counter++}@example.test`;

interface SignedIn {
  agent: TestAgent;
  csrf: string;
  id: string;
}

async function registerPatient(app: NestExpressApplication): Promise<SignedIn> {
  const email = uniqueEmail();
  const agent = request.agent(app.getHttpServer());
  const res = await agent
    .post(`${API}/auth/register`)
    .set('Origin', TEST_ORIGIN)
    .send({
      fullName: 'Home Visit Patient',
      email,
      password: PASSWORD,
      acceptTerms: true,
      accountType: 'patient',
    })
    .expect(201);
  return { agent, csrf: res.body.csrfToken as string, id: res.body.user.id as string };
}

async function signInDoctor(
  app: NestExpressApplication,
  users: Model<User>,
): Promise<SignedIn> {
  const email = uniqueEmail();
  const created = await users.create({
    email,
    fullName: 'Home Visit Doctor',
    passwordHash: await app.get(PasswordService).hash(PASSWORD),
    roles: ['doctor'],
    passwordChangedAt: new Date(),
    termsAcceptedVersion: 'test',
    privacyNoticeAcceptedVersion: 'test',
    termsAcceptedAt: new Date(),
  });
  const agent = request.agent(app.getHttpServer());
  const res = await agent
    .post(`${API}/auth/login`)
    .set('Origin', TEST_ORIGIN)
    .send({ email, password: PASSWORD, portal: 'doctor' })
    .expect(200);
  return { agent, csrf: res.body.csrfToken as string, id: created.id };
}

async function signInOps(app: NestExpressApplication, users: Model<User>): Promise<SignedIn> {
  const email = uniqueEmail();
  const created = await users.create({
    email,
    fullName: 'Ops',
    passwordHash: await app.get(PasswordService).hash(PASSWORD),
    roles: ['operations_staff'],
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
  return { agent, csrf: res.body.csrfToken as string, id: created.id };
}

const post = (who: SignedIn, path: string) =>
  who.agent.post(`${API}${path}`).set('Origin', TEST_ORIGIN).set('X-CSRF-Token', who.csrf);

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
});

afterAll(async () => {
  await mongo?.stop();
});

describe('home visit requests (booking closed)', () => {
  let app: NestExpressApplication;
  let areas: Model<ServiceArea>;

  beforeAll(async () => {
    ({ app } = await createTestApp(mongo.getUri(), 'sukoon_e2e_hv_closed'));
    areas = app.get(getModelToken(ServiceArea.name));
    await areas.create({
      pinCode: '560001',
      stateCode: 'KA',
      label: 'Pilot',
      active: true,
    });
  });

  it('quotes a pilot PIN but rejects create', async () => {
    const patient = await registerPatient(app);
    const quote = await post(patient, '/home-visits/quote')
      .send({ pin: '560001', preferredWindow: 'morning' })
      .expect(200);
    expect(quote.body.bookingOpen).toBe(false);
    expect(quote.body.fee.amountMinor).toBe(149_900);

    const denied = await post(patient, '/home-visits')
      .send({
        pin: '560001',
        addressLine1: '12 Test Street',
        chiefComplaint: 'Fever since yesterday evening',
        preferredWindow: 'asap',
      })
      .expect(503);
    expect(denied.body.error.code).toBe('HOME_VISITS_NOT_OPEN');
  });

  afterAll(async () => {
    await app?.close();
  });
});

describe('home visit requests (booking open)', () => {
  let app: NestExpressApplication;
  let users: Model<User>;
  let areas: Model<ServiceArea>;

  beforeAll(async () => {
    ({ app } = await createTestApp(mongo.getUri(), 'sukoon_e2e_hv_open', {
      HOME_VISIT_BOOKING_OPEN: 'true',
    }));
    users = app.get(getModelToken(User.name));
    areas = app.get(getModelToken(ServiceArea.name));
    await areas.create({
      pinCode: '560002',
      stateCode: 'KA',
      label: 'Pilot 2',
      active: true,
    });
  });

  it('creates a request, lists for ops, reassigns and accepts', async () => {
    const patient = await registerPatient(app);
    const created = await post(patient, '/home-visits')
      .send({
        pin: '560002',
        addressLine1: '45 Sample Road',
        chiefComplaint: 'Persistent cough for three days',
        preferredWindow: 'afternoon',
      })
      .expect(200);
    expect(created.body.status).toBe('requested');

    const ops = await signInOps(app, users);
    const list = await ops.agent.get(`${API}/ops/home-visits`).expect(200);
    expect(list.body.total).toBe(1);

    const doctor = await signInDoctor(app, users);
    const reassigned = await post(ops, `/ops/home-visits/${created.body.id}/reassign`)
      .send({ doctorUserId: doctor.id, note: 'Nearest available' })
      .expect(201);
    expect(reassigned.body.request.status).toBe('offered');

    const accepted = await post(doctor, `/provider/dispatch-offers/${reassigned.body.offer.id}/accept`)
      .expect(200);
    expect(accepted.body.status).toBe('accepted');

    const mine = await patient.agent.get(`${API}/home-visits/mine`).expect(200);
    expect(mine.body.items[0].status).toBe('accepted');
  });

  afterAll(async () => {
    await app?.close();
  });
});
