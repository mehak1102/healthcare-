import { ALL_PERMISSIONS, PERMISSIONS as P, type Permission } from './permissions';
import type { Role } from './roles';

/**
 * The single source of truth for what each role may do. Finance, support, operations and platform
 * administration are deliberately disjoint (separation of duties); only `super_admin` can change
 * roles, and it is intended for break-glass use.
 */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  patient: [P.ACCOUNT_SELF_MANAGE, P.APPOINTMENTS_SELF_BOOK, P.RECORDS_SELF_MANAGE],
  doctor: [
    P.ACCOUNT_SELF_MANAGE,
    P.PROVIDER_PROFILE_MANAGE_OWN,
    P.PROVIDER_SCHEDULE_MANAGE_OWN,
    P.PROVIDER_APPOINTMENTS_HANDLE,
    P.PRESCRIPTIONS_AUTHOR,
  ],
  clinic_staff: [P.ACCOUNT_SELF_MANAGE, P.ORG_OPERATE_OWN],
  diagnostic_partner: [P.ACCOUNT_SELF_MANAGE, P.PARTNER_ORDERS_HANDLE],
  homecare_provider: [
    P.ACCOUNT_SELF_MANAGE,
    P.PROVIDER_PROFILE_MANAGE_OWN,
    P.PROVIDER_SCHEDULE_MANAGE_OWN,
    P.PROVIDER_APPOINTMENTS_HANDLE,
  ],
  transport_partner: [P.ACCOUNT_SELF_MANAGE, P.PARTNER_ORDERS_HANDLE],
  support_agent: [P.ACCOUNT_SELF_MANAGE, P.USERS_READ, P.SUPPORT_TICKETS_MANAGE],
  operations_staff: [P.ACCOUNT_SELF_MANAGE, P.OPERATIONS_DASHBOARD, P.DISPATCH_OPERATE],
  finance_staff: [P.ACCOUNT_SELF_MANAGE, P.PAYMENTS_READ, P.REFUNDS_APPROVE, P.SETTLEMENTS_MANAGE],
  platform_admin: [
    P.ACCOUNT_SELF_MANAGE,
    P.USERS_READ,
    P.PROVIDERS_VERIFY,
    P.CATALOG_MANAGE,
    P.OPERATIONS_DASHBOARD,
    P.AUDIT_READ,
    P.SYSTEM_CONFIGURE,
  ],
  super_admin: ALL_PERMISSIONS,
};

export function permissionsForRoles(roles: readonly Role[]): Permission[] {
  const granted = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) granted.add(permission);
  }
  return [...granted].sort();
}
