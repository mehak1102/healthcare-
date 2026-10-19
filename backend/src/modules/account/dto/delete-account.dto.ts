import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH } from '../../auth/password.service';

export class DeleteAccountDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;

  @ApiPropertyOptional({
    description: 'Required when two-step verification is on: authenticator or recovery code',
  })
  @IsOptional()
  @IsString()
  @Length(6, 32)
  @Matches(/^[A-Za-z0-9 -]+$/, { message: 'code may contain only letters, digits, spaces and -' })
  code?: string;
}
