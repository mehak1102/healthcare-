import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { InjectConfig } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';
import { apiError, isApiErrorBody } from '../../common/http/api-error';
import { sessionAccess } from '../access-control/session-access';
import { requestMeta, type AppRequest } from '../../common/http/app-request';
import { ParseObjectIdPipe } from '../../common/validation/parse-object-id.pipe';
import { UsersService } from '../users/users.service';
import type { AuthContext } from './auth-context';
import { AuthService } from './auth.service';
import { AuthRateLimited, CurrentAuth, Public, SkipSessionCsrf } from './decorators';
import { AccountRecoveryService } from './account-recovery.service';
import {
  ChangePasswordDto,
  ConfirmEmailVerificationDto,
  ConfirmPasswordResetDto,
  LoginDto,
  MfaCodeDto,
  RegisterDto,
  RequestPasswordResetDto,
} from './dto/auth-requests.dto';
import {
  AuthResponseDto,
  CurrentUserDto,
  MfaRequiredDto,
  RevokedCountDto,
  SessionListDto,
  SessionSummaryDto,
} from './dto/auth-responses.dto';
import { MfaService } from './mfa/mfa.service';
import { sessionCookieName, sessionCookieOptions } from './session-cookie';
import { deriveCsrfToken } from './session-tokens';
import { MFA_PENDING_TTL_MS, SessionsService, type IssuedSession } from './sessions.service';
import type { UserDocument } from '../users/user.schema';

@ApiTags('auth')
@ApiExtraModels(AuthResponseDto, MfaRequiredDto)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly recovery: AccountRecoveryService,
    private readonly mfa: MfaService,
    private readonly sessions: SessionsService,
    private readonly users: UsersService,
    @InjectConfig() private readonly config: Env,
  ) {}

  @Public()
  @SkipSessionCsrf()
  @AuthRateLimited()
  @Post('register')
  @HttpCode(201)
  @ApiOkResponse({ type: AuthResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.auth.register(dto, requestMeta(req), req.auth ?? req.pendingMfa);
    return this.startSession(res, result.user, result.session);
  }

  @Public()
  @SkipSessionCsrf()
  @AuthRateLimited()
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Either a signed-in session, or `{ mfaRequired: true }` when a code is needed',
    schema: {
      oneOf: [{ $ref: getSchemaPath(AuthResponseDto) }, { $ref: getSchemaPath(MfaRequiredDto) }],
    },
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto | MfaRequiredDto> {
    const result = await this.auth.login(dto, requestMeta(req), req.auth ?? req.pendingMfa);
    if (result.session.mfaState === 'pending') {
      this.setSessionCookie(res, result.session.token, MFA_PENDING_TTL_MS);
      return { mfaRequired: true };
    }
    return this.startSession(res, result.user, result.session);
  }

  @Public()
  @SkipSessionCsrf()
  @AuthRateLimited()
  @Post('mfa/challenge')
  @HttpCode(200)
  @ApiOkResponse({ type: AuthResponseDto })
  async completeMfaChallenge(
    @Body() dto: MfaCodeDto,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    if (!req.pendingMfa) {
      throw new UnauthorizedException(
        apiError(
          'MFA_CHALLENGE_EXPIRED',
          'Your sign-in timed out. Please enter your password again.',
        ),
      );
    }
    try {
      const result = await this.mfa.completeChallenge(req.pendingMfa, dto.code, requestMeta(req));
      return this.startSession(res, result.user, result.session);
    } catch (error) {
      if (error instanceof UnauthorizedException && this.challengeEnded(error)) {
        this.clearSessionCookie(res);
      }
      throw error;
    }
  }

  @ApiCookieAuth()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(auth, requestMeta(req));
    this.clearSessionCookie(res);
  }

  @ApiCookieAuth()
  @Get('me')
  @ApiOkResponse({ type: AuthResponseDto })
  async me(@CurrentAuth() auth: AuthContext): Promise<AuthResponseDto> {
    const user = await this.users.findById(auth.userId);
    if (!user) throw new NotFoundException(apiError('NOT_FOUND', 'Account not found'));
    return {
      user: CurrentUserDto.from(user, auth),
      csrfToken: deriveCsrfToken(this.config.SESSION_SECRET, auth.tokenHash),
    };
  }

  @ApiCookieAuth()
  @Get('sessions')
  @ApiOkResponse({ type: SessionListDto })
  async listSessions(@CurrentAuth() auth: AuthContext): Promise<SessionListDto> {
    const sessions = await this.sessions.listActive(auth.userId);
    return { items: sessions.map((session) => SessionSummaryDto.from(session, auth.sessionId)) };
  }

  @ApiCookieAuth()
  @Delete('sessions/:id')
  @HttpCode(204)
  async revokeSession(
    @Param('id', ParseObjectIdPipe) sessionId: string,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const revoked = await this.auth.revokeSession(auth, sessionId, requestMeta(req));
    if (!revoked) throw new NotFoundException(apiError('NOT_FOUND', 'Session not found'));
    if (sessionId === auth.sessionId) this.clearSessionCookie(res);
  }

  @ApiCookieAuth()
  @Post('sessions/revoke-others')
  @HttpCode(200)
  @ApiOkResponse({ type: RevokedCountDto })
  async revokeOtherSessions(
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<RevokedCountDto> {
    return { revoked: await this.auth.revokeOtherSessions(auth, requestMeta(req)) };
  }

  @ApiCookieAuth()
  @AuthRateLimited()
  @Post('password')
  @HttpCode(200)
  @ApiOkResponse({ type: AuthResponseDto })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.auth.changePassword(auth, dto, requestMeta(req));
    return this.startSession(res, result.user, result.session);
  }

  @Public()
  @SkipSessionCsrf()
  @AuthRateLimited()
  @Post('password-reset/request')
  @HttpCode(204)
  requestPasswordReset(@Body() dto: RequestPasswordResetDto, @Req() req: AppRequest): void {
    this.recovery.requestPasswordReset(dto.email, requestMeta(req));
  }

  @Public()
  @SkipSessionCsrf()
  @AuthRateLimited()
  @Post('password-reset/confirm')
  @HttpCode(204)
  async confirmPasswordReset(
    @Body() dto: ConfirmPasswordResetDto,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.recovery.confirmPasswordReset(dto.token, dto.newPassword, requestMeta(req));
    this.clearSessionCookie(res);
  }

  @ApiCookieAuth()
  @AuthRateLimited()
  @Post('email-verification/request')
  @HttpCode(204)
  async requestEmailVerification(
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<void> {
    await this.recovery.requestEmailVerification(auth, requestMeta(req));
  }

  @Public()
  @SkipSessionCsrf()
  @AuthRateLimited()
  @Post('email-verification/confirm')
  @HttpCode(204)
  async confirmEmailVerification(
    @Body() dto: ConfirmEmailVerificationDto,
    @Req() req: AppRequest,
  ): Promise<void> {
    await this.recovery.confirmEmailVerification(dto.token, requestMeta(req));
  }

  private startSession(res: Response, user: UserDocument, session: IssuedSession): AuthResponseDto {
    this.setSessionCookie(res, session.token, this.sessions.ttlMs);
    const access = sessionAccess(this.config, user.roles, session.mfaState === 'verified');
    return {
      user: CurrentUserDto.from(user, access),
      csrfToken: deriveCsrfToken(this.config.SESSION_SECRET, session.tokenHash),
    };
  }

  private setSessionCookie(res: Response, token: string, maxAge: number): void {
    res.cookie(sessionCookieName(this.config), token, {
      ...sessionCookieOptions(this.config),
      maxAge,
    });
  }

  /** The pending session is gone after these, so the browser should drop its cookie too. */
  private challengeEnded(error: UnauthorizedException): boolean {
    const body = error.getResponse();
    return isApiErrorBody(body) && ['MFA_CHALLENGE_EXPIRED', 'MFA_LOCKED'].includes(body.code);
  }

  private clearSessionCookie(res: Response): void {
    res.clearCookie(sessionCookieName(this.config), sessionCookieOptions(this.config));
  }
}
