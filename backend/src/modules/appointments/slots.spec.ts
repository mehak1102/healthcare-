import { addDays, istDate, istInstant, istWeekday, isValidIstDate } from './ist-time';
import { generateSlots, scheduleProblems, type WeeklyRule } from './slots';

const monday = '2026-10-12';
const morning: WeeklyRule = {
  day: 1,
  start: '09:00',
  end: '10:00',
  slotMinutes: 20,
  mode: 'clinic',
};
const longAgo = new Date('2000-01-01T00:00:00Z');

describe('India time helpers', () => {
  it('maps India dates to the right UTC instants', () => {
    expect(istInstant(monday, 0).toISOString()).toBe('2026-10-11T18:30:00.000Z');
    expect(istInstant(monday, 9 * 60).toISOString()).toBe('2026-10-12T03:30:00.000Z');
  });

  it('uses the India calendar date around midnight', () => {
    expect(istDate(new Date('2026-10-11T18:29:59Z'))).toBe('2026-10-11');
    expect(istDate(new Date('2026-10-11T18:30:00Z'))).toBe('2026-10-12');
  });

  it('knows weekdays, month ends and leap days', () => {
    expect(istWeekday(monday)).toBe(1);
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(isValidIstDate('2027-02-29')).toBe(false);
    expect(isValidIstDate('2028-02-29')).toBe(true);
    expect(isValidIstDate('2026-1-01')).toBe(false);
  });
});

describe('scheduleProblems', () => {
  it('accepts a sensible week', () => {
    expect(
      scheduleProblems([morning, { ...morning, start: '10:00', end: '12:00', mode: 'online' }]),
    ).toEqual([]);
  });

  it('rejects overlaps, reversed and too-short blocks', () => {
    const problems = scheduleProblems([
      morning,
      { ...morning, start: '09:40', end: '11:00' },
      { ...morning, day: 2, start: '18:00', end: '17:00' },
      { ...morning, day: 3, start: '09:00', end: '09:10' },
      { ...morning, day: 4, start: '09:03', end: '10:00' },
    ]);
    expect(problems).toHaveLength(4);
    expect(problems.join('\n')).toMatch(/overlaps/);
    expect(problems.join('\n')).toMatch(/end after it starts/);
    expect(problems.join('\n')).toMatch(/shorter than one/);
    expect(problems.join('\n')).toMatch(/5-minute/);
  });
});

describe('generateSlots', () => {
  const base = {
    rules: [morning],
    daysOff: [],
    from: monday,
    days: 1,
    notBefore: longAgo,
    busy: [],
  };

  it('cuts a block into whole slots in India time', () => {
    const [day] = generateSlots(base);
    expect(day!.date).toBe(monday);
    expect(day!.slots.map((s) => s.startsAt.toISOString())).toEqual([
      '2026-10-12T03:30:00.000Z',
      '2026-10-12T03:50:00.000Z',
      '2026-10-12T04:10:00.000Z',
    ]);
  });

  it('drops a final partial slot', () => {
    const [day] = generateSlots({ ...base, rules: [{ ...morning, slotMinutes: 45 }] });
    expect(day!.slots).toHaveLength(1);
  });

  it('only uses rules for the matching weekday and skips days off', () => {
    const week = generateSlots({ ...base, days: 8, daysOff: [addDays(monday, 7)] });
    expect(week.map((d) => d.slots.length)).toEqual([3, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('hides slots before the notice period and slots that overlap busy time', () => {
    const [day] = generateSlots({
      ...base,
      notBefore: new Date('2026-10-12T03:31:00Z'),
      busy: [
        // A 30-minute booking from an older timetable overlaps the 09:40 slot only.
        { startsAt: new Date('2026-10-12T04:10:00Z'), endsAt: new Date('2026-10-12T04:40:00Z') },
      ],
    });
    expect(day!.slots.map((s) => s.startsAt.toISOString())).toEqual(['2026-10-12T03:50:00.000Z']);
  });

  it('can be limited to some consultation modes', () => {
    const rules: WeeklyRule[] = [
      morning,
      { ...morning, start: '10:00', end: '11:00', mode: 'online' },
    ];
    const [day] = generateSlots({ ...base, rules, modes: ['clinic'] });
    expect(day!.slots.every((s) => s.mode === 'clinic')).toBe(true);
    expect(day!.slots).toHaveLength(3);
  });

  it('adds one-off extra hours on a date without a weekly rule', () => {
    const tuesday = '2026-10-13';
    const [day] = generateSlots({
      ...base,
      from: tuesday,
      extraBlocks: [
        { date: tuesday, start: '14:00', end: '15:00', slotMinutes: 20, mode: 'clinic' },
      ],
    });
    expect(day!.slots).toHaveLength(3);
  });
});
