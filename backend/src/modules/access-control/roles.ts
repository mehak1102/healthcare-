export const ROLES = [
  'patient',
  'doctor',
  'clinic_staff',
  'diagnostic_partner',
  'homecare_provider',
  'transport_partner',
  'support_agent',
  'operations_staff',
  'finance_staff',
  'platform_admin',
  'super_admin',
] as const;

export type Role = (typeof ROLES)[number];

/**
 * Internal staff roles. In production their permissions only apply to sessions that passed
 * two-step verification (see session-access.ts).
 */
export const PRIVILEGED_ROLES: readonly Role[] = [
  'support_agent',
  'operations_staff',
  'finance_staff',
  'platform_admin',
  'super_admin',
];

export function hasPrivilegedRole(roles: readonly Role[]): boolean {
  return roles.some((role) => PRIVILEGED_ROLES.includes(role));
}
