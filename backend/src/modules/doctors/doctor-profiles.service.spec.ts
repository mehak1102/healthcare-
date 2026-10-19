import { missingForPublish, slugFor } from './doctor-profiles.service';

describe('slugFor', () => {
  it('builds a readable, unique-suffixed slug without a duplicated title', () => {
    expect(slugFor('Dr. Meera Iyer')).toMatch(/^dr-meera-iyer-[a-f0-9]{6}$/);
    expect(slugFor('Zoë  D’Souza')).toMatch(/^dr-zoe-d-souza-[a-f0-9]{6}$/);
    expect(slugFor('डॉ')).toMatch(/^dr-doctor-[a-f0-9]{6}$/);
    expect(slugFor('Meera Iyer')).not.toBe(slugFor('Meera Iyer'));
  });
});

describe('missingForPublish', () => {
  const complete = {
    bio: 'x'.repeat(50),
    languages: ['English'],
    consultationModes: ['online'],
    consultationFeeInr: 0,
    clinicName: null,
    city: null,
  };

  it('accepts a complete online-only profile, including a free consultation', () => {
    expect(missingForPublish(complete)).toEqual([]);
  });

  it('asks for clinic details only when in-clinic visits are offered', () => {
    expect(missingForPublish({ ...complete, consultationModes: ['clinic'] })).toEqual([
      'the clinic name',
      'the clinic city',
    ]);
  });

  it('lists everything missing from an empty draft', () => {
    expect(
      missingForPublish({
        bio: '   ',
        languages: [],
        consultationModes: [],
        consultationFeeInr: null,
        clinicName: null,
        city: null,
      }),
    ).toHaveLength(4);
  });
});
