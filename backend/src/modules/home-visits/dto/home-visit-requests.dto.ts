import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  HOME_VISIT_PREFERRED_WINDOWS,
  type HomeVisitPreferredWindow,
  type HomeVisitRequestStatus,
} from '../home-visit-statuses';

export class MoneyDto {
  @ApiProperty({ example: 149900 })
  amountMinor: number;

  @ApiProperty({ example: 'INR' })
  currency: string;
}

export class HomeVisitQuoteDto {
  @ApiProperty({ example: '560001' })
  @IsString()
  @MinLength(6)
  @MaxLength(8)
  pin: string;

  @ApiPropertyOptional({ enum: HOME_VISIT_PREFERRED_WINDOWS, default: 'asap' })
  @IsOptional()
  @IsEnum(HOME_VISIT_PREFERRED_WINDOWS)
  preferredWindow?: HomeVisitPreferredWindow;
}

export class HomeVisitQuoteResponseDto {
  @ApiProperty()
  bookingOpen: boolean;

  @ApiProperty()
  pin: string;

  @ApiProperty()
  inPilotArea: boolean;

  @ApiProperty({ type: MoneyDto })
  fee: MoneyDto;

  @ApiProperty({ enum: HOME_VISIT_PREFERRED_WINDOWS })
  preferredWindow: HomeVisitPreferredWindow;

  @ApiProperty()
  message: string;
}

export class CreateHomeVisitRequestDto {
  @ApiProperty({ example: '560001' })
  @IsString()
  @MinLength(6)
  @MaxLength(8)
  pin: string;

  @ApiProperty({ example: '12, 3rd Cross, Indiranagar' })
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  addressLine1: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  locality?: string;

  @ApiProperty({ example: 'Fever and cough since yesterday' })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  chiefComplaint: string;

  @ApiProperty({ enum: HOME_VISIT_PREFERRED_WINDOWS, default: 'asap' })
  @IsEnum(HOME_VISIT_PREFERRED_WINDOWS)
  preferredWindow: HomeVisitPreferredWindow;
}

export class HomeVisitRequestDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  pinCode: string;

  @ApiProperty()
  stateCode: string;

  @ApiProperty()
  addressLine1: string;

  @ApiProperty({ nullable: true })
  locality: string | null;

  @ApiProperty()
  chiefComplaint: string;

  @ApiProperty({ enum: HOME_VISIT_PREFERRED_WINDOWS })
  preferredWindow: HomeVisitPreferredWindow;

  @ApiProperty()
  status: HomeVisitRequestStatus;

  @ApiProperty({ nullable: true })
  assignedDoctorUserId: string | null;

  @ApiProperty({ type: MoneyDto })
  fee: MoneyDto;

  @ApiProperty()
  createdAt: string;
}

export class HomeVisitRequestListDto {
  @ApiProperty({ type: [HomeVisitRequestDto] })
  items: HomeVisitRequestDto[];
}

export class ListOpsHomeVisitsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by request status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'State code (e.g. KA) or 6-digit PIN prefix' })
  @IsOptional()
  @IsString()
  @MaxLength(6)
  area?: string;

  @ApiPropertyOptional({ description: 'ISO-8601 lower bound on createdAt (inclusive)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO-8601 upper bound on createdAt (exclusive)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class OpsHomeVisitRowDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  status: HomeVisitRequestStatus;

  @ApiProperty()
  pinCode: string;

  @ApiProperty()
  stateCode: string;

  @ApiProperty()
  preferredWindow: HomeVisitPreferredWindow;

  @ApiProperty()
  patientUserId: string;

  @ApiProperty()
  patientName: string;

  @ApiProperty({ nullable: true })
  assignedDoctorUserId: string | null;

  @ApiProperty({ type: MoneyDto })
  fee: MoneyDto;

  @ApiProperty()
  createdAt: string;
}

export class OpsHomeVisitListDto {
  @ApiProperty({ type: [OpsHomeVisitRowDto] })
  items: OpsHomeVisitRowDto[];

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;
}

export class ReassignHomeVisitDto {
  @ApiProperty({ description: 'Doctor user id to offer the visit to' })
  @IsString()
  @MinLength(12)
  @MaxLength(32)
  doctorUserId: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class DispatchOfferDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  homeVisitRequestId: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  expiresAt: string;
}
