import { ALL_PERMISSIONS, PERMISSIONS } from './permissions';
import { permissionsForRoles, ROLE_PERMISSIONS } from './role-permissions';
import { hasPrivilegedRole, ROLES } from './roles';

const STAFF_ONLY = [
  PERMISSIONS.USERS_READ,
  PERMISSIONS.USERS_MANAGE_ROLES,
  PERMISSIONS.AUDIT_READ,
  PERMISSIONS.REFUNDS_APPROVE,
  PERMISSIONS.PROVIDERS_VERIFY,
  PERMISSIONS.SYSTEM_CONFIGURE,
];

describe('role permission policy', () => {
  it('defines a policy for every role', () => {
    for (const role of ROLES) expect(ROLE_PERMISSIONS[role]).toBeDefined();
  });

  it('only references known permissions', () => {
    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role])
        expect(ALL_PERMISSIONS).toContain(permission);
    }
  });

  it.each([
    'patient',
    'doctor',
    'clinic_staff',
    'diagnostic_partner',
    'homecare_provider',
    'transport_partner',
  ] as const)('%s holds no internal staff permissions', (role) => {
    for (const permission of STAFF_ONLY) expect(ROLE_PERMISSIONS[role]).not.toContain(permission);
  });

  it('lets only super_admin manage roles', () => {
    const holders = ROLES.filter((role) =>
      ROLE_PERMISSIONS[role].includes(PERMISSIONS.USERS_MANAGE_ROLES),
    );
    expect(holders).toEqual(['super_admin']);
  });

  it('keeps refund approval with finance (and break-glass super_admin) only', () => {
    const holders = ROLES.filter((role) =>
      ROLE_PERMISSIONS[role].includes(PERMISSIONS.REFUNDS_APPROVE),
    );
    expect(holders.sort()).toEqual(['finance_staff', 'super_admin']);
  });

  it('keeps prescription authoring with doctors (and super_admin) only', () => {
    const holders = ROLES.filter((role) =>
      ROLE_PERMISSIONS[role].includes(PERMISSIONS.PRESCRIPTIONS_AUTHOR),
    );
    expect(holders.sort()).toEqual(['doctor', 'super_admin']);
  });

  it('merges and de-duplicates permissions across roles', () => {
    const merged = permissionsForRoles(['patient', 'doctor']);
    expect(new Set(merged).size).toBe(merged.length);
    expect(merged).toContain(PERMISSIONS.APPOINTMENTS_SELF_BOOK);
    expect(merged).toContain(PERMISSIONS.PRESCRIPTIONS_AUTHOR);
  });

  it('flags staff roles as privileged', () => {
    expect(hasPrivilegedRole(['patient'])).toBe(false);
    expect(hasPrivilegedRole(['doctor'])).toBe(false);
    expect(hasPrivilegedRole(['patient', 'support_agent'])).toBe(true);
  });
});
