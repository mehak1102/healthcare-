import { getModelToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Types, type Model } from 'mongoose';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { Role } from '../src/modules/access-control/roles';
import { PasswordService } from '../src/modules/auth/password.service';
import { DoctorProfile } from '../src/modules/doctors/doctor-profile.schema';
import { User } from '../src/modules/users/user.schema';
import { createTestApp, TEST_ORIGIN } from './test-app';

const PASSWORD = 'quiet river morning tea';
const API = '/api/v1';

let mongo: MongoMemoryReplSet;
let app: NestExpressApplication;
let users: Model<User>;
let profiles: Model<DoctorProfile>;
let counter = 0;

const uniqueEmail = (label: string) => `${label}.${Date.now()}.${counter++}@example.test`;
const uniqueRegistration = () => `TEST-${Date.now()}-${counter++}`;

interface SignedIn {
  agent: TestAgent;
  csrf: string;
  email: string;
  id: string;
}

async function register(
  accountType: 'patient' | 'doctor' = 'patient',
  fullName = accountType === 'doctor' ? 'Synthetic Doctor' : 'Synthetic Patient',
): Promise<SignedIn> {
  const email = uniqueEmail(accountType);
  const agent = request.agent(app.getHttpServer());
  const res = await agent
    .post(`${API}/auth/register`)
    .set('Origin', TEST_ORIGIN)
    .send({ fullName, email, password: PASSWORD, acceptTerms: true, accountType })
    .expect(201);
  return {
    agent,
    csrf: res.body.csrfToken as string,
    email,
    id: res.body.user.id as string,
  };
}

async function signInAs(roles: Role[]): Promise<SignedIn> {
  const email = uniqueEmail('staff');
  const created = await users.create({
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
  return { agent, csrf: res.body.csrfToken as string, email, id: created.id };
}

const send = (who: SignedIn, method: 'post' | 'put' | 'patch', path: string) =>
  who.agent[method](`${API}${path}`).set('Origin', TEST_ORIGIN).set('X-CSRF-Token', who.csrf);

const credentials = () => ({
  registrationNumber: uniqueRegistration(),
  registrationCouncil: 'Karnataka Medical Council',
  registrationYear: 2016,
  qualification: 'MBBS, MD (General Medicine)',
  specialty: 'General Physician',
});

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  ({ app } = await createTestApp(mongo.getUri(), 'sukoon_e2e_roles'));
  users = app.get(getModelToken(User.name));
  profiles = app.get(getModelToken(DoctorProfile.name));
});

afterAll(async () => {
  await app?.close();
  await mongo?.stop();
});

describe('patient and doctor accounts', () => {
  it('registers and signs in a patient, and opens only the patient dashboard', async () => {
    const patient = await register('patient');
    expect((await patient.agent.get(`${API}/auth/me`)).body.user.roles).toEqual(['patient']);

    const again = request.agent(app.getHttpServer());
    const login = await again
      .post(`${API}/auth/login`)
      .set('Origin', TEST_ORIGIN)
      .send({ email: patient.email, password: PASSWORD, portal: 'patient' })
      .expect(200);
    expect(login.body.user.roles).toEqual(['patient']);

    const dashboard = await patient.agent.get(`${API}/patient/dashboard`).expect(200);
    expect(dashboard.body.upcomingCount).toBe(0);
    expect(dashboard.body.records.available).toBe(false);
    expect(dashboard.body.homeVisits.available).toBe(false);

    await patient.agent.get(`${API}/doctor/dashboard`).expect(403);
    await patient.agent.get(`${API}/doctor-profile/me`).expect(403);
    await patient.agent.get(`${API}/admin/doctor-applications`).expect(403);
    await patient.agent.get(`${API}/admin/users`).expect(403);
  });

  it('registers a doctor as pending and refuses a patient portal sign-in', async () => {
    const doctor = await register('doctor');
    const me = await doctor.agent.get(`${API}/auth/me`).expect(200);
    expect(me.body.user.roles).toEqual(['doctor']);

    const stored = await users.findOne({ email: doctor.email }).lean();
    expect(stored?.doctorVerification).toBe('pending');

    const dashboard = await doctor.agent.get(`${API}/doctor/dashboard`).expect(200);
    expect(dashboard.body.verificationStatus).toBe('pending');
    expect(dashboard.body.profileCompletion).toBe('incomplete');
    expect(dashboard.body.nextSteps.join(' ')).toMatch(/administrator/i);

    await doctor.agent.get(`${API}/patient/dashboard`).expect(403);

    const wrongPortal = request.agent(app.getHttpServer());
    const denied = await wrongPortal
      .post(`${API}/auth/login`)
      .set('Origin', TEST_ORIGIN)
      .send({ email: doctor.email, password: PASSWORD, portal: 'patient' })
      .expect(403);
    expect(denied.body.error.code).toBe('PORTAL_MISMATCH');
    await wrongPortal.get(`${API}/auth/me`).expect(401);

    const rightPortal = request.agent(app.getHttpServer());
    await rightPortal
      .post(`${API}/auth/login`)
      .set('Origin', TEST_ORIGIN)
      .send({ email: doctor.email, password: PASSWORD, portal: 'doctor' })
      .expect(200);
  });

  it('rejects public attempts to choose a staff role', async () => {
    const agent = request.agent(app.getHttpServer());
    const asAdmin = await agent
      .post(`${API}/auth/register`)
      .set('Origin', TEST_ORIGIN)
      .send({
        fullName: 'Would-be Admin',
        email: uniqueEmail('admin'),
        password: PASSWORD,
        acceptTerms: true,
        accountType: 'platform_admin',
      })
      .expect(400);
    expect(asAdmin.body.error.code).toBe('VALIDATION_FAILED');

    const massAssignment = await agent
      .post(`${API}/auth/register`)
      .set('Origin', TEST_ORIGIN)
      .send({
        fullName: 'Would-be Admin',
        email: uniqueEmail('admin'),
        password: PASSWORD,
        acceptTerms: true,
        accountType: 'doctor',
        roles: ['super_admin'],
      })
      .expect(400);
    expect(massAssignment.body.error.details.join(' ')).toMatch(/roles should not exist/);
  });

  it('keeps a pending doctor out of booking and stops them verifying themselves', async () => {
    const doctor = await register('doctor');
    const applied = await send(doctor, 'post', '/doctor-applications')
      .send(credentials())
      .expect(201);
    expect(applied.body.status).toBe('pending');

    const forged = await send(doctor, 'put', '/doctor-profile/me')
      .send({
        bio: 'x'.repeat(60),
        languages: ['English'],
        consultationModes: ['clinic'],
        consultationFeeInr: 400,
        clinicName: 'Pending Clinic',
        city: 'Bengaluru',
        published: true,
        doctorVerification: 'verified',
      })
      .expect(400);
    expect(forged.body.error.details.join(' ')).toMatch(/doctorVerification should not exist/);

    const unpublished = await send(doctor, 'put', '/doctor-profile/me')
      .send({
        bio: 'x'.repeat(60),
        languages: ['English'],
        consultationModes: ['clinic'],
        consultationFeeInr: 400,
        clinicName: 'Pending Clinic',
        city: 'Bengaluru',
        published: true,
      })
      .expect(403);
    expect(unpublished.body.error.code).toBe('DOCTOR_NOT_VERIFIED');

    const availability = await send(doctor, 'patch', '/doctor-profile/me/availability')
      .send({ availabilityStatus: 'available' })
      .expect(403);
    expect(availability.body.error.code).toBe('DOCTOR_NOT_VERIFIED');

    const profile = await profiles.findOne({ userId: new Types.ObjectId(doctor.id) }).lean();
    expect(profile?.slug).toBeTruthy();
    await profiles.updateOne(
      { userId: new Types.ObjectId(doctor.id) },
      { $set: { published: true } },
    );
    await request(app.getHttpServer()).get(`${API}/doctors/${profile!.slug}`).expect(404);

    const selfApprove = await send(
      doctor,
      'post',
      `/admin/doctor-applications/${applied.body.id}/approve`,
    )
      .send({ registerChecked: true })
      .expect(403);
    expect(selfApprove.body.error.code).toBe('FORBIDDEN');
  });

  it('lets a verified doctor manage availability, and an administrator suspend them', async () => {
    const doctor = await register('doctor');
    const applied = await send(doctor, 'post', '/doctor-applications')
      .send(credentials())
      .expect(201);
    const admin = await signInAs(['platform_admin']);
    await send(admin, 'post', `/admin/doctor-applications/${applied.body.id}/approve`)
      .send({ registerChecked: true })
      .expect(200);

    const verified = await doctor.agent.get(`${API}/doctor/dashboard`).expect(200);
    expect(verified.body.verificationStatus).toBe('verified');
    expect((await users.findOne({ email: doctor.email }))?.roles).toEqual(
      expect.arrayContaining(['doctor']),
    );

    await send(doctor, 'put', '/doctor-profile/me')
      .send({
        bio: 'Synthetic verified doctor used only by automated tests. Not a real clinician.',
        languages: ['English'],
        consultationModes: ['clinic'],
        consultationFeeInr: 500,
        clinicName: 'Verified Clinic',
        city: 'Mysuru',
        published: true,
      })
      .expect(200);

    const profile = await profiles.findOne({ userId: new Types.ObjectId(doctor.id) }).lean();
    const before = await request(app.getHttpServer())
      .get(`${API}/doctors/${profile!.slug}/slots`)
      .expect(200);
    expect(before.body.unavailableReason).toBe('not_accepting');

    await send(doctor, 'patch', '/doctor-profile/me/availability')
      .send({ availabilityStatus: 'available' })
      .expect(200);
    await send(doctor, 'patch', '/doctor-profile/me/availability')
      .send({ availabilityStatus: 'on_leave' })
      .expect(200);
    const onLeave = await request(app.getHttpServer())
      .get(`${API}/doctors/${profile!.slug}/slots`)
      .expect(200);
    expect(onLeave.body.unavailableReason).toBe('not_accepting');

    const reviewer = await signInAs(['platform_admin', 'doctor']);
    const selfSuspend = await send(reviewer, 'post', `/admin/doctors/${reviewer.id}/suspend`)
      .send({ reason: 'A doctor must not be able to suspend their own account.' })
      .expect(403);
    expect(selfSuspend.body.error.code).toBe('SELF_REVIEW_FORBIDDEN');

    await send(admin, 'post', `/admin/doctors/${doctor.id}/suspend`)
      .send({ reason: 'Registration could not be confirmed on review.' })
      .expect(200);
    expect((await users.findOne({ email: doctor.email }))?.doctorVerification).toBe('suspended');
    await request(app.getHttpServer()).get(`${API}/doctors/${profile!.slug}`).expect(404);
    await send(doctor, 'patch', '/doctor-profile/me/availability')
      .send({ availabilityStatus: 'available' })
      .expect(403);

    const patient = await register('patient');
    await request(app.getHttpServer()).get(`${API}/doctors`).expect(200);
    await patient.agent.get(`${API}/doctors`).expect(200);
    await doctor.agent.get(`${API}/doctors`).expect(200);
  });

  it('signs administrators in through the staff option only', async () => {
    const admin = await signInAs(['platform_admin']);
    const staffLogin = request.agent(app.getHttpServer());
    await staffLogin
      .post(`${API}/auth/login`)
      .set('Origin', TEST_ORIGIN)
      .send({ email: admin.email, password: PASSWORD, portal: 'staff' })
      .expect(200);

    const asPatient = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .set('Origin', TEST_ORIGIN)
      .send({ email: admin.email, password: PASSWORD, portal: 'patient' })
      .expect(403);
    expect(asPatient.body.error.code).toBe('PORTAL_MISMATCH');

    const patient = await register('patient');
    const patientAsStaff = request.agent(app.getHttpServer());
    const denied = await patientAsStaff
      .post(`${API}/auth/login`)
      .set('Origin', TEST_ORIGIN)
      .send({ email: patient.email, password: PASSWORD, portal: 'staff' })
      .expect(403);
    expect(denied.body.error.code).toBe('PORTAL_MISMATCH');
    await patientAsStaff.get(`${API}/auth/me`).expect(401);

    const registerAsStaff = await request(app.getHttpServer())
      .post(`${API}/auth/register`)
      .set('Origin', TEST_ORIGIN)
      .send({
        fullName: 'Would-be Staff',
        email: uniqueEmail('staff-signup'),
        password: PASSWORD,
        acceptTerms: true,
        accountType: 'staff',
      })
      .expect(400);
    expect(registerAsStaff.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('still signs out and ends the session', async () => {
    const patient = await register('patient');
    await send(patient, 'post', '/auth/logout').expect(204);
    await patient.agent.get(`${API}/auth/me`).expect(401);
  });
});
