import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SchedulesService } from '../modules/appointments/schedules.service';
import { loadEnv } from '../config/load-env';
import { DIRECTORY_OPEN_SLOTS_SCAN_LIMIT, DoctorProfilesService } from '../modules/doctors/doctor-profiles.service';

/**
 * Recomputes cached `nextAvailableDate` for listed doctors (up to the directory scan cap).
 * Run after deploying cache fields or when sorting by soonest appointment looks stale.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.createApplicationContext(AppModule.forRoot(env), {
    logger: ['error'],
  });
  try {
    const profiles = app.get(DoctorProfilesService);
    const schedules = app.get(SchedulesService);
    const listed = await profiles.listAllMatchingPublic(
      { page: 1, limit: 12 },
      DIRECTORY_OPEN_SLOTS_SCAN_LIMIT,
    );
    let withDate = 0;
    for (const profile of listed) {
      const date = await schedules.refreshNextAvailableCache(profile);
      if (date) withDate++;
    }
    console.log(
      `Refreshed nextAvailableDate for ${listed.length} listed doctor(s); ${withDate} have a bookable date in the next 30 days.`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('Refresh failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
