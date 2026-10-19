import { getModelToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { Appointment } from '../src/modules/appointments/appointment.schema';
import { DoctorSchedule } from '../src/modules/appointments/doctor-schedule.schema';
import { addDays, istDate } from '../src/modules/appointments/ist-time';
import { SlotReservation } from '../src/modules/appointments/slot-reservation.schema';
import type { Role } from '../src/modules/access-control/roles';
import { AuditEvent } from '../src/modules/audit/audit-event.schema';
import { PasswordService } from '../src/modules/auth/password.service';
import { DoctorApplication } from '../src/modules/doctors/doctor-application.schema';
import { DoctorProfile } from '../src/modules/doctors/doctor-profile.schema';
import { User } from '../src/modules/users/user.schema';
import { FakePaymentGateway } from './fake-payment-gateway';
import { FakeVideoGateway } from './fake-video-gateway';
import { createTestApp, TEST_ORIGIN } from './test-app';

const PASSWORD = 'quiet river morning tea';
const API = '/api/v1';
const everyDay = (mode: 'clinic' | 'online') =>
  [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    start: '00:00',
    end: '23:55',
    slotMinutes: 15,
    mode,
  }));

let mongo: MongoMemoryReplSet;
let app: NestExpressApplication;
let payments: FakePaymentGateway;
let video: FakeVideoGateway;
let users: Model<User>;
let appointments: Model<Appointment>;
let reservations: Model<SlotReservation>;
let audits: Model<AuditEvent>;
let counter = 0;

interface SignedIn {
  agent: TestAgent;
  csrf: string;
}

interface Doctor extends SignedIn {
  slug: string;
}

interface AppointmentBody {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  videoOpensAt: string | null;
  doctor: { displayName: string };
}

const uniqueEmail = (label: string) => `${label}.${Date.now()}.${counter++}@example.test`;
const server = () => request(app.getHttpServer());

async function register(fullName = 'Synthetic Patient'): Promise<SignedIn> {
  const agent = request.agent(app.getHttpServer());
  const res = await agent
    .post(`${API}/auth/register`)
    .set('Origin', TEST_ORIGIN)
    .send({ fullName, email: uniqueEmail('person'), password: PASSWORD, acceptTerms: true })
    .expect(201);
  return { agent, csrf: res.body.csrfToken as string };
}

async function signInAs(roles: Role[]): Promise<SignedIn> {
  const email = uniqueEmail('staff');
  await users.create({
    email,
    fullName: 'Synthetic Reviewer',
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

const send = (who: SignedIn, method: 'post' | 'put' | 'patch', path: string) =>
  who.agent[method](`${API}${path}`).set('Origin', TEST_ORIGIN).set('X-CSRF-Token', who.csrf);

async function bookableDoctor(mode: 'clinic' | 'online' = 'online'): Promise<Doctor> {
  const doctor = await register('Synthetic Doctor');
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
      bio: 'Synthetic test doctor used only by automated video tests. Not a real person.',
      languages: ['English'],
      consultationModes: ['clinic', 'online'],
      consultationFeeInr: 500,
      clinicName: 'Test Clinic',
      city: 'Testpur',
      requiresBookingApproval: false,
      published: true,
    })
    .expect(200);
  await send(doctor, 'patch', '/doctor-profile/me/availability')
    .send({ availabilityStatus: 'available' })
    .expect(200);
  await send(doctor, 'put', '/doctor-schedule/me')
    .send({ rules: everyDay(mode), daysOff: [] })
    .expect(200);
  return { ...doctor, slug: profile.body.slug as string };
}

const tomorrow = () => addDays(istDate(new Date()), 1);

async function slotsBody(slug: string) {
  const res = await server().get(`${API}/doctors/${slug}/slots?from=${tomorrow()}&days=1`);
  expect(res.status).toBe(200);
  return res.body as {
    unavailableReason: string | null;
    videoBookingOpen: boolean;
    days: { slots: { startsAt: string; mode: string }[] }[];
  };
}

function book(patient: SignedIn, doctor: Doctor, startsAt: string, mode: string) {
  return send(patient, 'post', '/appointments')
    .set('Idempotency-Key', randomUUID())
    .send({ doctorSlug: doctor.slug, startsAt, mode });
}

async function confirmedBooking(
  doctor: Doctor,
  patient: SignedIn,
  mode: 'clinic' | 'online' = 'online',
): Promise<AppointmentBody> {
  const [slot] = (await slotsBody(doctor.slug)).days[0]!.slots;
  const booked = await book(patient, doctor, slot!.startsAt, mode).expect(200);
  const { body } = payments.pay(booked.body.checkout.orderId);
  const verified = await send(patient, 'post', `/appointments/${booked.body.id}/payment`)
    .send(body)
    .expect(200);
  return verified.body as AppointmentBody;
}

/** Moves an appointment (and its slot claim) so it starts `minutesFromNow` from now. */
async function shiftStart(id: string, minutesFromNow: number) {
  const startsAt = new Date(Date.now() + minutesFromNow * 60_000);
  const endsAt = new Date(startsAt.getTime() + 15 * 60_000);
  const appointment = await appointments.findByIdAndUpdate(id, { startsAt, endsAt }).exec();
  await reservations.updateOne({ _id: appointment!.reservationId }, { startsAt, endsAt }).exec();
}

const joinAsPatient = (patient: SignedIn, id: string) =>
  send(patient, 'post', `/appointments/${id}/video`);
const joinAsDoctor = (doctor: SignedIn, id: string) =>
  send(doctor, 'post', `/doctor/appointments/${id}/video`);

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  payments = new FakePaymentGateway();
  video = new FakeVideoGateway();
  ({ app } = await createTestApp(
    mongo.getUri(),
    'sukoon_e2e_video',
    {},
    { paymentGateway: payments, videoGateway: video },
  ));
  users = app.get(getModelToken(User.name));
  appointments = app.get(getModelToken(Appointment.name));
  reservations = app.get(getModelToken(SlotReservation.name));
  audits = app.get(getModelToken(AuditEvent.name));
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

afterEach(() => {
  video.available = true;
});

describe('booking video consultations', () => {
  it('is open only while a video provider is configured', async () => {
    const doctor = await bookableDoctor('online');
    const open = await slotsBody(doctor.slug);
    expect(open.unavailableReason).toBeNull();
    expect(open.videoBookingOpen).toBe(true);
    expect(open.days[0]!.slots.every((slot) => slot.mode === 'online')).toBe(true);
    const schedule = await doctor.agent.get(`${API}/doctor-schedule/me`).expect(200);
    expect(schedule.body.onlineBookingOpen).toBe(true);

    video.available = false;
    const closed = await slotsBody(doctor.slug);
    expect(closed.unavailableReason).toBe('no_timetable');
    expect(closed.videoBookingOpen).toBe(false);
    const startsAt = open.days[0]!.slots[0]!.startsAt;
    const refused = await book(await register(), doctor, startsAt, 'online').expect(409);
    expect(refused.body.error.code).toBe('ONLINE_NOT_AVAILABLE_YET');
    const closedSchedule = await doctor.agent.get(`${API}/doctor-schedule/me`).expect(200);
    expect(closedSchedule.body.onlineBookingOpen).toBe(false);
  });

  it('tells both sides when the call opens', async () => {
    const doctor = await bookableDoctor('online');
    const appointment = await confirmedBooking(doctor, await register());
    expect(appointment.status).toBe('confirmed');
    const opensAt = new Date(new Date(appointment.startsAt).getTime() - 5 * 60_000);
    expect(appointment.videoOpensAt).toBe(opensAt.toISOString());

    const list = await doctor.agent.get(`${API}/doctor/appointments`).expect(200);
    const seen = (list.body.items as AppointmentBody[]).find((item) => item.id === appointment.id);
    expect(seen?.videoOpensAt).toBe(opensAt.toISOString());

    const clinicDoctor = await bookableDoctor('clinic');
    const clinic = await confirmedBooking(clinicDoctor, await register(), 'clinic');
    expect(clinic.videoOpensAt).toBeNull();
  });
});

describe('joining a video consultation', () => {
  it('opens 5 minutes before the start and closes at the end time', async () => {
    const doctor = await bookableDoctor('online');
    const patient = await register('Asha Private Name');
    const appointment = await confirmedBooking(doctor, patient);

    await shiftStart(appointment.id, 6);
    const early = await joinAsPatient(patient, appointment.id).expect(409);
    expect(early.body.error.code).toBe('TOO_EARLY');
    await joinAsDoctor(doctor, appointment.id).expect(409);

    await shiftStart(appointment.id, 4);
    const before = video.joins.length;
    const patientJoin = await joinAsPatient(patient, appointment.id).expect(200);
    expect(patientJoin.body).toEqual({ url: expect.any(String), token: expect.any(String) });
    await joinAsDoctor(doctor, appointment.id).expect(200);

    const stored = await appointments.findById(appointment.id).exec();
    const [asPatient, asDoctor] = video.joins.slice(before);
    expect(asPatient).toEqual({
      room: `appt_${appointment.id}`,
      identity: 'patient',
      displayName: 'Patient',
      joinUntil: stored!.endsAt,
    });
    expect(asDoctor).toMatchObject({
      room: `appt_${appointment.id}`,
      identity: 'doctor',
      displayName: appointment.doctor.displayName,
    });
    expect(JSON.stringify(video.joins)).not.toContain('Asha Private Name');
    expect(
      await audits.countDocuments({
        action: 'appointment.video.join',
        targetId: appointment.id,
        outcome: 'success',
      }),
    ).toBe(2);

    await shiftStart(appointment.id, -15);
    const ended = await joinAsPatient(patient, appointment.id).expect(409);
    expect(ended.body.error.code).toBe('CALL_ENDED');
  });

  it('is only for the appointment’s own patient and doctor', async () => {
    const doctor = await bookableDoctor('online');
    const patient = await register();
    const appointment = await confirmedBooking(doctor, patient);
    await shiftStart(appointment.id, 1);

    await server()
      .post(`${API}/appointments/${appointment.id}/video`)
      .set('Origin', TEST_ORIGIN)
      .expect(401);
    await joinAsPatient(await register(), appointment.id).expect(404);
    await joinAsDoctor(await bookableDoctor('online'), appointment.id).expect(404);
    await joinAsDoctor(patient, appointment.id).expect(403);
    await joinAsPatient(patient, 'not-an-id').expect(404);
  });

  it('refuses in-clinic, cancelled and unavailable calls', async () => {
    const clinicDoctor = await bookableDoctor('clinic');
    const clinicPatient = await register();
    const clinic = await confirmedBooking(clinicDoctor, clinicPatient, 'clinic');
    await shiftStart(clinic.id, 1);
    const notVideo = await joinAsPatient(clinicPatient, clinic.id).expect(409);
    expect(notVideo.body.error.code).toBe('NOT_A_VIDEO_APPOINTMENT');

    const doctor = await bookableDoctor('online');
    const patient = await register();
    const cancelled = await confirmedBooking(doctor, patient);
    await send(patient, 'post', `/appointments/${cancelled.id}/cancel`).send({}).expect(200);
    await shiftStart(cancelled.id, 1);
    const inactive = await joinAsPatient(patient, cancelled.id).expect(409);
    expect(inactive.body.error.code).toBe('APPOINTMENT_NOT_ACTIVE');

    const live = await confirmedBooking(doctor, await register());
    await shiftStart(live.id, 1);
    video.available = false;
    const unavailable = await joinAsDoctor(doctor, live.id).expect(503);
    expect(unavailable.body.error.code).toBe('VIDEO_UNAVAILABLE');
  });
});
