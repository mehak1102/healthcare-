import { NestFactory } from '@nestjs/core';
import { z } from 'zod';
import { AppModule } from '../app.module';
import { loadEnv } from '../config/load-env';
import { AuditService } from '../modules/audit/audit.service';
import { PasswordService, passwordPolicyViolations } from '../modules/auth/password.service';
import {
  CURRENT_PRIVACY_NOTICE_VERSION,
  CURRENT_TERMS_VERSION,
} from '../modules/users/legal-versions';
import { UsersService } from '../modules/users/users.service';

const blankAsMissing = (value: unknown) => (value === '' ? undefined : value);

const adminSchema = z.object({
  ADMIN_EMAIL: z
    .string()
    .trim()
    .pipe(z.email({ error: 'must be a valid email address' })),
  ADMIN_PASSWORD: z.preprocess(
    blankAsMissing,
    z.string().min(12, 'must be at least 12 characters').max(128).optional(),
  ),
  ADMIN_FULL_NAME: z.preprocess(blankAsMissing, z.string().trim().min(2).max(100).optional()),
});

/**
 * Creates the owner's platform admin account from ADMIN_* environment values, or grants the
 * platform_admin role to an existing account with that email (and applies ADMIN_FULL_NAME if set).
 * Run by hand; never at start-up. The password is only hashed, never printed or logged, and an
 * existing password is never changed.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const parsed = adminSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Check the ADMIN_* values in backend/.env:\n${problems.join('\n')}`);
  }
  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password, ADMIN_FULL_NAME: fullName } = parsed.data;

  const app = await NestFactory.createApplicationContext(AppModule.forRoot(env), {
    logger: ['error'],
  });
  try {
    const users = app.get(UsersService);
    const audit = app.get(AuditService);
    const existing = await users.findByEmailWithPassword(email);

    if (existing) {
      if (fullName && fullName !== existing.fullName) {
        await users.updateFullName(existing._id, fullName);
        await audit.record({
          action: 'admin.bootstrap.rename',
          outcome: 'success',
          targetType: 'user',
          targetId: existing.id,
          metadata: { source: 'create-admin script' },
        });
        console.log(`✔ ${existing.email} is now named "${fullName}".`);
      }
      if (existing.roles.includes('platform_admin')) {
        console.log(`• ${existing.email} is already a platform admin.`);
        return;
      }
      await users.addRole(existing._id, 'platform_admin');
      await audit.record({
        action: 'admin.bootstrap.grant_role',
        outcome: 'success',
        targetType: 'user',
        targetId: existing.id,
        metadata: { role: 'platform_admin', source: 'create-admin script' },
      });
      console.log(`✔ ${existing.email} already had an account; it is now a platform admin.`);
      console.log('  Its password was not changed. Sign in with the password you already use.');
      return;
    }

    if (!password) throw new Error('Set ADMIN_PASSWORD in backend/.env to create the account.');
    const violations = passwordPolicyViolations(password, email);
    if (violations.length > 0) throw new Error(`ADMIN_PASSWORD: ${violations.join('; ')}`);

    const user = await users.create({
      email,
      fullName: fullName ?? 'Platform Admin',
      roles: ['platform_admin'],
      passwordHash: await app.get(PasswordService).hash(password),
      termsAcceptedVersion: CURRENT_TERMS_VERSION,
      privacyNoticeAcceptedVersion: CURRENT_PRIVACY_NOTICE_VERSION,
    });
    await audit.record({
      action: 'admin.bootstrap.create',
      outcome: 'success',
      targetType: 'user',
      targetId: user.id,
      metadata: { role: 'platform_admin', source: 'create-admin script' },
    });
    console.log(`✔ created platform admin ${user.email} in database "${env.MONGODB_DB_NAME}".`);
  } finally {
    await app.close();
  }
  console.log('\nNow delete the ADMIN_PASSWORD line from backend/.env; it is no longer needed.');
}

main().catch((error: unknown) => {
  console.error('Creating the admin failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
