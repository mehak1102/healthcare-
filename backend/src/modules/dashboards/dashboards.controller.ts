import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../access-control/permissions';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/decorators';
import { DashboardsService } from './dashboards.service';

@ApiTags('dashboards')
@ApiCookieAuth()
@Controller()
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Get('patient/dashboard')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS_SELF_BOOK)
  @ApiOkResponse({ description: 'The signed-in patient’s own care summary' })
  patient(@CurrentAuth() auth: AuthContext) {
    return this.dashboards.patient(auth);
  }

  @Get('doctor/dashboard')
  @RequirePermissions(PERMISSIONS.PROVIDER_PROFILE_MANAGE_OWN)
  @ApiOkResponse({ description: 'The signed-in doctor’s own practice summary' })
  doctor(@CurrentAuth() auth: AuthContext) {
    return this.dashboards.doctor(auth);
  }
}
