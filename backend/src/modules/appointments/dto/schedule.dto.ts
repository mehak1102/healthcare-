import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CONSULTATION_MODES, type ConsultationMode } from '../../doctors/doctor-profile.schema';
import { MAX_SLOT_DAYS_PER_REQUEST } from '../booking-rules';
import type { DoctorScheduleDocument } from '../doctor-schedule.schema';
import { SLOT_LENGTHS, type Slot } from '../slots';

export const SLOTS_UNAVAILABLE_REASONS = [
  'no_timetable',
  'payments_unavailable',
  'not_accepting',
] as const;
export type SlotsUnavailableReason = (typeof SLOTS_UNAVAILABLE_REASONS)[number];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class OneOffBlockDto {
  @ApiProperty({ example: '2026-10-20', description: 'India date YYYY-MM-DD' })
  @Matches(DATE, { message: 'date must be YYYY-MM-DD' })
  date: string;

  @ApiProperty({ example: '14:00' })
  @Matches(TIME, { message: 'start must be HH:mm' })
  start: string;

  @ApiProperty({ example: '16:00' })
  @Matches(TIME, { message: 'end must be HH:mm' })
  end: string;

  @ApiProperty({ enum: SLOT_LENGTHS })
  @IsIn(SLOT_LENGTHS)
  slotMinutes: number;

  @ApiProperty({ enum: CONSULTATION_MODES })
  @IsIn(CONSULTATION_MODES)
  mode: ConsultationMode;
}

export class WeeklyBlockDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: '0 = Sunday … 6 = Saturday (India time)' })
  @IsInt()
  @Min(0)
  @Max(6)
  day: number;

  @ApiProperty({ example: '09:00' })
  @Matches(TIME, { message: 'start must be HH:mm' })
  start: string;

  @ApiProperty({ example: '13:00', description: 'Same day as start; blocks cannot cross midnight' })
  @Matches(TIME, { message: 'end must be HH:mm' })
  end: string;

  @ApiProperty({ enum: SLOT_LENGTHS })
  @IsIn(SLOT_LENGTHS)
  slotMinutes: number;

  @ApiProperty({ enum: CONSULTATION_MODES })
  @IsIn(CONSULTATION_MODES)
  mode: ConsultationMode;
}

export class UpdateScheduleDto {
  @ApiProperty({ type: WeeklyBlockDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(42)
  @ValidateNested({ each: true })
  @Type(() => WeeklyBlockDto)
  rules: WeeklyBlockDto[];

  @ApiProperty({ type: String, isArray: true, description: 'India dates, YYYY-MM-DD' })
  @IsArray()
  @ArrayMaxSize(120)
  @ArrayUnique()
  @Matches(DATE, { each: true, message: 'each day off must be YYYY-MM-DD' })
  daysOff: string[];

  @ApiPropertyOptional({ type: OneOffBlockDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => OneOffBlockDto)
  extraBlocks?: OneOffBlockDto[];
}

export class ScheduleDto {
  @ApiProperty({ type: WeeklyBlockDto, isArray: true }) rules: WeeklyBlockDto[];
  @ApiProperty({ type: OneOffBlockDto, isArray: true }) extraBlocks: OneOffBlockDto[];
  @ApiProperty({ type: String, isArray: true }) daysOff: string[];
  @ApiProperty({ example: 'Asia/Kolkata' }) timezone: string;
  @ApiProperty({ description: 'Whether patients can book online (video) slots yet' })
  onlineBookingOpen: boolean;

  static from(
    schedule: Pick<DoctorScheduleDocument, 'rules' | 'daysOff' | 'extraBlocks'> | null,
    timezone: string,
    onlineBookingOpen: boolean,
  ): ScheduleDto {
    return {
      rules: (schedule?.rules ?? []).map(({ day, start, end, slotMinutes, mode }) => ({
        day,
        start,
        end,
        slotMinutes,
        mode,
      })),
      extraBlocks: (schedule?.extraBlocks ?? []).map(({ date, start, end, slotMinutes, mode }) => ({
        date,
        start,
        end,
        slotMinutes,
        mode,
      })),
      daysOff: [...(schedule?.daysOff ?? [])],
      timezone,
      onlineBookingOpen,
    };
  }
}

export class SlotsQueryDto {
  @ApiPropertyOptional({ description: 'First India date to list (YYYY-MM-DD); defaults to today' })
  @IsOptional()
  @Matches(DATE, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({ default: 7, minimum: 1, maximum: MAX_SLOT_DAYS_PER_REQUEST })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SLOT_DAYS_PER_REQUEST)
  days: number = 7;
}

export class SlotDto {
  @ApiProperty() startsAt: string;
  @ApiProperty() endsAt: string;
  @ApiProperty({ enum: CONSULTATION_MODES }) mode: ConsultationMode;

  static from(slot: Slot): SlotDto {
    return {
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      mode: slot.mode,
    };
  }
}

export class SlotDayDto {
  @ApiProperty({ example: '2026-10-14' }) date: string;
  @ApiProperty({ type: SlotDto, isArray: true }) slots: SlotDto[];
}

export class DoctorSlotsDto {
  @ApiProperty({ example: 'Asia/Kolkata' }) timezone: string;
  @ApiProperty({ type: Number, nullable: true }) feeInr: number | null;
  @ApiProperty({ description: 'Last India date patients can book' }) bookableUntil: string;
  @ApiProperty({
    enum: SLOTS_UNAVAILABLE_REASONS,
    nullable: true,
    description:
      'Why patients cannot book: the doctor has no bookable timetable, or the fee needs online payment, which is switched off',
  })
  unavailableReason: SlotsUnavailableReason | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'First India date in the booking window with a free slot',
  })
  nextAvailableDate: string | null;
  @ApiProperty({ description: 'Video consultations can be booked on this site right now' })
  videoBookingOpen: boolean;
  @ApiProperty({ type: SlotDayDto, isArray: true }) days: SlotDayDto[];
}
