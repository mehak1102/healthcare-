import type { AvailWhen } from './availability-when';
import type { ConsultationMode } from '../doctors/doctor-profile.schema';

export interface SlotFilterOptions {
  mode?: ConsultationMode;
  availWhen?: AvailWhen;
  /** ISO state code (e.g. `KA`) for `availWhen=public_holiday`. */
  holidayState?: string;
  now?: Date;
}
