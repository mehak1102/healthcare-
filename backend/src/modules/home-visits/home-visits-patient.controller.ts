import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { requestMeta, type AppRequest } from '../../common/http/app-request';
import { PERMISSIONS } from '../access-control/permissions';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import { VerifyPaymentDto } from '../appointments/dto/appointments.dto';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/decorators';
import {
  CreateHomeVisitRequestDto,
  HomeVisitAvailableDoctorListDto,
  HomeVisitQuoteDto,
  HomeVisitQuoteResponseDto,
  HomeVisitRequestDto,
  HomeVisitRequestListDto,
  ListHomeVisitDoctorsQueryDto,
} from './dto/home-visit-requests.dto';
import { HomeVisitRequestsService } from './home-visit-requests.service';

@ApiTags('home-visits')
@ApiCookieAuth()
@Controller('home-visits')
@RequirePermissions(PERMISSIONS.APPOINTMENTS_SELF_BOOK)
export class HomeVisitsPatientController {
  constructor(private readonly requests: HomeVisitRequestsService) {}

  @Post('quote')
  @HttpCode(200)
  @ApiOkResponse({ type: HomeVisitQuoteResponseDto })
  async quote(@Body() body: HomeVisitQuoteDto): Promise<HomeVisitQuoteResponseDto> {
    return this.requests.quote(body);
  }

  @Get('available-doctors')
  @ApiOkResponse({ type: HomeVisitAvailableDoctorListDto })
  async availableDoctors(
    @Query() query: ListHomeVisitDoctorsQueryDto,
  ): Promise<HomeVisitAvailableDoctorListDto> {
    return this.requests.listAvailableDoctors(query.pin);
  }

  @Post()
  @HttpCode(200)
  @ApiOkResponse({ type: HomeVisitRequestDto })
  async create(
    @Body() body: CreateHomeVisitRequestDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<HomeVisitRequestDto> {
    return this.requests.create(auth, body);
  }

  @Get('mine')
  @ApiOkResponse({ type: HomeVisitRequestListDto })
  async mine(@CurrentAuth() auth: AuthContext): Promise<HomeVisitRequestListDto> {
    const items = await this.requests.listMine(auth);
    return { items };
  }

  @Get('mine/:id')
  @ApiOkResponse({ type: HomeVisitRequestDto })
  async getOne(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<HomeVisitRequestDto> {
    return this.requests.getForPatient(auth, id);
  }

  @Post('mine/:id/cancel')
  @HttpCode(200)
  @ApiOkResponse({ type: HomeVisitRequestDto })
  async cancel(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<HomeVisitRequestDto> {
    return this.requests.cancelForPatient(auth, id);
  }

  @Post('mine/:id/payment/sandbox')
  @HttpCode(200)
  @ApiOkResponse({ type: HomeVisitRequestDto })
  async sandboxPayment(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<HomeVisitRequestDto> {
    return this.requests.completeSandboxPayment(auth, id, requestMeta(req));
  }

  @Post('mine/:id/payment')
  @HttpCode(200)
  @ApiOkResponse({ type: HomeVisitRequestDto })
  async verifyPayment(
    @Param('id') id: string,
    @Body() body: VerifyPaymentDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<HomeVisitRequestDto> {
    return this.requests.verifyPayment(auth, id, body, requestMeta(req));
  }
}
