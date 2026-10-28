import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../access-control/permissions';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/decorators';
import {
  ProviderAssignedVisitListDto,
  ProviderDispatchOfferListDto,
  UpdateHomeVisitLocationDto,
  UpdateHomeVisitStatusDto,
  VerifyHomeVisitArrivalDto,
} from './dto/home-visit-requests.dto';
import { HomeVisitRequestsService } from './home-visit-requests.service';

@ApiTags('home-visits')
@ApiCookieAuth()
@Controller('provider/home-visits')
@RequirePermissions(PERMISSIONS.PROVIDER_APPOINTMENTS_HANDLE)
export class ProviderHomeVisitsController {
  constructor(private readonly requests: HomeVisitRequestsService) {}

  @Get('dispatch-offers')
  @ApiOkResponse({ type: ProviderDispatchOfferListDto })
  async dispatchOffers(@CurrentAuth() auth: AuthContext): Promise<ProviderDispatchOfferListDto> {
    const items = await this.requests.listDispatchOffersForDoctor(auth);
    return { items };
  }

  @Get('assigned')
  @ApiOkResponse({ type: ProviderAssignedVisitListDto })
  async assigned(@CurrentAuth() auth: AuthContext): Promise<ProviderAssignedVisitListDto> {
    const items = await this.requests.listAssignedForDoctor(auth);
    return { items };
  }

  @Post(':id/status')
  @HttpCode(200)
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateHomeVisitStatusDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.requests.advanceStatusForDoctor(auth, id, body.status, {
      lat: body.lat,
      lng: body.lng,
    });
  }

  @Post(':id/location')
  @HttpCode(200)
  async updateLocation(
    @Param('id') id: string,
    @Body() body: UpdateHomeVisitLocationDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.requests.updateDoctorLocation(auth, id, body);
  }

  @Post(':id/verify-arrival')
  @HttpCode(200)
  async verifyArrival(
    @Param('id') id: string,
    @Body() body: VerifyHomeVisitArrivalDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.requests.verifyArrivalForDoctor(auth, id, body.code);
  }
}
