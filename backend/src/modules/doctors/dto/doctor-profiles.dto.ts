import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { profileCompletionOf, type ProfileCompletion } from '../doctor-next-steps';
import { AVAIL_WHEN, type AvailWhen } from '../../appointments/availability-when';
import { PILOT_STATE_CODES } from '../../calendar/holiday-regions';
import { DIRECTORY_SORTS, type DirectorySort } from '../directory-sort';
import { FEE_BANDS, type FeeBand } from '../fee-bands';
import {
  AVAILABILITY_STATUSES,
  CONSULTATION_MODES,
  LANGUAGES,
  shownAvailability,
  type AvailabilityStatus,
  type ConsultationMode,
  type DoctorProfileDocument,
  type Language,
} from '../doctor-profile.schema';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const queryBoolean = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1';
const blankToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};
const PLACE = /^[\p{L}\p{N} .,&()'/-]+$/u;
const PLACE_MESSAGE = 'contains characters that are not allowed';

/** Replaces the doctor-managed part of the profile. Reviewed fields cannot be sent. */
export class UpdateDoctorProfileDto {
  @ApiProperty({ maxLength: 1500, description: 'Plain text. At least 50 characters to publish' })
  @Transform(trim)
  @IsString()
  @MaxLength(1500)
  bio: string;

  @ApiProperty({ enum: LANGUAGES, isArray: true })
  @IsArray()
  @ArrayMaxSize(LANGUAGES.length)
  @ArrayUnique()
  @IsIn(LANGUAGES, { each: true })
  languages: Language[];

  @ApiProperty({ enum: CONSULTATION_MODES, isArray: true })
  @IsArray()
  @ArrayMaxSize(CONSULTATION_MODES.length)
  @ArrayUnique()
  @IsIn(CONSULTATION_MODES, { each: true })
  consultationModes: ConsultationMode[];

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'Whole rupees, 0–50,000' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50_000)
  consultationFeeInr?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(120)
  @Matches(PLACE, { message: `clinicName ${PLACE_MESSAGE}` })
  clinicName?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(60)
  @Matches(PLACE, { message: `city ${PLACE_MESSAGE}` })
  city?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Transform(blankToNull)
  @IsString()
  @MaxLength(80)
  @Matches(PLACE, { message: `locality ${PLACE_MESSAGE}` })
  locality?: string | null;

  @ApiPropertyOptional({
    description:
      'When true, new bookings wait for you to accept before the patient can join a video call',
  })
  @IsOptional()
  @IsBoolean()
  requiresBookingApproval?: boolean;

  @ApiProperty({ description: 'Show this profile in the public directory' })
  @IsBoolean()
  published: boolean;
}

export class UpdateAvailabilityDto {
  @ApiProperty({ enum: AVAILABILITY_STATUSES })
  @IsIn(AVAILABILITY_STATUSES)
  availabilityStatus: AvailabilityStatus;
}

export class DoctorDirectoryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  specialty?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  city?: string;

  @ApiPropertyOptional({ enum: CONSULTATION_MODES })
  @IsOptional()
  @IsIn(CONSULTATION_MODES)
  mode?: ConsultationMode;

  @ApiPropertyOptional({ enum: LANGUAGES })
  @IsOptional()
  @IsIn(LANGUAGES)
  language?: Language;

  @ApiPropertyOptional({ description: 'Part of the doctor’s name' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  q?: string;

  @ApiPropertyOptional({
    description: 'When true, only doctors who are taking new bookings (availability on)',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  takingBookings?: boolean;

  @ApiPropertyOptional({
    description:
      'When true, only doctors with at least one free bookable slot in the next 30 days (India time)',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  hasOpenSlots?: boolean;

  @ApiPropertyOptional({
    enum: AVAIL_WHEN,
    description: 'Only doctors with a free slot in this window (India time)',
  })
  @IsOptional()
  @IsIn(AVAIL_WHEN)
  availWhen?: AvailWhen;

  @ApiPropertyOptional({
    enum: PILOT_STATE_CODES,
    description:
      'With availWhen=public_holiday, also match state-specific holidays (national holidays always count)',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsIn(PILOT_STATE_CODES)
  holidayState?: (typeof PILOT_STATE_CODES)[number];

  @ApiPropertyOptional({
    enum: FEE_BANDS,
    description: 'Filter by published consultation fee (INR)',
  })
  @IsOptional()
  @IsIn(FEE_BANDS)
  feeBand?: FeeBand;

  @ApiPropertyOptional({ enum: DIRECTORY_SORTS, default: 'name' })
  @IsOptional()
  @IsIn(DIRECTORY_SORTS)
  sort?: DirectorySort;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000)
  page: number = 1;

  @ApiPropertyOptional({ default: 12, minimum: 1, maximum: 48 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  limit: number = 12;
}

export class DoctorCardDto {
  @ApiProperty() slug: string;
  @ApiProperty() displayName: string;
  @ApiProperty() specialty: string;
  @ApiProperty() qualification: string;
  @ApiProperty() registrationYear: number;
  @ApiProperty({ enum: LANGUAGES, isArray: true }) languages: Language[];
  @ApiProperty({ enum: CONSULTATION_MODES, isArray: true }) consultationModes: ConsultationMode[];
  @ApiProperty({ type: Number, nullable: true }) consultationFeeInr: number | null;
  @ApiProperty({ type: String, nullable: true }) clinicName: string | null;
  @ApiProperty({ type: String, nullable: true }) city: string | null;
  @ApiProperty({ type: String, nullable: true }) locality: string | null;
  @ApiProperty({ enum: AVAILABILITY_STATUSES })
  availabilityStatus: AvailabilityStatus;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'First India date in the booking window with a free slot, if any',
  })
  nextAvailableDate: string | null;

  static from(profile: DoctorProfileDocument, nextAvailableDate: string | null = null): DoctorCardDto {
    return {
      slug: profile.slug,
      displayName: profile.displayName,
      specialty: profile.specialty,
      qualification: profile.qualification,
      registrationYear: profile.registrationYear,
      languages: [...profile.languages],
      consultationModes: [...profile.consultationModes],
      consultationFeeInr: profile.consultationFeeInr,
      clinicName: profile.clinicName,
      city: profile.city,
      locality: profile.locality,
      availabilityStatus: shownAvailability(profile.availabilityStatus),
      nextAvailableDate,
    };
  }
}

export class DoctorPublicProfileDto extends DoctorCardDto {
  @ApiProperty() bio: string;
  @ApiProperty() registrationNumber: string;
  @ApiProperty() registrationCouncil: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'When Sukoon checked the registration in the medical register',
  })
  registrationCheckedAt: string | null;

  static fromProfile(profile: DoctorProfileDocument): DoctorPublicProfileDto {
    return {
      ...DoctorCardDto.from(profile),
      bio: profile.bio,
      registrationNumber: profile.registrationNumber,
      registrationCouncil: profile.registrationCouncil,
      registrationCheckedAt: profile.registrationCheckedAt?.toISOString() ?? null,
    };
  }
}

export class MyDoctorProfileDto extends DoctorPublicProfileDto {
  @ApiProperty({
    description: 'When true, you must accept each booking before it is confirmed for the patient',
  })
  requiresBookingApproval: boolean;
  @ApiProperty() published: boolean;
  @ApiProperty({ type: String, nullable: true }) publishedAt: string | null;
  @ApiProperty({ type: String, isArray: true, description: 'What is still needed to publish' })
  missing: string[];

  @ApiProperty({ enum: ['incomplete', 'complete'] })
  profileCompletion: ProfileCompletion;

  static fromOwn(profile: DoctorProfileDocument, missing: string[]): MyDoctorProfileDto {
    return {
      ...DoctorPublicProfileDto.fromProfile(profile),
      requiresBookingApproval: profile.requiresBookingApproval,
      published: profile.published,
      publishedAt: profile.publishedAt?.toISOString() ?? null,
      missing,
      availabilityStatus: shownAvailability(profile.availabilityStatus),
      profileCompletion: profileCompletionOf(missing),
    };
  }
}

export class DoctorDirectoryPageDto {
  @ApiProperty({ type: DoctorCardDto, isArray: true }) items: DoctorCardDto[];
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
}

export class DoctorDirectoryFiltersDto {
  @ApiProperty({ type: String, isArray: true }) specialties: string[];
  @ApiProperty({ type: String, isArray: true }) cities: string[];
}
