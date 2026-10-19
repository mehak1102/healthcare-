/** India postal PIN: six digits, first digit 1–9. */
export function normalizeIndiaPin(raw: string): string | null {
  const digits = raw.trim().replace(/\s/g, '');
  if (!/^[1-9]\d{5}$/.test(digits)) return null;
  return digits;
}
