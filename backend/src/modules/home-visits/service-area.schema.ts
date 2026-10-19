import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** Pilot service geography for doctor-at-home (pin-level; polygons later). */
@Schema({ collection: 'service_areas', timestamps: true })
export class ServiceArea {
  @Prop({ required: true, trim: true, match: /^[1-9]\d{5}$/ })
  pinCode: string;

  @Prop({ required: true, trim: true, uppercase: true, maxlength: 2 })
  stateCode: string;

  @Prop({ type: String, trim: true, maxlength: 80, default: null })
  label: string | null;

  /** When false, the pin is stored but not offered for home visits yet. */
  @Prop({ type: Boolean, default: true })
  active: boolean;
}

export type ServiceAreaDocument = HydratedDocument<ServiceArea>;

export const ServiceAreaSchema = SchemaFactory.createForClass(ServiceArea);
ServiceAreaSchema.index({ pinCode: 1 }, { unique: true });
