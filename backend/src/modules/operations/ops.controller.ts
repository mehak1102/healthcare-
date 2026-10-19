import { Controller, Get, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { requestMeta, type AppRequest } from '../../common/http/app-request';
import { PERMISSIONS } from '../access-control/permissions';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/decorators';
import { OpsSummaryDto } from './dto/ops-summary.dto';
import { OpsService } from './ops.service';

@ApiTags('operations')
@ApiCookieAuth()
@Controller('ops')
export class OpsController {
  constructor(
    private readonly ops: OpsService,
    private readonly audit: AuditService,
  ) {}

  @Get('summary')
  @RequirePermissions(PERMISSIONS.OPERATIONS_DASHBOARD)
  @ApiOkResponse({ type: OpsSummaryDto })
  async summary(
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<OpsSummaryDto> {
    const data = await this.ops.summary();
    const meta = requestMeta(req);
    await this.audit.record({
      action: 'ops.summary.read',
      outcome: 'success',
      actorUserId: auth.userId,
      targetType: 'operations_dashboard',
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
    });
    return data;
  }
}
