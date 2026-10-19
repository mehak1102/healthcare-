import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** Webhook deliveries already handled, so retries from the provider are not processed twice. */
@Schema({ collection: 'payment_webhook_events', timestamps: { createdAt: true, updatedAt: false } })
export class PaymentWebhookEvent {
  @Prop({ required: true })
  eventId: string;

  @Prop({ required: true })
  event: string;

  createdAt: Date;
}

export type PaymentWebhookEventDocument = HydratedDocument<PaymentWebhookEvent>;
export const PaymentWebhookEventSchema = SchemaFactory.createForClass(PaymentWebhookEvent);
PaymentWebhookEventSchema.index({ eventId: 1 }, { unique: true });
PaymentWebhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
