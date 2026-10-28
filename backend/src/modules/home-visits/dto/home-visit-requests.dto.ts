import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsIn,
  IsMongoId,
  IsNumber,
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
import { PAYMENT_STATUSES, type PaymentStatus } from '../../appointments/appointment.schema';

export class MoneyDto {
  @ApiProperty({ example: 149900 })
  amountMinor: number;

  @ApiProperty({ example: 'INR' })
  currency: string;
}

export class HomeVisitQuoteDto {
  @ApiProperty({ example: '110064' })
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
  paymentsAvailable: boolean;

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
  @ApiProperty({ example: '110064' })
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

  @ApiProperty({ description: 'Doctor the patient chose from the PIN-matched list' })
  @IsMongoId()
  doctorUserId: string;

  @ApiPropertyOptional({ description: 'Patient device GPS for the visit address (preferred over geocoding)' })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  destinationLat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  destinationLng?: number;
}

export class ListHomeVisitDoctorsQueryDto {
  @ApiProperty({ example: '110064' })
  @IsString()
  @MinLength(6)
  @MaxLength(8)
  pin: string;
}

export class HomeVisitAvailableDoctorRowDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  specialty: string;

  @ApiProperty()
  qualification: string;

  @ApiProperty({ type: Number, description: 'Whole rupees' })
  homeVisitFeeInr: number;

  @ApiProperty({ type: MoneyDto })
  fee: MoneyDto;
}

export class HomeVisitAvailableDoctorListDto {
  @ApiProperty()
  pin: string;

  @ApiProperty()
  bookingOpen: boolean;

  @ApiProperty({ type: [HomeVisitAvailableDoctorRowDto] })
  items: HomeVisitAvailableDoctorRowDto[];
}

export class HomeVisitCheckoutDto {
  @ApiProperty() keyId: string;
  @ApiProperty() orderId: string;
  @ApiProperty() amountPaise: number;
  @ApiProperty({ example: 'INR' }) currency: 'INR';
}

export class HomeVisitTrackingDto {
  @ApiProperty({ enum: ['live_gps'] })
  mode: 'live_gps';

  @ApiProperty({ nullable: true })
  destination: { lat: number; lng: number } | null;

  @ApiProperty({ nullable: true })
  doctor: { lat: number; lng: number; updatedAt: string } | null;

  @ApiProperty({ type: String, nullable: true })
  routePolyline: string | null;

  @ApiProperty({ nullable: true })
  etaMinutes: number | null;

  @ApiProperty({ nullable: true })
  distanceMeters: number | null;

  @ApiProperty()
  mapsConfigured: boolean;

  @ApiProperty()
  disclaimer: string;
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

  @ApiProperty({ nullable: true })
  assignedDoctorName: string | null;

  @ApiProperty({ type: MoneyDto })
  fee: MoneyDto;

  @ApiProperty({ enum: PAYMENT_STATUSES })
  paymentStatus: PaymentStatus;

  @ApiProperty({ type: HomeVisitCheckoutDto, nullable: true })
  checkout: HomeVisitCheckoutDto | null;

  @ApiProperty({ type: String, nullable: true })
  paymentHoldExpiresAt: string | null;

  @ApiProperty({ type: HomeVisitTrackingDto, nullable: true })
  tracking: HomeVisitTrackingDto | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiProperty({
    nullable: true,
    description: 'Six-digit code for the patient to share when the doctor arrives',
  })
  arrivalVerificationCode: string | null;

  @ApiProperty({ type: String, nullable: true })
  arrivalVerifiedAt: string | null;
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

  @ApiPropertyOptional({ description: 'State code (e.g. DL) or 6-digit PIN prefix' })
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

export class UpdateHomeVisitStatusDto {
  @ApiProperty({ enum: ['en_route', 'completed'] })
  @IsIn(['en_route', 'completed'])
  status: 'en_route' | 'completed';

  @ApiPropertyOptional({ description: 'Required when marking en route — doctor live GPS' })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}

export class UpdateHomeVisitLocationDto {
  @ApiProperty()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}

export class VerifyHomeVisitArrivalDto {
  @ApiProperty({ description: 'Six-digit code from the patient visit page' })
  @IsString()
  @MinLength(4)
  @MaxLength(8)
  code: string;
}

export class ProviderHomeVisitBriefDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  pinCode: string;

  @ApiProperty({ nullable: true })
  locality: string | null;

  @ApiProperty()
  addressLine1: string;

  @ApiProperty()
  chiefComplaint: string;

  @ApiProperty({ enum: HOME_VISIT_PREFERRED_WINDOWS })
  preferredWindow: HomeVisitPreferredWindow;

  @ApiProperty()
  status: HomeVisitRequestStatus;

  @ApiProperty({ type: MoneyDto })
  fee: MoneyDto;

  @ApiProperty()
  createdAt: string;
}

export class ProviderDispatchOfferRowDto {
  @ApiProperty({ type: DispatchOfferDto })
  offer: DispatchOfferDto;

  @ApiProperty()
  request: Omit<ProviderHomeVisitBriefDto, 'createdAt'> & { id: string };
}

export class ProviderDispatchOfferListDto {
  @ApiProperty({ type: [ProviderDispatchOfferRowDto] })
  items: ProviderDispatchOfferRowDto[];
}

export class ProviderAssignedVisitListDto {
  @ApiProperty({ type: [ProviderHomeVisitBriefDto] })
  items: ProviderHomeVisitBriefDto[];
}

export class OpsDispatchDoctorRowDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  specialty: string;

  @ApiProperty({ nullable: true })
  city: string | null;

  @ApiProperty({ nullable: true })
  homeVisitServicePinCode: string | null;
}

export class OpsDispatchDoctorListDto {
  @ApiProperty({ type: [OpsDispatchDoctorRowDto] })
  items: OpsDispatchDoctorRowDto[];
}

export class ListOpsDispatchDoctorsQueryDto {
  @ApiPropertyOptional({ description: 'Name, slug fragment, or doctor user id' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @ApiPropertyOptional({
    description: 'Patient request PIN — when set, only doctors with the same home visit service PIN',
  })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  pin?: string;

  @ApiPropertyOptional({
    description: 'When true with pin, list all verified doctors (ignore PIN match)',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  all?: boolean;
}
