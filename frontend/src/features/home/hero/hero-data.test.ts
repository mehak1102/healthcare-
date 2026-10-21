import { describe, expect, it } from 'vitest';
import type { DoctorCard } from '@/features/doctors/api';
import { liveSuggestions, matchLiveSpecialties } from './hero-data';

const live = ['General physician', 'Dermatology', 'Paediatrics'];

describe('matchLiveSpecialties', () => {
  it('uses live specialty names for an empty query', () => {
    expect(matchLiveSpecialties('', live).map((item) => item.name)).toEqual(live);
  });

  it('maps a symptom onto a live specialty', () => {
    const matched = matchLiveSpecialties('headache', live);
    expect(matched.some((item) => item.name === 'General physician' && item.via === 'symptom')).toBe(
      true,
    );
  });
});

describe('liveSuggestions', () => {
  it('includes real doctors from the directory payload', () => {
    const doctors = [
      {
        slug: 'ananya-rao',
        displayName: 'Ananya Rao',
        specialty: 'General physician',
        city: 'Bengaluru',
      },
    ] as DoctorCard[];
    const groups = liveSuggestions({
      query: 'Ananya',
      liveSpecialties: live,
      doctors,
      lang: 'en',
      mode: 'clinic',
      labels: {
        popularSearches: 'Popular searches',
        specialties: 'Specialties',
        doctors: 'Doctors',
        suggestedFor: (q) => q,
        symptomPrefix: 'For: ',
      },
    });
    const doctorRow = groups.flatMap((group) => group.items).find((item) => item.kind === 'doctor');
    expect(doctorRow?.href).toBe('/doctors/ananya-rao');
    expect(doctorRow?.title).toBe('Ananya Rao');
  });
});
