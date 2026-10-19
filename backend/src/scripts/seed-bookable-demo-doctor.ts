import { NestFactory } from '@nestjs/core';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../app.module';
import type { Env } from '../config/env.schema';
import { loadEnv } from '../config/load-env';
import { sessionAccess } from '../modules/access-control/session-access';
import type { Role } from '../modules/access-control/roles';
import { SchedulesService } from '../modules/appointments/schedules.service';
import type { AuthContext } from '../modules/auth/auth-context';
import type { RequestMeta } from '../common/http/app-request';
import { DoctorApplicationsService } from '../modules/doctors/doctor-applications.service';
import { DoctorProfilesService } from '../modules/doctors/doctor-profiles.service';
import { UsersService } from '../modules/users/users.service';

const DOCTOR_EMAIL = 'doctor.demo@sukoon.test';
const ADMIN_EMAIL = 'admin.demo@sukoon.test';
const SLUG_FILE = join(process.cwd(), '..', 'e2e', '.doctor-slug');

const META: RequestMeta = {
  requestId: 'seed-bookable-demo-doctor',
  ipAddress: '127.0.0.1',
  userAgent: 'seed-script',
};

const WEEKLY_HOURS = (mode: 'clinic' | 'online') =>
  [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    start: '09:00',
    end: '17:00',
    slotMinutes: 15,
    mode,
  }));

function authFor(userId: string, roles: Role[], env: Env): AuthContext {
  const access = sessionAccess(env, roles, true);
  return {
    userId,
    sessionId: 'seed',
    tokenHash: 'seed',
    roles,
    permissions: access.permissions,
    mfaVerified: true,
    staffMfaRequired: access.staffMfaRequired,
  };
}

async function main(): Promise<void> {
  const env = loadEnv();
  if (env.NODE_ENV !== 'development' || /prod/i.test(env.MONGODB_DB_NAME)) {
    throw new Error(
      'Refusing to seed: requires NODE_ENV=development and a non-production database name.',
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule.forRoot(env), {
    logger: ['error'],
  });
  try {
    const users = app.get(UsersService);
    const applications = app.get(DoctorApplicationsService);
    const profiles = app.get(DoctorProfilesService);
    const schedules = app.get(SchedulesService);

    const doctor = await users.findByEmailWithPassword(DOCTOR_EMAIL);
    const admin = await users.findByEmailWithPassword(ADMIN_EMAIL);
    if (!doctor) {
      throw new Error(`Run npm run db:seed -w backend first (missing ${DOCTOR_EMAIL}).`);
    }
    if (!admin?.roles.includes('platform_admin')) {
      throw new Error(`Run npm run db:seed -w backend first (missing admin ${ADMIN_EMAIL}).`);
    }

    const doctorAuth = authFor(doctor.id, doctor.roles as Role[], env);
    const adminAuth = authFor(admin.id, ['platform_admin'], env);

    let application = await applications.findLatestForUser(doctor.id);
    if (!application || application.status === 'rejected') {
      application = await applications.submit(
        doctorAuth,
        {
          registrationNumber: `DEMO-${randomBytes(4).toString('hex')}`,
          registrationCouncil: 'Karnataka Medical Council',
          registrationYear: 2015,
          qualification: 'MBBS',
          specialty: 'General Physician',
        },
        META,
      );
      console.log('✔ submitted doctor application');
    }

    if (application.status === 'pending') {
      await applications.approve(adminAuth, application.id, { registerChecked: true }, META);
      console.log('✔ approved doctor application');
    }

    const paid = process.env.SEED_DEMO_PAID === 'true';
    const video = process.env.SEED_DEMO_VIDEO === 'true';
    const instantConfirm = process.env.SEED_DEMO_INSTANT_CONFIRM === 'true' || paid;
    const feeInr = paid ? 500 : 0;
    const consultationModes = video ? (['online'] as const) : (['clinic'] as const);
    const scheduleRules = video ? WEEKLY_HOURS('online') : WEEKLY_HOURS('clinic');

    await profiles.updateMine(
      doctorAuth,
      {
        bio:
          'Synthetic demo doctor for local browser tests and manual QA. Not a real clinician. ' +
          (video
            ? 'Offers video consultation slots when LiveKit is configured.'
            : 'Offers in-clinic slots for booking checks in development.'),
        languages: ['English', 'Hindi'],
        consultationModes: [...consultationModes],
        consultationFeeInr: feeInr,
        clinicName: video ? null : 'Sukoon Demo Clinic',
        city: video ? null : 'Bengaluru',
        locality: video ? null : 'Indiranagar',
        published: true,
        requiresBookingApproval: !instantConfirm,
      },
      META,
    );
    const meta = { instantConfirm, paid, video };
    writeFileSync(
      join(process.cwd(), '..', 'e2e', '.demo-seed-meta.json'),
      JSON.stringify(meta),
      'utf8',
    );
    const kind = video ? 'video' : 'in-clinic';
    console.log(
      `✔ updated demo doctor profile (${kind}, ₹${feeInr}, ${instantConfirm ? 'instant confirm' : 'doctor approval'})`,
    );

    await profiles.setAvailability(doctorAuth, 'available', META);
    await schedules.updateMine(doctorAuth, { rules: scheduleRules, daysOff: [] }, META);
    console.log('✔ timetable and availability set');

    const profile = await profiles.findMine(doctor.id);
    const nextDate = await schedules.refreshNextAvailableCache(profile);
    console.log(`✔ next available date cache: ${nextDate ?? 'none in the next 30 days'}`);
    writeFileSync(SLUG_FILE, profile.slug, 'utf8');
    console.log(`\nDemo doctor slug: ${profile.slug}`);
    console.log(`Written to ${SLUG_FILE}`);
    console.log('\nBrowser tests can use:');
    console.log(`  export E2E_DOCTOR_SLUG='${profile.slug}'`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
