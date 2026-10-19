import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { InjectConfig } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';
import { Public } from '../auth/decorators';
import { PinCoverageDto, PinCoverageQueryDto } from './dto/pin-coverage.dto';
import { isHomeVisitBookingOpen, homeVisitBookingClosedMessage } from './home-visit-booking';
import { HOME_VISIT_PILOT_STATE_CODES } from './home-visits.constants';
import { ServiceAreasService } from './service-areas.service';

@ApiTags('home-visits')
@Controller('home-visits')
export class HomeVisitsController {
  constructor(
    private readonly areas: ServiceAreasService,
    @InjectConfig() private readonly env: Env,
  ) {}

  @Get('status')
  @Public()
  @ApiOkResponse({
    description: 'Whether home-visit booking is open (off by default; set HOME_VISIT_BOOKING_OPEN=true in dev)',
  })
  status() {
    const bookingOpen = isHomeVisitBookingOpen(this.env);
    return {
      available: bookingOpen,
      message: bookingOpen
        ? 'Home-visit requests are open in this environment for pilot PIN codes.'
        : homeVisitBookingClosedMessage(),
      pilot: {
        states: [...HOME_VISIT_PILOT_STATE_CODES],
        pinCodeLookup: true as const,
        bookingOpen,
      },
    };
  }

  @Get('pin-coverage')
  @Public()
  @ApiOkResponse({ type: PinCoverageDto })
  async pinCoverage(@Query() query: PinCoverageQueryDto): Promise<PinCoverageDto> {
    return this.areas.checkPin(query.pin);
  }
}
