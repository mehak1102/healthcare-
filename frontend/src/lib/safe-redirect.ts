function hasControlCharacters(value: string): boolean {
  return [...value].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f);
}

/** Only same-site relative paths are allowed as post-login destinations (prevents open redirects). */
export function safeRedirectPath(
  candidate: string | null | undefined,
  fallback = '/account',
): string {
  if (!candidate) return fallback;
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.startsWith('/\\')) {
    return fallback;
  }
  if (hasControlCharacters(candidate)) return fallback;
  return candidate;
}

/** Carries a post-sign-in destination between the sign-in and create-account pages. */
export function withNext(path: string, next: string | null | undefined): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}
