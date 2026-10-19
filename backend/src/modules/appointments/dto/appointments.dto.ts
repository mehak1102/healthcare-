import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsISO8601, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { CONSULTATION_MODES, type ConsultationMode } from '../../doctors/doctor-profile.schema';
import {
  APPOINTMENT_STATUSES,
  PAYMENT_STATUSES,
  type AppointmentDocument,
  type AppointmentStatus,
  type PaymentStatus,
} from '../appointment.schema';
import { clientVideoOpensAt, type VideoJoinSettings } from '../booking-rules';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const blankToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export const OPEN_STATUSES: readonly AppointmentStatus[] = [
  'pending_payment',
  'pending_doctor',
  'confirmed',
];

export class BookAppointmentDto {
  @ApiProperty({ example: 'dr-asha-rao-1a2b3c' })
  @Matches(/^[a-z0-9-]{3,64}$/, { message: 'doctorSlug is not valid' })
  doctorSlug: string;

  @ApiProperty({ description: 'Slot start exactly as returned by the slots endpoint' })
  @IsISO8601({ strict: true })
  startsAt: string;

  @ApiProperty({ enum: CONSULTATION_MODES })
  @IsIn(CONSULTATION_MODES)
  mode: ConsultationMode;

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Reason for the visit, shared with the doctor',
  })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(500)
  patientNote?: string;
}

export class VerifyPaymentDto {
  @ApiProperty()
  @Matches(/^order_[A-Za-z0-9]{6,40}$/, { message: 'razorpayOrderId is not valid' })
  razorpayOrderId: string;

  @ApiProperty()
  @Matches(/^pay_[A-Za-z0-9]{6,40}$/, { message: 'razorpayPaymentId is not valid' })
  razorpayPaymentId: string;

  @ApiProperty()
  @Matches(/^[a-f0-9]{64}$/, { message: 'razorpaySignature is not valid' })
  razorpaySignature: string;
}

export class RescheduleAppointmentDto {
  @ApiProperty({ description: 'New slot start exactly as returned by the slots endpoint' })
  @IsISO8601({ strict: true })
  startsAt: string;
}

export class PatientCancelDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class DoctorCancelDto {
  @ApiProperty({ minLength: 5, maxLength: 500, description: 'Shown to the patient' })
  @Transform(trim)
  @IsString()
  @Length(5, 500)
  reason: string;
}

export class RecordOutcomeDto {
  @ApiProperty({ enum: ['completed', 'no_show'] })
  @IsIn(['completed', 'no_show'])
  outcome: 'completed' | 'no_show';
}

export class DoctorRejectDto {
  @ApiPropertyOptional({ maxLength: 500, description: 'Shown to the patient' })
  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ListAppointmentsQueryDto {
  @ApiPropertyOptional({ enum: ['upcoming', 'past'], default: 'upcoming' })
  @IsOptional()
  @IsIn(['upcoming', 'past'])
  scope: 'upcoming' | 'past' = 'upcoming';
}

export class CheckoutDto {
  @ApiProperty({ description: 'Public Razorpay key id' }) keyId: string;
  @ApiProperty() orderId: string;
  @ApiProperty() amountPaise: number;
  @ApiProperty({ example: 'INR' }) currency: 'INR';
}

export class AppointmentDoctorDto {
  @ApiProperty() slug: string;
  @ApiProperty() displayName: string;
  @ApiProperty() specialty: string;
  @ApiProperty({ type: String, nullable: true }) clinicName: string | null;
  @ApiProperty({ type: String, nullable: true }) city: string | null;
  @ApiProperty({ type: String, nullable: true }) locality: string | null;
}

class AppointmentBaseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: APPOINTMENT_STATUSES }) status: AppointmentStatus;
  @ApiProperty() startsAt: string;
  @ApiProperty() endsAt: string;
  @ApiProperty({ enum: CONSULTATION_MODES }) mode: ConsultationMode;
  @ApiProperty() feeInr: number;
  @ApiProperty({ enum: PAYMENT_STATUSES }) paymentStatus: PaymentStatus;
  @ApiProperty({ type: String, nullable: true }) patientNote: string | null;
  @ApiProperty({ type: String, nullable: true }) cancelReason: string | null;
  @ApiProperty({ type: String, nullable: true }) cancelledAt: string | null;
  @ApiProperty() canCancel: boolean;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'When the video call can first be joined; null unless this is an active video consultation',
  })
  videoOpensAt: string | null;
}

function base(
  appointment: AppointmentDocument,
  canCancel: boolean,
  now: Date,
  videoJoin: VideoJoinSettings,
): AppointmentBaseDto {
  const opens = clientVideoOpensAt(appointment, now, videoJoin);
  return {
    id: appointment.id,
    status: appointment.status,
    startsAt: appointment.startsAt.toISOString(),
    endsAt: appointment.endsAt.toISOString(),
    mode: appointment.mode,
    feeInr: appointment.feeInr,
    paymentStatus: appointment.payment.status,
    patientNote: appointment.patientNote,
    cancelReason: appointment.cancelReason,
    cancelledAt: appointment.cancelledAt?.toISOString() ?? null,
    canCancel,
    videoOpensAt: opens?.toISOString() ?? null,
  };
}

export class PatientAppointmentDto extends AppointmentBaseDto {
  @ApiProperty({ type: AppointmentDoctorDto }) doctor: AppointmentDoctorDto;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Unpaid bookings are released after this',
  })
  holdExpiresAt: string | null;
  @ApiProperty({ type: CheckoutDto, nullable: true, description: 'Present while payment is due' })
  checkout: CheckoutDto | null;

  static from(
    appointment: AppointmentDocument,
    now: Date,
    keyId: string | null,
    videoJoin: VideoJoinSettings,
  ): PatientAppointmentDto {
    const open = OPEN_STATUSES.includes(appointment.status);
    const awaitingPayment =
      appointment.status === 'pending_payment' &&
      !!appointment.payment.orderId &&
      !!keyId &&
      (appointment.holdExpiresAt?.getTime() ?? 0) > now.getTime();
    const { slug, displayName, specialty, clinicName, city, locality } = appointment.doctor;
    return {
      ...base(appointment, open && now < appointment.startsAt, now, videoJoin),
      doctor: { slug, displayName, specialty, clinicName, city, locality },
      holdExpiresAt: appointment.holdExpiresAt?.toISOString() ?? null,
      checkout: awaitingPayment
        ? {
            keyId: keyId,
            orderId: appointment.payment.orderId!,
            amountPaise: appointment.payment.amountPaise,
            currency: 'INR',
          }
        : null,
    };
  }
}

export class DoctorAppointmentDto extends AppointmentBaseDto {
  @ApiProperty() patientName: string;
  @ApiProperty({ description: 'The visit time has started, so the outcome can be recorded' })
  canRecordOutcome: boolean;
  @ApiProperty({ description: 'Awaiting your acceptance' })
  canAccept: boolean;
  @ApiProperty({ description: 'You can decline this request' })
  canReject: boolean;

  static from(
    appointment: AppointmentDocument,
    now: Date,
    videoJoin: VideoJoinSettings,
  ): DoctorAppointmentDto {
    const confirmed = appointment.status === 'confirmed';
    const pendingDoctor = appointment.status === 'pending_doctor';
    const active = now < appointment.endsAt;
    return {
      ...base(appointment, OPEN_STATUSES.includes(appointment.status) && active, now, videoJoin),
      patientName: appointment.patientName,
      canRecordOutcome: confirmed && now >= appointment.startsAt,
      canAccept: pendingDoctor && active,
      canReject: pendingDoctor && active,
    };
  }
}

export class VideoJoinDto {
  @ApiProperty({ description: 'WebSocket URL of the video service' }) url: string;
  @ApiProperty({ description: 'Short-lived access token for this appointment’s call only' })
  token: string;
}

export class PatientAppointmentListDto {
  @ApiProperty({ type: PatientAppointmentDto, isArray: true }) items: PatientAppointmentDto[];
}

export class DoctorAppointmentListDto {
  @ApiProperty({ type: DoctorAppointmentDto, isArray: true }) items: DoctorAppointmentDto[];
}
