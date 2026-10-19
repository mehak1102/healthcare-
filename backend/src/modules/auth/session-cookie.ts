import type { CookieOptions } from 'express';
import type { Env } from '../../config/env.schema';

/** `__Host-` cookies must be Secure, host-only and Path=/, which browsers enforce. */
export function sessionCookieName(env: Env): string {
  return env.NODE_ENV === 'production' ? '__Host-sid' : 'sid';
}

export function sessionCookieOptions(env: Env): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
}
