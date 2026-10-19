import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { DISPATCH_OFFER_STATUSES, type DispatchOfferStatus } from './home-visit-statuses';

export type DispatchOfferDocument = HydratedDocument<DispatchOffer>;

@Schema({ collection: 'dispatch_offers', timestamps: true })
export class DispatchOffer {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  homeVisitRequestId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  doctorUserId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: DISPATCH_OFFER_STATUSES, default: 'offered' })
  status: DispatchOfferStatus;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  respondedAt: Date | null;
}

export const DispatchOfferSchema = SchemaFactory.createForClass(DispatchOffer);

DispatchOfferSchema.index({ homeVisitRequestId: 1, status: 1 });
DispatchOfferSchema.index({ doctorUserId: 1, status: 1, expiresAt: 1 });
