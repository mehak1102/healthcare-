import type { DoctorProfileDocument } from '../doctors/doctor-profile.schema';

/** Cached first bookable IST date is usable for directory cards (not mode-specific). */
export function isNextAvailableCacheFresh(
  profile: Pick<DoctorProfileDocument, 'nextAvailableDate' | 'nextAvailableDateAt'>,
  today: string,
): boolean {
  if (!profile.nextAvailableDateAt) return false;
  if (profile.nextAvailableDate === null) return true;
  return profile.nextAvailableDate >= today;
}
