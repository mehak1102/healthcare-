import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { requestMeta, type AppRequest } from '../../../common/http/app-request';
import type { AuthContext } from '../auth-context';
import { AuthRateLimited, CurrentAuth } from '../decorators';
import { DisableMfaDto, MfaCodeDto, MfaPasswordDto } from '../dto/auth-requests.dto';
import { MfaSetupDto, MfaStatusDto, RecoveryCodesDto } from '../dto/auth-responses.dto';
import { MfaService } from './mfa.service';

/** Two-step verification settings for the signed-in account. Sign-in itself is in AuthController. */
@ApiTags('auth')
@ApiCookieAuth()
@Controller('auth/mfa')
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @Get()
  @ApiOkResponse({ type: MfaStatusDto })
  status(@CurrentAuth() auth: AuthContext): Promise<MfaStatusDto> {
    return this.mfa.status(auth);
  }

  @AuthRateLimited()
  @Post('setup')
  @HttpCode(200)
  @ApiOkResponse({ type: MfaSetupDto })
  setup(
    @Body() dto: MfaPasswordDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<MfaSetupDto> {
    return this.mfa.startSetup(auth, dto.password, requestMeta(req));
  }

  @AuthRateLimited()
  @Post('enable')
  @HttpCode(200)
  @ApiOkResponse({ type: RecoveryCodesDto })
  async enable(
    @Body() dto: MfaCodeDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<RecoveryCodesDto> {
    return { recoveryCodes: await this.mfa.enable(auth, dto.code, requestMeta(req)) };
  }

  @AuthRateLimited()
  @Post('recovery-codes')
  @HttpCode(200)
  @ApiOkResponse({ type: RecoveryCodesDto })
  async regenerateRecoveryCodes(
    @Body() dto: MfaCodeDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<RecoveryCodesDto> {
    return {
      recoveryCodes: await this.mfa.regenerateRecoveryCodes(auth, dto.code, requestMeta(req)),
    };
  }

  @AuthRateLimited()
  @Post('disable')
  @HttpCode(204)
  async disable(
    @Body() dto: DisableMfaDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<void> {
    await this.mfa.disable(auth, dto.password, dto.code, requestMeta(req));
  }
}
