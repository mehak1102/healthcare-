import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { apiError } from '../../common/http/api-error';
import { requestMeta, type AppRequest } from '../../common/http/app-request';
import { AuditService } from '../audit/audit.service';
import type { Permission } from './permissions';
import { permissionsForRoles } from './role-permissions';
import { REQUIRED_PERMISSIONS_KEY } from './require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<AppRequest>();
    if (!req.auth) {
      throw new UnauthorizedException(apiError('UNAUTHENTICATED', 'Please sign in to continue'));
    }

    const missing = required.filter((permission) => !req.auth!.permissions.includes(permission));
    if (missing.length === 0) return true;

    const lockedByMfa =
      req.auth.staffMfaRequired &&
      missing.every((permission) => permissionsForRoles(req.auth!.roles).includes(permission));
    const meta = requestMeta(req);
    await this.audit.record({
      action: 'authz.denied',
      outcome: 'denied',
      actorUserId: req.auth.userId,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      metadata: {
        handler: `${context.getClass().name}.${context.getHandler().name}`,
        reason: lockedByMfa ? 'mfa_required' : 'missing_permission',
      },
    });
    if (lockedByMfa) {
      throw new ForbiddenException(
        apiError(
          'MFA_REQUIRED',
          'Turn on two-step verification in your account settings to use staff features.',
        ),
      );
    }
    throw new ForbiddenException(
      apiError('FORBIDDEN', 'You do not have permission to perform this action'),
    );
  }
}
