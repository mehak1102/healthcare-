import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const AUDIT_OUTCOMES = ['success', 'failure', 'denied'] as const;
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

/** Small scalar context only. Never put names, contact details, medical data or secrets here. */
export type AuditMetadata = Record<string, string | number | boolean | null>;

@Schema({ collection: 'audit_events', timestamps: { createdAt: true, updatedAt: false } })
export class AuditEvent {
  @Prop({ required: true, maxlength: 100 })
  action: string;

  @Prop({ type: String, required: true, enum: AUDIT_OUTCOMES })
  outcome: AuditOutcome;

  @Prop({ type: Types.ObjectId, default: null })
  actorUserId: Types.ObjectId | null;

  @Prop({ type: String, default: null, maxlength: 50 })
  targetType: string | null;

  @Prop({ type: String, default: null, maxlength: 100 })
  targetId: string | null;

  @Prop({ type: String, default: '', maxlength: 64 })
  requestId: string;

  @Prop({ type: String, default: '', maxlength: 64 })
  ipAddress: string;

  @Prop({ type: Object, default: {} })
  metadata: AuditMetadata;

  createdAt: Date;
}

export type AuditEventDocument = HydratedDocument<AuditEvent>;
export const AuditEventSchema = SchemaFactory.createForClass(AuditEvent);
AuditEventSchema.index({ createdAt: -1 });
AuditEventSchema.index({ actorUserId: 1, createdAt: -1 });
AuditEventSchema.index({ action: 1, createdAt: -1 });
