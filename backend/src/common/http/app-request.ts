import type { Request } from 'express';
import type { AuthContext, PendingMfaContext } from '../../modules/auth/auth-context';

/** `req.id` (declared by pino-http) is the request ID echoed in the X-Request-Id header. */
export interface AppRequest extends Request {
  /** Present only when a valid, fully signed-in session cookie was supplied. */
  auth?: AuthContext;
  /** Present instead of `auth` while a sign-in waits for its two-step verification code. */
  pendingMfa?: PendingMfaContext;
}

export interface RequestMeta {
  requestId: string;
  ipAddress: string;
  userAgent: string;
}

export function requestMeta(req: AppRequest): RequestMeta {
  const userAgent = req.headers['user-agent'];
  return {
    requestId: typeof req.id === 'string' ? req.id : '',
    ipAddress: req.ip ?? '',
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 256) : '',
  };
}
