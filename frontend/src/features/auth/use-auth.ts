import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, setCsrfToken } from '@/lib/api-client';
import {
  authApi,
  isMfaRequired,
  type AuthResponse,
  type CurrentUser,
  type LoginInput,
  type RegisterInput,
} from './api';

export const CURRENT_USER_KEY = ['auth', 'me'] as const;

/** The signed-in user, or `null` when signed out. The single source of truth for session state. */
export function useCurrentUser() {
  return useQuery<CurrentUser | null>({
    queryKey: CURRENT_USER_KEY,
    queryFn: async () => {
      try {
        const { user, csrfToken } = await authApi.me();
        setCsrfToken(csrfToken);
        return user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setCsrfToken(null);
          return null;
        }
        throw error;
      }
    },
    staleTime: 5 * 60_000,
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  });
}

export function hasPermission(user: CurrentUser | null | undefined, permission: string): boolean {
  return Boolean(user?.permissions.includes(permission));
}

function useSessionStarter() {
  const queryClient = useQueryClient();
  return ({ user, csrfToken }: AuthResponse) => {
    setCsrfToken(csrfToken);
    // Drop any cached data from a previous identity before showing the new one.
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
    queryClient.setQueryData(CURRENT_USER_KEY, user);
  };
}

/** Resolves to `true` when signed in, or `false` when a two-step verification code is needed. */
export function useLogin() {
  const startSession = useSessionStarter();
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const response = await authApi.login(input);
      if (isMfaRequired(response)) return false;
      startSession(response);
      return true;
    },
  });
}

export function useMfaChallenge() {
  const startSession = useSessionStarter();
  return useMutation({
    mutationFn: (code: string) => authApi.completeMfaChallenge(code),
    onSuccess: startSession,
  });
}

export function useRegister() {
  const startSession = useSessionStarter();
  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onSuccess: startSession,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      setCsrfToken(null);
      queryClient.clear();
      queryClient.setQueryData(CURRENT_USER_KEY, null);
    },
  });
}
