import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { requestMeta, type AppRequest } from '../../common/http/app-request';
import { PERMISSIONS } from '../access-control/permissions';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/decorators';
import {
  ListOpsHomeVisitsQueryDto,
  OpsHomeVisitListDto,
  ReassignHomeVisitDto,
} from './dto/home-visit-requests.dto';
import { HomeVisitRequestsService } from './home-visit-requests.service';

@ApiTags('operations')
@ApiCookieAuth()
@Controller('ops/home-visits')
export class OpsHomeVisitsController {
  constructor(
    private readonly requests: HomeVisitRequestsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.OPERATIONS_DASHBOARD)
  @ApiOkResponse({ type: OpsHomeVisitListDto })
  async list(@Query() query: ListOpsHomeVisitsQueryDto): Promise<OpsHomeVisitListDto> {
    return this.requests.listForOps(query);
  }

  @Post(':id/reassign')
  @RequirePermissions(PERMISSIONS.DISPATCH_OPERATE)
  @ApiOkResponse({ description: 'Withdraws open offers and creates a new dispatch offer' })
  async reassign(
    @Param('id') id: string,
    @Body() body: ReassignHomeVisitDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ) {
    const result = await this.requests.reassign(id, body, auth.userId);
    const meta = requestMeta(req);
    await this.audit.record({
      action: 'home_visit.reassign',
      outcome: 'success',
      actorUserId: auth.userId,
      targetType: 'home_visit_request',
      targetId: id,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      metadata: { doctorUserId: body.doctorUserId },
    });
    return result;
  }
}
