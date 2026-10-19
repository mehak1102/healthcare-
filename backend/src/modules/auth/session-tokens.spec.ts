import {
  csrfTokenMatches,
  deriveCsrfToken,
  generateSessionToken,
  hashSessionToken,
  isWellFormedSessionToken,
} from './session-tokens';

describe('session tokens', () => {
  it('generates unique, well-formed 256-bit tokens', () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toEqual(b);
    expect(isWellFormedSessionToken(a)).toBe(true);
    expect(isWellFormedSessionToken('short')).toBe(false);
    expect(isWellFormedSessionToken({ $ne: null })).toBe(false);
  });

  it('stores only a one-way hash', () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken(token)).not.toContain(token);
  });

  it('binds CSRF tokens to both the session and the server secret', () => {
    const secret = 's'.repeat(40);
    const hash = hashSessionToken(generateSessionToken());
    const token = deriveCsrfToken(secret, hash);

    expect(csrfTokenMatches(secret, hash, token)).toBe(true);
    expect(csrfTokenMatches(secret, hashSessionToken(generateSessionToken()), token)).toBe(false);
    expect(csrfTokenMatches('t'.repeat(40), hash, token)).toBe(false);
    expect(csrfTokenMatches(secret, hash, undefined)).toBe(false);
    expect(csrfTokenMatches(secret, hash, `${token}x`)).toBe(false);
  });
});
