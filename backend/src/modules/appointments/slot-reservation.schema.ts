import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const RESERVATION_STATES = ['held', 'booked', 'released', 'expired'] as const;
export type ReservationState = (typeof RESERVATION_STATES)[number];

/**
 * One row per claim on a doctor's time. While `active`, the unique index guarantees nobody else
 * can claim the same start time; releasing or expiring a claim clears `active`.
 */
@Schema({ collection: 'slot_reservations', timestamps: true })
export class SlotReservation {
  @Prop({ type: Types.ObjectId, required: true })
  doctorUserId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  startsAt: Date;

  @Prop({ type: Date, required: true })
  endsAt: Date;

  @Prop({ type: String, required: true, enum: RESERVATION_STATES })
  state: ReservationState;

  @Prop({ type: Boolean, required: true })
  active: boolean;

  /** Set while `held`: unpaid holds stop blocking the slot after this. */
  @Prop({ type: Date, default: null })
  holdExpiresAt: Date | null;

  @Prop({ type: Types.ObjectId, required: true })
  appointmentId: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export type SlotReservationDocument = HydratedDocument<SlotReservation>;
export const SlotReservationSchema = SchemaFactory.createForClass(SlotReservation);
SlotReservationSchema.index(
  { doctorUserId: 1, startsAt: 1 },
  { unique: true, partialFilterExpression: { active: true }, name: 'one_active_claim_per_slot' },
);
SlotReservationSchema.index({ doctorUserId: 1, active: 1, startsAt: 1, endsAt: 1 });
SlotReservationSchema.index({ state: 1, holdExpiresAt: 1 });
