import { Body, Controller, Get, Param, Put, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { requestMeta, type AppRequest } from '../../common/http/app-request';
import { PERMISSIONS } from '../access-control/permissions';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth, Public } from '../auth/decorators';
import {
  DoctorSlotsDto,
  ScheduleDto,
  SlotDto,
  SlotsQueryDto,
  UpdateScheduleDto,
} from './dto/schedule.dto';
import { IST_TIMEZONE } from './ist-time';
import { SchedulesService } from './schedules.service';

@ApiTags('appointments')
@ApiCookieAuth()
@Controller('doctor-schedule/me')
@RequirePermissions(PERMISSIONS.PROVIDER_SCHEDULE_MANAGE_OWN)
export class DoctorScheduleController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get()
  @ApiOkResponse({ type: ScheduleDto })
  async get(@CurrentAuth() auth: AuthContext): Promise<ScheduleDto> {
    return ScheduleDto.from(
      await this.schedules.findMine(auth.userId),
      IST_TIMEZONE,
      this.schedules.onlineBookingOpen,
    );
  }

  @Put()
  @ApiOkResponse({ type: ScheduleDto })
  async update(
    @Body() body: UpdateScheduleDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<ScheduleDto> {
    const schedule = await this.schedules.updateMine(auth, body, requestMeta(req));
    return ScheduleDto.from(schedule, IST_TIMEZONE, this.schedules.onlineBookingOpen);
  }
}

@ApiTags('doctors')
@Controller('doctors')
export class DoctorSlotsController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get(':slug/slots')
  @Public()
  @ApiOkResponse({ type: DoctorSlotsDto })
  async slots(@Param('slug') slug: string, @Query() query: SlotsQueryDto): Promise<DoctorSlotsDto> {
    const result = await this.schedules.slotsFor(slug, query);
    return {
      timezone: IST_TIMEZONE,
      feeInr: result.feeInr,
      bookableUntil: result.bookableUntil,
      unavailableReason: result.unavailableReason,
      nextAvailableDate: result.nextAvailableDate,
      videoBookingOpen: this.schedules.onlineBookingOpen,
      days: result.days.map((day) => ({ date: day.date, slots: day.slots.map(SlotDto.from) })),
    };
  }
}
