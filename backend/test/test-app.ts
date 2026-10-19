import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';
import { validateEnv, type Env } from '../src/config/env.schema';
import { MAIL_TRANSPORT } from '../src/modules/mail/mail-transport';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../src/modules/payments/payment-gateway';
import { VIDEO_GATEWAY, type VideoGateway } from '../src/modules/video/video-gateway';
import { TestMailbox } from './test-mailbox';

export const TEST_ORIGIN = 'http://localhost:5173';

/**
 * Boots the real application stack (guards, pipes, filters) against the given database. When the
 * console mail transport is configured, it is replaced by an in-memory mailbox.
 */
export async function createTestApp(
  mongoUri: string,
  dbName: string,
  overrides: Record<string, string> = {},
  options: { paymentGateway?: PaymentGateway; videoGateway?: VideoGateway } = {},
): Promise<{ app: NestExpressApplication; env: Env; mailbox: TestMailbox }> {
  const env = validateEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    MONGODB_URI: mongoUri,
    MONGODB_DB_NAME: dbName,
    SESSION_SECRET: 'integration-test-secret-'.padEnd(48, 'x'),
    CORS_ORIGINS: TEST_ORIGIN,
    APP_BASE_URL: TEST_ORIGIN,
    RATE_LIMIT_PER_MINUTE: '10000',
    AUTH_RATE_LIMIT_PER_MINUTE: '10000',
    ...overrides,
  });
  const mailbox = new TestMailbox();
  const builder = Test.createTestingModule({ imports: [AppModule.forRoot(env)] });
  if (env.MAIL_TRANSPORT === 'console') builder.overrideProvider(MAIL_TRANSPORT).useValue(mailbox);
  if (options.paymentGateway) {
    builder.overrideProvider(PAYMENT_GATEWAY).useValue(options.paymentGateway);
  }
  if (options.videoGateway) {
    builder.overrideProvider(VIDEO_GATEWAY).useValue(options.videoGateway);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
    bufferLogs: true,
    rawBody: true,
  });
  configureApp(app, env);
  await app.init();
  return { app, env, mailbox };
}
