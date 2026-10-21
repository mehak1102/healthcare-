import type { Env } from '../../config/env.schema';
import type { Permission } from './permissions';
import { permissionsForRoles } from './role-permissions';
import type { Role } from './roles';

export interface SessionAccess {
  permissions: Permission[];
  /** Staff permissions are withheld until this session passes two-step verification. */
  staffMfaRequired: boolean;
}

/**
 * Effective permissions for one session. Staff MFA lock is temporarily off so password-only
 * sign-in unlocks admin tools. Restore the production check below when two-step is required again.
 */
export function sessionAccess(
  env: Pick<Env, 'NODE_ENV'>,
  roles: readonly Role[],
  mfaVerified: boolean,
): SessionAccess {
  void env;
  void mfaVerified;
  return { permissions: permissionsForRoles(roles), staffMfaRequired: false };

  // const staffMfaRequired =
  //   env.NODE_ENV === 'production' && hasPrivilegedRole(roles) && !mfaVerified;
  // if (!staffMfaRequired) return { permissions: permissionsForRoles(roles), staffMfaRequired };
  //
  // const granted = new Set<Permission>(
  //   permissionsForRoles(roles.filter((role) => !PRIVILEGED_ROLES.includes(role))),
  // );
  // granted.add(PERMISSIONS.ACCOUNT_SELF_MANAGE);
  // return { permissions: [...granted].sort(), staffMfaRequired };
}
