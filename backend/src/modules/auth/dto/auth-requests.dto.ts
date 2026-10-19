import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../password.service';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** The only account kinds public registration may create. Staff roles are never accepted. */
export const PUBLIC_ACCOUNT_TYPES = ['patient', 'doctor'] as const;
export type PublicAccountType = (typeof PUBLIC_ACCOUNT_TYPES)[number];

/** Sign-in pages. `staff` is for accounts an administrator created; it cannot be registered. */
export const LOGIN_PORTALS = [...PUBLIC_ACCOUNT_TYPES, 'staff'] as const;
export type LoginPortal = (typeof LOGIN_PORTALS)[number];

export class RegisterDto {
  @ApiProperty({ example: 'Asha Rao', minLength: 2, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  @Matches(/^[^<>{}\p{Cc}]+$/u, { message: 'fullName contains characters that are not allowed' })
  fullName: string;

  @ApiProperty({ example: 'asha@example.test' })
  @Transform(trim)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  password: string;

  @ApiProperty({ description: 'Must be true: accepts the current Terms and Privacy Notice' })
  @IsBoolean()
  @Equals(true, { message: 'you must accept the Terms and Privacy Notice to create an account' })
  acceptTerms: boolean;

  @ApiProperty({ enum: PUBLIC_ACCOUNT_TYPES, default: 'patient' })
  @IsOptional()
  @IsIn(PUBLIC_ACCOUNT_TYPES)
  accountType?: PublicAccountType;
}

export class LoginDto {
  @ApiProperty({ example: 'asha@example.test' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;

  @ApiProperty({
    enum: LOGIN_PORTALS,
    required: false,
    description: 'Which sign-in page was used. Does not grant a role.',
  })
  @IsOptional()
  @IsIn(LOGIN_PORTALS)
  portal?: LoginPortal;
}

export class RequestPasswordResetDto {
  @ApiProperty({ example: 'asha@example.test' })
  @Transform(trim)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email: string;
}

export class ConfirmPasswordResetDto {
  @ApiProperty({ description: 'Token from the emailed link' })
  @IsString()
  @Length(1, 128)
  token: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  newPassword: string;
}

export class ConfirmEmailVerificationDto {
  @ApiProperty({ description: 'Token from the emailed link' })
  @IsString()
  @Length(1, 128)
  token: string;
}

const MFA_CODE_FORMAT = /^[A-Za-z0-9 -]+$/;

export class MfaCodeDto {
  @ApiProperty({ description: '6-digit authenticator code, or a recovery code like abcde-fgh23' })
  @IsString()
  @Length(6, 32)
  @Matches(MFA_CODE_FORMAT, { message: 'code may contain only letters, digits, spaces and -' })
  code: string;
}

export class MfaPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}

export class DisableMfaDto extends MfaCodeDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX_LENGTH)
  currentPassword: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  newPassword: string;
}
