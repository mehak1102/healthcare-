import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { type ClientSession, type Connection, Model, Types } from 'mongoose';
import { apiError } from '../../common/http/api-error';
import type { RequestMeta } from '../../common/http/app-request';
import { InjectConfig } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import {
  acceptsNewBookings,
  requiresBookingApproval,
  type AvailabilityStatus,
} from '../doctors/doctor-profile.schema';
import { DoctorProfilesService } from '../doctors/doctor-profiles.service';
import { effectiveDoctorVerification } from '../users/doctor-verification';
import {
  type GatewayPayment,
  InjectPaymentGateway,
  type GatewayOrder,
  type PaymentGateway,
  paymentsUnavailable,
} from '../payments/payment-gateway';
import {
  SANDBOX_RAZORPAY_KEY_ID,
  SandboxPaymentGateway,
} from '../payments/sandbox-payment.gateway';
import { UsersService } from '../users/users.service';
import { AppointmentEvent, type EventSource } from './appointment-event.schema';
import { AppointmentNotifications } from './appointment-notifications';
import {
  Appointment,
  type AppointmentDocument,
  type AppointmentStatus,
} from './appointment.schema';
import { InjectVideoGateway, type VideoGateway, type VideoJoin } from '../video/video-gateway';
import {
  clientVideoOpensAt,
  HOLD_MINUTES,
  MAX_PENDING_PAYMENTS,
  type VideoJoinSettings,
  videoOpensAt,
} from './booking-rules';
import {
  type BookAppointmentDto,
  DoctorAppointmentDto,
  type DoctorCancelDto,
  type DoctorRejectDto,
  OPEN_STATUSES,
  PatientAppointmentDto,
  type PatientCancelDto,
  type RescheduleAppointmentDto,
  type RecordOutcomeDto,
  type VerifyPaymentDto,
} from './dto/appointments.dto';
import { SchedulesService } from './schedules.service';
import { SlotReservation } from './slot-reservation.schema';

const DUPLICATE_KEY = 11000;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,100}$/;
const LIST_LIMIT = 100;

type Actor = { source: EventSource; userId: string | null };
type Settlement =
  | { kind: 'confirmed' | 'already_confirmed'; appointment: AppointmentDocument }
  | { kind: 'late'; appointment: AppointmentDocument };

const notFound = () =>
  new NotFoundException(apiError('NOT_FOUND', 'This appointment does not exist.'));

const slotTaken = () =>
  new ConflictException(
    apiError('SLOT_UNAVAILABLE', 'That time is no longer available. Please pick another slot.'),
  );

const isDuplicateKey = (error: unknown): error is Error & { code: number } =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: unknown }).code === DUPLICATE_KEY;

export function assertIdempotencyKey(value: unknown): string {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY.test(value)) {
    throw new BadRequestException(
      apiError(
        'IDEMPOTENCY_KEY_REQUIRED',
        'Send a unique Idempotency-Key header (16–100 letters, digits, - or _) with each booking.',
      ),
    );
  }
  return value;
}

function fingerprintOf(input: BookAppointmentDto): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        input.doctorSlug,
        new Date(input.startsAt).toISOString(),
        input.mode,
        input.patientNote ?? '',
      ]),
    )
    .digest('hex');
}

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    @InjectModel(SlotReservation.name) private readonly reservations: Model<SlotReservation>,
    @InjectModel(AppointmentEvent.name) private readonly events: Model<AppointmentEvent>,
    @InjectConnection() private readonly connection: Connection,
    private readonly schedules: SchedulesService,
    private readonly profiles: DoctorProfilesService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly notifications: AppointmentNotifications,
    @InjectPaymentGateway() private readonly gateway: PaymentGateway,
    @InjectVideoGateway() private readonly video: VideoGateway,
    @InjectConfig() private readonly env: Env,
  ) {}

  get checkoutKey(): string | null {
    return this.gateway.publicKey;
  }

  get videoJoinSettings(): VideoJoinSettings {
    return {
      joinAnytime: this.env.VIDEO_JOIN_ANYTIME,
      earlyMinutes: this.env.VIDEO_JOIN_EARLY_MINUTES,
    };
  }

  toPatientDto(appointment: AppointmentDocument, now = new Date()): PatientAppointmentDto {
    return PatientAppointmentDto.from(
      appointment,
      now,
      this.checkoutKey,
      this.videoJoinSettings,
    );
  }

  toDoctorDto(appointment: AppointmentDocument, now = new Date()): DoctorAppointmentDto {
    return DoctorAppointmentDto.from(appointment, now, this.videoJoinSettings);
  }

  // ---------------------------------------------------------------- booking

  async book(
    auth: AuthContext,
    input: BookAppointmentDto,
    idempotencyKey: string,
    meta: RequestMeta,
  ): Promise<AppointmentDocument> {
    const patientId = new Types.ObjectId(auth.userId);
    const fingerprint = fingerprintOf(input);
    const previous = await this.appointments.findOne({ patientId, idempotencyKey }).exec();
    if (previous) return this.replay(previous, fingerprint);

    const now = new Date();
    const profile = await this.profiles.findPublicBySlug(input.doctorSlug);
    await this.assertAcceptingBookings(profile);
    if (profile.userId.equals(patientId)) {
      throw new ForbiddenException(
        apiError('SELF_BOOKING_FORBIDDEN', 'You cannot book an appointment with yourself.'),
      );
    }
    if (!profile.consultationModes.includes(input.mode)) {
      throw new BadRequestException(
        apiError('MODE_NOT_OFFERED', 'This doctor does not offer that type of consultation.'),
      );
    }
    if (input.mode === 'online' && !this.video.available) {
      throw new ConflictException(
        apiError(
          'ONLINE_NOT_AVAILABLE_YET',
          'Video consultations are not available right now. Please choose an in-clinic visit.',
        ),
      );
    }
    const feeInr = profile.consultationFeeInr;
    if (feeInr === null) throw slotTaken();
    const paid = feeInr > 0;
    if (paid && !this.gateway.available) throw paymentsUnavailable();

    const slot = await this.schedules.findOfferedSlot(
      profile,
      new Date(input.startsAt),
      input.mode,
      now,
    );
    if (!slot) throw slotTaken();

    const pending = await this.appointments.countDocuments({
      patientId,
      status: 'pending_payment',
      holdExpiresAt: { $gt: now },
    });
    if (pending >= MAX_PENDING_PAYMENTS) {
      throw new ConflictException(
        apiError(
          'TOO_MANY_UNPAID_BOOKINGS',
          'Finish paying for or cancel your unpaid bookings before starting another.',
        ),
      );
    }
    const patient = await this.users.findById(auth.userId);
    if (!patient) throw notFound();

    const appointmentId = new Types.ObjectId();
    const reservationId = new Types.ObjectId();
    const holdExpiresAt = paid ? new Date(now.getTime() + HOLD_MINUTES * 60_000) : null;
    const needsApproval = requiresBookingApproval(profile);
    const status: AppointmentStatus = paid
      ? 'pending_payment'
      : needsApproval
        ? 'pending_doctor'
        : 'confirmed';

    try {
      await this.connection.transaction(async (session) => {
        if (!(await this.schedules.lockForBooking(profile.userId, session))) throw slotTaken();
        await this.expireStaleHolds({ doctorUserId: profile.userId }, now, session);
        const clash = await this.reservations
          .exists({
            doctorUserId: profile.userId,
            active: true,
            startsAt: { $lt: slot.endsAt },
            endsAt: { $gt: slot.startsAt },
          })
          .session(session);
        if (clash) throw slotTaken();

        await this.reservations.create(
          [
            {
              _id: reservationId,
              doctorUserId: profile.userId,
              startsAt: slot.startsAt,
              endsAt: slot.endsAt,
              state: paid ? 'held' : 'booked',
              active: true,
              holdExpiresAt,
              appointmentId,
            },
          ],
          { session },
        );
        await this.appointments.create(
          [
            {
              _id: appointmentId,
              patientId,
              patientName: patient.fullName,
              doctorUserId: profile.userId,
              doctor: {
                slug: profile.slug,
                displayName: profile.displayName,
                specialty: profile.specialty,
                clinicName: profile.clinicName,
                city: profile.city,
                locality: profile.locality,
              },
              reservationId,
              startsAt: slot.startsAt,
              endsAt: slot.endsAt,
              mode: input.mode,
              status,
              feeInr,
              payment: {
                status: paid ? 'pending' : 'not_required',
                amountPaise: feeInr * 100,
                orderId: null,
                paymentId: null,
                paidAt: null,
                refunds: [],
              },
              holdExpiresAt,
              confirmedAt: paid || needsApproval ? null : now,
              patientNote: input.patientNote ?? null,
              idempotencyKey,
              requestFingerprint: fingerprint,
            },
          ],
          { session },
        );
        await this.recordEvent(
          appointmentId,
          'created',
          null,
          status,
          {
            source: 'patient',
            userId: auth.userId,
          },
          session,
        );
      });
    } catch (error) {
      if (isDuplicateKey(error)) {
        if (error.message.includes('one_booking_per_idempotency_key')) {
          const winner = await this.appointments.findOne({ patientId, idempotencyKey }).exec();
          if (winner) return this.replay(winner, fingerprint);
        }
        throw slotTaken();
      }
      throw error;
    }

    await this.audit.record({
      action: 'appointment.book',
      outcome: 'success',
      actorUserId: auth.userId,
      targetType: 'appointment',
      targetId: appointmentId.toString(),
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      metadata: { doctorUserId: profile.userId.toString(), mode: input.mode, feeInr },
    });

    await this.refreshDoctorNextAvailable(profile.userId);

    const appointment = await this.mustFind(appointmentId);
    if (!paid) {
      if (appointment.status === 'confirmed') {
        this.notifications.confirmed(appointment);
      } else {
        this.notifications.pendingDoctorApproval(appointment);
      }
      return appointment;
    }
    return this.ensureOrder(appointment);
  }

  private async replay(
    existing: AppointmentDocument,
    fingerprint: string,
  ): Promise<AppointmentDocument> {
    if (existing.requestFingerprint !== fingerprint) {
      throw new UnprocessableEntityException(
        apiError(
          'IDEMPOTENCY_KEY_REUSED',
          'This Idempotency-Key was already used for a different booking. Generate a new key.',
        ),
      );
    }
    if (existing.status === 'pending_payment' && !existing.payment.orderId) {
      return this.ensureOrder(existing);
    }
    return existing;
  }

  /** Creates the gateway order for a held booking; releases the hold if the gateway fails. */
  private async ensureOrder(appointment: AppointmentDocument): Promise<AppointmentDocument> {
    if (appointment.payment.orderId) {
      const gateway = this.gateway as PaymentGateway & {
        fetchOpenOrder?: (orderId: string) => Promise<GatewayOrder | null>;
      };
      if (typeof gateway.fetchOpenOrder === 'function') {
        const open = await gateway.fetchOpenOrder(appointment.payment.orderId);
        if (open && open.amountPaise === appointment.payment.amountPaise) {
          return appointment;
        }
        const cleared = await this.appointments
          .findOneAndUpdate(
            { _id: appointment._id, status: 'pending_payment' },
            { $set: { 'payment.orderId': null } },
            { returnDocument: 'after' },
          )
          .exec();
        appointment = cleared ?? appointment;
      } else {
        return appointment;
      }
    }
    let orderId: string;
    try {
      const order = await this.gateway.createOrder({
        amountPaise: appointment.payment.amountPaise,
        receipt: appointment.id,
        notes: { appointmentId: appointment.id },
      });
      if (order.amountPaise !== appointment.payment.amountPaise || order.currency !== 'INR') {
        this.logger.error(`Payment order for appointment ${appointment.id} has the wrong amount`);
        throw paymentsUnavailable();
      }
      orderId = order.orderId;
    } catch (error) {
      await this.releaseUnpaid(appointment);
      throw error;
    }
    const updated = await this.appointments
      .findOneAndUpdate(
        { _id: appointment._id, 'payment.orderId': null },
        { $set: { 'payment.orderId': orderId } },
        { returnDocument: 'after' },
      )
      .exec();
    return updated ?? this.mustFind(appointment._id);
  }

  private async releaseUnpaid(appointment: AppointmentDocument): Promise<void> {
    await this.connection.transaction(async (session) => {
      const updated = await this.appointments
        .updateOne(
          { _id: appointment._id, status: 'pending_payment' },
          { $set: { status: 'expired', holdExpiresAt: null } },
          { session },
        )
        .exec();
      if (updated.modifiedCount === 0) return;
      await this.reservations
        .updateOne(
          { _id: appointment.reservationId, state: 'held' },
          { $set: { state: 'expired', active: false, holdExpiresAt: null } },
          { session },
        )
        .exec();
      await this.recordEvent(
        appointment._id,
        'payment_setup_failed',
        'pending_payment',
        'expired',
        {
          source: 'system',
          userId: null,
        },
        session,
      );
    });
  }

  /**
   * Part of account deletion, inside its transaction. Refuses while the user still has an
   * appointment that has not ended (as patient or doctor) or an unpaid hold that is still valid,
   * so cancellations and refunds go through the normal flow first. Past appointments are kept as
   * medical and financial records. Removes the doctor's timetable so nothing new can be booked.
   */
  async prepareAccountDeletion(userId: Types.ObjectId, session: ClientSession): Promise<void> {
    const now = new Date();
    const isDoctor = await this.schedules.lockForBooking(userId, session);
    await this.expireStaleHolds({ patientId: userId }, now, session);
    await this.expireStaleHolds({ doctorUserId: userId }, now, session);
    const open = await this.appointments
      .countDocuments({
        $or: [{ patientId: userId }, { doctorUserId: userId }],
        status: { $in: OPEN_STATUSES },
        endsAt: { $gt: now },
      })
      .session(session)
      .exec();
    if (open > 0) {
      throw new ConflictException(
        apiError(
          'ACCOUNT_HAS_OPEN_APPOINTMENTS',
          'Cancel your upcoming appointments before deleting your account.',
          [`${open} upcoming ${open === 1 ? 'appointment' : 'appointments'}`],
        ),
      );
    }
    if (isDoctor) await this.schedules.deleteForDoctor(userId, session);
  }

  /** Unpaid holds past their deadline stop blocking the slot. */
  private async expireStaleHolds(
    scope: { doctorUserId: Types.ObjectId } | { patientId: Types.ObjectId },
    now: Date,
    session?: ClientSession,
  ): Promise<void> {
    if ('doctorUserId' in scope) {
      await this.reservations
        .updateMany(
          { doctorUserId: scope.doctorUserId, state: 'held', holdExpiresAt: { $lte: now } },
          { $set: { state: 'expired', active: false, holdExpiresAt: null } },
          { session },
        )
        .exec();
    }
    const stale = await this.appointments
      .find(
        { ...scope, status: 'pending_payment', holdExpiresAt: { $lte: now } },
        {
          _id: 1,
          reservationId: 1,
        },
      )
      .session(session ?? null)
      .lean()
      .exec();
    if (stale.length === 0) return;
    const ids = stale.map((item) => item._id);
    await this.appointments
      .updateMany(
        { _id: { $in: ids }, status: 'pending_payment' },
        { $set: { status: 'expired', holdExpiresAt: null } },
        { session },
      )
      .exec();
    await this.reservations
      .updateMany(
        { _id: { $in: stale.map((item) => item.reservationId) }, state: 'held' },
        { $set: { state: 'expired', active: false, holdExpiresAt: null } },
        { session },
      )
      .exec();
    await this.events.insertMany(
      ids.map((appointmentId) => ({
        appointmentId,
        type: 'hold_expired',
        fromStatus: 'pending_payment',
        toStatus: 'expired',
        source: 'system',
        actorUserId: null,
      })),
      { session },
    );
  }

  // ---------------------------------------------------------------- payment

  /** Development only: simulates Razorpay Checkout after the patient clicks pay. */
  async completeSandboxPayment(
    auth: AuthContext,
    id: string,
    meta: RequestMeta,
  ): Promise<AppointmentDocument> {
    if (this.gateway.publicKey !== SANDBOX_RAZORPAY_KEY_ID) {
      throw notFound();
    }
    const appointment = await this.findOwned(auth, id);
    if (!appointment.payment.orderId) throw this.paymentMismatch();
    const confirmation = (this.gateway as SandboxPaymentGateway).completeOrder(
      appointment.payment.orderId,
    );
    return this.verifyPayment(
      auth,
      id,
      {
        razorpayOrderId: confirmation.orderId,
        razorpayPaymentId: confirmation.paymentId,
        razorpaySignature: confirmation.signature,
      },
      meta,
    );
  }

  async verifyPayment(
    auth: AuthContext,
    id: string,
    input: VerifyPaymentDto,
    meta: RequestMeta,
  ): Promise<AppointmentDocument> {
    const appointment = await this.findOwned(auth, id);
    if (!this.gateway.available) throw paymentsUnavailable();
    if (!appointment.payment.orderId || appointment.payment.orderId !== input.razorpayOrderId) {
      throw this.paymentMismatch();
    }
    const genuine = this.gateway.verifyCheckout({
      orderId: input.razorpayOrderId,
      paymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
    });
    if (!genuine) {
      await this.audit.record({
        action: 'appointment.payment_verify',
        outcome: 'denied',
        actorUserId: auth.userId,
        targetType: 'appointment',
        targetId: appointment.id,
        requestId: meta.requestId,
        ipAddress: meta.ipAddress,
        metadata: { reason: 'bad_signature' },
      });
      throw new BadRequestException(
        apiError('PAYMENT_SIGNATURE_INVALID', 'We could not verify this payment confirmation.'),
      );
    }
    if (
      appointment.payment.paymentId === input.razorpayPaymentId &&
      appointment.status !== 'pending_payment'
    ) {
      return this.afterLateCheck(appointment);
    }

    const payment = await this.gateway.fetchPayment(input.razorpayPaymentId);
    const settlement = await this.settle(
      appointment,
      payment,
      {
        source: 'patient',
        userId: auth.userId,
      },
      meta,
    );
    return this.afterLateCheck(settlement.appointment, settlement.kind === 'late');
  }

  private afterLateCheck(appointment: AppointmentDocument, late = false): AppointmentDocument {
    const refundedLate =
      late ||
      (appointment.status !== 'confirmed' &&
        appointment.status !== 'pending_doctor' &&
        appointment.status !== 'completed' &&
        appointment.status !== 'no_show' &&
        appointment.payment.refunds.some((r) => r.reason === 'late_payment'));
    if (refundedLate) {
      throw new ConflictException(
        apiError(
          'PAYMENT_TOO_LATE',
          'The slot was released before your payment completed, so it could not be booked. A full refund has been started.',
        ),
      );
    }
    return appointment;
  }

  /**
   * Confirms a booking for a payment the gateway itself reported. Safe to call repeatedly and
   * from both the browser confirmation and the webhook.
   */
  private async settle(
    appointment: AppointmentDocument,
    payment: GatewayPayment,
    actor: Actor,
    meta: RequestMeta | null,
  ): Promise<Settlement> {
    if (
      payment.orderId !== appointment.payment.orderId ||
      payment.amountPaise !== appointment.payment.amountPaise ||
      payment.currency !== 'INR'
    ) {
      await this.audit.record({
        action: 'appointment.payment_verify',
        outcome: 'denied',
        actorUserId: actor.userId,
        targetType: 'appointment',
        targetId: appointment.id,
        requestId: meta?.requestId ?? '',
        ipAddress: meta?.ipAddress ?? '',
        metadata: { reason: 'payment_mismatch', paymentId: payment.paymentId },
      });
      throw this.paymentMismatch();
    }

    let settled = payment;
    if (settled.status === 'authorized') {
      settled = await this.gateway.capture(settled.paymentId, appointment.payment.amountPaise);
    }
    if (settled.status !== 'captured') {
      throw new ConflictException(
        apiError(
          'PAYMENT_NOT_COMPLETED',
          'The payment has not completed. If money left your account, it will be returned automatically by your bank.',
        ),
      );
    }

    const settlement = await this.confirmPaid(appointment._id, settled.paymentId, actor);
    if (settlement.kind === 'confirmed') {
      await this.audit.record({
        action: 'appointment.payment_confirmed',
        outcome: 'success',
        actorUserId: actor.userId,
        targetType: 'appointment',
        targetId: appointment.id,
        requestId: meta?.requestId ?? '',
        ipAddress: meta?.ipAddress ?? '',
        metadata: { paymentId: settled.paymentId, via: actor.source },
      });
      if (settlement.appointment.status === 'confirmed') {
        this.notifications.confirmed(settlement.appointment);
      } else if (settlement.appointment.status === 'pending_doctor') {
        this.notifications.pendingDoctorApproval(settlement.appointment);
      }
    }
    if (settlement.kind === 'late') {
      const isPrimary =
        !settlement.appointment.payment.paymentId ||
        settlement.appointment.payment.paymentId === settled.paymentId;
      const reason = isPrimary ? 'late_payment' : 'duplicate_payment';
      const refunded = await this.refund(settlement.appointment, settled.paymentId, reason, actor);
      if (refunded && reason === 'late_payment') {
        this.notifications.latePaymentRefunded(settlement.appointment);
      }
      return { kind: 'late', appointment: await this.mustFind(appointment._id) };
    }
    return settlement;
  }

  private async confirmPaid(
    appointmentId: Types.ObjectId,
    paymentId: string,
    actor: Actor,
  ): Promise<Settlement> {
    return this.connection.transaction(async (session) => {
      const appointment = await this.appointments.findById(appointmentId).session(session).exec();
      if (!appointment) throw notFound();
      if (appointment.payment.paymentId === paymentId && appointment.confirmedAt) {
        return { kind: 'already_confirmed' as const, appointment };
      }
      if (appointment.status !== 'pending_payment') {
        return { kind: 'late' as const, appointment };
      }
      // Still `held` means nobody else has claimed the slot, even if the hold deadline passed.
      const claimed = await this.reservations
        .updateOne(
          { _id: appointment.reservationId, state: 'held' },
          { $set: { state: 'booked', holdExpiresAt: null } },
          { session },
        )
        .exec();
      if (claimed.modifiedCount === 0) {
        appointment.set({ status: 'expired', holdExpiresAt: null });
        await appointment.save({ session });
        await this.recordEvent(
          appointmentId,
          'hold_expired',
          'pending_payment',
          'expired',
          actor,
          session,
        );
        return { kind: 'late' as const, appointment };
      }
      const now = new Date();
      const profile = await this.profiles.findByUserId(appointment.doctorUserId, session);
      const needsApproval = profile ? requiresBookingApproval(profile) : true;
      const nextStatus: AppointmentStatus = needsApproval ? 'pending_doctor' : 'confirmed';
      appointment.set({
        status: nextStatus,
        holdExpiresAt: null,
        confirmedAt: needsApproval ? null : now,
        'payment.status': 'paid',
        'payment.paymentId': paymentId,
        'payment.paidAt': now,
      });
      await appointment.save({ session });
      await this.recordEvent(
        appointmentId,
        'payment_captured',
        'pending_payment',
        nextStatus,
        actor,
        session,
      );
      return { kind: 'confirmed' as const, appointment };
    });
  }

  /**
   * Refunds one payment in full, at most once per payment id. Returns false when a refund for
   * this payment was already under way. A failed refund is recorded for operators to follow up.
   */
  private async refund(
    appointment: AppointmentDocument,
    paymentId: string,
    reason: string,
    actor: Actor,
  ): Promise<boolean> {
    const primary = !appointment.payment.paymentId || appointment.payment.paymentId === paymentId;
    const amountPaise = appointment.payment.amountPaise;
    const claimed = await this.appointments
      .updateOne(
        { _id: appointment._id, 'payment.refunds.paymentId': { $ne: paymentId } },
        {
          $push: {
            'payment.refunds': {
              paymentId,
              refundId: null,
              state: 'requesting',
              amountPaise,
              reason,
              requestedAt: new Date(),
            },
          },
          ...(primary
            ? { $set: { 'payment.paymentId': paymentId, 'payment.status': 'refund_pending' } }
            : {}),
        },
      )
      .exec();
    if (claimed.modifiedCount === 0) return false;

    const match = { _id: appointment._id, 'payment.refunds.paymentId': paymentId };
    try {
      const refund = await this.gateway.refund(paymentId, amountPaise, {
        appointmentId: appointment.id,
        reason,
      });
      const processed = refund.status === 'processed';
      await this.appointments
        .updateOne(match, {
          $set: {
            'payment.refunds.$.refundId': refund.refundId,
            'payment.refunds.$.state': processed ? 'processed' : 'pending',
            ...(primary ? { 'payment.status': processed ? 'refunded' : 'refund_pending' } : {}),
          },
        })
        .exec();
      await this.recordEvent(appointment._id, 'refund_started', null, null, actor);
      await this.audit.record({
        action: 'appointment.refund',
        outcome: 'success',
        actorUserId: actor.userId,
        targetType: 'appointment',
        targetId: appointment.id,
        requestId: '',
        ipAddress: '',
        metadata: { paymentId, refundId: refund.refundId, reason, amountPaise },
      });
    } catch (error) {
      this.logger.error(
        `Refund for appointment ${appointment.id} failed and needs manual follow-up: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      await this.appointments
        .updateOne(match, {
          $set: {
            'payment.refunds.$.state': 'failed',
            ...(primary ? { 'payment.status': 'refund_failed' } : {}),
          },
        })
        .exec();
      await this.recordEvent(appointment._id, 'refund_failed', null, null, actor);
      await this.audit.record({
        action: 'appointment.refund',
        outcome: 'failure',
        actorUserId: actor.userId,
        targetType: 'appointment',
        targetId: appointment.id,
        requestId: '',
        ipAddress: '',
        metadata: { paymentId, reason, amountPaise },
      });
    }
    return true;
  }

  private paymentMismatch() {
    return new BadRequestException(
      apiError('PAYMENT_MISMATCH', 'This payment does not belong to this appointment.'),
    );
  }

  // ---------------------------------------------------------------- webhook

  /** Handles a verified Razorpay webhook event. Unknown events and orders are ignored. */
  async handleGatewayEvent(event: string, payload: unknown): Promise<void> {
    const body = payload as {
      payment?: { entity?: RazorpayPaymentEntity };
      refund?: { entity?: { id?: string; payment_id?: string; status?: string } };
    };
    const actor: Actor = { source: 'payment_webhook', userId: null };

    if (event === 'payment.captured' || event === 'payment.authorized' || event === 'order.paid') {
      const entity = body.payment?.entity;
      if (!entity?.id || !entity.order_id) return;
      const appointment = await this.appointments
        .findOne({ 'payment.orderId': entity.order_id })
        .exec();
      if (!appointment) return;
      if (appointment.payment.paymentId === entity.id && appointment.confirmedAt) return;
      await this.settle(
        appointment,
        {
          paymentId: entity.id,
          orderId: entity.order_id,
          amountPaise: Number(entity.amount),
          currency: String(entity.currency),
          status: String(entity.status),
        },
        actor,
        null,
      );
      return;
    }

    if (event === 'refund.processed' || event === 'refund.failed') {
      const refund = body.refund?.entity;
      if (!refund?.id || !refund.payment_id) return;
      const appointment = await this.appointments
        .findOne({ 'payment.refunds.refundId': refund.id })
        .exec();
      if (!appointment) return;
      const processed = event === 'refund.processed';
      const primary = appointment.payment.paymentId === refund.payment_id;
      await this.appointments
        .updateOne(
          { _id: appointment._id, 'payment.refunds.refundId': refund.id },
          {
            $set: {
              'payment.refunds.$.state': processed ? 'processed' : 'failed',
              ...(primary ? { 'payment.status': processed ? 'refunded' : 'refund_failed' } : {}),
            },
          },
        )
        .exec();
      await this.recordEvent(
        appointment._id,
        processed ? 'refund_processed' : 'refund_failed',
        null,
        null,
        actor,
      );
      if (!processed) {
        this.logger.error(`Refund ${refund.id} failed at the gateway and needs manual follow-up`);
      }
    }
  }

  // ---------------------------------------------------------------- patient

  async listMine(auth: AuthContext, scope: 'upcoming' | 'past'): Promise<AppointmentDocument[]> {
    const patientId = new Types.ObjectId(auth.userId);
    const now = new Date();
    await this.expireStaleHolds({ patientId }, now);
    const filter =
      scope === 'upcoming'
        ? { patientId, status: { $in: OPEN_STATUSES }, endsAt: { $gt: now } }
        : {
            patientId,
            $or: [{ status: { $nin: OPEN_STATUSES } }, { endsAt: { $lte: now } }],
          };
    return this.appointments
      .find(filter)
      .sort({ startsAt: scope === 'upcoming' ? 1 : -1 })
      .limit(LIST_LIMIT)
      .exec();
  }

  async findMine(auth: AuthContext, id: string): Promise<AppointmentDocument> {
    await this.expireStaleHolds({ patientId: new Types.ObjectId(auth.userId) }, new Date());
    const appointment = await this.findOwned(auth, id);
    if (appointment.status === 'pending_payment' && this.gateway.available) {
      return this.ensureOrder(appointment);
    }
    return appointment;
  }

  async rescheduleByPatient(
    auth: AuthContext,
    id: string,
    input: RescheduleAppointmentDto,
    meta: RequestMeta,
  ): Promise<AppointmentDocument> {
    const appointment = await this.findOwned(auth, id);
    if (appointment.status !== 'confirmed') {
      throw new ConflictException(
        apiError('APPOINTMENT_NOT_ACTIVE', 'This appointment is no longer active.'),
      );
    }
    const now = new Date();
    if (now >= appointment.startsAt) throw this.cannotReschedule('has already started');

    const newStart = new Date(input.startsAt);
    if (newStart.getTime() === appointment.startsAt.getTime()) return appointment;

    const profile = await this.profiles.findPublicBySlug(appointment.doctor.slug);
    await this.assertAcceptingBookings(profile);
    const slot = await this.schedules.findOfferedSlot(profile, newStart, appointment.mode, now);
    if (!slot) throw slotTaken();

    const previousStartsAt = appointment.startsAt;
    const updated = await this.connection.transaction(async (session) => {
      if (!(await this.schedules.lockForBooking(profile.userId, session))) throw slotTaken();
      await this.expireStaleHolds({ doctorUserId: profile.userId }, now, session);
      const clash = await this.reservations
        .exists({
          doctorUserId: profile.userId,
          active: true,
          _id: { $ne: appointment.reservationId },
          startsAt: { $lt: slot.endsAt },
          endsAt: { $gt: slot.startsAt },
        })
        .session(session);
      if (clash) throw slotTaken();

      const released = await this.reservations
        .updateOne(
          { _id: appointment.reservationId, active: true },
          { $set: { state: 'released', active: false, holdExpiresAt: null } },
          { session },
        )
        .exec();
      if (released.matchedCount !== 1) {
        throw new ConflictException(
          apiError('APPOINTMENT_NOT_ACTIVE', 'This appointment is no longer active.'),
        );
      }

      const newReservationId = new Types.ObjectId();
      await this.reservations.create(
        [
          {
            _id: newReservationId,
            doctorUserId: profile.userId,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            state: 'booked',
            active: true,
            holdExpiresAt: null,
            appointmentId: appointment._id,
          },
        ],
        { session },
      );

      const changed = await this.appointments
        .findOneAndUpdate(
          { _id: appointment._id, status: 'confirmed' },
          {
            $set: {
              startsAt: slot.startsAt,
              endsAt: slot.endsAt,
              reservationId: newReservationId,
            },
          },
          { returnDocument: 'after', session },
        )
        .exec();
      if (!changed) return null;

      await this.recordEvent(
        appointment._id,
        'rescheduled',
        'confirmed',
        'confirmed',
        { source: 'patient', userId: auth.userId },
        session,
      );
      return changed;
    });

    if (!updated) {
      throw new ConflictException(
        apiError('APPOINTMENT_NOT_ACTIVE', 'This appointment is no longer active.'),
      );
    }

    await this.audit.record({
      action: 'appointment.reschedule',
      outcome: 'success',
      actorUserId: auth.userId,
      targetType: 'appointment',
      targetId: appointment.id,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      metadata: { mode: appointment.mode },
    });
    this.notifications.rescheduled(updated, previousStartsAt);
    await this.refreshDoctorNextAvailable(updated.doctorUserId);
    return updated;
  }

  async cancelByPatient(
    auth: AuthContext,
    id: string,
    input: PatientCancelDto,
    meta: RequestMeta,
  ): Promise<AppointmentDocument> {
    const appointment = await this.findOwned(auth, id);
    if (!OPEN_STATUSES.includes(appointment.status)) throw this.cannotCancel('is not active');
    if (new Date() >= appointment.startsAt) throw this.cannotCancel('has already started');
    return this.cancel(
      appointment,
      'cancelled_by_patient',
      input.reason ?? null,
      {
        source: 'patient',
        userId: auth.userId,
      },
      meta,
    );
  }

  // ---------------------------------------------------------------- doctor

  async listForDoctor(
    auth: AuthContext,
    scope: 'upcoming' | 'past',
  ): Promise<AppointmentDocument[]> {
    const doctorUserId = new Types.ObjectId(auth.userId);
    const now = new Date();
    const filter =
      scope === 'upcoming'
        ? {
            doctorUserId,
            status: { $in: ['pending_doctor', 'confirmed'] as const },
            endsAt: { $gt: now },
          }
        : {
            doctorUserId,
            $or: [
              { status: { $nin: ['pending_doctor', 'confirmed'] as const } },
              { endsAt: { $lte: now } },
            ],
          };
    return this.appointments
      .find(filter)
      .sort({ startsAt: scope === 'upcoming' ? 1 : -1 })
      .limit(LIST_LIMIT)
      .exec();
  }

  async cancelByDoctor(
    auth: AuthContext,
    id: string,
    input: DoctorCancelDto,
    meta: RequestMeta,
  ): Promise<AppointmentDocument> {
    const appointment = await this.findForDoctor(auth, id);
    if (appointment.status !== 'confirmed') throw this.cannotCancel('is not active');
    if (new Date() >= appointment.endsAt) throw this.cannotCancel('has already ended');
    return this.cancel(
      appointment,
      'cancelled_by_doctor',
      input.reason,
      {
        source: 'doctor',
        userId: auth.userId,
      },
      meta,
    );
  }

  async acceptBooking(
    auth: AuthContext,
    id: string,
    meta: RequestMeta,
  ): Promise<AppointmentDocument> {
    const appointment = await this.findForDoctor(auth, id);
    if (appointment.status !== 'pending_doctor') {
      throw new ConflictException(
        apiError('APPOINTMENT_NOT_ACTIVE', 'This booking request is no longer waiting for you.'),
      );
    }
    if (new Date() >= appointment.endsAt) {
      throw new ConflictException(
        apiError('APPOINTMENT_NOT_ACTIVE', 'This appointment time has already passed.'),
      );
    }
    const now = new Date();
    const updated = await this.connection.transaction(async (session) => {
      const changed = await this.appointments
        .findOneAndUpdate(
          { _id: appointment._id, status: 'pending_doctor' },
          { $set: { status: 'confirmed', confirmedAt: now } },
          { returnDocument: 'after', session },
        )
        .exec();
      if (!changed) return null;
      await this.recordEvent(
        appointment._id,
        'accepted',
        'pending_doctor',
        'confirmed',
        { source: 'doctor', userId: auth.userId },
        session,
      );
      return changed;
    });
    if (!updated) {
      throw new ConflictException(
        apiError('APPOINTMENT_NOT_ACTIVE', 'This booking request is no longer waiting for you.'),
      );
    }
    await this.audit.record({
      action: 'appointment.accept',
      outcome: 'success',
      actorUserId: auth.userId,
      targetType: 'appointment',
      targetId: appointment.id,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
    });
    this.notifications.confirmed(updated);
    return updated;
  }

  async rejectBooking(
    auth: AuthContext,
    id: string,
    input: DoctorRejectDto,
    meta: RequestMeta,
  ): Promise<AppointmentDocument> {
    const appointment = await this.findForDoctor(auth, id);
    if (appointment.status !== 'pending_doctor') {
      throw new ConflictException(
        apiError('APPOINTMENT_NOT_ACTIVE', 'This booking request is no longer waiting for you.'),
      );
    }
    const reason = input.reason?.trim() || null;
    const rejected = await this.connection.transaction(async (session) => {
      const changed = await this.appointments
        .findOneAndUpdate(
          { _id: appointment._id, status: 'pending_doctor' },
          {
            $set: {
              status: 'rejected_by_doctor',
              cancelledAt: new Date(),
              cancelReason: reason,
            },
          },
          { returnDocument: 'after', session },
        )
        .exec();
      if (!changed) return null;
      await this.reservations
        .updateOne(
          { _id: appointment.reservationId, active: true },
          { $set: { state: 'released', active: false, holdExpiresAt: null } },
          { session },
        )
        .exec();
      await this.recordEvent(
        appointment._id,
        'rejected_by_doctor',
        'pending_doctor',
        'rejected_by_doctor',
        { source: 'doctor', userId: auth.userId },
        session,
      );
      return changed;
    });
    if (!rejected) {
      throw new ConflictException(
        apiError('APPOINTMENT_NOT_ACTIVE', 'This booking request is no longer waiting for you.'),
      );
    }
    await this.audit.record({
      action: 'appointment.reject',
      outcome: 'success',
      actorUserId: auth.userId,
      targetType: 'appointment',
      targetId: appointment.id,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
    });
    const refunding = rejected.payment.status === 'paid' && !!rejected.payment.paymentId;
    if (refunding) {
      await this.refund(rejected, rejected.payment.paymentId!, 'rejected_by_doctor', {
        source: 'doctor',
        userId: auth.userId,
      });
    }
    const final = await this.mustFind(appointment._id);
    this.notifications.rejectedByDoctor(final, reason, refunding);
    return final;
  }

  async recordOutcome(
    auth: AuthContext,
    id: string,
    input: RecordOutcomeDto,
    meta: RequestMeta,
  ): Promise<AppointmentDocument> {
    const appointment = await this.findForDoctor(auth, id);
    if (new Date() < appointment.startsAt) {
      throw new ConflictException(
        apiError('TOO_EARLY', 'You can record the outcome once the appointment time has started.'),
      );
    }
    const updated = await this.connection.transaction(async (session) => {
      const changed = await this.appointments
        .findOneAndUpdate(
          { _id: appointment._id, status: 'confirmed' },
          { $set: { status: input.outcome } },
          { returnDocument: 'after', session },
        )
        .exec();
      if (!changed) return null;
      await this.recordEvent(
        appointment._id,
        input.outcome,
        'confirmed',
        input.outcome,
        {
          source: 'doctor',
          userId: auth.userId,
        },
        session,
      );
      return changed;
    });
    if (!updated) {
      throw new ConflictException(
        apiError('APPOINTMENT_NOT_ACTIVE', 'This appointment is no longer active.'),
      );
    }
    await this.audit.record({
      action: 'appointment.outcome',
      outcome: 'success',
      actorUserId: auth.userId,
      targetType: 'appointment',
      targetId: appointment.id,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      metadata: { outcome: input.outcome },
    });
    return updated;
  }

  // ---------------------------------------------------------------- video

  /**
   * Short-lived pass into the appointment's video call, for its patient or doctor only, from
   * a few minutes before the start until the end time. Rooms and identities are opaque; the
   * patient's name is never sent to the video provider.
   */
  async joinVideo(
    auth: AuthContext,
    id: string,
    role: 'patient' | 'doctor',
    meta: RequestMeta,
  ): Promise<VideoJoin> {
    const appointment =
      role === 'patient' ? await this.findOwned(auth, id) : await this.findForDoctor(auth, id);
    if (appointment.mode !== 'online') {
      throw new ConflictException(
        apiError('NOT_A_VIDEO_APPOINTMENT', 'This appointment is an in-clinic visit.'),
      );
    }
    if (appointment.status !== 'confirmed') {
      throw new ConflictException(
        apiError('APPOINTMENT_NOT_ACTIVE', 'This appointment is no longer active.'),
      );
    }
    const now = new Date();
    if (now >= appointment.endsAt) {
      throw new ConflictException(
        apiError('CALL_ENDED', 'The time for this video consultation has ended.'),
      );
    }
    if (!this.env.VIDEO_JOIN_ANYTIME) {
      const opens =
        clientVideoOpensAt(appointment, now, this.videoJoinSettings) ??
        videoOpensAt(appointment.startsAt, this.env.VIDEO_JOIN_EARLY_MINUTES);
      if (now < opens) {
        throw new ConflictException(
          apiError(
            'TOO_EARLY',
            `The call opens ${this.env.VIDEO_JOIN_EARLY_MINUTES} minutes before the appointment starts.`,
          ),
        );
      }
    }
    const join = await this.video.issueJoin({
      room: `appt_${appointment.id}`,
      identity: role,
      displayName: role === 'doctor' ? appointment.doctor.displayName : 'Patient',
      joinUntil: appointment.endsAt,
    });
    await this.audit.record({
      action: 'appointment.video.join',
      outcome: 'success',
      actorUserId: auth.userId,
      targetType: 'appointment',
      targetId: appointment.id,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      metadata: { role },
    });
    return join;
  }

  // ---------------------------------------------------------------- shared

  private async cancel(
    appointment: AppointmentDocument,
    status: 'cancelled_by_patient' | 'cancelled_by_doctor',
    reason: string | null,
    actor: Actor,
    meta: RequestMeta,
  ): Promise<AppointmentDocument> {
    const cancelled = await this.connection.transaction(async (session) => {
      const changed = await this.appointments
        .findOneAndUpdate(
          { _id: appointment._id, status: { $in: OPEN_STATUSES } },
          {
            $set: { status, cancelledAt: new Date(), cancelReason: reason, holdExpiresAt: null },
          },
          { returnDocument: 'after', session },
        )
        .exec();
      if (!changed) return null;
      await this.reservations
        .updateOne(
          { _id: appointment.reservationId, active: true },
          { $set: { state: 'released', active: false, holdExpiresAt: null } },
          { session },
        )
        .exec();
      await this.recordEvent(appointment._id, status, appointment.status, status, actor, session);
      return changed;
    });
    if (!cancelled) throw this.cannotCancel('is not active');

    await this.audit.record({
      action: 'appointment.cancel',
      outcome: 'success',
      actorUserId: actor.userId,
      targetType: 'appointment',
      targetId: appointment.id,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      metadata: { by: actor.source, previousStatus: appointment.status },
    });

    const refunding = cancelled.payment.status === 'paid' && !!cancelled.payment.paymentId;
    if (refunding) {
      await this.refund(cancelled, cancelled.payment.paymentId!, status, actor);
    }
    const final = await this.mustFind(appointment._id);
    if (appointment.status === 'confirmed' || appointment.status === 'pending_doctor') {
      this.notifications.cancelled(
        final,
        actor.source === 'doctor' ? 'doctor' : 'patient',
        refunding,
      );
    }
    await this.refreshDoctorNextAvailable(final.doctorUserId);
    return final;
  }

  private async refreshDoctorNextAvailable(doctorUserId: Types.ObjectId): Promise<void> {
    const profile = await this.profiles.findByUserId(doctorUserId);
    if (profile) await this.schedules.refreshNextAvailableCache(profile);
  }

  private async assertAcceptingBookings(profile: {
    userId: Types.ObjectId;
    availabilityStatus: AvailabilityStatus;
  }): Promise<void> {
    if (!acceptsNewBookings(profile.availabilityStatus)) {
      throw new ConflictException(
        apiError('DOCTOR_NOT_ACCEPTING', 'This doctor is not accepting new bookings right now.'),
      );
    }
    const doctor = await this.users.findById(profile.userId.toString());
    if (
      effectiveDoctorVerification(doctor?.roles ?? [], doctor?.doctorVerification) !== 'verified'
    ) {
      throw new ConflictException(
        apiError('DOCTOR_NOT_VERIFIED', 'This doctor is not verified to accept bookings.'),
      );
    }
  }

  async patientDashboard(auth: AuthContext) {
    const patientId = new Types.ObjectId(auth.userId);
    const now = new Date();
    await this.expireStaleHolds({ patientId }, now);
    const upcomingFilter = {
      patientId,
      status: { $in: OPEN_STATUSES },
      endsAt: { $gt: now },
    };
    const previousFilter = {
      patientId,
      $or: [{ status: { $nin: [...OPEN_STATUSES] } }, { endsAt: { $lte: now } }],
    };
    const preview = 'startsAt endsAt mode status feeInr payment doctor';
    const [upcomingCount, previousCount, onlineCount, upcoming, previous, payments, paymentTotals] =
      await Promise.all([
        this.appointments.countDocuments(upcomingFilter).exec(),
        this.appointments.countDocuments(previousFilter).exec(),
        this.appointments
          .countDocuments({ patientId, mode: 'online', confirmedAt: { $ne: null } })
          .exec(),
        this.appointments
          .find(upcomingFilter)
          .select(preview)
          .sort({ startsAt: 1 })
          .limit(5)
          .exec(),
        this.appointments
          .find(previousFilter)
          .select(preview)
          .sort({ startsAt: -1 })
          .limit(5)
          .exec(),
        this.appointments
          .find({ patientId })
          .select(preview)
          .sort({ startsAt: -1 })
          .limit(8)
          .exec(),
        this.appointments
          .aggregate<{ _id: string; total: number }>([
            { $match: { patientId } },
            { $group: { _id: '$payment.status', total: { $sum: '$feeInr' } } },
          ])
          .exec(),
      ]);
    return {
      upcomingCount,
      previousCount,
      onlineCount,
      upcoming,
      previous,
      payments,
      paymentTotals,
    };
  }

  async doctorDashboard(auth: AuthContext) {
    const doctorUserId = new Types.ObjectId(auth.userId);
    const now = new Date();
    const upcomingFilter = {
      doctorUserId,
      status: { $in: ['pending_doctor', 'confirmed'] as const },
      endsAt: { $gt: now },
    };
    const preview = 'patientName startsAt endsAt mode status';
    const [upcomingCount, pastCount, pendingApprovalCount, upcoming] = await Promise.all([
      this.appointments.countDocuments(upcomingFilter).exec(),
      this.appointments
        .countDocuments({
          doctorUserId,
          confirmedAt: { $ne: null },
          $or: [{ status: { $ne: 'confirmed' } }, { endsAt: { $lte: now } }],
        })
        .exec(),
      this.appointments
        .countDocuments({
          doctorUserId,
          status: 'pending_doctor',
          endsAt: { $gt: now },
        })
        .exec(),
      this.appointments.find(upcomingFilter).select(preview).sort({ startsAt: 1 }).limit(5).exec(),
    ]);
    return { upcomingCount, pastCount, pendingApprovalCount, upcoming };
  }

  private cannotCancel(why: string) {
    return new ConflictException(
      apiError('CANNOT_CANCEL', `This appointment cannot be cancelled because it ${why}.`),
    );
  }

  private cannotReschedule(why: string) {
    return new ConflictException(
      apiError('CANNOT_RESCHEDULE', `This appointment cannot be rescheduled because it ${why}.`),
    );
  }

  private async findOwned(auth: AuthContext, id: string): Promise<AppointmentDocument> {
    if (!Types.ObjectId.isValid(id)) throw notFound();
    const appointment = await this.appointments
      .findOne({ _id: new Types.ObjectId(id), patientId: new Types.ObjectId(auth.userId) })
      .exec();
    if (!appointment) throw notFound();
    return appointment;
  }

  private async findForDoctor(auth: AuthContext, id: string): Promise<AppointmentDocument> {
    if (!Types.ObjectId.isValid(id)) throw notFound();
    const appointment = await this.appointments
      .findOne({
        _id: new Types.ObjectId(id),
        doctorUserId: new Types.ObjectId(auth.userId),
      })
      .exec();
    if (!appointment) throw notFound();
    return appointment;
  }

  private async mustFind(id: Types.ObjectId): Promise<AppointmentDocument> {
    const appointment = await this.appointments.findById(id).exec();
    if (!appointment) throw notFound();
    return appointment;
  }

  private async recordEvent(
    appointmentId: Types.ObjectId,
    type: string,
    fromStatus: AppointmentStatus | null,
    toStatus: AppointmentStatus | null,
    actor: Actor,
    session?: ClientSession,
  ): Promise<void> {
    await this.events.create(
      [
        {
          appointmentId,
          type,
          fromStatus,
          toStatus,
          source: actor.source,
          actorUserId: actor.userId ? new Types.ObjectId(actor.userId) : null,
        },
      ],
      { session },
    );
  }
}

interface RazorpayPaymentEntity {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
}
