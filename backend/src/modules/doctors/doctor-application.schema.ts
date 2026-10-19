import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const DOCTOR_APPLICATION_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type DoctorApplicationStatus = (typeof DOCTOR_APPLICATION_STATUSES)[number];

/**
 * A request to be listed and act as a doctor. Nothing here is trusted until a reviewer with
 * `providers:verify` has checked it against the official medical register and approved it.
 */
@Schema({ collection: 'doctor_applications', timestamps: true })
export class DoctorApplication {
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: DOCTOR_APPLICATION_STATUSES, default: 'pending' })
  status: DoctorApplicationStatus;

  @Prop({ required: true, trim: true, maxlength: 30 })
  registrationNumber: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  registrationCouncil: string;

  @Prop({ required: true, min: 1950 })
  registrationYear: number;

  @Prop({ required: true, trim: true, maxlength: 120 })
  qualification: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  specialty: string;

  /** Normalised council + number, so one registration cannot back two live applications. */
  @Prop({ required: true })
  registrationKey: string;

  /** True while pending or approved; the uniqueness rule only applies to these. */
  @Prop({ type: Boolean, default: true })
  claimsRegistration: boolean;

  @Prop({ type: Types.ObjectId, default: null })
  reviewedBy: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  reviewedAt: Date | null;

  /** Shown to the applicant. */
  @Prop({ type: String, default: null, maxlength: 500 })
  rejectionReason: string | null;

  /** Internal reviewer note; never shown to the applicant. */
  @Prop({ type: String, default: null, maxlength: 500 })
  reviewNote: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export type DoctorApplicationDocument = HydratedDocument<DoctorApplication>;
export const DoctorApplicationSchema = SchemaFactory.createForClass(DoctorApplication);
DoctorApplicationSchema.index({ userId: 1, createdAt: -1 });
DoctorApplicationSchema.index({ status: 1, createdAt: 1 });
DoctorApplicationSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' }, name: 'one_pending_per_user' },
);
DoctorApplicationSchema.index(
  { registrationKey: 1 },
  {
    unique: true,
    partialFilterExpression: { claimsRegistration: true },
    name: 'one_live_application_per_registration',
  },
);
