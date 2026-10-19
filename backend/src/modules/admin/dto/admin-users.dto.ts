import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ROLES, type Role } from '../../access-control/roles';
import { USER_STATUSES, type UserDocument, type UserStatus } from '../../users/user.schema';

export class ListUsersQueryDto {
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

  @ApiPropertyOptional({ description: 'Email prefix' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES)
  role?: Role;
}

export class AdminUserSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() fullName: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: ROLES, isArray: true }) roles: Role[];
  @ApiProperty({ enum: USER_STATUSES }) status: UserStatus;
  @ApiProperty() emailVerified: boolean;
  @ApiProperty() createdAt: string;
  @ApiProperty({ nullable: true, type: String }) lastLoginAt: string | null;

  static from(user: UserDocument): AdminUserSummaryDto {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      roles: [...user.roles],
      status: user.status,
      emailVerified: user.emailVerifiedAt !== null,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    };
  }
}

export class AdminUserPageDto {
  @ApiProperty({ type: AdminUserSummaryDto, isArray: true }) items: AdminUserSummaryDto[];
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
}
