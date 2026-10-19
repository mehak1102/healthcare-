import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { apiError } from '../../common/http/api-error';
import type { RequestMeta } from '../../common/http/app-request';
import { AuditService } from '../audit/audit.service';
import { CURRENT_PRIVACY_NOTICE_VERSION, CURRENT_TERMS_VERSION } from '../users/legal-versions';
import type { UserDocument } from '../users/user.schema';
import { UsersService } from '../users/users.service';
import { AccountRecoveryService } from './account-recovery.service';
import type { AuthContext } from './auth-context';
import { hasPrivilegedRole, type Role } from '../access-control/roles';
import type {
  ChangePasswordDto,
  LoginDto,
  LoginPortal,
  RegisterDto,
} from './dto/auth-requests.dto';
import { PasswordService, assertPasswordPolicy } from './password.service';
import { SessionsService, type IssuedSession } from './sessions.service';

export interface AuthResult {
  user: UserDocument;
  session: IssuedSession;
}

/** A session (full or awaiting its second step) that a new sign-in replaces. */
type ExistingSession = Pick<AuthContext, 'sessionId' | 'userId'>;

function matchesPortal(roles: readonly Role[], portal: LoginPortal): boolean {
  return portal === 'staff' ? hasPrivilegedRole(roles) : roles.includes(portal);
}

const PORTAL_MISMATCH_MESSAGES: Record<LoginPortal, string> = {
  patient: 'This account is not a patient account. Choose the sign-in option that matches it.',
  doctor: 'This account is not a doctor account. Choose the sign-in option that matches it.',
  staff: 'This account is not a staff account. Sign in as a patient or doctor instead.',
};

const invalidCredentials = () =>
  new UnauthorizedException(apiError('INVALID_CREDENTIALS', 'Incorrect email or password'));

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    private readonly recovery: AccountRecoveryService,
  ) {}

  async register(
    dto: RegisterDto,
    meta: RequestMeta,
    existing?: ExistingSession,
  ): Promise<AuthResult> {
    assertPasswordPolicy(dto.password, dto.email);
    const passwordHash = await this.passwords.hash(dto.password);

    let user: UserDocument;
    try {
      const accountType = dto.accountType ?? 'patient';
      user = await this.users.create({
        email: dto.email,
        fullName: dto.fullName,
        passwordHash,
        roles: accountType === 'doctor' ? ['doctor'] : ['patient'],
        doctorVerification: accountType === 'doctor' ? 'pending' : null,
        termsAcceptedVersion: CURRENT_TERMS_VERSION,
        privacyNoticeAcceptedVersion: CURRENT_PRIVACY_NOTICE_VERSION,
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        await this.audit.record({
          action: 'auth.register',
          outcome: 'failure',
          requestId: meta.requestId,
          ipAddress: meta.ipAddress,
          metadata: { reason: 'email_taken' },
        });
      }
      throw error;
    }

    if (existing) await this.sessions.revoke(existing.sessionId, existing.userId);
    const session = await this.sessions.issue(user._id, meta);
    await this.users.recordSuccessfulLogin(user._id);
    this.recovery.sendVerificationAfterRegistration(user, meta);
    await this.audit.record({
      action: 'auth.register',
      outcome: 'success',
      actorUserId: user.id,
      targetType: 'user',
      targetId: user.id,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      metadata: { termsVersion: CURRENT_TERMS_VERSION, accountType: dto.accountType ?? 'patient' },
    });
    return { user, session };
  }

  async login(dto: LoginDto, meta: RequestMeta, existing?: ExistingSession): Promise<AuthResult> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    const fail = async (reason: string, userId?: string) => {
      await this.audit.record({
        action: 'auth.login',
        outcome: 'failure',
        actorUserId: userId ?? null,
        requestId: meta.requestId,
        ipAddress: meta.ipAddress,
        metadata: { reason },
      });
      return invalidCredentials();
    };

    if (!user) {
      await this.passwords.verifyAgainstDummy(dto.password);
      throw await fail('unknown_account');
    }
    if (user.status !== 'active') {
      await this.passwords.verifyAgainstDummy(dto.password);
      throw await fail('account_disabled', user.id);
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.passwords.verifyAgainstDummy(dto.password);
      throw await fail('account_locked', user.id);
    }
    if (!(await this.passwords.verify(user.passwordHash, dto.password))) {
      await this.users.recordFailedLogin(user._id);
      throw await fail('bad_password', user.id);
    }

    if (dto.portal && !matchesPortal(user.roles, dto.portal)) {
      await this.audit.record({
        action: 'auth.login',
        outcome: 'failure',
        actorUserId: user.id,
        requestId: meta.requestId,
        ipAddress: meta.ipAddress,
        metadata: { reason: 'portal_mismatch' },
      });
      throw new ForbiddenException(
        apiError('PORTAL_MISMATCH', PORTAL_MISMATCH_MESSAGES[dto.portal]),
      );
    }

    if (this.passwords.needsRehash(user.passwordHash)) {
      await this.users.updatePasswordHash(user._id, await this.passwords.hash(dto.password), false);
    }
    if (existing) await this.sessions.revoke(existing.sessionId, existing.userId);

    if (user.mfaEnrolledAt) {
      // Failure counters are only reset once the second step succeeds, so re-entering the
      // password cannot be used to get unlimited code guesses.
      const session = await this.sessions.issue(user._id, meta, 'pending');
      await this.audit.record({
        action: 'auth.mfa.challenge_issued',
        outcome: 'success',
        actorUserId: user.id,
        requestId: meta.requestId,
        ipAddress: meta.ipAddress,
      });
      return { user, session };
    }

    await this.users.recordSuccessfulLogin(user._id);
    const session = await this.sessions.issue(user._id, meta);
    await this.audit.record({
      action: 'auth.login',
      outcome: 'success',
      actorUserId: user.id,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
    });
    return { user, session };
  }

  async logout(auth: AuthContext, meta: RequestMeta): Promise<void> {
    await this.sessions.revoke(auth.sessionId, auth.userId);
    await this.audit.record({
      action: 'auth.logout',
      outcome: 'success',
      actorUserId: auth.userId,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
    });
  }

  /** Verifies the current password, then rotates the session and revokes every other one. */
  async changePassword(
    auth: AuthContext,
    dto: ChangePasswordDto,
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const user = await this.users.findByIdWithPassword(auth.userId);
    if (!user) throw invalidCredentials();

    if (!(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
      await this.users.recordFailedLogin(user._id);
      await this.audit.record({
        action: 'auth.password.change',
        outcome: 'failure',
        actorUserId: auth.userId,
        requestId: meta.requestId,
        ipAddress: meta.ipAddress,
        metadata: { reason: 'bad_current_password' },
      });
      throw new BadRequestException(
        apiError('INVALID_CURRENT_PASSWORD', 'Your current password is incorrect'),
      );
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        apiError('VALIDATION_FAILED', 'Request validation failed', [
          'new password must be different from the current password',
        ]),
      );
    }
    assertPasswordPolicy(dto.newPassword, user.email);

    await this.users.updatePasswordHash(user._id, await this.passwords.hash(dto.newPassword), true);
    await this.sessions.revokeAllForUser(auth.userId);
    const session = await this.sessions.issue(
      user._id,
      meta,
      auth.mfaVerified ? 'verified' : 'none',
    );
    await this.audit.record({
      action: 'auth.password.change',
      outcome: 'success',
      actorUserId: auth.userId,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
    });
    return { user, session };
  }

  async revokeSession(auth: AuthContext, sessionId: string, meta: RequestMeta): Promise<boolean> {
    const revoked = await this.sessions.revoke(sessionId, auth.userId);
    if (revoked) {
      await this.audit.record({
        action: 'auth.session.revoke',
        outcome: 'success',
        actorUserId: auth.userId,
        targetType: 'session',
        targetId: sessionId,
        requestId: meta.requestId,
        ipAddress: meta.ipAddress,
      });
    }
    return revoked;
  }

  async revokeOtherSessions(auth: AuthContext, meta: RequestMeta): Promise<number> {
    const revoked = await this.sessions.revokeAllForUser(auth.userId, auth.sessionId);
    await this.audit.record({
      action: 'auth.session.revoke_others',
      outcome: 'success',
      actorUserId: auth.userId,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      metadata: { revoked },
    });
    return revoked;
  }
}
