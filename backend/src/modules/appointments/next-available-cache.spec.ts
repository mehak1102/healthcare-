import { isNextAvailableCacheFresh } from './next-available-cache';

describe('isNextAvailableCacheFresh', () => {
  it('accepts a future cached date', () => {
    expect(
      isNextAvailableCacheFresh(
        { nextAvailableDate: '2026-10-20', nextAvailableDateAt: new Date() },
        '2026-10-15',
      ),
    ).toBe(true);
  });

  it('rejects a cached date before today', () => {
    expect(
      isNextAvailableCacheFresh(
        { nextAvailableDate: '2026-10-10', nextAvailableDateAt: new Date() },
        '2026-10-15',
      ),
    ).toBe(false);
  });

  it('accepts a null date when the cache timestamp exists', () => {
    expect(
      isNextAvailableCacheFresh(
        { nextAvailableDate: null, nextAvailableDateAt: new Date() },
        '2026-10-15',
      ),
    ).toBe(true);
  });
});
