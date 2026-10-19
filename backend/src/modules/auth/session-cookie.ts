import type { CookieOptions } from 'express';
import type { Env } from '../../config/env.schema';

/** `__Host-` cookies must be Secure, host-only and Path=/, which browsers enforce. */
export function sessionCookieName(env: Env): string {
  return env.NODE_ENV === 'production' ? '__Host-sid' : 'sid';
}

export function sessionCookieOptions(env: Env): CookieOptions {
  // Production on split hosts (e.g. static + API on different *.onrender.com
  // subdomains) is cross-site. SameSite=Lax cookies are not sent on cross-site
  // fetch(), so the session would be dropped after login. None + Secure is
  // required until the API and web app share one registrable domain.
  const crossSite = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: crossSite,
    sameSite: crossSite ? 'none' : 'lax',
    path: '/',
  };
}
