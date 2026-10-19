import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { requestMeta, type AppRequest } from '../../common/http/app-request';
import { PERMISSIONS } from '../access-control/permissions';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/decorators';
import { DoctorStandingService } from './doctor-standing.service';

export class SuspendDoctorDto {
  @ApiProperty({ minLength: 10, maxLength: 500 })
  @IsString()
  @Length(10, 500)
  reason: string;
}

class SuspendDoctorResultDto {
  @ApiProperty() userId: string;
  @ApiProperty({ enum: ['suspended'] }) verificationStatus: 'suspended';
}

@ApiTags('admin')
@ApiCookieAuth()
@Controller('admin/doctors')
@RequirePermissions(PERMISSIONS.PROVIDERS_VERIFY)
export class AdminDoctorStandingController {
  constructor(private readonly standing: DoctorStandingService) {}

  @Post(':userId/suspend')
  @HttpCode(200)
  @ApiOkResponse({ type: SuspendDoctorResultDto })
  async suspend(
    @Param('userId') userId: string,
    @Body() body: SuspendDoctorDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<SuspendDoctorResultDto> {
    await this.standing.suspend(auth, userId, body.reason, requestMeta(req));
    return { userId, verificationStatus: 'suspended' };
  }
}
