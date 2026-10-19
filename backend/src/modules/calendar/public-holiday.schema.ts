import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { PublicHolidayRegion } from './holiday-regions';

export type { PublicHolidayRegion } from './holiday-regions';
export { PUBLIC_HOLIDAY_REGIONS, PILOT_STATE_CODES } from './holiday-regions';

@Schema({ collection: 'public_holidays', timestamps: true })
export class PublicHoliday {
  /** Calendar date in IST, `YYYY-MM-DD`. */
  @Prop({ required: true, trim: true, match: /^\d{4}-\d{2}-\d{2}$/ })
  date: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  /** `IN` = national; `IN-KA` etc. for pilot states. */
  @Prop({ type: String, required: true, trim: true, default: 'IN', maxlength: 6 })
  region: PublicHolidayRegion;
}

export type PublicHolidayDocument = HydratedDocument<PublicHoliday>;

export const PublicHolidaySchema = SchemaFactory.createForClass(PublicHoliday);
PublicHolidaySchema.index({ region: 1, date: 1 }, { unique: true });
