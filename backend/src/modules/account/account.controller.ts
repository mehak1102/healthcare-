import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { requestMeta, type AppRequest } from '../../common/http/app-request';
import { InjectConfig } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';
import { PERMISSIONS } from '../access-control/permissions';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import type { AuthContext } from '../auth/auth-context';
import { AuthRateLimited, CurrentAuth } from '../auth/decorators';
import { sessionCookieName, sessionCookieOptions } from '../auth/session-cookie';
import { AccountDeletionService } from './account-deletion.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

@ApiTags('account')
@ApiCookieAuth()
@Controller('account')
@RequirePermissions(PERMISSIONS.ACCOUNT_SELF_MANAGE)
export class AccountController {
  constructor(
    private readonly deletion: AccountDeletionService,
    @InjectConfig() private readonly config: Env,
  ) {}

  @AuthRateLimited()
  @Post('delete')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Account deleted and signed out everywhere' })
  async delete(
    @Body() dto: DeleteAccountDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.deletion.deleteOwnAccount(auth, dto, requestMeta(req));
    res.clearCookie(sessionCookieName(this.config), sessionCookieOptions(this.config));
  }
}
