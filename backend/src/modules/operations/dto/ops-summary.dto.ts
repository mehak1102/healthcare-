import { ApiProperty } from '@nestjs/swagger';

export class OpsDoctorApplicationsDto {
  @ApiProperty()
  pending: number;
}

export class OpsAppointmentsDto {
  @ApiProperty({ description: 'Paid bookings waiting for doctor accept/decline' })
  pendingDoctorApproval: number;

  @ApiProperty({ description: 'Confirmed appointments starting today (IST)' })
  confirmedToday: number;

  @ApiProperty({ description: 'Confirmed appointments starting in the next 24 hours' })
  startingNext24Hours: number;
}

export class OpsDirectoryDto {
  @ApiProperty()
  publishedDoctors: number;

  @ApiProperty()
  takingBookings: number;
}

export class OpsHomeVisitsDto {
  @ApiProperty()
  pilotPinCount: number;

  @ApiProperty()
  bookingOpen: boolean;

  @ApiProperty({ description: 'Requests not yet completed or cancelled' })
  openRequests: number;
}

export class OpsIntegrationsDto {
  @ApiProperty()
  videoCalls: boolean;

  @ApiProperty()
  paymentWebhooks: boolean;
}

export class OpsSummaryDto {
  @ApiProperty()
  generatedAt: string;

  @ApiProperty({ example: 'Asia/Kolkata' })
  timezone: 'Asia/Kolkata';

  @ApiProperty({ type: OpsDoctorApplicationsDto })
  doctorApplications: OpsDoctorApplicationsDto;

  @ApiProperty({ type: OpsAppointmentsDto })
  appointments: OpsAppointmentsDto;

  @ApiProperty({ type: OpsDirectoryDto })
  directory: OpsDirectoryDto;

  @ApiProperty({ type: OpsHomeVisitsDto })
  homeVisits: OpsHomeVisitsDto;

  @ApiProperty({ type: OpsIntegrationsDto })
  integrations: OpsIntegrationsDto;
}
