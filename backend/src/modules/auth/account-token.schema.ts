import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const ACCOUNT_TOKEN_PURPOSES = ['email_verification', 'password_reset'] as const;
export type AccountTokenPurpose = (typeof ACCOUNT_TOKEN_PURPOSES)[number];

/** Single-use tokens sent by email. Only the SHA-256 hash is stored. */
@Schema({ collection: 'account_tokens', timestamps: { createdAt: true, updatedAt: false } })
export class AccountToken {
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ACCOUNT_TOKEN_PURPOSES })
  purpose: AccountTokenPurpose;

  @Prop({ required: true })
  tokenHash: string;

  /** The address the link was sent to; verification only counts if it still matches. */
  @Prop({ required: true, lowercase: true })
  email: string;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  usedAt: Date | null;

  createdAt: Date;
}

export type AccountTokenDocument = HydratedDocument<AccountToken>;
export const AccountTokenSchema = SchemaFactory.createForClass(AccountToken);
AccountTokenSchema.index({ tokenHash: 1 }, { unique: true });
AccountTokenSchema.index({ userId: 1, purpose: 1 });
AccountTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
