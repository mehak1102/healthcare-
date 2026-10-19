import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../access-control/permissions';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/decorators';
import {
  CreateHomeVisitRequestDto,
  HomeVisitQuoteDto,
  HomeVisitQuoteResponseDto,
  HomeVisitRequestDto,
  HomeVisitRequestListDto,
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
}
