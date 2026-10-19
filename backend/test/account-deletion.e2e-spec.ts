import { getModelToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { type Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { Appointment } from '../src/modules/appointments/appointment.schema';
import { DoctorSchedule } from '../src/modules/appointments/doctor-schedule.schema';
import { addDays, istDate } from '../src/modules/appointments/ist-time';
import { SlotReservation } from '../src/modules/appointments/slot-reservation.schema';
import type { Role } from '../src/modules/access-control/roles';
import { AuditEvent } from '../src/modules/audit/audit-event.schema';
import { base32Decode, hotp, totpStep } from '../src/modules/auth/mfa/totp';
import { PasswordService } from '../src/modules/auth/password.service';
import { Session } from '../src/modules/auth/session.schema';
import { DoctorApplication } from '../src/modules/doctors/doctor-application.schema';
import { DoctorProfile } from '../src/modules/doctors/doctor-profile.schema';
import { User } from '../src/modules/users/user.schema';
import { createTestApp, TEST_ORIGIN } from './test-app';

const PASSWORD = 'quiet river morning tea';
const API = '/api/v1';
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  start: '00:00',
  end: '23:55',
  slotMinutes: 15,
  mode: 'clinic',
}));

let mongo: MongoMemoryReplSet;
let app: NestExpressApplication;
let users: Model<User>;
let sessions: Model<Session>;
let audits: Model<AuditEvent>;
let applications: Model<DoctorApplication>;
let profiles: Model<DoctorProfile>;
let schedules: Model<DoctorSchedule>;
let appointments: Model<Appointment>;
let counter = 0;

interface SignedIn {
  agent: TestAgent;
  csrf: string;
  email: string;
}

const uniqueEmail = (label: string) => `${label}.${Date.now()}.${counter++}@example.test`;
const server = () => request(app.getHttpServer());
const send = (who: SignedIn, method: 'post' | 'put', path: string) =>
  who.agent[method](`${API}${path}`).set('Origin', TEST_ORIGIN).set('X-CSRF-Token', who.csrf);
const deleteAccount = (who: SignedIn, body: Record<string, unknown> = { password: PASSWORD }) =>
  send(who, 'post', '/account/delete').send(body);
const userId = async (email: string) => (await users.findOne({ email }).exec())!._id;

async function register(email = uniqueEmail('person')): Promise<SignedIn> {
  const agent = request.agent(app.getHttpServer());
  const res = await agent
    .post(`${API}/auth/register`)
    .set('Origin', TEST_ORIGIN)
    .send({ fullName: 'Synthetic Person', email, password: PASSWORD, acceptTerms: true })
    .expect(201);
  return { agent, csrf: res.body.csrfToken as string, email };
}

async function signInAs(roles: Role[]): Promise<SignedIn> {
  const email = uniqueEmail('staff');
  await users.create({
    email,
    fullName: 'Synthetic Staff',
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
  return { agent, csrf: res.body.csrfToken as string, email };
}

async function freeDoctor(): Promise<SignedIn & { slug: string }> {
  const doctor = await register(uniqueEmail('doctor'));
  const applied = await send(doctor, 'post', '/doctor-applications')
    .send({
      registrationNumber: `TEST-${Date.now()}-${counter++}`,
      registrationCouncil: 'Karnataka Medical Council',
      registrationYear: 2015,
      qualification: 'MBBS',
      specialty: 'General Physician',
    })
    .expect(201);
  const admin = await signInAs(['platform_admin']);
  await send(admin, 'post', `/admin/doctor-applications/${applied.body.id}/approve`)
    .send({ registerChecked: true })
    .expect(200);
  const profile = await send(doctor, 'put', '/doctor-profile/me')
    .send({
      bio: 'Synthetic test doctor used only by automated deletion tests. Not a real person.',
      languages: ['English'],
      consultationModes: ['clinic'],
      consultationFeeInr: 0,
      clinicName: 'Test Clinic',
      city: 'Testpur',
      published: true,
    })
    .expect(200);
  await doctor.agent
    .patch(`${API}/doctor-profile/me/availability`)
    .set('Origin', TEST_ORIGIN)
    .set('X-CSRF-Token', doctor.csrf)
    .send({ availabilityStatus: 'available' })
    .expect(200);
  await send(doctor, 'put', '/doctor-schedule/me')
    .send({ rules: EVERY_DAY, daysOff: [] })
    .expect(200);
  return { ...doctor, slug: profile.body.slug as string };
}

async function bookFree(patient: SignedIn, slug: string) {
  const from = addDays(istDate(new Date()), 1);
  const slots = await server().get(`${API}/doctors/${slug}/slots?from=${from}&days=1`).expect(200);
  const slot = slots.body.days[0].slots[0] as { startsAt: string };
  const res = await send(patient, 'post', '/appointments')
    .set('Idempotency-Key', randomUUID())
    .send({ doctorSlug: slug, startsAt: slot.startsAt, mode: 'clinic' })
    .expect(200);
  return res.body as { id: string };
}

/** Moves an appointment into the past, as if it had already happened. */
async function moveToPast(id: string) {
  const startsAt = new Date(Date.now() - 2 * 3_600_000);
  await appointments
    .updateOne(
      { _id: new Types.ObjectId(id) },
      { startsAt, endsAt: new Date(startsAt.getTime() + 900_000) },
    )
    .exec();
}

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  ({ app } = await createTestApp(mongo.getUri(), 'sukoon_e2e_account_deletion'));
  users = app.get(getModelToken(User.name));
  sessions = app.get(getModelToken(Session.name));
  audits = app.get(getModelToken(AuditEvent.name));
  applications = app.get(getModelToken(DoctorApplication.name));
  profiles = app.get(getModelToken(DoctorProfile.name));
  schedules = app.get(getModelToken(DoctorSchedule.name));
  appointments = app.get(getModelToken(Appointment.name));
  for (const name of [
    User.name,
    DoctorApplication.name,
    DoctorProfile.name,
    DoctorSchedule.name,
    SlotReservation.name,
    Appointment.name,
  ]) {
    await app.get<Model<unknown>>(getModelToken(name)).syncIndexes();
  }
});

afterAll(async () => {
  await app?.close();
  await mongo?.stop();
});

describe('deleting your own account', () => {
  it('needs a signed-in session and the correct password', async () => {
    await server()
      .post(`${API}/account/delete`)
      .set('Origin', TEST_ORIGIN)
      .send({ password: PASSWORD })
      .expect(401);

    const person = await register();
    const wrong = await deleteAccount(person, { password: 'not my password at all' }).expect(400);
    expect(wrong.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    expect(await users.countDocuments({ email: person.email })).toBe(1);
  });

  it('removes the account and every sign-in, and frees the email for a new account', async () => {
    const person = await register();
    const id = await userId(person.email);
    const otherDevice = request.agent(app.getHttpServer());
    await otherDevice
      .post(`${API}/auth/login`)
      .set('Origin', TEST_ORIGIN)
      .send({ email: person.email, password: PASSWORD })
      .expect(200);

    const res = await deleteAccount(person).expect(204);
    expect(String(res.headers['set-cookie'])).toMatch(/Expires=Thu, 01 Jan 1970/);

    expect(await users.countDocuments({ _id: id })).toBe(0);
    expect(await sessions.countDocuments({ userId: id })).toBe(0);
    await person.agent.get(`${API}/auth/me`).expect(401);
    await otherDevice.get(`${API}/auth/me`).expect(401);
    await server()
      .post(`${API}/auth/login`)
      .set('Origin', TEST_ORIGIN)
      .send({ email: person.email, password: PASSWORD })
      .expect(401);

    const event = await audits
      .findOne({ action: 'account.delete', targetId: id.toString() })
      .lean();
    expect(event).toMatchObject({ outcome: 'success' });
    expect(JSON.stringify(event)).not.toContain(person.email);

    await register(person.email);
  });

  it('asks for a two-step code when two-step verification is on', async () => {
    const person = await register();
    const setup = await send(person, 'post', '/auth/mfa/setup')
      .send({ password: PASSWORD })
      .expect(200);
    const secret = setup.body.secret as string;
    const code = () => hotp(base32Decode(secret), totpStep(Date.now()));
    await send(person, 'post', '/auth/mfa/enable').send({ code: code() }).expect(200);
    await users.updateOne({ email: person.email }, { $set: { mfaLastUsedStep: null } });

    const missing = await deleteAccount(person).expect(400);
    expect(missing.body.error.code).toBe('MFA_CODE_REQUIRED');
    await deleteAccount(person, { password: PASSWORD, code: code() }).expect(204);
    expect(await users.countDocuments({ email: person.email })).toBe(0);
  });

  it('refuses to delete the only admin', async () => {
    await users.deleteMany({ roles: 'platform_admin' });
    const admin = await signInAs(['platform_admin']);
    const refused = await deleteAccount(admin).expect(409);
    expect(refused.body.error.code).toBe('LAST_ADMIN');
    expect(await users.countDocuments({ email: admin.email })).toBe(1);

    await signInAs(['platform_admin']);
    await deleteAccount(admin).expect(204);
  });

  it('refuses while appointments are upcoming, then keeps past ones as records', async () => {
    const doctor = await freeDoctor();
    const patient = await register();
    const appointment = await bookFree(patient, doctor.slug);

    for (const who of [doctor, patient]) {
      const refused = await deleteAccount(who).expect(409);
      expect(refused.body.error.code).toBe('ACCOUNT_HAS_OPEN_APPOINTMENTS');
    }

    await moveToPast(appointment.id);
    const doctorId = await userId(doctor.email);
    await deleteAccount(doctor).expect(204);

    expect(await applications.countDocuments({ userId: doctorId })).toBe(0);
    expect(await profiles.countDocuments({ userId: doctorId })).toBe(0);
    expect(await schedules.countDocuments({ doctorUserId: doctorId })).toBe(0);
    await server().get(`${API}/doctors/${doctor.slug}`).expect(404);
    await server().get(`${API}/doctors/${doctor.slug}/slots`).expect(404);

    const kept = await patient.agent.get(`${API}/appointments/${appointment.id}`).expect(200);
    expect(kept.body.doctor.slug).toBe(doctor.slug);
    await deleteAccount(patient).expect(204);
    expect(await appointments.countDocuments({ _id: new Types.ObjectId(appointment.id) })).toBe(1);
  });
});
