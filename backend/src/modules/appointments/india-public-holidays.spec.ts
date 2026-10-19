import {
  applyIndiaPublicHolidayDates,
  applyStatePublicHolidayDates,
  isIndiaPublicHoliday,
  isPublicHolidayForBooking,
  nextIndiaPublicHoliday,
  resetStatePublicHolidayDates,
  useStaticIndiaPublicHolidayDates,
} from './india-public-holidays';

describe('india public holidays', () => {
  afterEach(() => {
    useStaticIndiaPublicHolidayDates();
    resetStatePublicHolidayDates();
  });
  it('recognises listed dates', () => {
    expect(isIndiaPublicHoliday('2026-01-26')).toBe(true);
    expect(isIndiaPublicHoliday('2026-10-15')).toBe(false);
  });

  it('finds the next holiday in a window', () => {
    expect(nextIndiaPublicHoliday('2026-10-01', 5)).toBe('2026-10-02');
    expect(nextIndiaPublicHoliday('2026-10-15', 30)).toBe('2026-11-08');
  });

  it('includes state holidays when a state code is provided', () => {
    applyStatePublicHolidayDates('IN-KA', ['2099-05-01']);
    expect(isPublicHolidayForBooking('2099-05-01', 'KA')).toBe(true);
    expect(isPublicHolidayForBooking('2099-05-01')).toBe(false);
    expect(isPublicHolidayForBooking('2026-01-26', 'KA')).toBe(true);
  });

  it('uses an applied date set until reset', () => {
    applyIndiaPublicHolidayDates(['2099-01-01']);
    expect(isIndiaPublicHoliday('2099-01-01')).toBe(true);
    expect(isIndiaPublicHoliday('2026-01-26')).toBe(false);
  });
});
