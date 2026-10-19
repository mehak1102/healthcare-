import { isPublicHolidayForBooking } from './india-public-holidays';
import type { Slot } from './slots';
import { istDate, istWeekday } from './ist-time';

/** Evening care filter: free slots from 18:00 IST through end of that India calendar day. */
export const TONIGHT_START_MINUTES = 18 * 60;

export const AVAIL_WHEN = ['today', 'tonight', 'weekend', 'public_holiday'] as const;
export type AvailWhen = (typeof AVAIL_WHEN)[number];

const OFFSET_MS = 330 * 60_000;

/** Minutes after midnight IST for an instant. */
export function istMinutesAfterMidnight(instant: Date): number {
  const shifted = new Date(instant.getTime() + OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export function slotMatchesAvailWhen(
  slot: Slot,
  when: AvailWhen,
  now: Date,
  holidayState?: string,
): boolean {
  const date = istDate(slot.startsAt);
  if (when === 'weekend') {
    const day = istWeekday(date);
    return day === 0 || day === 6;
  }
  if (when === 'public_holiday') {
    return isPublicHolidayForBooking(date, holidayState);
  }
  const today = istDate(now);
  if (when === 'today') {
    return date === today;
  }
  if (when === 'tonight') {
    return date === today && istMinutesAfterMidnight(slot.startsAt) >= TONIGHT_START_MINUTES;
  }
  return false;
}

export function firstBookableDate(
  days: { date: string; slots: Slot[] }[],
  now: Date,
  availWhen?: AvailWhen,
  holidayState?: string,
): string | null {
  for (const day of days) {
    const slots = availWhen
      ? day.slots.filter((slot) => slotMatchesAvailWhen(slot, availWhen, now, holidayState))
      : day.slots;
    if (slots.length > 0) return day.date;
  }
  return null;
}
