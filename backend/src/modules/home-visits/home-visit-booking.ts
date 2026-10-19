import type { Env } from '../../config/env.schema';
import { HOME_VISIT_MESSAGE } from './home-visits.constants';

export function isHomeVisitBookingOpen(env: Env): boolean {
  return env.HOME_VISIT_BOOKING_OPEN;
}

export function homeVisitBookingClosedMessage(): string {
  return HOME_VISIT_MESSAGE;
}
