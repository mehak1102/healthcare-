import { addDays } from './ist-time';

/**
 * India national (gazetted) public holidays by calendar date (IST).
 * When `public_holidays` has rows for region `IN`, the API loads those instead (see CalendarModule).
 */
export const STATIC_INDIA_PUBLIC_HOLIDAY_DATES = new Set([
  // 2025
  '2025-01-26',
  '2025-03-14',
  '2025-08-15',
  '2025-10-02',
  '2025-10-21',
  '2025-12-25',
  // 2026
  '2026-01-26',
  '2026-03-03',
  '2026-04-03',
  '2026-04-14',
  '2026-08-15',
  '2026-10-02',
  '2026-11-08',
  '2026-12-25',
  // 2027
  '2027-01-26',
  '2027-03-22',
  '2027-08-15',
  '2027-10-02',
  '2027-10-28',
  '2027-12-25',
]);

let activeHolidayDates: Set<string> = STATIC_INDIA_PUBLIC_HOLIDAY_DATES;

export function applyIndiaPublicHolidayDates(dates: Iterable<string>): void {
  activeHolidayDates = new Set(dates);
}

export function useStaticIndiaPublicHolidayDates(): void {
  activeHolidayDates = STATIC_INDIA_PUBLIC_HOLIDAY_DATES;
}

export function isIndiaPublicHoliday(date: string): boolean {
  return activeHolidayDates.has(date);
}

const stateHolidayDates = new Map<string, Set<string>>();

export function resetStatePublicHolidayDates(): void {
  stateHolidayDates.clear();
}

export function applyStatePublicHolidayDates(region: string, dates: Iterable<string>): void {
  stateHolidayDates.set(region, new Set(dates));
}

/** National holiday, or state holiday when `stateCode` is set (e.g. `KA` → `IN-KA`). */
export function isPublicHolidayForBooking(date: string, stateCode?: string | null): boolean {
  if (isIndiaPublicHoliday(date)) return true;
  if (!stateCode) return false;
  const region = `IN-${stateCode.trim().toUpperCase()}`;
  return stateHolidayDates.get(region)?.has(date) ?? false;
}

/** First public holiday in `[from, from + days)`, or null. */
export function nextIndiaPublicHoliday(from: string, days: number): string | null {
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    if (isIndiaPublicHoliday(date)) return date;
  }
  return null;
}
