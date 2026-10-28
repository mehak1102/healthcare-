import { randomInt, timingSafeEqual } from 'node:crypto';

/** Six-digit code the patient shows the doctor at the door. */
export function generateHomeVisitArrivalCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

export function normalizeHomeVisitArrivalCode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 6) return null;
  return digits;
}

export function homeVisitArrivalCodesMatch(stored: string, submitted: string): boolean {
  const a = Buffer.from(stored, 'utf8');
  const b = Buffer.from(submitted, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
