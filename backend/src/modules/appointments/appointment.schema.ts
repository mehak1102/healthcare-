import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CONSULTATION_MODES, type ConsultationMode } from '../doctors/doctor-profile.schema';

export const APPOINTMENT_STATUSES = [
  'pending_payment',
  'pending_doctor',
  'confirmed',
  'rejected_by_doctor',
  'completed',
  'no_show',
  'cancelled_by_patient',
  'cancelled_by_doctor',
  'expired',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'not_required',
  'pending',
  'paid',
  'refund_pending',
  'refunded',
  'refund_failed',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const REFUND_STATES = ['requesting', 'pending', 'processed', 'failed'] as const;
export type RefundState = (typeof REFUND_STATES)[number];

@Schema({ _id: false })
export class RefundRecord {
  @Prop({ required: true })
  paymentId: string;

  @Prop({ type: String, default: null })
  refundId: string | null;

  @Prop({ type: String, required: true, enum: REFUND_STATES })
  state: RefundState;

  @Prop({ required: true })
  amountPaise: number;

  /** e.g. cancelled_by_patient, late_payment, duplicate_payment. */
  @Prop({ required: true })
  reason: string;

  @Prop({ type: Date, required: true })
  requestedAt: Date;
}
const RefundRecordSchema = SchemaFactory.createForClass(RefundRecord);

@Schema({ _id: false })
export class AppointmentPayment {
  @Prop({ type: String, required: true, enum: PAYMENT_STATUSES })
  status: PaymentStatus;

  /** Exactly what the gateway order was created for; derived from the fee, never the browser. */
  @Prop({ required: true, min: 0 })
  amountPaise: number;

  @Prop({ type: String, default: null })
  orderId: string | null;

  @Prop({ type: String, default: null })
  paymentId: string | null;

  @Prop({ type: Date, default: null })
  paidAt: Date | null;

  @Prop({ type: [RefundRecordSchema], default: [] })
  refunds: RefundRecord[];
}
const AppointmentPaymentSchema = SchemaFactory.createForClass(AppointmentPayment);

/** Copied at booking time so the record stays readable if the profile later changes. */
@Schema({ _id: false })
export class DoctorSnapshot {
  @Prop({ required: true }) slug: string;
  @Prop({ required: true }) displayName: string;
  @Prop({ required: true }) specialty: string;
  @Prop({ type: String, default: null }) clinicName: string | null;
  @Prop({ type: String, default: null }) city: string | null;
  @Prop({ type: String, default: null }) locality: string | null;
}
const DoctorSnapshotSchema = SchemaFactory.createForClass(DoctorSnapshot);

@Schema({ collection: 'appointments', timestamps: true })
export class Appointment {
  @Prop({ type: Types.ObjectId, required: true })
  patientId: Types.ObjectId;

  @Prop({ required: true, maxlength: 100 })
  patientName: string;

  @Prop({ type: Types.ObjectId, required: true })
  doctorUserId: Types.ObjectId;

  @Prop({ type: DoctorSnapshotSchema, required: true })
  doctor: DoctorSnapshot;

  @Prop({ type: Types.ObjectId, required: true })
  reservationId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  startsAt: Date;

  @Prop({ type: Date, required: true })
  endsAt: Date;

  @Prop({ type: String, required: true, enum: CONSULTATION_MODES })
  mode: ConsultationMode;

  @Prop({ type: String, required: true, enum: APPOINTMENT_STATUSES })
  status: AppointmentStatus;

  /** Whole rupees at the time of booking. */
  @Prop({ required: true, min: 0 })
  feeInr: number;

  @Prop({ type: AppointmentPaymentSchema, required: true })
  payment: AppointmentPayment;

  @Prop({ type: Date, default: null })
  holdExpiresAt: Date | null;

  /** Set once the booking was confirmed; doctors only ever see appointments that were confirmed. */
  @Prop({ type: Date, default: null })
  confirmedAt: Date | null;

  /** Health information: shown only to the patient and their doctor, never logged or audited. */
  @Prop({ type: String, default: null, maxlength: 500 })
  patientNote: string | null;

  @Prop({ required: true })
  idempotencyKey: string;

  /** What the idempotency key was first used for, so a reused key with a new request is refused. */
  @Prop({ required: true })
  requestFingerprint: string;

  @Prop({ type: Date, default: null })
  cancelledAt: Date | null;

  @Prop({ type: String, default: null, maxlength: 500 })
  cancelReason: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export type AppointmentDocument = HydratedDocument<Appointment>;
export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
AppointmentSchema.index(
  { patientId: 1, idempotencyKey: 1 },
  { unique: true, name: 'one_booking_per_idempotency_key' },
);
AppointmentSchema.index({ patientId: 1, startsAt: -1 });
AppointmentSchema.index({ doctorUserId: 1, startsAt: 1 });
AppointmentSchema.index(
  { 'payment.orderId': 1 },
  { unique: true, partialFilterExpression: { 'payment.orderId': { $type: 'string' } } },
);
AppointmentSchema.index({ status: 1, holdExpiresAt: 1 });
