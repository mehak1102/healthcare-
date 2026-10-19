import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ROLES, type Role } from '../access-control/roles';
import { DOCTOR_VERIFICATION_STATUSES, type DoctorVerificationStatus } from './doctor-verification';

export const USER_STATUSES = ['active', 'disabled'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

const MAX_ROLES_PER_USER = 5;

@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ required: true, lowercase: true, trim: true, maxlength: 254 })
  email: string;

  @Prop({ required: true, trim: true, minlength: 2, maxlength: 100 })
  fullName: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({
    type: [{ type: String, enum: ROLES }],
    default: ['patient'],
    validate: {
      validator: (roles: Role[]) => roles.length > 0 && roles.length <= MAX_ROLES_PER_USER,
      message: `a user must have between 1 and ${MAX_ROLES_PER_USER} roles`,
    },
  })
  roles: Role[];

  @Prop({ type: String, enum: USER_STATUSES, default: 'active' })
  status: UserStatus;

  /**
   * Separate from account status and from whether the doctor is available today.
   * Null for anyone who is not a doctor. Missing on older doctor rows means verified.
   */
  @Prop({ type: String, enum: [...DOCTOR_VERIFICATION_STATUSES, null], default: null })
  doctorVerification: DoctorVerificationStatus | null;

  /** Administrator note for a suspension. Never written to logs. */
  @Prop({ type: String, default: null, maxlength: 500 })
  doctorStatusNote: string | null;

  @Prop({ type: Date, default: null })
  emailVerifiedAt: Date | null;

  @Prop({ type: Date, default: null })
  mfaEnrolledAt: Date | null;

  /** Authenticator secret, AES-256-GCM encrypted (see mfa/secret-box.ts). Never plaintext. */
  @Prop({ type: String, default: null, select: false })
  mfaSecret: string | null;

  /** Encrypted secret awaiting its first code during set-up. */
  @Prop({ type: String, default: null, select: false })
  mfaPendingSecret: string | null;

  @Prop({ type: Date, default: null })
  mfaPendingExpiresAt: Date | null;

  /** Highest TOTP time step accepted, so a code cannot be replayed. */
  @Prop({ type: Number, default: null })
  mfaLastUsedStep: number | null;

  /** SHA-256 hashes of unused recovery codes. */
  @Prop({ type: [String], default: [], select: false })
  mfaRecoveryCodeHashes: string[];

  @Prop({ type: Number, default: 0, min: 0 })
  failedLoginCount: number;

  @Prop({ type: Date, default: null })
  lockedUntil: Date | null;

  @Prop({ type: Date, default: null })
  lastLoginAt: Date | null;

  @Prop({ type: Date, required: true })
  passwordChangedAt: Date;

  @Prop({ type: String, required: true, maxlength: 20 })
  termsAcceptedVersion: string;

  @Prop({ type: String, required: true, maxlength: 20 })
  privacyNoticeAcceptedVersion: string;

  @Prop({ type: Date, required: true })
  termsAcceptedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ roles: 1, createdAt: -1 });
UserSchema.index({ doctorVerification: 1 });
