import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../access-control/permissions';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/decorators';
import { DispatchOfferDto } from './dto/home-visit-requests.dto';
import { HomeVisitRequestsService } from './home-visit-requests.service';

@ApiTags('home-visits')
@ApiCookieAuth()
@Controller('provider/dispatch-offers')
@RequirePermissions(PERMISSIONS.PROVIDER_APPOINTMENTS_HANDLE)
export class ProviderDispatchController {
  constructor(private readonly requests: HomeVisitRequestsService) {}

  @Post(':id/accept')
  @HttpCode(200)
  @ApiOkResponse({ type: DispatchOfferDto })
  async accept(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<DispatchOfferDto> {
    return this.requests.acceptOffer(auth, id);
  }
}
