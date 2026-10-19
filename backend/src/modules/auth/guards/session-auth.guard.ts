import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectConfig } from '../../../config/app-config.module';
import type { Env } from '../../../config/env.schema';
import { apiError } from '../../../common/http/api-error';
import type { AppRequest } from '../../../common/http/app-request';
import { sessionAccess } from '../../access-control/session-access';
import { UsersService } from '../../users/users.service';
import { IS_PUBLIC_KEY } from '../decorators';
import { sessionCookieName } from '../session-cookie';
import { SessionsService } from '../sessions.service';

/** Resolves the session cookie into `req.auth`; rejects non-public routes without one. */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
    private readonly users: UsersService,
    @InjectConfig() private readonly config: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<AppRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const cookies = req.cookies as Record<string, unknown> | undefined;
    const session = await this.sessions.resolve(cookies?.[sessionCookieName(this.config)]);
    if (session) {
      const user = await this.users.findById(session.userId.toString());
      const sessionPredatesPasswordChange =
        user !== null && session.createdAt < user.passwordChangedAt;
      if (user && user.status === 'active' && !sessionPredatesPasswordChange) {
        if (session.mfaPending) {
          req.pendingMfa = { userId: user.id, sessionId: session.id };
        } else {
          const mfaVerified = session.mfaVerifiedAt !== null;
          req.auth = {
            userId: user.id,
            sessionId: session.id,
            tokenHash: session.tokenHash,
            roles: [...user.roles],
            mfaVerified,
            ...sessionAccess(this.config, user.roles, mfaVerified),
          };
        }
      }
    }

    if (!req.auth && !isPublic) {
      throw new UnauthorizedException(apiError('UNAUTHENTICATED', 'Please sign in to continue'));
    }
    return true;
  }
}
