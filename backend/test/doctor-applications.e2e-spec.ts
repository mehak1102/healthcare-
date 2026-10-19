import { getModelToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Model } from 'mongoose';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { Role } from '../src/modules/access-control/roles';
import { AuditEvent } from '../src/modules/audit/audit-event.schema';
import { PasswordService } from '../src/modules/auth/password.service';
import { DoctorApplication } from '../src/modules/doctors/doctor-application.schema';
import { DoctorProfile } from '../src/modules/doctors/doctor-profile.schema';
import { User } from '../src/modules/users/user.schema';
import { BOOKING_WINDOW_DAYS } from '../src/modules/appointments/booking-rules';
import { nextIndiaPublicHoliday } from '../src/modules/appointments/india-public-holidays';
import { istDate, istWeekday } from '../src/modules/appointments/ist-time';
import { createTestApp, TEST_ORIGIN } from './test-app';
import type { TestMailbox } from './test-mailbox';

const PASSWORD = 'quiet river morning tea';
const API = '/api/v1';
const CLINIC_HOURS = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  start: '09:00',
  end: '17:00',
  slotMinutes: 30,
  mode: 'clinic' as const,
}));

let mongo: MongoMemoryReplSet;
let app: NestExpressApplication;
let mailbox: TestMailbox;
let users: Model<User>;
let applications: Model<DoctorApplication>;
let audits: Model<AuditEvent>;
let counter = 0;

const uniqueEmail = (label: string) => `${label}.${Date.now()}.${counter++}@example.test`;
const uniqueRegistration = () => `TEST-${Date.now()}-${counter++}`;

interface SignedIn {
  agent: TestAgent;
  csrf: string;
  email: string;
}

async function register(fullName = 'Synthetic Applicant'): Promise<SignedIn> {
  const email = uniqueEmail('applicant');
  const agent = request.agent(app.getHttpServer());
  const res = await agent
    .post(`${API}/auth/register`)
    .set('Origin', TEST_ORIGIN)
    .send({ fullName, email, password: PASSWORD, acceptTerms: true })
    .expect(201);
  return { agent, csrf: res.body.csrfToken as string, email };
}

/** Staff accounts cannot be self-registered, so tests create them directly. */
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

const post = (who: SignedIn, path: string) =>
  who.agent.post(`${API}${path}`).set('Origin', TEST_ORIGIN).set('X-CSRF-Token', who.csrf);

const details = (overrides: Record<string, unknown> = {}) => ({
  registrationNumber: uniqueRegistration(),
  registrationCouncil: 'Karnataka Medical Council',
  registrationYear: 2015,
  qualification: 'MBBS, MD (General Medicine)',
  specialty: 'General Physician',
  ...overrides,
});

async function apply(who: SignedIn, overrides: Record<string, unknown> = {}) {
  const res = await post(who, '/doctor-applications').send(details(overrides)).expect(201);
  return res.body.id as string;
}

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  ({ app, mailbox } = await createTestApp(mongo.getUri(), 'sukoon_e2e_doctors'));
  users = app.get(getModelToken(User.name));
  applications = app.get(getModelToken(DoctorApplication.name));
  audits = app.get(getModelToken(AuditEvent.name));
  await users.syncIndexes();
  await applications.syncIndexes();
  await app.get<Model<DoctorProfile>>(getModelToken(DoctorProfile.name)).syncIndexes();
});

afterAll(async () => {
  await app?.close();
  await mongo?.stop();
});

describe('applying to join as a doctor', () => {
  it('requires a signed-in account', async () => {
    await request(app.getHttpServer())
      .post(`${API}/doctor-applications`)
      .set('Origin', TEST_ORIGIN)
      .send(details())
      .expect(401);
  });

  it('records a pending application without granting any access', async () => {
    const applicant = await register();
    const res = await post(applicant, '/doctor-applications').send(details()).expect(201);
    expect(res.body).toMatchObject({ status: 'pending', specialty: 'General Physician' });

    const me = await applicant.agent.get(`${API}/doctor-applications/me`).expect(200);
    expect(me.body.application).toMatchObject({ id: res.body.id, status: 'pending' });
    const account = await applicant.agent.get(`${API}/auth/me`).expect(200);
    expect(account.body.user.roles).toEqual(['patient']);
    expect(await audits.countDocuments({ action: 'doctor_application.submit' })).toBeGreaterThan(0);
  });

  it('rejects attempts to choose a status or role from the browser', async () => {
    const applicant = await register();
    const res = await post(applicant, '/doctor-applications')
      .send({ ...details(), status: 'approved', roles: ['doctor'] })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    const user = await users.findOne({ email: applicant.email });
    expect(await applications.countDocuments({ userId: user!._id })).toBe(0);
    expect(user!.roles).toEqual(['patient']);
  });

  it('validates the registration details', async () => {
    const applicant = await register();
    await post(applicant, '/doctor-applications')
      .send(details({ registrationYear: new Date().getFullYear() + 1 }))
      .expect(400);
    await post(applicant, '/doctor-applications')
      .send(details({ registrationNumber: '<script>' }))
      .expect(400);
  });

  it('allows one pending application per account and one live claim per registration', async () => {
    const first = await register();
    const registrationNumber = uniqueRegistration();
    await apply(first, { registrationNumber });

    const again = await post(first, '/doctor-applications').send(details()).expect(409);
    expect(again.body.error.code).toBe('APPLICATION_PENDING');

    const other = await register();
    const sameNumber = await post(other, '/doctor-applications')
      .send(details({ registrationNumber: registrationNumber.toLowerCase().replace(/-/g, ' ') }))
      .expect(409);
    expect(sameNumber.body.error.code).toBe('REGISTRATION_IN_USE');
  });
});

describe('reviewing applications', () => {
  it('is limited to reviewers with providers:verify', async () => {
    const patient = await register();
    await patient.agent.get(`${API}/admin/doctor-applications`).expect(403);
    const support = await signInAs(['support_agent']);
    await support.agent.get(`${API}/admin/doctor-applications`).expect(403);
  });

  it('lists pending applications with the applicant and audits the read', async () => {
    const applicant = await register();
    const id = await apply(applicant);
    const admin = await signInAs(['platform_admin']);

    const res = await admin.agent
      .get(`${API}/admin/doctor-applications?status=pending&limit=100`)
      .expect(200);
    const item = res.body.items.find((entry: { id: string }) => entry.id === id);
    expect(item.applicant).toMatchObject({ email: applicant.email, emailVerified: false });
    expect(
      await audits.countDocuments({ action: 'admin.doctor_applications.list', outcome: 'success' }),
    ).toBeGreaterThan(0);
  });

  it('only approves after the register check is confirmed, then grants the doctor role', async () => {
    const applicant = await register();
    const id = await apply(applicant);
    const admin = await signInAs(['platform_admin']);

    await post(admin, `/admin/doctor-applications/${id}/approve`).send({}).expect(400);
    await post(admin, `/admin/doctor-applications/${id}/approve`)
      .send({ registerChecked: false })
      .expect(400);

    const approved = await post(admin, `/admin/doctor-applications/${id}/approve`)
      .send({ registerChecked: true, note: 'Checked on the state register' })
      .expect(200);
    expect(approved.body.status).toBe('approved');

    const account = await applicant.agent.get(`${API}/auth/me`).expect(200);
    expect(account.body.user.roles).toEqual(expect.arrayContaining(['patient', 'doctor']));
    expect(account.body.user.permissions).toContain('provider:profile:manage-own');

    const audit = await audits.findOne({ action: 'doctor_application.approve', targetId: id });
    expect(audit?.metadata).toMatchObject({ registerChecked: true });
    await mailbox.waitFor(applicant.email, /doctor application is approved/);

    const twice = await post(admin, `/admin/doctor-applications/${id}/approve`)
      .send({ registerChecked: true })
      .expect(409);
    expect(twice.body.error.code).toBe('APPLICATION_ALREADY_REVIEWED');

    const reapply = await post(applicant, '/doctor-applications').send(details()).expect(409);
    expect(reapply.body.error.code).toBe('ALREADY_A_DOCTOR');
  });

  it('never lets reviewers approve their own application', async () => {
    const admin = await signInAs(['platform_admin']);
    const id = await apply(admin);

    const res = await post(admin, `/admin/doctor-applications/${id}/approve`)
      .send({ registerChecked: true })
      .expect(403);
    expect(res.body.error.code).toBe('SELF_REVIEW_FORBIDDEN');
    expect((await users.findOne({ email: admin.email }))?.roles).not.toContain('doctor');
    expect(
      await audits.countDocuments({ action: 'doctor_application.review', outcome: 'denied' }),
    ).toBeGreaterThan(0);
  });

  it('rejects with a reason the applicant can see, and allows a corrected re-application', async () => {
    const applicant = await register();
    const registrationNumber = uniqueRegistration();
    const id = await apply(applicant, { registrationNumber });
    const admin = await signInAs(['platform_admin']);

    await post(admin, `/admin/doctor-applications/${id}/reject`).send({ reason: 'no' }).expect(400);
    await post(admin, `/admin/doctor-applications/${id}/reject`)
      .send({ reason: 'The registration year does not match the council register.' })
      .expect(200);

    const me = await applicant.agent.get(`${API}/doctor-applications/me`).expect(200);
    expect(me.body.application).toMatchObject({
      status: 'rejected',
      rejectionReason: 'The registration year does not match the council register.',
    });
    expect(me.body.application).not.toHaveProperty('reviewNote');
    await mailbox.waitFor(applicant.email, /Update on your Sukoon Health doctor application/);

    await apply(applicant, { registrationNumber, registrationYear: 2016 });
    const account = await applicant.agent.get(`${API}/auth/me`).expect(200);
    expect(account.body.user.roles).toEqual(['patient']);
  });

  it('answers 404 for unknown or malformed ids', async () => {
    const admin = await signInAs(['platform_admin']);
    await post(admin, '/admin/doctor-applications/not-an-id/approve')
      .send({ registerChecked: true })
      .expect(404);
    await post(admin, '/admin/doctor-applications/0123456789abcdef01234567/reject')
      .send({ reason: 'Registration could not be found.' })
      .expect(404);
  });
});

describe('doctor profiles and the public directory', () => {
  const put = (who: SignedIn, body: Record<string, unknown>) =>
    who.agent
      .put(`${API}/doctor-profile/me`)
      .set('Origin', TEST_ORIGIN)
      .set('X-CSRF-Token', who.csrf)
      .send(body);

  const completeProfile = (overrides: Record<string, unknown> = {}) => ({
    bio: 'Family physician with a focus on preventive care, diabetes and blood pressure.',
    languages: ['English', 'Kannada'],
    consultationModes: ['online', 'clinic'],
    consultationFeeInr: 500,
    clinicName: 'Synthetic Family Clinic',
    city: 'Bengaluru',
    locality: 'Jayanagar',
    published: true,
    ...overrides,
  });

  /** Registers, applies and gets approved; returns the new doctor's signed-in agent. */
  async function approvedDoctor(fullName: string, specialty: string) {
    const doctor = await register(fullName);
    const id = await apply(doctor, { specialty });
    const admin = await signInAs(['platform_admin']);
    await post(admin, `/admin/doctor-applications/${id}/approve`)
      .send({ registerChecked: true })
      .expect(200);
    return doctor;
  }

  const directory = (query: string) =>
    request(app.getHttpServer()).get(`${API}/doctors?${query}`).expect(200);

  it('creates an unpublished draft with the reviewed details when approved', async () => {
    const doctor = await approvedDoctor('Meera Iyer', 'Dermatologist');
    const res = await doctor.agent.get(`${API}/doctor-profile/me`).expect(200);
    expect(res.body).toMatchObject({
      displayName: 'Meera Iyer',
      specialty: 'Dermatologist',
      registrationCouncil: 'Karnataka Medical Council',
      published: false,
    });
    expect(res.body.slug).toMatch(/^dr-meera-iyer-[a-f0-9]{6}$/);
    expect(res.body.missing.length).toBeGreaterThan(0);

    await request(app.getHttpServer()).get(`${API}/doctors/${res.body.slug}`).expect(404);
    expect((await directory('specialty=dermatologist')).body.total).toBe(0);
  });

  it('is only available to doctors', async () => {
    const patient = await register();
    await patient.agent.get(`${API}/doctor-profile/me`).expect(403);
    await put(patient, completeProfile()).expect(403);
  });

  it('refuses to publish an incomplete profile and explains what is missing', async () => {
    const doctor = await approvedDoctor('Ravi Kumar', 'Paediatrician');
    const res = await put(
      doctor,
      completeProfile({ bio: 'Short.', consultationFeeInr: null, clinicName: '' }),
    ).expect(400);
    expect(res.body.error.code).toBe('PROFILE_INCOMPLETE');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.stringContaining('about'),
        'a consultation fee',
        'the clinic name',
      ]),
    );

    const draft = await put(doctor, completeProfile({ bio: 'Short.', published: false })).expect(
      200,
    );
    expect(draft.body.published).toBe(false);
  });

  it('never lets doctors change their reviewed details', async () => {
    const doctor = await approvedDoctor('Anita Desai', 'Gynaecologist');
    for (const field of [
      { specialty: 'Cardiologist' },
      { registrationNumber: 'FAKE-1' },
      { displayName: 'Someone Else' },
      { userId: '0123456789abcdef01234567' },
    ]) {
      const res = await put(doctor, completeProfile(field)).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    }
    const me = await doctor.agent.get(`${API}/doctor-profile/me`).expect(200);
    expect(me.body).toMatchObject({ specialty: 'Gynaecologist', displayName: 'Anita Desai' });
  });

  it('lists published profiles publicly, with filters and the reviewed registration', async () => {
    const doctor = await approvedDoctor('Kavya Rao', 'Pulmonologist');
    const saved = await put(doctor, completeProfile({ city: 'Mysuru' })).expect(200);
    expect(saved.body).toMatchObject({ published: true, missing: [] });

    const list = await directory('specialty=pulmonologist&city=mysuru&mode=clinic');
    expect(list.body.total).toBe(1);
    expect(list.body.items[0]).toMatchObject({ displayName: 'Kavya Rao', city: 'Mysuru' });
    expect(list.body.items[0]).not.toHaveProperty('userId');
    expect(list.body.items[0]).not.toHaveProperty('bio');

    expect((await directory('specialty=pulmonologist&language=Tamil')).body.total).toBe(0);
    expect((await directory('specialty=pulmonologist&feeBand=under_500')).body.total).toBe(1);
    expect((await directory('specialty=pulmonologist&feeBand=free')).body.total).toBe(0);
    expect((await directory('q=kavya')).body.total).toBe(1);
    expect((await directory('q=.*')).body.total).toBe(0);

    const profile = await request(app.getHttpServer())
      .get(`${API}/doctors/${saved.body.slug}`)
      .expect(200);
    expect(profile.body).toMatchObject({
      registrationCouncil: 'Karnataka Medical Council',
      bio: expect.stringContaining('preventive care'),
    });
    expect(profile.body.registrationCheckedAt).toEqual(expect.any(String));

    const filters = await request(app.getHttpServer()).get(`${API}/doctors/filters`).expect(200);
    expect(filters.body.specialties).toContain('Pulmonologist');
    expect(filters.body.cities).toContain('Mysuru');

    expect((await directory('specialty=pulmonologist&takingBookings=1')).body.total).toBe(0);
    await doctor.agent
      .patch(`${API}/doctor-profile/me/availability`)
      .set('Origin', TEST_ORIGIN)
      .set('X-CSRF-Token', doctor.csrf)
      .send({ availabilityStatus: 'available' })
      .expect(200);
    expect((await directory('specialty=pulmonologist&takingBookings=1')).body.total).toBe(1);

    expect((await directory('specialty=pulmonologist&hasOpenSlots=1')).body.total).toBe(0);
    await doctor.agent
      .put(`${API}/doctor-schedule/me`)
      .set('Origin', TEST_ORIGIN)
      .set('X-CSRF-Token', doctor.csrf)
      .send({ rules: CLINIC_HOURS, daysOff: [] })
      .expect(200);
    const withSlots = await directory('specialty=pulmonologist&hasOpenSlots=1');
    expect(withSlots.body.total).toBe(1);
    expect(withSlots.body.items[0].nextAvailableDate).toEqual(expect.any(String));

    const weekendOnly = [
      {
        day: 6,
        start: '09:00',
        end: '12:00',
        slotMinutes: 30,
        mode: 'clinic' as const,
      },
    ];
    await doctor.agent
      .put(`${API}/doctor-schedule/me`)
      .set('Origin', TEST_ORIGIN)
      .set('X-CSRF-Token', doctor.csrf)
      .send({ rules: weekendOnly, daysOff: [] })
      .expect(200);
    expect((await directory('specialty=pulmonologist&availWhen=weekend')).body.total).toBe(1);

    const todayWeekday = istWeekday(istDate(new Date()));
    const todayHours = [
      {
        day: todayWeekday,
        start: '09:00',
        end: '17:00',
        slotMinutes: 30,
        mode: 'clinic' as const,
      },
    ];
    await doctor.agent
      .put(`${API}/doctor-schedule/me`)
      .set('Origin', TEST_ORIGIN)
      .set('X-CSRF-Token', doctor.csrf)
      .send({ rules: todayHours, daysOff: [] })
      .expect(200);
    expect((await directory('specialty=pulmonologist&availWhen=today')).body.total).toBe(1);

    const tonightHours = [
      {
        day: todayWeekday,
        start: '18:00',
        end: '21:00',
        slotMinutes: 30,
        mode: 'clinic' as const,
      },
    ];
    await doctor.agent
      .put(`${API}/doctor-schedule/me`)
      .set('Origin', TEST_ORIGIN)
      .set('X-CSRF-Token', doctor.csrf)
      .send({ rules: tonightHours, daysOff: [] })
      .expect(200);
    expect((await directory('specialty=pulmonologist&availWhen=tonight')).body.total).toBe(1);

    const holiday = nextIndiaPublicHoliday(istDate(new Date()), BOOKING_WINDOW_DAYS);
    expect(holiday).toBeTruthy();
    await doctor.agent
      .put(`${API}/doctor-schedule/me`)
      .set('Origin', TEST_ORIGIN)
      .set('X-CSRF-Token', doctor.csrf)
      .send({
        rules: [],
        extraBlocks: [
          {
            date: holiday,
            start: '10:00',
            end: '12:00',
            slotMinutes: 30,
            mode: 'clinic',
          },
        ],
        daysOff: [],
      })
      .expect(200);
    expect((await directory('specialty=pulmonologist&availWhen=public_holiday')).body.total).toBe(
      1,
    );
  });

  it('drops a profile from the directory when the account loses doctor access', async () => {
    const doctor = await approvedDoctor('Suresh Nair', 'Nephrologist');
    const saved = await put(doctor, completeProfile()).expect(200);
    expect((await directory('specialty=nephrologist')).body.total).toBe(1);

    await users.updateOne({ email: doctor.email }, { $pull: { roles: 'doctor' } });
    expect((await directory('specialty=nephrologist')).body.total).toBe(0);
    await request(app.getHttpServer()).get(`${API}/doctors/${saved.body.slug}`).expect(404);

    await users.updateOne(
      { email: doctor.email },
      { $addToSet: { roles: 'doctor' }, $set: { status: 'disabled' } },
    );
    expect((await directory('specialty=nephrologist')).body.total).toBe(0);
  });

  it('rejects malformed directory queries', async () => {
    await request(app.getHttpServer()).get(`${API}/doctors?mode=house-call`).expect(400);
    await request(app.getHttpServer()).get(`${API}/doctors?availWhen=soon`).expect(400);
    await request(app.getHttpServer()).get(`${API}/doctors?feeBand=under_99`).expect(400);
    await request(app.getHttpServer()).get(`${API}/doctors?sort=soonest`).expect(400);
    await request(app.getHttpServer()).get(`${API}/doctors?limit=500`).expect(400);
    await request(app.getHttpServer()).get(`${API}/doctors/NOT%20A%20SLUG`).expect(404);
  });
});
