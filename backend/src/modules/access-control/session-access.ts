import type { Env } from '../../config/env.schema';
import { PERMISSIONS, type Permission } from './permissions';
import { permissionsForRoles } from './role-permissions';
import { hasPrivilegedRole, PRIVILEGED_ROLES, type Role } from './roles';

export interface SessionAccess {
  permissions: Permission[];
  /** Staff permissions are withheld until this session passes two-step verification. */
  staffMfaRequired: boolean;
}

/**
 * Effective permissions for one session. In production, staff roles only count once the session
 * has passed two-step verification; until then the account keeps its non-staff permissions plus
 * the ability to manage itself (so the person can turn two-step verification on).
 */
export function sessionAccess(
  env: Pick<Env, 'NODE_ENV'>,
  roles: readonly Role[],
  mfaVerified: boolean,
): SessionAccess {
  const staffMfaRequired =
    env.NODE_ENV === 'production' && hasPrivilegedRole(roles) && !mfaVerified;
  if (!staffMfaRequired) return { permissions: permissionsForRoles(roles), staffMfaRequired };

  const granted = new Set<Permission>(
    permissionsForRoles(roles.filter((role) => !PRIVILEGED_ROLES.includes(role))),
  );
  granted.add(PERMISSIONS.ACCOUNT_SELF_MANAGE);
  return { permissions: [...granted].sort(), staffMfaRequired };
}
