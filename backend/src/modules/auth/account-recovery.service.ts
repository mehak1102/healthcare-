import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectConfig } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';
import { apiError } from '../../common/http/api-error';
import type { RequestMeta } from '../../common/http/app-request';
import { AuditService } from '../audit/audit.service';
import { emailUnavailable } from '../mail/disabled-mail.transport';
import { InjectMailTransport, type MailTransport } from '../mail/mail-transport';
import type { UserDocument } from '../users/user.schema';
import { UsersService } from '../users/users.service';
import type { AuthContext } from './auth-context';
import { ACCOUNT_TOKEN_TTL_MINUTES, AccountTokensService } from './account-tokens.service';
import { PasswordService, assertPasswordPolicy } from './password.service';
import { SessionsService } from './sessions.service';

const invalidLink = () =>
  new BadRequestException(
    apiError(
      'INVALID_OR_EXPIRED_LINK',
      'This link is invalid or has expired. Please request a new one.',
    ),
  );

const firstName = (user: UserDocument) => user.fullName.split(' ')[0] ?? user.fullName;

@Injectable()
export class AccountRecoveryService {
  private readonly logger = new Logger(AccountRecoveryService.name);

  constructor(
    private readonly users: UsersService,
    private readonly tokens: AccountTokensService,
    private readonly sessions: SessionsService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    @InjectMailTransport() private readonly mail: MailTransport,
    @InjectConfig() private readonly config: Env,
  ) {}

  /**
   * Always resolves the same way whether or not the account exists. The lookup and email run in
   * the background so response timing does not reveal registered addresses either.
   */
  requestPasswordReset(email: string, meta: RequestMeta): void {
    if (!this.mail.available) throw emailUnavailable();
    this.runInBackground('password reset request', () => this.sendPasswordReset(email, meta));
  }

  async confirmPasswordReset(token: string, newPassword: string, meta: RequestMeta): Promise<void> {
    const pending = await this.tokens.findUsable(token, 'password_reset');
    const user = pending ? await this.users.findById(pending.userId.toString()) : null;
    if (!pending || !user || user.status !== 'active') throw invalidLink();

    assertPasswordPolicy(newPassword, user.email);
    if (!(await this.tokens.consume(token, 'password_reset'))) throw invalidLink();

    await this.users.resetPassword(user._id, await this.passwords.hash(newPassword));
    const revoked = await this.sessions.revokeAllForUser(user.id);
    await this.audit.record({
      action: 'auth.password_reset.complete',
      outcome: 'success',
      actorUserId: user.id,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      metadata: { sessionsRevoked: revoked },
    });
  }

  async requestEmailVerification(auth: AuthContext, meta: RequestMeta): Promise<void> {
    const user = await this.users.findById(auth.userId);
    if (!user || user.emailVerifiedAt) return;
    if (!this.mail.available) throw emailUnavailable();
    await this.sendEmailVerification(user, meta);
  }

  /** Called after registration; a delivery problem must not undo a successful sign-up. */
  sendVerificationAfterRegistration(user: UserDocument, meta: RequestMeta): void {
    if (!this.mail.available) return;
    this.runInBackground('verification email', () => this.sendEmailVerification(user, meta));
  }

  async confirmEmailVerification(token: string, meta: RequestMeta): Promise<void> {
    const used = await this.tokens.consume(token, 'email_verification');
    if (!used) throw invalidLink();
    if (!(await this.users.markEmailVerified(used.userId, used.email))) throw invalidLink();
    await this.audit.record({
      action: 'auth.email_verification.complete',
      outcome: 'success',
      actorUserId: used.userId.toString(),
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
    });
  }

  private async sendPasswordReset(email: string, meta: RequestMeta): Promise<void> {
    const user = await this.users.findByEmailWithPassword(email);
    if (!user || user.status !== 'active') {
      await this.audit.record({
        action: 'auth.password_reset.request',
        outcome: 'failure',
        actorUserId: user?.id ?? null,
        requestId: meta.requestId,
        ipAddress: meta.ipAddress,
        metadata: { reason: user ? 'account_disabled' : 'unknown_account' },
      });
      return;
    }

    const token = await this.tokens.issue(user._id, 'password_reset', user.email);
    await this.mail.send({
      to: user.email,
      subject: 'Reset your Sukoon Health password',
      text: [
        `Hello ${firstName(user)},`,
        '',
        'We received a request to reset your password. Open this link to choose a new one:',
        `${this.config.APP_BASE_URL}/reset-password#token=${token}`,
        '',
        `The link works once and expires in ${ACCOUNT_TOKEN_TTL_MINUTES.password_reset} minutes.`,
        'Resetting your password signs you out on every device.',
        '',
        'If you did not ask for this, you can ignore this email. Your password has not changed.',
      ].join('\n'),
    });
    await this.audit.record({
      action: 'auth.password_reset.request',
      outcome: 'success',
      actorUserId: user.id,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
    });
  }

  private async sendEmailVerification(user: UserDocument, meta: RequestMeta): Promise<void> {
    const token = await this.tokens.issue(user._id, 'email_verification', user.email);
    await this.mail.send({
      to: user.email,
      subject: 'Confirm your email address for Sukoon Health',
      text: [
        `Hello ${firstName(user)},`,
        '',
        'Please confirm this is your email address by opening this link:',
        `${this.config.APP_BASE_URL}/verify-email#token=${token}`,
        '',
        'The link expires in 24 hours. If you did not create a Sukoon Health account, ignore this email.',
      ].join('\n'),
    });
    await this.audit.record({
      action: 'auth.email_verification.request',
      outcome: 'success',
      actorUserId: user.id,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
    });
  }

  private runInBackground(label: string, task: () => Promise<void>): void {
    task().catch((error: unknown) => {
      this.logger.error(
        `Failed to process ${label}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    });
  }
}
