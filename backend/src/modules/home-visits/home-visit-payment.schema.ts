import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PAYMENT_STATUSES, type PaymentStatus } from '../appointments/appointment.schema';

@Schema({ _id: false })
export class HomeVisitPayment {
  @Prop({ type: String, required: true, enum: PAYMENT_STATUSES, default: 'not_required' })
  status: PaymentStatus;

  @Prop({ required: true, min: 0 })
  amountPaise: number;

  @Prop({ type: String, default: null })
  orderId: string | null;

  @Prop({ type: String, default: null })
  paymentId: string | null;

  @Prop({ type: Date, default: null })
  paidAt: Date | null;
}

export const HomeVisitPaymentSchema = SchemaFactory.createForClass(HomeVisitPayment);
