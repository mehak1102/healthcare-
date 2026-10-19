import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { apiError } from '../../common/http/api-error';
import type { AppRequest } from '../../common/http/app-request';
import type { AuthContext } from './auth-context';

export const IS_PUBLIC_KEY = 'isPublic';
export const SKIP_SESSION_CSRF_KEY = 'skipSessionCsrf';
export const AUTH_RATE_LIMITED_KEY = 'authRateLimited';

/** Routes require a session by default; this opts a route out. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Skips the session CSRF token check (the Origin allow-list still applies). Only for endpoints
 * that create a fresh session, such as login and registration.
 */
export const SkipSessionCsrf = () => SetMetadata(SKIP_SESSION_CSRF_KEY, true);

/** Applies the stricter per-IP limit used for credential endpoints. */
export const AuthRateLimited = () => SetMetadata(AUTH_RATE_LIMITED_KEY, true);

export function isAuthRateLimited(context: ExecutionContext): boolean {
  return Reflect.getMetadata(AUTH_RATE_LIMITED_KEY, context.getHandler()) === true;
}

export const CurrentAuth = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthContext => {
    const req = context.switchToHttp().getRequest<AppRequest>();
    if (!req.auth) {
      throw new UnauthorizedException(apiError('UNAUTHENTICATED', 'Please sign in to continue'));
    }
    return req.auth;
  },
);
