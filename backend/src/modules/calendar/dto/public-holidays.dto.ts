import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { PUBLIC_HOLIDAY_REGIONS, type PublicHolidayRegion } from '../holiday-regions';

export class ListPublicHolidaysQueryDto {
  @ApiPropertyOptional({ enum: PUBLIC_HOLIDAY_REGIONS, default: 'IN' })
  @IsOptional()
  @IsIn(PUBLIC_HOLIDAY_REGIONS)
  region?: PublicHolidayRegion;

  @ApiPropertyOptional({ description: 'IST calendar date YYYY-MM-DD; default today in India' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 366, default: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(366)
  days?: number;
}

export class PublicHolidayItemDto {
  @ApiProperty({ example: '2026-10-02' })
  date: string;

  @ApiProperty({ example: 'Gandhi Jayanti' })
  name: string;
}

export class PublicHolidayListDto {
  @ApiProperty({ enum: PUBLIC_HOLIDAY_REGIONS })
  region: PublicHolidayRegion;

  @ApiProperty({ example: 'Asia/Kolkata' })
  timezone: 'Asia/Kolkata';

  @ApiProperty({ enum: ['database', 'static'] })
  source: 'database' | 'static';

  @ApiProperty({ type: [PublicHolidayItemDto] })
  items: PublicHolidayItemDto[];
}

export class CreatePublicHolidayDto {
  @ApiProperty({ example: '2028-01-26' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ enum: PUBLIC_HOLIDAY_REGIONS, default: 'IN' })
  @IsOptional()
  @IsIn(PUBLIC_HOLIDAY_REGIONS)
  region?: PublicHolidayRegion;
}

export class AdminPublicHolidayDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  date: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: PUBLIC_HOLIDAY_REGIONS })
  region: PublicHolidayRegion;
}
