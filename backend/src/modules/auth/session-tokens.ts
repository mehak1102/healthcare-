import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

/** 256-bit random session token, base64url encoded (43 characters). */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function isWellFormedSessionToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN_FORMAT.test(token);
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** CSRF token bound to one session: HMAC of the session hash under the server secret. */
export function deriveCsrfToken(secret: string, sessionTokenHash: string): string {
  return createHmac('sha256', secret).update(`csrf:${sessionTokenHash}`).digest('base64url');
}

export function csrfTokenMatches(
  secret: string,
  sessionTokenHash: string,
  candidate: unknown,
): boolean {
  if (typeof candidate !== 'string' || candidate.length === 0) return false;
  const expected = Buffer.from(deriveCsrfToken(secret, sessionTokenHash));
  const given = Buffer.from(candidate);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
