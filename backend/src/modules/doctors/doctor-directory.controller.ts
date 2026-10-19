import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SchedulesService } from '../appointments/schedules.service';
import { Public } from '../auth/decorators';
import { compareByNextAvailableDate } from './directory-sort';
import { DoctorProfilesService } from './doctor-profiles.service';
import {
  DoctorCardDto,
  DoctorDirectoryFiltersDto,
  DoctorDirectoryPageDto,
  DoctorDirectoryQueryDto,
  DoctorPublicProfileDto,
} from './dto/doctor-profiles.dto';

/** Public, read-only directory. Only published profiles of active, approved doctors appear. */
@ApiTags('doctors')
@Controller('doctors')
export class DoctorDirectoryController {
  constructor(
    private readonly profiles: DoctorProfilesService,
    private readonly schedules: SchedulesService,
  ) {}

  @Get()
  @Public()
  @ApiOkResponse({ type: DoctorDirectoryPageDto })
  async list(@Query() query: DoctorDirectoryQueryDto): Promise<DoctorDirectoryPageDto> {
    const slotScan = query.hasOpenSlots || query.availWhen;
    const slotOptions = {
      mode: query.mode,
      availWhen: query.availWhen,
      holidayState: query.holidayState,
    };
    if (slotScan) {
      const candidates = await this.profiles.listAllMatchingPublic(query);
      const nextDates = await this.schedules.nextAvailableDatesFor(candidates, slotOptions);
      let withSlots = candidates.filter((profile) => nextDates.get(profile.slug));
      if (query.sort === 'next_available') {
        withSlots = [...withSlots].sort((a, b) =>
          compareByNextAvailableDate(a, b, (slug) => nextDates.get(slug)),
        );
      }
      const start = (query.page - 1) * query.limit;
      const items = withSlots.slice(start, start + query.limit);
      return {
        items: items.map((item) =>
          DoctorCardDto.from(item, nextDates.get(item.slug) ?? null),
        ),
        page: query.page,
        limit: query.limit,
        total: withSlots.length,
      };
    }

    const { items, total } = await this.profiles.listPublic(query);
    const nextDates = await this.schedules.nextAvailableDatesForDirectory(items, {
      mode: query.mode,
      availWhen: query.availWhen,
      holidayState: query.holidayState,
    });
    return {
      items: items.map((item) =>
        DoctorCardDto.from(item, nextDates.get(item.slug) ?? null),
      ),
      page: query.page,
      limit: query.limit,
      total,
    };
  }

  @Get('filters')
  @Public()
  @ApiOkResponse({ type: DoctorDirectoryFiltersDto })
  filters(): Promise<DoctorDirectoryFiltersDto> {
    return this.profiles.filters();
  }

  @Get(':slug')
  @Public()
  @ApiOkResponse({ type: DoctorPublicProfileDto })
  async get(@Param('slug') slug: string): Promise<DoctorPublicProfileDto> {
    const profile = await this.profiles.findPublicBySlug(slug);
    const dto = DoctorPublicProfileDto.fromProfile(profile);
    dto.nextAvailableDate = await this.schedules.nextAvailableDateForDirectory(profile);
    return dto;
  }
}
