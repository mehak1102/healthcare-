import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { requestMeta, type AppRequest } from '../../common/http/app-request';
import { PERMISSIONS } from '../access-control/permissions';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/decorators';
import {
  AdminPublicHolidayDto,
  CreatePublicHolidayDto,
  ListPublicHolidaysQueryDto,
} from './dto/public-holidays.dto';
import { PublicHolidaysService } from './public-holidays.service';

@ApiTags('admin')
@ApiCookieAuth()
@Controller('admin/public-holidays')
export class AdminPublicHolidaysController {
  constructor(
    private readonly holidays: PublicHolidaysService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @ApiOkResponse({ type: [AdminPublicHolidayDto] })
  async list(
    @Query() query: ListPublicHolidaysQueryDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<AdminPublicHolidayDto[]> {
    const items = await this.holidays.listAllAdmin(query.region);
    const meta = requestMeta(req);
    await this.audit.record({
      action: 'admin.public_holidays.list',
      outcome: 'success',
      actorUserId: auth.userId,
      targetType: 'public_holiday',
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      metadata: { region: query.region ?? 'all', resultCount: items.length },
    });
    return items.map((row) => ({
      id: row.id,
      date: row.date,
      name: row.name,
      region: row.region,
    }));
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  @ApiCreatedResponse({ type: AdminPublicHolidayDto })
  async create(
    @Body() body: CreatePublicHolidayDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<AdminPublicHolidayDto> {
    const region = body.region ?? 'IN';
    const doc = await this.holidays.create({
      date: body.date,
      name: body.name.trim(),
      region,
    });
    const meta = requestMeta(req);
    await this.audit.record({
      action: 'admin.public_holidays.create',
      outcome: 'success',
      actorUserId: auth.userId,
      targetType: 'public_holiday',
      targetId: doc.id,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      metadata: { date: doc.date, region: doc.region },
    });
    return { id: doc.id, date: doc.date, name: doc.name, region: doc.region };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CATALOG_MANAGE)
  async remove(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<{ removed: true }> {
    await this.holidays.remove(id);
    const meta = requestMeta(req);
    await this.audit.record({
      action: 'admin.public_holidays.delete',
      outcome: 'success',
      actorUserId: auth.userId,
      targetType: 'public_holiday',
      targetId: id,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
    });
    return { removed: true };
  }
}
