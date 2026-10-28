import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const CONSULTATION_MODES = ['online', 'clinic'] as const;
export type ConsultationMode = (typeof CONSULTATION_MODES)[number];

/** Whether the doctor is taking new bookings. Not the same as verification. */
export const AVAILABILITY_STATUSES = ['available', 'unavailable', 'busy', 'on_leave'] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

/** Older profiles have no stored value and keep accepting bookings. */
export function acceptsNewBookings(status: AvailabilityStatus | null | undefined): boolean {
  return status == null || status === 'available';
}

/** When true (default), paid or free bookings wait for the doctor to accept before video or visit. */
export function requiresBookingApproval(
  profile: { requiresBookingApproval?: boolean | null },
): boolean {
  return profile.requiresBookingApproval !== false;
}

export function shownAvailability(
  status: AvailabilityStatus | null | undefined,
): AvailabilityStatus {
  return status ?? 'available';
}

export const LANGUAGES = [
  'English',
  'Hindi',
  'Assamese',
  'Bengali',
  'Gujarati',
  'Kannada',
  'Malayalam',
  'Marathi',
  'Odia',
  'Punjabi',
  'Tamil',
  'Telugu',
  'Urdu',
] as const;
export type Language = (typeof LANGUAGES)[number];

/**
 * A doctor's public listing. Created as an unpublished draft when their application is approved.
 * Name, specialty, qualification and registration come from the reviewed application and cannot
 * be edited by the doctor; everything else is theirs to fill in.
 */
@Schema({ collection: 'doctor_profiles', timestamps: true })
export class DoctorProfile {
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  applicationId: Types.ObjectId;

  @Prop({ required: true })
  slug: string;

  // Reviewed fields (copied from the approved application).
  @Prop({ required: true, trim: true, maxlength: 100 })
  displayName: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  specialty: string;

  /** Lower-cased specialty, for exact filtering. */
  @Prop({ required: true })
  specialtyKey: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  qualification: string;

  @Prop({ required: true, trim: true, maxlength: 30 })
  registrationNumber: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  registrationCouncil: string;

  @Prop({ required: true })
  registrationYear: number;

  /** When a reviewer approved the registration. Null on a draft that is still unverified. */
  @Prop({ type: Date, default: null })
  registrationCheckedAt: Date | null;

  // Doctor-managed fields.
  @Prop({ type: String, default: '', maxlength: 1500 })
  bio: string;

  @Prop({ type: [String], enum: LANGUAGES, default: [] })
  languages: Language[];

  @Prop({ type: [String], enum: CONSULTATION_MODES, default: [] })
  consultationModes: ConsultationMode[];

  /** Whole rupees. */
  @Prop({ type: Number, default: null, min: 0, max: 50_000 })
  consultationFeeInr: number | null;

  @Prop({ type: String, default: null, maxlength: 120 })
  clinicName: string | null;

  @Prop({ type: String, default: null, maxlength: 60 })
  city: string | null;

  /** Lower-cased city, for exact filtering. */
  @Prop({ type: String, default: null })
  cityKey: string | null;

  @Prop({ type: String, default: null, maxlength: 80 })
  locality: string | null;

  /**
   * Pilot home-visit geography: doctors only receive dispatch offers for patient PINs that match
   * this code (ops can still override). Not the same as clinic address text.
   */
  @Prop({ type: String, default: null, match: /^[1-9]\d{5}$/ })
  homeVisitServicePinCode: string | null;

  /** Whole rupees for a home visit in the doctor’s service PIN. Shown to patients when booking. */
  @Prop({ type: Number, default: null, min: 0, max: 50_000 })
  homeVisitFeeInr: number | null;

  @Prop({ type: String, enum: AVAILABILITY_STATUSES, default: 'unavailable' })
  availabilityStatus: AvailabilityStatus;

  @Prop({ type: Boolean, default: true })
  requiresBookingApproval: boolean;

  @Prop({ type: Boolean, default: false })
  published: boolean;

  @Prop({ type: Date, default: null })
  publishedAt: Date | null;

  /** First bookable IST date in the window; refreshed when the timetable or bookings change. */
  @Prop({ type: String, default: null })
  nextAvailableDate: string | null;

  @Prop({ type: Date, default: null })
  nextAvailableDateAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export type DoctorProfileDocument = HydratedDocument<DoctorProfile>;
export const DoctorProfileSchema = SchemaFactory.createForClass(DoctorProfile);
DoctorProfileSchema.index({ userId: 1 }, { unique: true });
DoctorProfileSchema.index({ slug: 1 }, { unique: true });
DoctorProfileSchema.index({ published: 1, specialtyKey: 1, cityKey: 1 });
DoctorProfileSchema.index({ availabilityStatus: 1, published: 1 });
