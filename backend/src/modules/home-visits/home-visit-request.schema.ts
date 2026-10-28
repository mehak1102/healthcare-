import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  HOME_VISIT_PILOT_QUOTE_FEE_MINOR,
  HOME_VISIT_PREFERRED_WINDOWS,
  HOME_VISIT_REQUEST_STATUSES,
  type HomeVisitPreferredWindow,
  type HomeVisitRequestStatus,
} from './home-visit-statuses';
import { HomeVisitPayment, HomeVisitPaymentSchema } from './home-visit-payment.schema';

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

  @Prop({
    type: HomeVisitPaymentSchema,
    required: true,
    default: () => ({
      status: 'not_required',
      amountPaise: HOME_VISIT_PILOT_QUOTE_FEE_MINOR,
      orderId: null,
      paymentId: null,
      paidAt: null,
    }),
  })
  payment: HomeVisitPayment;

  @Prop({ type: Date, default: null })
  paymentHoldExpiresAt: Date | null;

  @Prop({ type: Date, default: null })
  enRouteStartedAt: Date | null;

  @Prop({ type: Date, default: null })
  arrivedAt: Date | null;

  /** Patient shows this to the doctor at the door (patient API only). */
  @Prop({ type: String, default: null, match: /^\d{6}$/ })
  arrivalVerificationCode: string | null;

  @Prop({ type: Date, default: null })
  arrivalCodeIssuedAt: Date | null;

  @Prop({ type: Date, default: null })
  arrivalVerifiedAt: Date | null;

  @Prop({ type: Number, default: null })
  destinationLat: number | null;

  @Prop({ type: Number, default: null })
  destinationLng: number | null;

  @Prop({ type: Number, default: null })
  doctorLat: number | null;

  @Prop({ type: Number, default: null })
  doctorLng: number | null;

  @Prop({ type: Date, default: null })
  doctorLocationAt: Date | null;

  /** Google encoded polyline for the driving route (refreshed when doctor marks en route). */
  @Prop({ type: String, default: null, maxlength: 20_000 })
  routePolyline: string | null;
}

export const HomeVisitRequestSchema = SchemaFactory.createForClass(HomeVisitRequest);

HomeVisitRequestSchema.index({ status: 1, createdAt: -1 });
HomeVisitRequestSchema.index({ pinCode: 1, createdAt: -1 });
HomeVisitRequestSchema.index({ patientUserId: 1, createdAt: -1 });
