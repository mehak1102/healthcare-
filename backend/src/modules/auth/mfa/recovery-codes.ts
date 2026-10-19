import { createHmac, randomBytes } from 'node:crypto';
import { base32Encode } from './totp';

export const RECOVERY_CODE_COUNT = 10;
const CODE_CHARS = 10; // 50 bits each

/** Ten single-use codes shaped like `abcde-fgh23`. Shown once; only keyed hashes are stored. */
export function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const raw = base32Encode(randomBytes(7)).slice(0, CODE_CHARS).toLowerCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

/** Accepts any case, spaces and dashes; returns null for anything that cannot be a code. */
export function normalizeRecoveryCode(input: string): string | null {
  const clean = input.replace(/[\s-]/g, '').toUpperCase();
  return new RegExp(`^[A-Z2-7]{${CODE_CHARS}}$`).test(clean) ? clean : null;
}

/**
 * Keyed with the server's MFA key and bound to the user, so a database leak alone does not allow
 * offline guessing, and a hash copied to another account does not work.
 */
export function hashRecoveryCode(key: Buffer, userId: string, normalizedCode: string): string {
  return createHmac('sha256', key).update(`recovery:${userId}:${normalizedCode}`).digest('hex');
}
