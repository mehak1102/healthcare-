/** Pilot state codes for regional public holidays (ISO 3166-2:IN). */
export const PILOT_STATE_CODES = ['KA', 'MH', 'TN', 'DL', 'TG'] as const;
export type PilotStateCode = (typeof PILOT_STATE_CODES)[number];

export const STATE_HOLIDAY_REGIONS = PILOT_STATE_CODES.map((code) => `IN-${code}` as const);
export type StateHolidayRegion = (typeof STATE_HOLIDAY_REGIONS)[number];

export const PUBLIC_HOLIDAY_REGIONS = ['IN', ...STATE_HOLIDAY_REGIONS] as const;
export type PublicHolidayRegion = (typeof PUBLIC_HOLIDAY_REGIONS)[number];

export function stateHolidayRegion(code: string): StateHolidayRegion {
  const upper = code.trim().toUpperCase();
  if (!PILOT_STATE_CODES.includes(upper as PilotStateCode)) {
    throw new Error(`Unsupported state code: ${code}`);
  }
  return `IN-${upper}` as StateHolidayRegion;
}

export function isPublicHolidayRegion(value: string): value is PublicHolidayRegion {
  return (PUBLIC_HOLIDAY_REGIONS as readonly string[]).includes(value);
}
