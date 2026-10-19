import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators';
import {
  ListPublicHolidaysQueryDto,
  PublicHolidayListDto,
} from './dto/public-holidays.dto';
import { PublicHolidaysService } from './public-holidays.service';

@ApiTags('calendar')
@Public()
@Controller('calendar')
export class CalendarController {
  constructor(private readonly holidays: PublicHolidaysService) {}

  @Get('public-holidays')
  @ApiOkResponse({ type: PublicHolidayListDto })
  async publicHolidays(@Query() query: ListPublicHolidaysQueryDto): Promise<PublicHolidayListDto> {
    const region = query.region ?? 'IN';
    const from = query.from ?? this.holidays.defaultFromDate();
    const days = query.days ?? 90;
    const listed = await this.holidays.listInRange(region, from, days);
    return {
      region,
      timezone: 'Asia/Kolkata',
      source: listed.source,
      items: listed.items,
    };
  }
}
