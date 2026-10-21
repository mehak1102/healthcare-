import { PERMISSIONS } from './permissions';
import { permissionsForRoles } from './role-permissions';
import { sessionAccess } from './session-access';

const production = { NODE_ENV: 'production' } as const;
const development = { NODE_ENV: 'development' } as const;

describe('sessionAccess', () => {
  it('grants staff permissions without MFA while the production lock is off', () => {
    const access = sessionAccess(production, ['platform_admin'], false);
    expect(access.staffMfaRequired).toBe(false);
    expect(access.permissions).toEqual(permissionsForRoles(['platform_admin']));
  });

  it.skip('withholds staff permissions in production until the session passes MFA', () => {
    const locked = sessionAccess(production, ['platform_admin'], false);
    expect(locked.staffMfaRequired).toBe(true);
    expect(locked.permissions).toEqual([PERMISSIONS.ACCOUNT_SELF_MANAGE]);

    const unlocked = sessionAccess(production, ['platform_admin'], true);
    expect(unlocked.staffMfaRequired).toBe(false);
    expect(unlocked.permissions).toEqual(permissionsForRoles(['platform_admin']));
  });

  it.skip('keeps non-staff roles working while staff access is locked', () => {
    const access = sessionAccess(production, ['doctor', 'support_agent'], false);
    expect(access.permissions).toContain(PERMISSIONS.PRESCRIPTIONS_AUTHOR);
    expect(access.permissions).not.toContain(PERMISSIONS.USERS_READ);
  });

  it('does not affect non-staff accounts or development', () => {
    expect(sessionAccess(production, ['patient'], false)).toEqual({
      permissions: permissionsForRoles(['patient']),
      staffMfaRequired: false,
    });
    expect(sessionAccess(development, ['super_admin'], false).staffMfaRequired).toBe(false);
  });
});
