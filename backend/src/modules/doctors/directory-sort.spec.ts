import { compareByNextAvailableDate } from './directory-sort';

describe('compareByNextAvailableDate', () => {
  const doc = (slug: string, displayName: string) => ({ slug, displayName });

  it('orders earlier dates first', () => {
    const dates = new Map([
      ['a', '2026-10-20'],
      ['b', '2026-10-15'],
    ]);
    expect(
      compareByNextAvailableDate(doc('a', 'Zara'), doc('b', 'Anita'), (s) => dates.get(s)),
    ).toBeGreaterThan(0);
  });
});
