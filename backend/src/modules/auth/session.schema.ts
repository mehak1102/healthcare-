import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'sessions', timestamps: { createdAt: true, updatedAt: false } })
export class Session {
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  /** SHA-256 of the cookie token. The raw token is never stored. */
  @Prop({ required: true })
  tokenHash: string;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Date, required: true })
  idleExpiresAt: Date;

  @Prop({ type: Date, required: true })
  lastSeenAt: Date;

  @Prop({ type: Date, default: null })
  revokedAt: Date | null;

  /** Password accepted but the second step is outstanding. Grants nothing except the challenge. */
  @Prop({ type: Boolean, default: false })
  mfaPending: boolean;

  /** When this session passed two-step verification (null if it never did). */
  @Prop({ type: Date, default: null })
  mfaVerifiedAt: Date | null;

  @Prop({ type: String, default: '', maxlength: 256 })
  userAgent: string;

  @Prop({ type: String, default: '', maxlength: 64 })
  ipAddress: string;

  createdAt: Date;
}

export type SessionDocument = HydratedDocument<Session>;
export const SessionSchema = SchemaFactory.createForClass(Session);
SessionSchema.index({ tokenHash: 1 }, { unique: true });
SessionSchema.index({ userId: 1, revokedAt: 1 });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
