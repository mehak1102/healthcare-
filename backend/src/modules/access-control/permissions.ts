/**
 * Permission catalogue. Permissions for later phases are declared now so the role policy can be
 * reviewed as a whole; a permission only grants access once an endpoint requires it.
 */
export const PERMISSIONS = {
  // Own account
  ACCOUNT_SELF_MANAGE: 'account:self:manage',

  // Patient care (Phase 3–4)
  APPOINTMENTS_SELF_BOOK: 'appointments:self:book',
  RECORDS_SELF_MANAGE: 'records:self:manage',

  // Providers (Phase 2–4)
  PROVIDER_PROFILE_MANAGE_OWN: 'provider:profile:manage-own',
  PROVIDER_SCHEDULE_MANAGE_OWN: 'provider:schedule:manage-own',
  PROVIDER_APPOINTMENTS_HANDLE: 'provider:appointments:handle',
  PRESCRIPTIONS_AUTHOR: 'prescriptions:author',

  // Organizations and partners (Phase 2+)
  ORG_OPERATE_OWN: 'org:operate-own',
  PARTNER_ORDERS_HANDLE: 'partner:orders:handle',

  // Internal staff
  USERS_READ: 'users:read',
  USERS_MANAGE_ROLES: 'users:roles:manage',
  PROVIDERS_VERIFY: 'providers:verify',
  CATALOG_MANAGE: 'catalog:manage',
  OPERATIONS_DASHBOARD: 'operations:dashboard',
  DISPATCH_OPERATE: 'dispatch:operate',
  SUPPORT_TICKETS_MANAGE: 'support:tickets:manage',
  PAYMENTS_READ: 'payments:read',
  REFUNDS_APPROVE: 'refunds:approve',
  SETTLEMENTS_MANAGE: 'settlements:manage',
  AUDIT_READ: 'audit:read',
  SYSTEM_CONFIGURE: 'system:configure',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);
