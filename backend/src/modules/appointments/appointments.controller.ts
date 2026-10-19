import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { requestMeta, type AppRequest } from '../../common/http/app-request';
import { PERMISSIONS } from '../access-control/permissions';
import { RequirePermissions } from '../access-control/require-permissions.decorator';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/decorators';
import { AppointmentsService, assertIdempotencyKey } from './appointments.service';
import {
  BookAppointmentDto,
  DoctorAppointmentDto,
  DoctorAppointmentListDto,
  DoctorCancelDto,
  DoctorRejectDto,
  ListAppointmentsQueryDto,
  PatientAppointmentDto,
  PatientAppointmentListDto,
  PatientCancelDto,
  RescheduleAppointmentDto,
  RecordOutcomeDto,
  VerifyPaymentDto,
  VideoJoinDto,
} from './dto/appointments.dto';

@ApiTags('appointments')
@ApiCookieAuth()
@Controller('appointments')
@RequirePermissions(PERMISSIONS.APPOINTMENTS_SELF_BOOK)
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Post()
  @HttpCode(200)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOkResponse({ type: PatientAppointmentDto })
  async book(
    @Body() body: BookAppointmentDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<PatientAppointmentDto> {
    const key = assertIdempotencyKey(idempotencyKey);
    const appointment = await this.appointments.book(auth, body, key, requestMeta(req));
    return this.appointments.toPatientDto(appointment);
  }

  @Get()
  @ApiOkResponse({ type: PatientAppointmentListDto })
  async list(
    @Query() query: ListAppointmentsQueryDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<PatientAppointmentListDto> {
    const now = new Date();
    const items = await this.appointments.listMine(auth, query.scope);
    return {
      items: items.map((item) =>
        this.appointments.toPatientDto(item, now),
      ),
    };
  }

  @Get(':id')
  @ApiOkResponse({ type: PatientAppointmentDto })
  async get(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ): Promise<PatientAppointmentDto> {
    const appointment = await this.appointments.findMine(auth, id);
    return this.appointments.toPatientDto(appointment);
  }

  @Post(':id/payment/sandbox')
  @HttpCode(200)
  @ApiOkResponse({ type: PatientAppointmentDto })
  async sandboxPayment(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<PatientAppointmentDto> {
    const appointment = await this.appointments.completeSandboxPayment(auth, id, requestMeta(req));
    return this.appointments.toPatientDto(appointment);
  }

  @Post(':id/payment')
  @HttpCode(200)
  @ApiOkResponse({ type: PatientAppointmentDto })
  async verifyPayment(
    @Param('id') id: string,
    @Body() body: VerifyPaymentDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<PatientAppointmentDto> {
    const appointment = await this.appointments.verifyPayment(auth, id, body, requestMeta(req));
    return this.appointments.toPatientDto(appointment);
  }

  @Post(':id/reschedule')
  @HttpCode(200)
  @ApiOkResponse({ type: PatientAppointmentDto })
  async reschedule(
    @Param('id') id: string,
    @Body() body: RescheduleAppointmentDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<PatientAppointmentDto> {
    const appointment = await this.appointments.rescheduleByPatient(
      auth,
      id,
      body,
      requestMeta(req),
    );
    return this.appointments.toPatientDto(appointment);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOkResponse({ type: PatientAppointmentDto })
  async cancel(
    @Param('id') id: string,
    @Body() body: PatientCancelDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<PatientAppointmentDto> {
    const appointment = await this.appointments.cancelByPatient(auth, id, body, requestMeta(req));
    return this.appointments.toPatientDto(appointment);
  }

  @Post(':id/video')
  @HttpCode(200)
  @ApiOkResponse({ type: VideoJoinDto })
  joinVideo(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<VideoJoinDto> {
    return this.appointments.joinVideo(auth, id, 'patient', requestMeta(req));
  }
}

@ApiTags('appointments')
@ApiCookieAuth()
@Controller('doctor/appointments')
@RequirePermissions(PERMISSIONS.PROVIDER_APPOINTMENTS_HANDLE)
export class DoctorAppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  @ApiOkResponse({ type: DoctorAppointmentListDto })
  async list(
    @Query() query: ListAppointmentsQueryDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<DoctorAppointmentListDto> {
    const now = new Date();
    const items = await this.appointments.listForDoctor(auth, query.scope);
    return { items: items.map((item) => this.appointments.toDoctorDto(item, now)) };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOkResponse({ type: DoctorAppointmentDto })
  async cancel(
    @Param('id') id: string,
    @Body() body: DoctorCancelDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<DoctorAppointmentDto> {
    const appointment = await this.appointments.cancelByDoctor(auth, id, body, requestMeta(req));
    return this.appointments.toDoctorDto(appointment);
  }

  @Post(':id/accept')
  @HttpCode(200)
  @ApiOkResponse({ type: DoctorAppointmentDto })
  async accept(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<DoctorAppointmentDto> {
    const appointment = await this.appointments.acceptBooking(auth, id, requestMeta(req));
    return this.appointments.toDoctorDto(appointment);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOkResponse({ type: DoctorAppointmentDto })
  async reject(
    @Param('id') id: string,
    @Body() body: DoctorRejectDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<DoctorAppointmentDto> {
    const appointment = await this.appointments.rejectBooking(auth, id, body, requestMeta(req));
    return this.appointments.toDoctorDto(appointment);
  }

  @Post(':id/outcome')
  @HttpCode(200)
  @ApiOkResponse({ type: DoctorAppointmentDto })
  async outcome(
    @Param('id') id: string,
    @Body() body: RecordOutcomeDto,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<DoctorAppointmentDto> {
    const appointment = await this.appointments.recordOutcome(auth, id, body, requestMeta(req));
    return this.appointments.toDoctorDto(appointment);
  }

  @Post(':id/video')
  @HttpCode(200)
  @ApiOkResponse({ type: VideoJoinDto })
  joinVideo(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
    @Req() req: AppRequest,
  ): Promise<VideoJoinDto> {
    return this.appointments.joinVideo(auth, id, 'doctor', requestMeta(req));
  }
}
