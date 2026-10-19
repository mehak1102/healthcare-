import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  HOME_VISIT_PREFERRED_WINDOWS,
  HOME_VISIT_REQUEST_STATUSES,
  type HomeVisitPreferredWindow,
  type HomeVisitRequestStatus,
} from './home-visit-statuses';

export type HomeVisitRequestDocument = HydratedDocument<HomeVisitRequest>;

@Schema({ collection: 'home_visit_requests', timestamps: true })
export class HomeVisitRequest {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  patientUserId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  pinCode: string;

  @Prop({ type: String, required: true, trim: true })
  stateCode: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 200 })
  addressLine1: string;

  @Prop({ type: String, trim: true, maxlength: 120 })
  locality: string | null;

  @Prop({ type: String, required: true, trim: true, maxlength: 500 })
  chiefComplaint: string;

  @Prop({ type: String, required: true, enum: HOME_VISIT_PREFERRED_WINDOWS })
  preferredWindow: HomeVisitPreferredWindow;

  @Prop({ type: String, required: true, enum: HOME_VISIT_REQUEST_STATUSES, default: 'requested' })
  status: HomeVisitRequestStatus;

  @Prop({ type: Types.ObjectId, default: null })
  assignedDoctorUserId: Types.ObjectId | null;

  @Prop({ type: Number, required: true })
  quotedFeeMinor: number;

  @Prop({ type: String, required: true, default: 'INR' })
  currency: string;
}

export const HomeVisitRequestSchema = SchemaFactory.createForClass(HomeVisitRequest);

HomeVisitRequestSchema.index({ status: 1, createdAt: -1 });
HomeVisitRequestSchema.index({ pinCode: 1, createdAt: -1 });
HomeVisitRequestSchema.index({ patientUserId: 1, createdAt: -1 });
