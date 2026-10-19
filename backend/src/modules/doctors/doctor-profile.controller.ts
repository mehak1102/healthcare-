import { Body, Controller, Get, Patch, Put, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { requestMeta, type AppRequest } from '../../common/http/app-request';
import { PERMISSIONS } from '../access-control/permissions';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/decorators';
import { SchedulesService } from '../appointments/schedules.service';
import { DoctorProfilesService, missingForPublish } from './doctor-profiles.service';
import {
  MyDoctorProfileDto,
  UpdateAvailabilityDto,
  UpdateDoctorProfileDto,
} from './dto/doctor-profiles.dto';

@ApiTags('doctors')
@ApiCookieAuth()
@Controller('doctor-profile/me')
@RequirePermissions(PERMISSIONS.PROVIDER_PROFILE_MANAGE_OWN)
export class DoctorProfileController {
  constructor(
    private readonly profiles: DoctorProfilesService,
    private readonly schedules: SchedulesService,
  ) {}

  @Get()
  @ApiOkResponse({ type: MyDoctorProfileDto })
  async get(@CurrentAuth() auth: AuthContext): Promise<MyDoctorProfileDto> {
    const profile = await this.profiles.findMine(auth.userId);
    return MyDoctorProfileDto.fromOwn(profile, missingForPublish(profile));
  }

  @Put()
  @ApiOkResponse({ type: MyDoctorProfileDto })
  async update(
    @Body() body: UpdateDoctorProfileDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<MyDoctorProfileDto> {
    const profile = await this.profiles.updateMine(auth, body, requestMeta(req));
    return MyDoctorProfileDto.fromOwn(profile, missingForPublish(profile));
  }

  @Patch('availability')
  @ApiOkResponse({ type: MyDoctorProfileDto })
  async availability(
    @Body() body: UpdateAvailabilityDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<MyDoctorProfileDto> {
    const profile = await this.profiles.setAvailability(
      auth,
      body.availabilityStatus,
      requestMeta(req),
    );
    await this.schedules.refreshNextAvailableCache(profile);
    return MyDoctorProfileDto.fromOwn(profile, missingForPublish(profile));
  }
}
