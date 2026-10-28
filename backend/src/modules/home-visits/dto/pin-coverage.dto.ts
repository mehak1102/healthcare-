import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class PinCoverageQueryDto {
  @ApiProperty({ example: '110064', description: 'India postal PIN (6 digits)' })
  @IsString()
  @MinLength(6)
  @MaxLength(8)
  pin: string;
}

export class PinCoverageDto {
  @ApiProperty({ nullable: true })
  pin: string | null;

  @ApiProperty()
  valid: boolean;

  @ApiProperty()
  inPilotArea: boolean;

  @ApiProperty({ nullable: true })
  stateCode: string | null;

  @ApiProperty({ nullable: true })
  areaLabel: string | null;

  @ApiProperty()
  bookingOpen: boolean;

  @ApiProperty()
  message: string;
}
