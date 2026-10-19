import { firstBookableDate, slotMatchesAvailWhen } from './availability-when';
import { istInstant } from './ist-time';
import type { Slot } from './slots';

const slotAt = (date: string, time: string): Slot => {
  const [h, m] = time.split(':').map(Number);
  const startsAt = istInstant(date, h * 60 + m);
  return { startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60_000), mode: 'clinic' };
};

describe('slotMatchesAvailWhen', () => {
  const fridayAfternoon = new Date('2026-10-16T10:00:00.000Z'); // 15:30 IST Fri 16? check: 10 UTC = 15:30 IST

  it('matches any slot today for today', () => {
    const now = new Date('2026-10-15T08:00:00.000Z');
    expect(slotMatchesAvailWhen(slotAt('2026-10-15', '14:00'), 'today', now)).toBe(true);
    expect(slotMatchesAvailWhen(slotAt('2026-10-16', '14:00'), 'today', now)).toBe(false);
  });

  it('matches evening slots on the same India day for tonight', () => {
    const now = new Date('2026-10-15T08:00:00.000Z'); // 13:30 IST Wed 15 Oct 2026
    expect(slotMatchesAvailWhen(slotAt('2026-10-15', '19:00'), 'tonight', now)).toBe(true);
    expect(slotMatchesAvailWhen(slotAt('2026-10-15', '17:30'), 'tonight', now)).toBe(false);
    expect(slotMatchesAvailWhen(slotAt('2026-10-16', '19:00'), 'tonight', now)).toBe(false);
  });

  it('matches gazetted India holidays for public_holiday', () => {
    const now = new Date('2026-10-01T08:00:00.000Z');
    expect(slotMatchesAvailWhen(slotAt('2026-10-02', '10:00'), 'public_holiday', now)).toBe(true);
    expect(slotMatchesAvailWhen(slotAt('2026-10-03', '10:00'), 'public_holiday', now)).toBe(false);
  });

  it('matches Saturday and Sunday for weekend', () => {
    const now = fridayAfternoon;
    expect(slotMatchesAvailWhen(slotAt('2026-10-17', '10:00'), 'weekend', now)).toBe(true); // Sat
    expect(slotMatchesAvailWhen(slotAt('2026-10-18', '10:00'), 'weekend', now)).toBe(true); // Sun
    expect(slotMatchesAvailWhen(slotAt('2026-10-16', '10:00'), 'weekend', now)).toBe(false); // Fri
  });
});

describe('firstBookableDate', () => {
  it('returns the first day with a matching slot when availWhen is set', () => {
    const now = new Date('2026-10-15T08:00:00.000Z');
    const days = [
      {
        date: '2026-10-15',
        slots: [slotAt('2026-10-15', '10:00'), slotAt('2026-10-15', '19:00')],
      },
    ];
    expect(firstBookableDate(days, now, 'tonight')).toBe('2026-10-15');
  });
});
