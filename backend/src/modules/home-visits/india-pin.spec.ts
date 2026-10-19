import { normalizeIndiaPin } from './india-pin';

describe('normalizeIndiaPin', () => {
  it('accepts a 6-digit PIN', () => {
    expect(normalizeIndiaPin('560001')).toBe('560001');
    expect(normalizeIndiaPin(' 560 001 ')).toBe('560001');
  });

  it('rejects invalid PINs', () => {
    expect(normalizeIndiaPin('060001')).toBeNull();
    expect(normalizeIndiaPin('56001')).toBeNull();
    expect(normalizeIndiaPin('abcdef')).toBeNull();
  });
});
