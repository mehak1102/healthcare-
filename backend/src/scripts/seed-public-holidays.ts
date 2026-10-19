import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { loadEnv } from '../config/load-env';
import { INDIA_PUBLIC_HOLIDAY_SEED } from '../modules/calendar/india-public-holiday-seed';
import { PublicHolidaysService } from '../modules/calendar/public-holidays.service';

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.createApplicationContext(AppModule.forRoot(env), {
    logger: ['error'],
  });
  try {
    const holidays = app.get(PublicHolidaysService);
    const changed = await holidays.upsertSeedRows();
    const refresh = await holidays.refreshActiveDates();
    console.log(
      `Seeded ${INDIA_PUBLIC_HOLIDAY_SEED.length} India public holiday(s); ${changed} row(s) changed. Active source: ${refresh.source} (${refresh.count} dates).`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
