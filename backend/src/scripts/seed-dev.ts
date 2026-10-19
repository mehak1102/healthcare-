import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { AppModule } from '../app.module';
import type { Env } from '../config/env.schema';
import { loadEnv } from '../config/load-env';
import type { Role } from '../modules/access-control/roles';
import { PasswordService } from '../modules/auth/password.service';
import {
  CURRENT_PRIVACY_NOTICE_VERSION,
  CURRENT_TERMS_VERSION,
} from '../modules/users/legal-versions';
import { UsersService } from '../modules/users/users.service';

/** Synthetic accounts only. The reserved `.test` domain can never reach a real inbox. */
const SEED_USERS: { email: string; fullName: string; roles: Role[] }[] = [
  { email: 'patient.demo@sukoon.test', fullName: 'Demo Patient', roles: ['patient'] },
  { email: 'doctor.demo@sukoon.test', fullName: 'Demo Doctor (synthetic)', roles: ['doctor'] },
  { email: 'support.demo@sukoon.test', fullName: 'Demo Support Agent', roles: ['support_agent'] },
  { email: 'admin.demo@sukoon.test', fullName: 'Demo Platform Admin', roles: ['platform_admin'] },
];

async function main(): Promise<void> {
  const env = loadEnv();
  if (env.NODE_ENV !== 'development' || /prod/i.test(env.MONGODB_DB_NAME)) {
    throw new Error(
      'Refusing to seed: requires NODE_ENV=development and a non-production database name.',
    );
  }

  if (process.argv.includes('--remove')) {
    await removeSeedUsers(env);
    return;
  }

  const password = process.env.SEED_USER_PASSWORD ?? randomBytes(12).toString('base64url');
  if (password.length < 12) throw new Error('SEED_USER_PASSWORD must be at least 12 characters.');

  const app = await NestFactory.createApplicationContext(AppModule.forRoot(env), {
    logger: ['error'],
  });
  try {
    const users = app.get(UsersService);
    const passwords = app.get(PasswordService);
    const passwordHash = await passwords.hash(password);

    for (const seed of SEED_USERS) {
      if (await users.findByEmailWithPassword(seed.email)) {
        console.log(`• exists   ${seed.email}`);
        continue;
      }
      await users.create({
        ...seed,
        passwordHash,
        termsAcceptedVersion: CURRENT_TERMS_VERSION,
        privacyNoticeAcceptedVersion: CURRENT_PRIVACY_NOTICE_VERSION,
      });
      console.log(`✔ created  ${seed.email}  (${seed.roles.join(', ')})`);
    }

    if (!process.env.SEED_USER_PASSWORD) {
      console.log(`\nPassword for newly created demo accounts: ${password}`);
      console.log('It is shown once and not stored. Set SEED_USER_PASSWORD to choose your own.');
    }
  } finally {
    await app.close();
  }
}

/**
 * Deletes only the fixed demo accounts above and the data that belongs to them. Audit events are
 * append-only and are kept.
 */
async function removeSeedUsers(env: Env): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule.forRoot(env), {
    logger: ['error'],
  });
  try {
    const db = app.get<Connection>(getConnectionToken()).db!;
    const emails = SEED_USERS.map((seed) => seed.email);
    const found = await db
      .collection('users')
      .find({ email: { $in: emails } }, { projection: { _id: 1, email: 1 } })
      .toArray();
    const ids = found.map((user) => user._id);
    for (const collection of [
      'sessions',
      'account_tokens',
      'doctor_applications',
      'doctor_profiles',
    ]) {
      await db.collection(collection).deleteMany({ userId: { $in: ids } });
    }
    await db.collection('users').deleteMany({ _id: { $in: ids } });
    for (const user of found) console.log(`✔ removed  ${String(user.email)}`);
    if (found.length === 0) console.log('• no demo accounts found');
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
