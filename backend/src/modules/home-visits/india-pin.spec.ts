import { normalizeIndiaPin } from './india-pin';

describe('normalizeIndiaPin', () => {
  it('accepts a 6-digit PIN', () => {
    expect(normalizeIndiaPin('110064')).toBe('110064');
    expect(normalizeIndiaPin(' 110 064 ')).toBe('110064');
  });

  it('rejects invalid PINs', () => {
    expect(normalizeIndiaPin('060001')).toBeNull();
    expect(normalizeIndiaPin('56001')).toBeNull();
    expect(normalizeIndiaPin('abcdef')).toBeNull();
  });
});
