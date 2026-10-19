import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectConfig } from '../../../config/app-config.module';
import type { Env } from '../../../config/env.schema';
import { apiError } from '../../../common/http/api-error';
import type { RequestMeta } from '../../../common/http/app-request';
import { hasPrivilegedRole } from '../../access-control/roles';
import { AuditService } from '../../audit/audit.service';
import type { UserDocument } from '../../users/user.schema';
import { UsersService } from '../../users/users.service';
import type { AuthContext, PendingMfaContext } from '../auth-context';
import { PasswordService } from '../password.service';
import { SessionsService, type IssuedSession } from '../sessions.service';
import { generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode } from './recovery-codes';
import { mfaEncryptionKey, openSecret, sealSecret } from './secret-box';
import { generateTotpSecret, isTotpCodeFormat, otpauthUri, verifyTotp } from './totp';

export const MFA_ISSUER = 'Sukoon Health';
const SETUP_TTL_MS = 10 * 60_000;

export interface MfaStatus {
  enabled: boolean;
  enrolledAt: string | null;
  recoveryCodesRemaining: number;
  /** False for staff accounts in production, where two-step verification is mandatory. */
  canDisable: boolean;
}

export interface MfaSetup {
  secret: string;
  otpauthUri: string;
}

type SecondFactor = 'totp' | 'recovery_code';

const invalidCode = () =>
  apiError(
    'INVALID_MFA_CODE',
    'That code did not work. Check your authenticator app and try again.',
  );
const challengeExpired = () =>
  new UnauthorizedException(
    apiError('MFA_CHALLENGE_EXPIRED', 'Your sign-in timed out. Please enter your password again.'),
  );

@Injectable()
export class MfaService {
  private readonly key: Buffer;

  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    @InjectConfig() private readonly config: Env,
  ) {
    this.key = mfaEncryptionKey(config);
  }

  async status(auth: AuthContext): Promise<MfaStatus> {
    const user = await this.loadUser(auth.userId);
    const enabled = user.mfaEnrolledAt !== null;
    return {
      enabled,
      enrolledAt: user.mfaEnrolledAt?.toISOString() ?? null,
      recoveryCodesRemaining: enabled ? user.mfaRecoveryCodeHashes.length : 0,
      canDisable: !this.isMandatory(user),
    };
  }

  /** Re-checks the password, then creates a secret that only becomes active after a valid code. */
  async startSetup(auth: AuthContext, password: string, meta: RequestMeta): Promise<MfaSetup> {
    const user = await this.loadUser(auth.userId);
    if (user.mfaEnrolledAt) {
      throw new ConflictException(
        apiError('MFA_ALREADY_ENABLED', 'Two-step verification is already on.'),
      );
    }
    await this.requirePassword(user, password, 'auth.mfa.setup', meta);

    const secret = generateTotpSecret();
    await this.users.setPendingMfaSecret(
      user._id,
      this.seal(secret, user.id),
      new Date(Date.now() + SETUP_TTL_MS),
    );
    await this.record('auth.mfa.setup', 'success', user.id, meta);
    return { secret, otpauthUri: otpauthUri(MFA_ISSUER, user.email, secret) };
  }

  /** Activates two-step verification and returns recovery codes (shown once, never stored). */
  async enable(auth: AuthContext, code: string, meta: RequestMeta): Promise<string[]> {
    const user = await this.loadUser(auth.userId);
    if (user.mfaEnrolledAt) {
      throw new ConflictException(
        apiError('MFA_ALREADY_ENABLED', 'Two-step verification is already on.'),
      );
    }
    const pending = user.mfaPendingSecret;
    if (!pending || !user.mfaPendingExpiresAt || user.mfaPendingExpiresAt <= new Date()) {
      throw new BadRequestException(
        apiError('MFA_SETUP_EXPIRED', 'Set-up timed out. Please start again.'),
      );
    }

    const step = verifyTotp(this.open(pending, user.id), code.replace(/\s/g, ''));
    if (step === null) {
      await this.record('auth.mfa.enable', 'failure', user.id, meta, { reason: 'bad_code' });
      throw new BadRequestException(invalidCode());
    }

    const codes = generateRecoveryCodes();
    const activated = await this.users.activateMfa(
      user._id,
      pending,
      step,
      this.hashCodes(user, codes),
    );
    if (!activated) {
      throw new BadRequestException(
        apiError('MFA_SETUP_EXPIRED', 'Set-up timed out. Please start again.'),
      );
    }
    await this.sessions.markMfaVerified(auth.sessionId);
    const revoked = await this.sessions.revokeAllForUser(auth.userId, auth.sessionId);
    await this.record('auth.mfa.enable', 'success', user.id, meta, { sessionsRevoked: revoked });
    return codes;
  }

  /** Second step of sign-in. Replaces the pending session with a fully verified one. */
  async completeChallenge(
    pending: PendingMfaContext,
    code: string,
    meta: RequestMeta,
  ): Promise<{ user: UserDocument; session: IssuedSession }> {
    const user = await this.users.findByIdWithMfa(pending.userId);
    if (!user || user.status !== 'active' || !user.mfaEnrolledAt) {
      await this.sessions.revoke(pending.sessionId, pending.userId);
      throw challengeExpired();
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.sessions.revoke(pending.sessionId, pending.userId);
      await this.record('auth.mfa.challenge', 'failure', user.id, meta, {
        reason: 'account_locked',
      });
      throw new UnauthorizedException(
        apiError(
          'MFA_LOCKED',
          'Too many incorrect codes. Sign-in is paused for 15 minutes for your safety.',
        ),
      );
    }

    const method = await this.checkSecondFactor(user, code);
    if (!method) {
      await this.users.recordFailedLogin(user._id);
      await this.record('auth.mfa.challenge', 'failure', user.id, meta, { reason: 'bad_code' });
      throw new UnauthorizedException(invalidCode());
    }

    await this.users.recordSuccessfulLogin(user._id);
    await this.sessions.revoke(pending.sessionId, pending.userId);
    const session = await this.sessions.issue(user._id, meta, 'verified');
    await this.record('auth.mfa.challenge', 'success', user.id, meta, { method });
    await this.record('auth.login', 'success', user.id, meta, { method });
    return { user, session };
  }

  async regenerateRecoveryCodes(
    auth: AuthContext,
    code: string,
    meta: RequestMeta,
  ): Promise<string[]> {
    const user = await this.loadEnrolledUser(auth.userId);
    await this.requireSecondFactor(user, code, 'auth.mfa.recovery_codes', meta);
    const codes = generateRecoveryCodes();
    await this.users.replaceRecoveryCodes(user._id, this.hashCodes(user, codes));
    await this.record('auth.mfa.recovery_codes', 'success', user.id, meta);
    return codes;
  }

  async disable(
    auth: AuthContext,
    password: string,
    code: string,
    meta: RequestMeta,
  ): Promise<void> {
    const user = await this.loadEnrolledUser(auth.userId);
    if (this.isMandatory(user)) {
      await this.record('auth.mfa.disable', 'denied', user.id, meta, { reason: 'mandatory' });
      throw new ForbiddenException(
        apiError('MFA_MANDATORY', 'Two-step verification cannot be turned off for staff accounts.'),
      );
    }
    await this.requirePassword(user, password, 'auth.mfa.disable', meta);
    await this.requireSecondFactor(user, code, 'auth.mfa.disable', meta);
    await this.users.disableMfa(user._id);
    await this.record('auth.mfa.disable', 'success', user.id, meta);
  }

  /** Re-checks the password, and the second step when it is on, before an irreversible action. */
  async confirmIdentity(
    userId: string,
    password: string,
    code: string | undefined,
    action: string,
    meta: RequestMeta,
  ): Promise<UserDocument> {
    const user = await this.loadUser(userId);
    await this.requirePassword(user, password, action, meta);
    if (user.mfaEnrolledAt) {
      if (!code) {
        throw new BadRequestException(
          apiError('MFA_CODE_REQUIRED', 'Enter a code from your authenticator app.'),
        );
      }
      await this.requireSecondFactor(user, code, action, meta);
    }
    return user;
  }

  private async checkSecondFactor(user: UserDocument, input: string): Promise<SecondFactor | null> {
    const code = input.replace(/\s/g, '');
    if (isTotpCodeFormat(code)) {
      if (!user.mfaSecret) return null;
      const step = verifyTotp(this.open(user.mfaSecret, user.id), code);
      return step !== null && (await this.users.claimTotpStep(user._id, step)) ? 'totp' : null;
    }
    const normalized = normalizeRecoveryCode(code);
    if (!normalized) return null;
    const used = await this.users.consumeRecoveryCode(
      user._id,
      hashRecoveryCode(this.key, user.id, normalized),
    );
    return used ? 'recovery_code' : null;
  }

  private async requireSecondFactor(
    user: UserDocument,
    code: string,
    action: string,
    meta: RequestMeta,
  ): Promise<void> {
    if (await this.checkSecondFactor(user, code)) return;
    await this.users.recordFailedLogin(user._id);
    await this.record(action, 'failure', user.id, meta, { reason: 'bad_code' });
    throw new BadRequestException(invalidCode());
  }

  private async requirePassword(
    user: UserDocument,
    password: string,
    action: string,
    meta: RequestMeta,
  ): Promise<void> {
    if (await this.passwords.verify(user.passwordHash, password)) return;
    await this.users.recordFailedLogin(user._id);
    await this.record(action, 'failure', user.id, meta, { reason: 'bad_password' });
    throw new BadRequestException(
      apiError('INVALID_CURRENT_PASSWORD', 'Your current password is incorrect'),
    );
  }

  private isMandatory(user: UserDocument): boolean {
    return this.config.NODE_ENV === 'production' && hasPrivilegedRole(user.roles);
  }

  private async loadUser(userId: string): Promise<UserDocument> {
    const user = await this.users.findByIdWithMfa(userId);
    if (!user)
      throw new UnauthorizedException(apiError('UNAUTHENTICATED', 'Please sign in to continue'));
    return user;
  }

  private async loadEnrolledUser(userId: string): Promise<UserDocument> {
    const user = await this.loadUser(userId);
    if (!user.mfaEnrolledAt) {
      throw new ConflictException(apiError('MFA_NOT_ENABLED', 'Two-step verification is not on.'));
    }
    return user;
  }

  private hashCodes(user: UserDocument, codes: string[]): string[] {
    return codes.map((code) => hashRecoveryCode(this.key, user.id, normalizeRecoveryCode(code)!));
  }

  private seal(secret: string, userId: string): string {
    return sealSecret(this.key, secret, `mfa:${userId}`);
  }

  private open(sealed: string, userId: string): string {
    return openSecret(this.key, sealed, `mfa:${userId}`);
  }

  private record(
    action: string,
    outcome: 'success' | 'failure' | 'denied',
    userId: string,
    meta: RequestMeta,
    metadata?: Record<string, string | number | boolean>,
  ): Promise<void> {
    return this.audit.record({
      action,
      outcome,
      actorUserId: userId,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      metadata,
    });
  }
}
