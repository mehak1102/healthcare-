import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Time-based one-time passwords (RFC 6238 over RFC 4226 HOTP) with the parameters every common
 * authenticator app supports: HMAC-SHA1, 6 digits, 30-second steps.
 */
export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_SECONDS = 30;
/** Accept one step either side of now, to tolerate phone clock drift. */
const ALLOWED_DRIFT_STEPS = 1;
const SECRET_BYTES = 20;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(data: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=-]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('invalid base32 character');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(SECRET_BYTES));
}

export function hotp(key: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key).update(message).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    (hmac[offset + 1]! << 16) |
    (hmac[offset + 2]! << 8) |
    hmac[offset + 3]!;
  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

export function totpStep(nowMs: number): number {
  return Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);
}

export function isTotpCodeFormat(code: string): boolean {
  return new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(code);
}

/** Returns the time step the code belongs to (for replay protection), or null if it is wrong. */
export function verifyTotp(secretBase32: string, code: string, nowMs = Date.now()): number | null {
  if (!isTotpCodeFormat(code)) return null;
  const key = base32Decode(secretBase32);
  const given = Buffer.from(code);
  const current = totpStep(nowMs);
  let matched: number | null = null;
  for (let step = current - ALLOWED_DRIFT_STEPS; step <= current + ALLOWED_DRIFT_STEPS; step++) {
    // Compare every candidate so timing does not reveal which step matched.
    if (timingSafeEqual(Buffer.from(hotp(key, step)), given)) matched = step;
  }
  return matched;
}

export function otpauthUri(issuer: string, accountName: string, secretBase32: string): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  // encodeURIComponent (%20), not URLSearchParams (+): some apps show "+" literally.
  const query = Object.entries({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  })
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('&');
  return `otpauth://totp/${label}?${query}`;
}
