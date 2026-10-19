import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectConfig } from '../../../config/app-config.module';
import type { Env } from '../../../config/env.schema';
import { apiError } from '../../../common/http/api-error';
import type { AppRequest } from '../../../common/http/app-request';
import { SKIP_SESSION_CSRF_KEY } from '../decorators';
import { csrfTokenMatches } from '../session-tokens';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return 'invalid';
  }
}

/**
 * Two layers for unsafe methods:
 * 1. A browser-supplied Origin (or Referer) must be on the allow-list.
 * 2. Requests carrying a valid session must also send the session-bound X-CSRF-Token.
 * Requests without Origin/Referer come from non-browser clients, which cannot ride a victim's
 * cookies, so layer 1 does not reject them; layer 2 still applies if they send a session cookie.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(
    private readonly reflector: Reflector,
    @InjectConfig() private readonly config: Env,
  ) {
    this.allowedOrigins = new Set(config.CORS_ORIGINS);
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<AppRequest>();
    if (SAFE_METHODS.has(req.method)) return true;

    const origin = req.headers.origin ?? originOf(req.headers.referer);
    if (origin !== undefined && !this.allowedOrigins.has(origin)) {
      throw this.reject();
    }

    const skipSessionCheck = this.reflector.getAllAndOverride<boolean>(SKIP_SESSION_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (req.auth && !skipSessionCheck) {
      const token = req.headers['x-csrf-token'];
      if (!csrfTokenMatches(this.config.SESSION_SECRET, req.auth.tokenHash, token)) {
        throw this.reject();
      }
    }
    return true;
  }

  private reject(): ForbiddenException {
    return new ForbiddenException(
      apiError('CSRF_FAILED', 'Security check failed. Please refresh the page and try again.'),
    );
  }
}
