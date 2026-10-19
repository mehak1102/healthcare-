/**
 * India Standard Time is a fixed UTC+05:30 with no daylight saving, so calendar arithmetic can
 * be done by shifting instants instead of pulling in a time-zone database.
 */
export const IST_TIMEZONE = 'Asia/Kolkata';
const OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Calendar date (YYYY-MM-DD) in India for an instant. */
export function istDate(instant: Date): string {
  return new Date(instant.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

export function isValidIstDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** The instant a given India time-of-day occurs on a given India date. */
export function istInstant(date: string, minutesAfterMidnight: number): Date {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) - OFFSET_MS + minutesAfterMidnight * 60_000);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, for an India calendar date. */
export function istWeekday(date: string): number {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay();
}

export function isValidTime(value: string): boolean {
  return TIME.test(value);
}

/** Minutes after midnight for "HH:mm". */
export function minutesOf(time: string): number {
  const match = TIME.exec(time);
  if (!match) throw new Error(`Invalid time "${time}"`);
  return Number(match[1]) * 60 + Number(match[2]);
}
