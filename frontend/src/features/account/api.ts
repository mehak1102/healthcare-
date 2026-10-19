import { apiRequest } from '@/lib/api-client';
import type { AuthResponse } from '@/features/auth/api';

export interface SessionSummary {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string;
  ipAddress: string;
  current: boolean;
}

export interface MfaStatus {
  enabled: boolean;
  enrolledAt: string | null;
  recoveryCodesRemaining: number;
  canDisable: boolean;
}

export interface MfaSetup {
  secret: string;
  otpauthUri: string;
}

export interface RecoveryCodes {
  recoveryCodes: string[];
}

export const accountApi = {
  listSessions: () => apiRequest<{ items: SessionSummary[] }>('/auth/sessions'),
  revokeSession: (id: string) =>
    apiRequest<void>(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  revokeOtherSessions: () =>
    apiRequest<{ revoked: number }>('/auth/sessions/revoke-others', { method: 'POST' }),
  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    apiRequest<AuthResponse>('/auth/password', { method: 'POST', body: input }),
  mfaStatus: () => apiRequest<MfaStatus>('/auth/mfa'),
  startMfaSetup: (password: string) =>
    apiRequest<MfaSetup>('/auth/mfa/setup', { method: 'POST', body: { password } }),
  enableMfa: (code: string) =>
    apiRequest<RecoveryCodes>('/auth/mfa/enable', { method: 'POST', body: { code } }),
  regenerateRecoveryCodes: (code: string) =>
    apiRequest<RecoveryCodes>('/auth/mfa/recovery-codes', { method: 'POST', body: { code } }),
  disableMfa: (input: { password: string; code: string }) =>
    apiRequest<void>('/auth/mfa/disable', { method: 'POST', body: input }),
  deleteAccount: (input: { password: string; code?: string }) =>
    apiRequest<void>('/account/delete', { method: 'POST', body: input }),
};
