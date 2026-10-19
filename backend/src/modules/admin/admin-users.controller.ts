import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { requestMeta, type AppRequest } from '../../common/http/app-request';
import { PERMISSIONS } from '../access-control/permissions';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/decorators';
import { UsersService } from '../users/users.service';
import { AdminUserPageDto, AdminUserSummaryDto, ListUsersQueryDto } from './dto/admin-users.dto';

@ApiTags('admin')
@ApiCookieAuth()
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ApiOkResponse({ type: AdminUserPageDto })
  async list(
    @Query() query: ListUsersQueryDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<AdminUserPageDto> {
    const { items, total } = await this.users.list(query);
    const meta = requestMeta(req);
    // Privileged reads are audited before data is returned; if auditing fails, nothing is returned.
    await this.audit.record({
      action: 'admin.users.list',
      outcome: 'success',
      actorUserId: auth.userId,
      targetType: 'user',
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      metadata: {
        page: query.page,
        resultCount: items.length,
        filtered: Boolean(query.search || query.role),
      },
    });
    return {
      items: items.map((user) => AdminUserSummaryDto.from(user)),
      page: query.page,
      limit: query.limit,
      total,
    };
  }
}
