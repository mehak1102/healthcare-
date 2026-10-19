import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { APPOINTMENT_STATUSES, type AppointmentStatus } from './appointment.schema';

export const EVENT_SOURCES = ['patient', 'doctor', 'system', 'payment_webhook'] as const;
export type EventSource = (typeof EVENT_SOURCES)[number];

/** Append-only history of an appointment's status changes and money movements. */
@Schema({ collection: 'appointment_events', timestamps: { createdAt: true, updatedAt: false } })
export class AppointmentEvent {
  @Prop({ type: Types.ObjectId, required: true })
  appointmentId: Types.ObjectId;

  @Prop({ required: true })
  type: string;

  @Prop({ type: String, enum: [...APPOINTMENT_STATUSES, null], default: null })
  fromStatus: AppointmentStatus | null;

  @Prop({ type: String, enum: [...APPOINTMENT_STATUSES, null], default: null })
  toStatus: AppointmentStatus | null;

  @Prop({ type: String, required: true, enum: EVENT_SOURCES })
  source: EventSource;

  @Prop({ type: Types.ObjectId, default: null })
  actorUserId: Types.ObjectId | null;

  createdAt: Date;
}

export type AppointmentEventDocument = HydratedDocument<AppointmentEvent>;
export const AppointmentEventSchema = SchemaFactory.createForClass(AppointmentEvent);
AppointmentEventSchema.index({ appointmentId: 1, createdAt: 1 });
