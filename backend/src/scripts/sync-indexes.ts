import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { AppModule } from '../app.module';
import { loadEnv } from '../config/load-env';

/**
 * Creates any missing indexes declared in the Mongoose schemas. Never drops indexes; removing an
 * index is a reviewed, manual migration step.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.createApplicationContext(AppModule.forRoot(env), {
    logger: ['error'],
  });
  try {
    const connection = app.get<Connection>(getConnectionToken());
    for (const model of Object.values(connection.models)) {
      await model.createIndexes();
      const indexes = await model.listIndexes();
      console.log(`✔ ${model.collection.collectionName}: ${indexes.map((i) => i.name).join(', ')}`);
    }
    console.log(`Indexes are up to date in database "${env.MONGODB_DB_NAME}".`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('Index sync failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
