import type { Permission } from '../access-control/permissions';
import type { Role } from '../access-control/roles';

/** Server-derived identity for the current request. Never built from client-supplied data. */
export interface AuthContext {
  userId: string;
  sessionId: string;
  tokenHash: string;
  roles: Role[];
  /** Effective permissions for this session (see access-control/session-access.ts). */
  permissions: Permission[];
  mfaVerified: boolean;
  staffMfaRequired: boolean;
}

/** A session whose password step succeeded but whose second step is still outstanding. */
export interface PendingMfaContext {
  userId: string;
  sessionId: string;
}
