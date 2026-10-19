/** Escapes user input before it is embedded in a MongoDB `$regex` (prevents ReDoS and operator tricks). */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
