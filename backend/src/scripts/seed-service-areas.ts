import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { loadEnv } from '../config/load-env';
import { HOME_VISIT_SERVICE_AREA_SEED } from '../modules/home-visits/service-area-seed';
import { ServiceAreasService } from '../modules/home-visits/service-areas.service';

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.createApplicationContext(AppModule.forRoot(env), {
    logger: ['error'],
  });
  try {
    const areas = app.get(ServiceAreasService);
    const changed = await areas.upsertSeedRows();
    console.log(
      `Seeded ${HOME_VISIT_SERVICE_AREA_SEED.length} pilot service area PIN(s); ${changed} row(s) changed.`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
