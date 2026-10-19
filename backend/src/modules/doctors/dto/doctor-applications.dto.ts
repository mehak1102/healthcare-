import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { UserDocument } from '../../users/user.schema';
import {
  DOCTOR_APPLICATION_STATUSES,
  type DoctorApplicationDocument,
  type DoctorApplicationStatus,
} from '../doctor-application.schema';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const TEXT = /^[\p{L}\p{N} .,&()'/-]+$/u;
const TEXT_MESSAGE = 'contains characters that are not allowed';

export class SubmitDoctorApplicationDto {
  @ApiProperty({ example: 'KMC-123456', description: 'As printed on the registration certificate' })
  @Transform(trim)
  @IsString()
  @Length(3, 30)
  @Matches(/^[A-Za-z0-9/. -]+$/, { message: 'registrationNumber ' + TEXT_MESSAGE })
  registrationNumber: string;

  @ApiProperty({ example: 'Karnataka Medical Council' })
  @Transform(trim)
  @IsString()
  @Length(3, 120)
  @Matches(TEXT, { message: 'registrationCouncil ' + TEXT_MESSAGE })
  registrationCouncil: string;

  @ApiProperty({ example: 2015 })
  @IsInt()
  @Min(1950)
  @Max(2100)
  registrationYear: number;

  @ApiProperty({ example: 'MBBS, MD (General Medicine)' })
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  @Matches(TEXT, { message: 'qualification ' + TEXT_MESSAGE })
  qualification: string;

  @ApiProperty({ example: 'General Physician' })
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  @Matches(TEXT, { message: 'specialty ' + TEXT_MESSAGE })
  specialty: string;
}

export class ListDoctorApplicationsQueryDto {
  @ApiPropertyOptional({ enum: DOCTOR_APPLICATION_STATUSES, default: 'pending' })
  @IsOptional()
  @IsIn(DOCTOR_APPLICATION_STATUSES)
  status: DoctorApplicationStatus = 'pending';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class ApproveDoctorApplicationDto {
  @ApiProperty({
    description: 'Reviewer confirms the registration was checked in the official register',
  })
  @IsBoolean()
  @Equals(true, { message: 'confirm that you checked the registration in the official register' })
  registerChecked: boolean;

  @ApiPropertyOptional({ description: 'Internal note, not shown to the applicant' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectDoctorApplicationDto {
  @ApiProperty({ description: 'Shown to the applicant' })
  @Transform(trim)
  @IsString()
  @Length(10, 500)
  reason: string;
}

export class DoctorApplicationDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: DOCTOR_APPLICATION_STATUSES }) status: DoctorApplicationStatus;
  @ApiProperty() registrationNumber: string;
  @ApiProperty() registrationCouncil: string;
  @ApiProperty() registrationYear: number;
  @ApiProperty() qualification: string;
  @ApiProperty() specialty: string;
  @ApiProperty() submittedAt: string;
  @ApiProperty({ type: String, nullable: true }) reviewedAt: string | null;
  @ApiProperty({ type: String, nullable: true }) rejectionReason: string | null;

  static from(application: DoctorApplicationDocument): DoctorApplicationDto {
    return {
      id: application.id,
      status: application.status,
      registrationNumber: application.registrationNumber,
      registrationCouncil: application.registrationCouncil,
      registrationYear: application.registrationYear,
      qualification: application.qualification,
      specialty: application.specialty,
      submittedAt: application.createdAt.toISOString(),
      reviewedAt: application.reviewedAt?.toISOString() ?? null,
      rejectionReason: application.rejectionReason,
    };
  }
}

export class MyDoctorApplicationDto {
  @ApiProperty({ type: DoctorApplicationDto, nullable: true })
  application: DoctorApplicationDto | null;
}

export class ApplicantDto {
  @ApiProperty() id: string;
  @ApiProperty() fullName: string;
  @ApiProperty() email: string;
  @ApiProperty() emailVerified: boolean;
}

export class AdminDoctorApplicationDto extends DoctorApplicationDto {
  @ApiProperty({ type: ApplicantDto, nullable: true }) applicant: ApplicantDto | null;
  @ApiProperty({ type: String, nullable: true }) reviewNote: string | null;

  static fromWithApplicant(
    application: DoctorApplicationDocument,
    user: UserDocument | undefined,
  ): AdminDoctorApplicationDto {
    return {
      ...DoctorApplicationDto.from(application),
      reviewNote: application.reviewNote,
      applicant: user
        ? {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            emailVerified: user.emailVerifiedAt !== null,
          }
        : null,
    };
  }
}

export class AdminDoctorApplicationPageDto {
  @ApiProperty({ type: AdminDoctorApplicationDto, isArray: true })
  items: AdminDoctorApplicationDto[];
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
}
