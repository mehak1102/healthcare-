import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Env } from '../config/env.schema';
import { sessionCookieName } from '../modules/auth/session-cookie';

/** OpenAPI docs at /api/docs, development only. */
export function setupSwagger(app: INestApplication, env: Env): void {
  if (env.NODE_ENV !== 'development') return;
  const config = new DocumentBuilder()
    .setTitle('Sukoon Health API')
    .setDescription(
      'Session cookie auth. Unsafe methods need X-CSRF-Token (from /auth/me or /auth/login).',
    )
    .setVersion('v1')
    .addCookieAuth(sessionCookieName(env))
    .build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, config));
}
