import { consultationFeeMatch } from './fee-bands';

describe('consultationFeeMatch', () => {
  it('maps bands to fee constraints', () => {
    expect(consultationFeeMatch('free')).toEqual({ consultationFeeInr: 0 });
    expect(consultationFeeMatch('under_500')).toEqual({
      consultationFeeInr: { $ne: null, $lte: 500 },
    });
  });
});
