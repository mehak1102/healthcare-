import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CONSULTATION_MODES, type ConsultationMode } from '../doctors/doctor-profile.schema';
import { SLOT_LENGTHS } from './slots';

@Schema({ _id: false })
export class WeeklyBlock {
  @Prop({ required: true, min: 0, max: 6 })
  day: number;

  @Prop({ required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ })
  start: string;

  @Prop({ required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ })
  end: string;

  @Prop({ required: true, enum: SLOT_LENGTHS })
  slotMinutes: number;

  @Prop({ type: String, required: true, enum: CONSULTATION_MODES })
  mode: ConsultationMode;
}
const WeeklyBlockSchema = SchemaFactory.createForClass(WeeklyBlock);

/** Extra bookable hours on one India calendar date (outside the weekly pattern). */
@Schema({ _id: false })
export class OneOffBlock {
  @Prop({ required: true, match: /^\d{4}-\d{2}-\d{2}$/ })
  date: string;

  @Prop({ required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ })
  start: string;

  @Prop({ required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ })
  end: string;

  @Prop({ required: true, enum: SLOT_LENGTHS })
  slotMinutes: number;

  @Prop({ type: String, required: true, enum: CONSULTATION_MODES })
  mode: ConsultationMode;
}
const OneOffBlockSchema = SchemaFactory.createForClass(OneOffBlock);

/** A doctor's repeating weekly timetable, in India time. */
@Schema({ collection: 'doctor_schedules', timestamps: true })
export class DoctorSchedule {
  @Prop({ type: Types.ObjectId, required: true })
  doctorUserId: Types.ObjectId;

  @Prop({ type: [WeeklyBlockSchema], default: [] })
  rules: WeeklyBlock[];

  /** India calendar dates (YYYY-MM-DD) with no appointments. */
  @Prop({ type: [String], default: [] })
  daysOff: string[];

  @Prop({ type: [OneOffBlockSchema], default: [] })
  extraBlocks: OneOffBlock[];

  /**
   * Bumped inside every booking transaction for this doctor. Concurrent bookings therefore
   * write-conflict and are retried one after another, which keeps the overlap check reliable
   * even when slots of different lengths could overlap.
   */
  @Prop({ type: Number, default: 0 })
  bookingVersion: number;

  createdAt: Date;
  updatedAt: Date;
}

export type DoctorScheduleDocument = HydratedDocument<DoctorSchedule>;
export const DoctorScheduleSchema = SchemaFactory.createForClass(DoctorSchedule);
DoctorScheduleSchema.index({ doctorUserId: 1 }, { unique: true });
