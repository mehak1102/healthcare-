import { getModelToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { DoctorProfile } from '../src/modules/doctors/doctor-profile.schema';
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

async function seedVerifiedDoctorProfile(
  app: NestExpressApplication,
  doctor: SignedIn,
  homeVisitServicePinCode: string,
) {
  const profiles = app.get(getModelToken(DoctorProfile.name)) as Model<DoctorProfile>;
  await profiles.create({
    userId: new Types.ObjectId(doctor.id),
    applicationId: new Types.ObjectId(),
    slug: `dr-hv-${doctor.id.slice(-8)}`,
    displayName: 'Home Visit Doctor',
    specialty: 'General Physician',
    specialtyKey: 'general physician',
    qualification: 'MBBS',
    registrationNumber: 'REG12345',
    registrationCouncil: 'Delhi Medical Council',
    registrationYear: 2015,
    registrationCheckedAt: new Date(),
    homeVisitServicePinCode,
    homeVisitFeeInr: 1499,
    availabilityStatus: 'available',
  });
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
      pinCode: '110001',
      stateCode: 'DL',
      label: 'Pilot',
      active: true,
    });
  });

  it('quotes a pilot PIN but rejects create', async () => {
    const patient = await registerPatient(app);
    const quote = await post(patient, '/home-visits/quote')
      .send({ pin: '110001', preferredWindow: 'morning' })
      .expect(200);
    expect(quote.body.bookingOpen).toBe(false);
    expect(quote.body.inPilotArea).toBe(true);

    const denied = await post(patient, '/home-visits')
      .send({
        pin: '110001',
        addressLine1: '12 Test Street',
        chiefComplaint: 'Fever since yesterday evening',
        preferredWindow: 'asap',
        doctorUserId: '507f1f77bcf86cd799439011',
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
      pinCode: '110016',
      stateCode: 'DL',
      label: 'Pilot 2',
      active: true,
    });
  });

  it('creates a request, lists for ops, and doctor accepts dispatch offer', async () => {
    const doctor = await signInDoctor(app, users);
    await seedVerifiedDoctorProfile(app, doctor, '110016');
    const patient = await registerPatient(app);
    const created = await post(patient, '/home-visits')
      .send({
        pin: '110016',
        addressLine1: '45 Sample Road',
        chiefComplaint: 'Persistent cough for three days',
        preferredWindow: 'afternoon',
        doctorUserId: doctor.id,
      })
      .expect(200);
    expect(created.body.status).toBe('offered');

    const ops = await signInOps(app, users);
    const list = await ops.agent.get(`${API}/ops/home-visits`).expect(200);
    expect(list.body.total).toBe(1);

    const offers = await doctor.agent
      .get(`${API}/provider/home-visits/dispatch-offers`)
      .expect(200);
    expect(offers.body.items.length).toBe(1);
    const offerId = offers.body.items[0].offer.id as string;

    const accepted = await post(doctor, `/provider/dispatch-offers/${offerId}/accept`)
      .expect(200);
    expect(accepted.body.status).toBe('accepted');

    const mine = await patient.agent.get(`${API}/home-visits/mine`).expect(200);
    expect(mine.body.items[0].status).toBe('accepted');
  });

  it('cancels an unpaid request before dispatch', async () => {
    const doctor = await signInDoctor(app, users);
    await seedVerifiedDoctorProfile(app, doctor, '110016');
    const patient = await registerPatient(app);
    const created = await post(patient, '/home-visits')
      .send({
        pin: '110016',
        addressLine1: '9 Cancel Lane',
        chiefComplaint: 'Mild headache for two days',
        preferredWindow: 'morning',
        doctorUserId: doctor.id,
      })
      .expect(200);
    expect(created.body.status).toBe('offered');

    const cancelled = await post(patient, `/home-visits/mine/${created.body.id}/cancel`).expect(200);
    expect(cancelled.body.status).toBe('cancelled');
  });

  it('runs en route → arrived → completed after accept', async () => {
    const doctor = await signInDoctor(app, users);
    await seedVerifiedDoctorProfile(app, doctor, '110016');
    const patient = await registerPatient(app);
    const created = await post(patient, '/home-visits')
      .send({
        pin: '110016',
        addressLine1: '88 Status Road',
        chiefComplaint: 'Follow up after fever resolved',
        preferredWindow: 'evening',
        doctorUserId: doctor.id,
      })
      .expect(200);

    const offers = await doctor.agent
      .get(`${API}/provider/home-visits/dispatch-offers`)
      .expect(200);
    const offerId = offers.body.items[0].offer.id as string;
    await post(doctor, `/provider/dispatch-offers/${offerId}/accept`).expect(200);

    const afterAccept = await patient.agent
      .get(`${API}/home-visits/mine/${created.body.id}`)
      .expect(200);
    expect(afterAccept.body.arrivalVerificationCode).toMatch(/^\d{6}$/);

    await post(doctor, `/provider/home-visits/${created.body.id}/status`)
      .send({ status: 'en_route', lat: 28.6139, lng: 77.209 })
      .expect(200);
    const enRoute = await patient.agent
      .get(`${API}/home-visits/mine/${created.body.id}`)
      .expect(200);
    expect(enRoute.body.status).toBe('en_route');
    expect(enRoute.body.tracking?.mode).toBe('live_gps');
    expect(enRoute.body.arrivalVerificationCode).toBe(afterAccept.body.arrivalVerificationCode);

    await post(doctor, `/provider/home-visits/${created.body.id}/status`)
      .send({ status: 'arrived' })
      .expect(400);

    await post(doctor, `/provider/home-visits/${created.body.id}/verify-arrival`)
      .send({ code: afterAccept.body.arrivalVerificationCode })
      .expect(200);
    await post(doctor, `/provider/home-visits/${created.body.id}/status`)
      .send({ status: 'completed' })
      .expect(200);
    const done = await patient.agent.get(`${API}/home-visits/mine/${created.body.id}`).expect(200);
    expect(done.body.status).toBe('completed');
  });

  afterAll(async () => {
    await app?.close();
  });
});
