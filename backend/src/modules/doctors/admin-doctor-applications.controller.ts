import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { requestMeta, type AppRequest } from '../../common/http/app-request';
import { PERMISSIONS } from '../access-control/permissions';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/decorators';
import { DoctorApplicationsService } from './doctor-applications.service';
import {
  AdminDoctorApplicationDto,
  AdminDoctorApplicationPageDto,
  ApproveDoctorApplicationDto,
  ListDoctorApplicationsQueryDto,
  RejectDoctorApplicationDto,
} from './dto/doctor-applications.dto';

@ApiTags('admin')
@ApiCookieAuth()
@Controller('admin/doctor-applications')
@RequirePermissions(PERMISSIONS.PROVIDERS_VERIFY)
export class AdminDoctorApplicationsController {
  constructor(
    private readonly applications: DoctorApplicationsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOkResponse({ type: AdminDoctorApplicationPageDto })
  async list(
    @Query() query: ListDoctorApplicationsQueryDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<AdminDoctorApplicationPageDto> {
    const { items, total, applicants } = await this.applications.list(query);
    const meta = requestMeta(req);
    await this.audit.record({
      action: 'admin.doctor_applications.list',
      outcome: 'success',
      actorUserId: auth.userId,
      targetType: 'doctor_application',
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      metadata: { status: query.status, page: query.page, resultCount: items.length },
    });
    return {
      items: items.map((item) =>
        AdminDoctorApplicationDto.fromWithApplicant(item, applicants.get(item.userId.toString())),
      ),
      page: query.page,
      limit: query.limit,
      total,
    };
  }

  @Post(':id/approve')
  @HttpCode(200)
  @ApiOkResponse({ type: AdminDoctorApplicationDto })
  async approve(
    @Param('id') id: string,
    @Body() body: ApproveDoctorApplicationDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<AdminDoctorApplicationDto> {
    const application = await this.applications.approve(auth, id, body, requestMeta(req));
    return AdminDoctorApplicationDto.fromWithApplicant(application, undefined);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOkResponse({ type: AdminDoctorApplicationDto })
  async reject(
    @Param('id') id: string,
    @Body() body: RejectDoctorApplicationDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<AdminDoctorApplicationDto> {
    const application = await this.applications.reject(auth, id, body, requestMeta(req));
    return AdminDoctorApplicationDto.fromWithApplicant(application, undefined);
  }
}
