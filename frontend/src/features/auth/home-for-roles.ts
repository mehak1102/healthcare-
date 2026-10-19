import type { AccountPortal, LoginPortal } from './portal-choice';

export function portalFromSearch(value: string | null): AccountPortal {
  return value === 'doctor' ? 'doctor' : 'patient';
}

export function loginPortalFromSearch(value: string | null): LoginPortal {
  return value === 'staff' ? 'staff' : portalFromSearch(value);
}

export function authPath(
  path: '/login' | '/register',
  portal: LoginPortal,
  next: string | null,
): string {
  const params = new URLSearchParams();
  if (portal !== 'patient') params.set('as', portal);
  if (next) params.set('next', next);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** Where an authenticated person should land when they have not asked for a specific page. */
export function homeForRoles(roles: readonly string[]): string {
  if (roles.includes('doctor')) return '/doctor';
  if (roles.includes('patient')) return '/patient';
  return '/account';
}
