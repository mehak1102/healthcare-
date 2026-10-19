import { apiRequest } from '@/lib/api-client';

export interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  roles: string[];
  permissions: string[];
  emailVerified: boolean;
  mfaEnabled: boolean;
  /** Staff permissions stay locked until this session passes two-step verification. */
  staffMfaRequired: boolean;
  createdAt: string;
}

export interface AuthResponse {
  user: CurrentUser;
  csrfToken: string;
}

/** Password accepted; the sign-in continues with a two-step verification code. */
export interface MfaRequiredResponse {
  mfaRequired: true;
}

export type LoginResponse = AuthResponse | MfaRequiredResponse;

export const isMfaRequired = (response: LoginResponse): response is MfaRequiredResponse =>
  'mfaRequired' in response;

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  acceptTerms: true;
  accountType?: 'patient' | 'doctor';
}

export interface LoginInput {
  email: string;
  password: string;
  portal?: 'patient' | 'doctor' | 'staff';
}

export interface ConfirmPasswordResetInput {
  token: string;
  newPassword: string;
}

export const authApi = {
  me: () => apiRequest<AuthResponse>('/auth/me'),
  register: (input: RegisterInput) =>
    apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: input }),
  login: (input: LoginInput) =>
    apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: input }),
  completeMfaChallenge: (code: string) =>
    apiRequest<AuthResponse>('/auth/mfa/challenge', { method: 'POST', body: { code } }),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
  requestPasswordReset: (email: string) =>
    apiRequest<void>('/auth/password-reset/request', { method: 'POST', body: { email } }),
  confirmPasswordReset: (input: ConfirmPasswordResetInput) =>
    apiRequest<void>('/auth/password-reset/confirm', { method: 'POST', body: input }),
  requestEmailVerification: () =>
    apiRequest<void>('/auth/email-verification/request', { method: 'POST' }),
  confirmEmailVerification: (token: string) =>
    apiRequest<void>('/auth/email-verification/confirm', { method: 'POST', body: { token } }),
};
