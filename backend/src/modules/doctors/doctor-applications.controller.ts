import { Body, Controller, Get, Post, Put, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { requestMeta, type AppRequest } from '../../common/http/app-request';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/decorators';
import { DoctorApplicationsService } from './doctor-applications.service';
import {
  DoctorApplicationDto,
  MyDoctorApplicationDto,
  SubmitDoctorApplicationDto,
} from './dto/doctor-applications.dto';

/** Any signed-in account may apply. Verification is granted only by a reviewer. */
@ApiTags('doctors')
@ApiCookieAuth()
@Controller('doctor-applications')
export class DoctorApplicationsController {
  constructor(private readonly applications: DoctorApplicationsService) {}

  @Post()
  @ApiCreatedResponse({ type: DoctorApplicationDto })
  async submit(
    @Body() body: SubmitDoctorApplicationDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<DoctorApplicationDto> {
    const application = await this.applications.submit(auth, body, requestMeta(req));
    return DoctorApplicationDto.from(application);
  }

  @Put('me')
  @ApiOkResponse({ type: DoctorApplicationDto })
  async update(
    @Body() body: SubmitDoctorApplicationDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<DoctorApplicationDto> {
    const application = await this.applications.updatePending(auth, body, requestMeta(req));
    return DoctorApplicationDto.from(application);
  }

  @Get('me')
  @ApiOkResponse({ type: MyDoctorApplicationDto })
  async mine(@CurrentAuth() auth: AuthContext): Promise<MyDoctorApplicationDto> {
    const application = await this.applications.findLatestForUser(auth.userId);
    return { application: application ? DoctorApplicationDto.from(application) : null };
  }
}
