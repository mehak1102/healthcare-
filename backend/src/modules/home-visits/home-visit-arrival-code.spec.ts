import {
  generateHomeVisitArrivalCode,
  homeVisitArrivalCodesMatch,
  normalizeHomeVisitArrivalCode,
} from './home-visit-arrival-code';

describe('home visit arrival code', () => {
  it('generates six digits', () => {
    const code = generateHomeVisitArrivalCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('normalizes user input', () => {
    expect(normalizeHomeVisitArrivalCode('123456')).toBe('123456');
    expect(normalizeHomeVisitArrivalCode('12 34 56')).toBe('123456');
    expect(normalizeHomeVisitArrivalCode('12345')).toBeNull();
  });

  it('compares codes safely', () => {
    expect(homeVisitArrivalCodesMatch('654321', '654321')).toBe(true);
    expect(homeVisitArrivalCodesMatch('654321', '654322')).toBe(false);
  });
});
