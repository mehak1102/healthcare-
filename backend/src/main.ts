import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap/configure-app';
import { setupSwagger } from './bootstrap/swagger';
import { loadEnv } from './config/load-env';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(env), {
    bufferLogs: true,
    bodyParser: false,
    // Payment webhooks are signed over the exact bytes received.
    rawBody: true,
  });
  configureApp(app, env);
  setupSwagger(app, env);
  await app.listen(env.PORT);

  const logger = new Logger('Bootstrap');
  logger.log(`API listening on port ${env.PORT} (${env.NODE_ENV})`);
  if (env.NODE_ENV === 'development') {
    logger.log(`API docs: http://localhost:${env.PORT}/api/docs`);
  }
}

bootstrap().catch((error: unknown) => {
  // The structured logger may not exist yet (e.g. invalid configuration), so use stderr.
  process.stderr.write(
    `\nAPI failed to start: ${error instanceof Error ? error.message : String(error)}\n\n`,
  );
  process.exit(1);
});
