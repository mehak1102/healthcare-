import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Slug for doctor.demo@sukoon.test after `npm run db:seed:demo-doctor -w backend`. */
export function demoDoctorSlug(): string | null {
  const fromEnv = process.env.E2E_DOCTOR_SLUG?.trim();
  if (fromEnv) return fromEnv;
  try {
    return readFileSync(join(__dirname, '..', '.doctor-slug'), 'utf8').trim();
  } catch {
    return null;
  }
}
