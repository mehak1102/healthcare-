import { getModelToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { type Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { AppointmentEvent } from '../src/modules/appointments/appointment-event.schema';
import { Appointment } from '../src/modules/appointments/appointment.schema';
import { DoctorSchedule } from '../src/modules/appointments/doctor-schedule.schema';
import { addDays, istDate } from '../src/modules/appointments/ist-time';
import { PaymentWebhookEvent } from '../src/modules/appointments/payment-webhook-event.schema';
import { SlotReservation } from '../src/modules/appointments/slot-reservation.schema';
import type { Role } from '../src/modules/access-control/roles';
import { PasswordService } from '../src/modules/auth/password.service';
import { DoctorApplication } from '../src/modules/doctors/doctor-application.schema';
import { DoctorProfile } from '../src/modules/doctors/doctor-profile.schema';
import { User } from '../src/modules/users/user.schema';
import { FakePaymentGateway } from './fake-payment-gateway';
import { createTestApp, TEST_ORIGIN } from './test-app';
import type { TestMailbox } from './test-mailbox';

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
let mailbox: TestMailbox;
let gateway: FakePaymentGateway;
let users: Model<User>;
let appointments: Model<Appointment>;
let reservations: Model<SlotReservation>;
let events: Model<AppointmentEvent>;
let counter = 0;

interface SignedIn {
  agent: TestAgent;
  csrf: string;
  email: string;
}

interface Doctor extends SignedIn {
  slug: string;
}

const uniqueEmail = (label: string) => `${label}.${Date.now()}.${counter++}@example.test`;
const server = () => request(app.getHttpServer());

async function register(fullName = 'Synthetic Patient'): Promise<SignedIn> {
  const email = uniqueEmail('person');
  const agent = request.agent(app.getHttpServer());
  const res = await agent
    .post(`${API}/auth/register`)
    .set('Origin', TEST_ORIGIN)
    .send({ fullName, email, password: PASSWORD, acceptTerms: true })
    .expect(201);
  return { agent, csrf: res.body.csrfToken as string, email };
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
  return { agent, csrf: res.body.csrfToken as string, email };
}

const send = (who: SignedIn, method: 'post' | 'put', path: string) =>
  who.agent[method](`${API}${path}`).set('Origin', TEST_ORIGIN).set('X-CSRF-Token', who.csrf);

async function bookableDoctor(
  options: { feeInr?: number; modes?: string[]; rules?: unknown[] } = {},
): Promise<Doctor> {
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
      bio: 'Synthetic test doctor used only by automated booking tests. Not a real person.',
      languages: ['English'],
      consultationModes: options.modes ?? ['clinic', 'online'],
      consultationFeeInr: options.feeInr ?? 500,
      clinicName: 'Test Clinic',
      city: 'Testpur',
      requiresBookingApproval: false,
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
    .send({ rules: options.rules ?? EVERY_DAY, daysOff: [] })
    .expect(200);
  return { ...doctor, slug: profile.body.slug as string };
}

const tomorrow = () => addDays(istDate(new Date()), 1);

async function slotsOf(slug: string, from = tomorrow()) {
  const res = await server().get(`${API}/doctors/${slug}/slots?from=${from}&days=1`).expect(200);
  return res.body.days[0].slots as { startsAt: string; endsAt: string; mode: string }[];
}

const book = (
  patient: SignedIn,
  body: Record<string, unknown>,
  key: string | null = randomUUID(),
) => {
  const req = send(patient, 'post', '/appointments');
  if (key) req.set('Idempotency-Key', key);
  return req.send(body);
};

async function confirmedBooking(doctor: Doctor, patient: SignedIn, slotIndex = 0) {
  const slot = (await slotsOf(doctor.slug))[slotIndex]!;
  const booked = await book(patient, {
    doctorSlug: doctor.slug,
    startsAt: slot.startsAt,
    mode: 'clinic',
  }).expect(200);
  const { body } = gateway.pay(booked.body.checkout.orderId);
  const verified = await send(patient, 'post', `/appointments/${booked.body.id}/payment`)
    .send(body)
    .expect(200);
  return verified.body as { id: string; startsAt: string; status: string };
}

const oid = (id: string) => new Types.ObjectId(id);

const capturedEvents = (appointmentId: string) =>
  events.countDocuments({ appointmentId: oid(appointmentId), type: 'payment_captured' });

/** Moves an appointment (and its slot claim) so it starts `minutesFromNow` from now. */
async function shiftStart(id: string, minutesFromNow: number) {
  const startsAt = new Date(Date.now() + minutesFromNow * 60_000);
  const endsAt = new Date(startsAt.getTime() + 15 * 60_000);
  const appointment = await appointments.findByIdAndUpdate(id, { startsAt, endsAt }).exec();
  await reservations.updateOne({ _id: appointment!.reservationId }, { startsAt, endsAt }).exec();
}

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  gateway = new FakePaymentGateway();
  ({ app, mailbox } = await createTestApp(
    mongo.getUri(),
    'sukoon_e2e_appointments',
    {},
    {
      paymentGateway: gateway,
    },
  ));
  users = app.get(getModelToken(User.name));
  appointments = app.get(getModelToken(Appointment.name));
  reservations = app.get(getModelToken(SlotReservation.name));
  events = app.get(getModelToken(AppointmentEvent.name));
  for (const name of [
    User.name,
    DoctorApplication.name,
    DoctorProfile.name,
    DoctorSchedule.name,
    SlotReservation.name,
    Appointment.name,
    AppointmentEvent.name,
    PaymentWebhookEvent.name,
  ]) {
    await app.get<Model<unknown>>(getModelToken(name)).syncIndexes();
  }
});

afterAll(async () => {
  await app?.close();
  await mongo?.stop();
});

describe('doctor timetable', () => {
  it('is only for doctors', async () => {
    const patient = await register();
    await patient.agent.get(`${API}/doctor-schedule/me`).expect(403);
    await send(patient, 'put', '/doctor-schedule/me').send({ rules: [], daysOff: [] }).expect(403);
  });

  it('rejects overlapping blocks and modes the profile does not offer', async () => {
    const doctor = await bookableDoctor({ modes: ['clinic'] });
    const overlap = await send(doctor, 'put', '/doctor-schedule/me')
      .send({
        rules: [
          { day: 1, start: '09:00', end: '12:00', slotMinutes: 15, mode: 'clinic' },
          { day: 1, start: '11:00', end: '13:00', slotMinutes: 15, mode: 'clinic' },
        ],
        daysOff: [],
      })
      .expect(400);
    expect(overlap.body.error.code).toBe('SCHEDULE_INVALID');

    const online = await send(doctor, 'put', '/doctor-schedule/me')
      .send({
        rules: [{ day: 1, start: '09:00', end: '12:00', slotMinutes: 15, mode: 'online' }],
        daysOff: [],
      })
      .expect(400);
    expect(online.body.error.details.join(' ')).toMatch(/video consultations/);

    const badLength = await send(doctor, 'put', '/doctor-schedule/me')
      .send({
        rules: [{ day: 1, start: '09:00', end: '12:00', slotMinutes: 17, mode: 'clinic' }],
        daysOff: [],
      })
      .expect(400);
    expect(badLength.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('publishes free slots in India time and honours days off', async () => {
    const doctor = await bookableDoctor();
    const slots = await slotsOf(doctor.slug);
    expect(slots.length).toBeGreaterThan(50);
    expect(slots.every((slot) => slot.mode === 'clinic')).toBe(true);
    expect(istDate(new Date(slots[0]!.startsAt))).toBe(tomorrow());

    await send(doctor, 'put', '/doctor-schedule/me')
      .send({ rules: EVERY_DAY, daysOff: [tomorrow()] })
      .expect(200);
    expect(await slotsOf(doctor.slug)).toEqual([]);

    const tooFar = await server()
      .get(`${API}/doctors/${doctor.slug}/slots?from=${addDays(istDate(new Date()), 45)}`)
      .expect(400);
    expect(tooFar.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('says why nothing is bookable and points to the next free day', async () => {
    const slotsBody = async (slug: string) =>
      (await server().get(`${API}/doctors/${slug}/slots`).expect(200)).body as {
        unavailableReason: string | null;
        nextAvailableDate: string | null;
        days: { slots: unknown[] }[];
      };

    const noTimetable = await bookableDoctor({ rules: [] });
    expect(await slotsBody(noTimetable.slug)).toMatchObject({
      unavailableReason: 'no_timetable',
      nextAvailableDate: null,
    });

    const videoOnly = await bookableDoctor({
      rules: EVERY_DAY.map((rule) => ({ ...rule, mode: 'online' })),
    });
    expect((await slotsBody(videoOnly.slug)).unavailableReason).toBe('no_timetable');

    const today = istDate(new Date());
    const away = await bookableDoctor();
    await send(away, 'put', '/doctor-schedule/me')
      .send({ rules: EVERY_DAY, daysOff: [0, 1, 2, 3, 4, 5, 6, 7].map((n) => addDays(today, n)) })
      .expect(200);
    const awayBody = await slotsBody(away.slug);
    expect(awayBody).toMatchObject({
      unavailableReason: null,
      nextAvailableDate: addDays(today, 8),
    });
    expect(awayBody.days.every((day) => day.slots.length === 0)).toBe(true);

    const free = await bookableDoctor({ feeInr: 0 });
    gateway.available = false;
    try {
      expect((await slotsBody(away.slug)).unavailableReason).toBe('payments_unavailable');
      expect((await slotsBody(free.slug)).unavailableReason).toBeNull();
    } finally {
      gateway.available = true;
    }
  });
});

describe('booking a paid appointment', () => {
  it('requires a signed-in patient, an idempotency key and a real slot', async () => {
    const doctor = await bookableDoctor();
    const [slot] = await slotsOf(doctor.slug);
    const body = { doctorSlug: doctor.slug, startsAt: slot!.startsAt, mode: 'clinic' };

    await server().post(`${API}/appointments`).set('Origin', TEST_ORIGIN).send(body).expect(401);

    const patient = await register();
    const noKey = await book(patient, body, null).expect(400);
    expect(noKey.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');

    const offGrid = new Date(new Date(slot!.startsAt).getTime() + 5 * 60_000).toISOString();
    const notASlot = await book(patient, { ...body, startsAt: offGrid }).expect(409);
    expect(notASlot.body.error.code).toBe('SLOT_UNAVAILABLE');

    const online = await book(patient, { ...body, mode: 'online' }).expect(409);
    expect(online.body.error.code).toBe('ONLINE_NOT_AVAILABLE_YET');

    const forged = await book(patient, { ...body, feeInr: 1, status: 'confirmed' }).expect(400);
    expect(forged.body.error.code).toBe('VALIDATION_FAILED');

    const self = await book(doctor, body).expect(403);
    expect(self.body.error.code).toBe('SELF_BOOKING_FORBIDDEN');
  });

  it('holds the slot, takes payment for the server-side fee and confirms only verified payments', async () => {
    const doctor = await bookableDoctor({ feeInr: 750 });
    const patient = await register('Asha Test');
    const [slot] = await slotsOf(doctor.slug);

    const booked = await book(patient, {
      doctorSlug: doctor.slug,
      startsAt: slot!.startsAt,
      mode: 'clinic',
      patientNote: 'Synthetic note for tests',
    }).expect(200);
    expect(booked.body).toMatchObject({
      status: 'pending_payment',
      paymentStatus: 'pending',
      feeInr: 750,
      checkout: { keyId: gateway.publicKey, amountPaise: 75_000, currency: 'INR' },
    });
    expect((await slotsOf(doctor.slug))[0]!.startsAt).not.toBe(slot!.startsAt);

    const id = booked.body.id as string;
    const orderId = booked.body.checkout.orderId as string;
    const { body: paid } = gateway.pay(orderId);

    const forged = await send(patient, 'post', `/appointments/${id}/payment`)
      .send({ ...paid, razorpaySignature: 'a'.repeat(64) })
      .expect(400);
    expect(forged.body.error.code).toBe('PAYMENT_SIGNATURE_INVALID');

    const { body: short } = gateway.pay(orderId, { amountPaise: 100 });
    const mismatch = await send(patient, 'post', `/appointments/${id}/payment`)
      .send(short)
      .expect(400);
    expect(mismatch.body.error.code).toBe('PAYMENT_MISMATCH');

    const confirmed = await send(patient, 'post', `/appointments/${id}/payment`)
      .send(paid)
      .expect(200);
    expect(confirmed.body).toMatchObject({
      status: 'confirmed',
      paymentStatus: 'paid',
      checkout: null,
    });

    await send(patient, 'post', `/appointments/${id}/payment`).send(paid).expect(200);
    expect(await capturedEvents(id)).toBe(1);

    await mailbox.waitFor(patient.email, /Appointment confirmed/);
    const doctorMail = await mailbox.waitFor(doctor.email, /New appointment booked/);
    expect(doctorMail.text).toContain('Asha Test');
    expect(doctorMail.text).not.toContain('Synthetic note');

    const doctorList = await doctor.agent.get(`${API}/doctor/appointments`).expect(200);
    expect(doctorList.body.items).toHaveLength(1);
    expect(doctorList.body.items[0]).toMatchObject({
      id,
      patientName: 'Asha Test',
      patientNote: 'Synthetic note for tests',
    });
  });

  it('captures payments that were only authorised', async () => {
    const doctor = await bookableDoctor();
    const patient = await register();
    const [slot] = await slotsOf(doctor.slug);
    const booked = await book(patient, {
      doctorSlug: doctor.slug,
      startsAt: slot!.startsAt,
      mode: 'clinic',
    }).expect(200);
    const { payment, body } = gateway.pay(booked.body.checkout.orderId, { status: 'authorized' });
    await send(patient, 'post', `/appointments/${booked.body.id}/payment`).send(body).expect(200);
    expect(gateway.payments.get(payment.paymentId)!.status).toBe('captured');
  });

  it('replays the same booking for a repeated idempotency key and refuses reuse for another', async () => {
    const doctor = await bookableDoctor();
    const patient = await register();
    const [first, second] = await slotsOf(doctor.slug);
    const key = randomUUID();
    const body = { doctorSlug: doctor.slug, startsAt: first!.startsAt, mode: 'clinic' };

    const a = await book(patient, body, key).expect(200);
    const b = await book(patient, body, key).expect(200);
    expect(b.body.id).toBe(a.body.id);
    expect(b.body.checkout.orderId).toBe(a.body.checkout.orderId);

    const reused = await book(patient, { ...body, startsAt: second!.startsAt }, key).expect(422);
    expect(reused.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    const user = await users.findOne({ email: patient.email });
    expect(await appointments.countDocuments({ patientId: user!._id })).toBe(1);
  });

  it('gives a contested slot to exactly one of many simultaneous patients', async () => {
    const doctor = await bookableDoctor();
    const [slot] = await slotsOf(doctor.slug);
    const patients = await Promise.all([1, 2, 3, 4, 5, 6].map(() => register()));
    const results = await Promise.all(
      patients.map((patient) =>
        book(patient, { doctorSlug: doctor.slug, startsAt: slot!.startsAt, mode: 'clinic' }),
      ),
    );
    const statuses = results.map((res) => res.status).sort();
    expect(statuses).toEqual([200, 409, 409, 409, 409, 409]);
    expect(
      results
        .filter((res) => res.status === 409)
        .every((res) => res.body.error.code === 'SLOT_UNAVAILABLE'),
    ).toBe(true);
    const owner = await users.findOne({ email: doctor.email });
    expect(
      await reservations.countDocuments({
        doctorUserId: owner!._id,
        startsAt: new Date(slot!.startsAt),
        active: true,
      }),
    ).toBe(1);
  });

  it('limits how many unpaid bookings a patient can hold', async () => {
    const doctor = await bookableDoctor();
    const patient = await register();
    const slots = await slotsOf(doctor.slug);
    for (const slot of slots.slice(0, 2)) {
      await book(patient, {
        doctorSlug: doctor.slug,
        startsAt: slot.startsAt,
        mode: 'clinic',
      }).expect(200);
    }
    const third = await book(patient, {
      doctorSlug: doctor.slug,
      startsAt: slots[2]!.startsAt,
      mode: 'clinic',
    }).expect(409);
    expect(third.body.error.code).toBe('TOO_MANY_UNPAID_BOOKINGS');
  });

  it('releases an unpaid hold after it expires and refunds a payment that arrives too late', async () => {
    const doctor = await bookableDoctor();
    const slow = await register();
    const [slot] = await slotsOf(doctor.slug);
    const body = { doctorSlug: doctor.slug, startsAt: slot!.startsAt, mode: 'clinic' };
    const held = await book(slow, body).expect(200);

    const past = new Date(Date.now() - 1_000);
    await appointments.updateOne({ _id: held.body.id }, { holdExpiresAt: past }).exec();
    await reservations
      .updateOne({ appointmentId: oid(held.body.id) }, { holdExpiresAt: past })
      .exec();
    expect((await slotsOf(doctor.slug))[0]!.startsAt).toBe(slot!.startsAt);

    const quick = await register();
    await book(quick, body).expect(200);

    const { payment, body: paid } = gateway.pay(held.body.checkout.orderId);
    const late = await send(slow, 'post', `/appointments/${held.body.id}/payment`)
      .send(paid)
      .expect(409);
    expect(late.body.error.code).toBe('PAYMENT_TOO_LATE');
    expect(gateway.refunds.filter((r) => r.paymentId === payment.paymentId)).toHaveLength(1);

    const mine = await slow.agent.get(`${API}/appointments/${held.body.id}`).expect(200);
    expect(mine.body).toMatchObject({ status: 'expired', paymentStatus: 'refunded' });
    await mailbox.waitFor(slow.email, /being refunded/);

    // Retrying the confirmation never refunds twice.
    await send(slow, 'post', `/appointments/${held.body.id}/payment`).send(paid).expect(409);
    expect(gateway.refunds.filter((r) => r.paymentId === payment.paymentId)).toHaveLength(1);
  });

  it('still confirms a slightly late payment when nobody else took the slot', async () => {
    const doctor = await bookableDoctor();
    const patient = await register();
    const [slot] = await slotsOf(doctor.slug);
    const held = await book(patient, {
      doctorSlug: doctor.slug,
      startsAt: slot!.startsAt,
      mode: 'clinic',
    }).expect(200);
    const past = new Date(Date.now() - 1_000);
    await appointments.updateOne({ _id: held.body.id }, { holdExpiresAt: past }).exec();
    await reservations
      .updateOne({ appointmentId: oid(held.body.id) }, { holdExpiresAt: past })
      .exec();

    const { body } = gateway.pay(held.body.checkout.orderId);
    const res = await send(patient, 'post', `/appointments/${held.body.id}/payment`)
      .send(body)
      .expect(200);
    expect(res.body.status).toBe('confirmed');
  });

  it('fails closed when payments are unavailable', async () => {
    const doctor = await bookableDoctor();
    const patient = await register();
    const [first, second] = await slotsOf(doctor.slug);

    gateway.available = false;
    try {
      const res = await book(patient, {
        doctorSlug: doctor.slug,
        startsAt: first!.startsAt,
        mode: 'clinic',
      }).expect(503);
      expect(res.body.error.code).toBe('PAYMENTS_UNAVAILABLE');
    } finally {
      gateway.available = true;
    }

    gateway.failNextOrder = true;
    const failed = await book(patient, {
      doctorSlug: doctor.slug,
      startsAt: second!.startsAt,
      mode: 'clinic',
    }).expect(503);
    expect(failed.body.error.code).toBe('PAYMENTS_UNAVAILABLE');

    const user = await users.findOne({ email: patient.email });
    const records = await appointments.find({ patientId: user!._id }).exec();
    expect(records.map((r) => r.status)).toEqual(['expired']);
    expect((await slotsOf(doctor.slug)).map((s) => s.startsAt)).toContain(second!.startsAt);
  });
});

describe('free consultations', () => {
  it('are confirmed straight away without any payment', async () => {
    const doctor = await bookableDoctor({ feeInr: 0 });
    const patient = await register();
    const [slot] = await slotsOf(doctor.slug);
    const before = gateway.orders.size;

    gateway.available = false;
    try {
      const res = await book(patient, {
        doctorSlug: doctor.slug,
        startsAt: slot!.startsAt,
        mode: 'clinic',
      }).expect(200);
      expect(res.body).toMatchObject({
        status: 'confirmed',
        paymentStatus: 'not_required',
        checkout: null,
      });
    } finally {
      gateway.available = true;
    }
    expect(gateway.orders.size).toBe(before);
  });
});

describe('cancelling', () => {
  it('lets the patient cancel any time before the start, with a full refund', async () => {
    const doctor = await bookableDoctor();
    const patient = await register();
    const appointment = await confirmedBooking(doctor, patient);

    const res = await send(patient, 'post', `/appointments/${appointment.id}/cancel`)
      .send({ reason: 'Feeling better' })
      .expect(200);
    expect(res.body).toMatchObject({
      status: 'cancelled_by_patient',
      paymentStatus: 'refunded',
      canCancel: false,
    });
    const record = await appointments.findById(appointment.id).exec();
    expect(gateway.refunds.some((r) => r.paymentId === record!.payment.paymentId)).toBe(true);
    expect((await slotsOf(doctor.slug))[0]!.startsAt).toBe(appointment.startsAt);
    await mailbox.waitFor(patient.email, /cancelled/);

    const again = await send(patient, 'post', `/appointments/${appointment.id}/cancel`)
      .send({})
      .expect(409);
    expect(again.body.error.code).toBe('CANNOT_CANCEL');
  });

  it('refuses once the appointment has started', async () => {
    const doctor = await bookableDoctor();
    const patient = await register();
    const appointment = await confirmedBooking(doctor, patient);
    await shiftStart(appointment.id, -1);
    const res = await send(patient, 'post', `/appointments/${appointment.id}/cancel`)
      .send({})
      .expect(409);
    expect(res.body.error.code).toBe('CANNOT_CANCEL');
  });

  it('keeps appointments private to their patient and doctor', async () => {
    const doctor = await bookableDoctor();
    const patient = await register();
    const appointment = await confirmedBooking(doctor, patient);

    const stranger = await register();
    await stranger.agent.get(`${API}/appointments/${appointment.id}`).expect(404);
    await send(stranger, 'post', `/appointments/${appointment.id}/cancel`).send({}).expect(404);

    const otherDoctor = await bookableDoctor();
    await send(otherDoctor, 'post', `/doctor/appointments/${appointment.id}/cancel`)
      .send({ reason: 'Not mine to cancel' })
      .expect(404);
    expect(
      (await otherDoctor.agent.get(`${API}/doctor/appointments`).expect(200)).body.items,
    ).toEqual([]);
    await patient.agent.get(`${API}/doctor/appointments`).expect(403);
  });

  it('lets the doctor cancel with a reason and refunds the patient', async () => {
    const doctor = await bookableDoctor();
    const patient = await register();
    const appointment = await confirmedBooking(doctor, patient);

    await send(doctor, 'post', `/doctor/appointments/${appointment.id}/cancel`)
      .send({})
      .expect(400);
    const res = await send(doctor, 'post', `/doctor/appointments/${appointment.id}/cancel`)
      .send({ reason: 'Called away for an emergency' })
      .expect(200);
    expect(res.body).toMatchObject({ status: 'cancelled_by_doctor', paymentStatus: 'refunded' });
    const mail = await mailbox.waitFor(patient.email, /cancelled/);
    expect(mail.text).toContain('Called away for an emergency');
  });
});

describe('rescheduling', () => {
  it('moves a confirmed appointment to another free slot and frees the old one', async () => {
    const doctor = await bookableDoctor();
    const patient = await register();
    const slots = await slotsOf(doctor.slug);
    const appointment = await confirmedBooking(doctor, patient, 0);
    const newSlot = slots[1]!;

    const res = await send(patient, 'post', `/appointments/${appointment.id}/reschedule`)
      .send({ startsAt: newSlot.startsAt })
      .expect(200);
    expect(res.body.startsAt).toBe(newSlot.startsAt);
    expect(res.body.status).toBe('confirmed');

    const listed = (await slotsOf(doctor.slug)).map((s) => s.startsAt);
    expect(listed).toContain(appointment.startsAt);
    expect(listed).not.toContain(newSlot.startsAt);

    expect(
      await events.countDocuments({ appointmentId: oid(appointment.id), type: 'rescheduled' }),
    ).toBe(1);
    await mailbox.waitFor(patient.email, /Appointment time changed/);
  });

  it('refuses a taken slot, inactive bookings and changes after the start', async () => {
    const doctor = await bookableDoctor();
    const holder = await register();
    const mover = await register();
    const slots = await slotsOf(doctor.slug);
    const held = await confirmedBooking(doctor, holder, 0);
    const moving = await confirmedBooking(doctor, mover, 1);

    const taken = await send(mover, 'post', `/appointments/${moving.id}/reschedule`)
      .send({ startsAt: held.startsAt })
      .expect(409);
    expect(taken.body.error.code).toBe('SLOT_UNAVAILABLE');

    await send(holder, 'post', `/appointments/${held.id}/cancel`).send({}).expect(200);
    const inactive = await send(mover, 'post', `/appointments/${moving.id}/reschedule`)
      .send({ startsAt: slots[2]!.startsAt })
      .expect(200);
    expect(inactive.body.startsAt).toBe(slots[2]!.startsAt);

    await shiftStart(moving.id, -1);
    const late = await send(mover, 'post', `/appointments/${moving.id}/reschedule`)
      .send({ startsAt: slots[3]!.startsAt })
      .expect(409);
    expect(late.body.error.code).toBe('CANNOT_RESCHEDULE');
  });
});

describe('after the visit', () => {
  it('lets the doctor record the outcome only once the time has started', async () => {
    const doctor = await bookableDoctor();
    const patient = await register();
    const appointment = await confirmedBooking(doctor, patient);

    const early = await send(doctor, 'post', `/doctor/appointments/${appointment.id}/outcome`)
      .send({ outcome: 'completed' })
      .expect(409);
    expect(early.body.error.code).toBe('TOO_EARLY');

    await shiftStart(appointment.id, -20);
    const res = await send(doctor, 'post', `/doctor/appointments/${appointment.id}/outcome`)
      .send({ outcome: 'completed' })
      .expect(200);
    expect(res.body.status).toBe('completed');

    const past = await patient.agent.get(`${API}/appointments?scope=past`).expect(200);
    expect(past.body.items.map((i: { id: string }) => i.id)).toContain(appointment.id);
  });
});

describe('payment webhook', () => {
  const deliver = (payload: unknown, options: { eventId?: string; signature?: string } = {}) => {
    const raw = JSON.stringify(payload);
    return server()
      .post(`${API}/webhooks/razorpay`)
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Event-Id', options.eventId ?? randomUUID())
      .set('X-Razorpay-Signature', options.signature ?? gateway.signWebhook(raw))
      .send(raw);
  };

  it('rejects unsigned or tampered deliveries', async () => {
    const res = await deliver({ event: 'payment.captured' }, { signature: 'b'.repeat(64) }).expect(
      400,
    );
    expect(res.body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
  });

  it('confirms a booking when the browser never reported back, once per event', async () => {
    const doctor = await bookableDoctor();
    const patient = await register();
    const [slot] = await slotsOf(doctor.slug);
    const booked = await book(patient, {
      doctorSlug: doctor.slug,
      startsAt: slot!.startsAt,
      mode: 'clinic',
    }).expect(200);
    const { payment } = gateway.pay(booked.body.checkout.orderId);
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: payment.paymentId,
            order_id: payment.orderId,
            amount: payment.amountPaise,
            currency: 'INR',
            status: 'captured',
          },
        },
      },
    };
    const eventId = randomUUID();
    await deliver(payload, { eventId }).expect(200);
    await deliver(payload, { eventId }).expect(200);

    const mine = await patient.agent.get(`${API}/appointments/${booked.body.id}`).expect(200);
    expect(mine.body).toMatchObject({ status: 'confirmed', paymentStatus: 'paid' });
    expect(await capturedEvents(booked.body.id)).toBe(1);
  });

  it('ignores payments for orders it does not know and amounts that do not match', async () => {
    await deliver({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_Unknown01',
            order_id: 'order_Unknown01',
            amount: 100,
            currency: 'INR',
            status: 'captured',
          },
        },
      },
    }).expect(200);

    const doctor = await bookableDoctor();
    const patient = await register();
    const [slot] = await slotsOf(doctor.slug);
    const booked = await book(patient, {
      doctorSlug: doctor.slug,
      startsAt: slot!.startsAt,
      mode: 'clinic',
    }).expect(200);
    await deliver({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_Wrong0001',
            order_id: booked.body.checkout.orderId,
            amount: 1,
            currency: 'INR',
            status: 'captured',
          },
        },
      },
    }).expect(200);
    const mine = await patient.agent.get(`${API}/appointments/${booked.body.id}`).expect(200);
    expect(mine.body.status).toBe('pending_payment');
  });

  it('lets a doctor accept or reject a booking request when approval is required', async () => {
    const doctor = await bookableDoctor({ feeInr: 0 });
    await send(doctor, 'put', '/doctor-profile/me')
      .send({
        bio: 'Synthetic test doctor used only by automated booking tests. Not a real person.',
        languages: ['English'],
        consultationModes: ['clinic', 'online'],
        consultationFeeInr: 0,
        clinicName: 'Test Clinic',
        city: 'Testpur',
        requiresBookingApproval: true,
        published: true,
      })
      .expect(200);
    const patient = await register();
    const slot = (await slotsOf(doctor.slug))[0]!;
    const booked = await book(patient, {
      doctorSlug: doctor.slug,
      startsAt: slot.startsAt,
      mode: 'clinic',
    }).expect(200);
    expect(booked.body.status).toBe('pending_doctor');

    const pending = await doctor.agent
      .get(`${API}/doctor/appointments?scope=upcoming`)
      .expect(200);
    expect(pending.body.items).toHaveLength(1);
    expect(pending.body.items[0].canAccept).toBe(true);

    const rejected = await bookableDoctor({ feeInr: 0 });
    await send(rejected, 'put', '/doctor-profile/me')
      .send({
        bio: 'Synthetic test doctor used only by automated booking tests. Not a real person.',
        languages: ['English'],
        consultationModes: ['clinic'],
        consultationFeeInr: 0,
        clinicName: 'Test Clinic',
        city: 'Testpur',
        requiresBookingApproval: true,
        published: true,
      })
      .expect(200);
    const patient2 = await register();
    const slot2 = (await slotsOf(rejected.slug))[0]!;
    const bookingRequest = await book(patient2, {
      doctorSlug: rejected.slug,
      startsAt: slot2.startsAt,
      mode: 'clinic',
    }).expect(200);
    await send(rejected, 'post', `/doctor/appointments/${bookingRequest.body.id}/reject`)
      .send({ reason: 'Not available that day' })
      .expect(200);
    const declined = await patient2.agent
      .get(`${API}/appointments/${bookingRequest.body.id}`)
      .expect(200);
    expect(declined.body.status).toBe('rejected_by_doctor');

    await send(doctor, 'post', `/doctor/appointments/${booked.body.id}/accept`).expect(200);
    const accepted = await patient.agent.get(`${API}/appointments/${booked.body.id}`).expect(200);
    expect(accepted.body.status).toBe('confirmed');
  });
});
