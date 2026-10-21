import type { ConsultationMode, DoctorCard } from '@/features/doctors/api';
import type { ConsultMode, HeroLang } from './hero-copy';
import type { SuggestionRow } from './suggestions-dropdown';

/** Symptom keywords used only to map a typed query onto live specialty names from the API. */
const SPECIALTY_HINTS: { match: RegExp; keywords: string[] }[] = [
  {
    match: /general|physician|चिकित्सक/i,
    keywords: [
      'fever',
      'cold',
      'cough',
      'headache',
      'body pain',
      'weakness',
      'bukhar',
      'sardi',
      'khansi',
      'बुखार',
      'सिरदर्द',
      'खांसी',
    ],
  },
  {
    match: /derma|skin|त्वचा/i,
    keywords: ['skin', 'acne', 'pimple', 'hair fall', 'rash', 'itching', 'त्वचा', 'मुंहासे', 'बाल'],
  },
  {
    match: /paed|pediatr|child|बाल/i,
    keywords: ['child', 'baby', 'kid', 'vaccination', 'बच्चा', 'टीका'],
  },
  {
    match: /gynae|gyneco|obstet|स्त्री/i,
    keywords: ['period', 'pregnancy', 'pcos', 'pcod', 'women', 'पीरियड', 'गर्भावस्था'],
  },
  {
    match: /mental|psych|mind|मानसिक/i,
    keywords: ['anxiety', 'stress', 'sleep', 'depression', 'तनाव', 'नींद', 'चिंता'],
  },
  {
    match: /ortho|bone|हड्डी/i,
    keywords: ['back pain', 'knee', 'joint', 'fracture', 'कमर दर्द', 'घुटना', 'जोड़'],
  },
  {
    match: /dent|tooth|दंत|दांत/i,
    keywords: ['tooth', 'teeth', 'dental', 'gum', 'दांत'],
  },
  {
    match: /ent|ear|throat|नाक|कान|गला/i,
    keywords: ['ear', 'throat', 'sinus', 'nose', 'कान', 'गला'],
  },
];

export function consultApiMode(mode: ConsultMode): ConsultationMode {
  return mode === 'video' ? 'online' : 'clinic';
}

export function initialsFromName(name: string) {
  return name
    .replace(/^dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function hintsFor(specialty: string) {
  return SPECIALTY_HINTS.find((item) => item.match.test(specialty))?.keywords ?? [];
}

export function matchLiveSpecialties(query: string, live: string[]) {
  const q = query.trim().toLowerCase();
  if (!q) return live.slice(0, 5).map((name) => ({ name, via: 'popular' as const, keyword: '' }));

  const byName = live.filter((name) => name.toLowerCase().includes(q));
  if (byName.length) return byName.map((name) => ({ name, via: 'name' as const, keyword: '' }));

  return live
    .map((name) => {
      const keyword = hintsFor(name).find(
        (word) => word.toLowerCase().includes(q) || q.includes(word.toLowerCase()),
      );
      return keyword ? { name, via: 'symptom' as const, keyword } : null;
    })
    .filter((item): item is { name: string; via: 'symptom'; keyword: string } => Boolean(item));
}

export function liveSuggestions(input: {
  query: string;
  liveSpecialties: string[];
  doctors: DoctorCard[];
  lang: HeroLang;
  mode: ConsultMode;
  labels: {
    popularSearches: string;
    specialties: string;
    doctors: string;
    suggestedFor: (q: string) => string;
    symptomPrefix: string;
  };
}): { group: string; items: SuggestionRow[] }[] {
  const { query, liveSpecialties, doctors, labels, mode } = input;
  const modeLine = mode === 'video' ? 'Video consult' : 'In-clinic';
  const matched = matchLiveSpecialties(query, liveSpecialties);
  const groups: { group: string; items: SuggestionRow[] }[] = [];
  const q = query.trim();

  if (matched.length) {
    const viaSymptom = Boolean(q) && matched.every((item) => item.via === 'symptom');
    groups.push({
      group: !q ? labels.popularSearches : viaSymptom ? labels.suggestedFor(q) : labels.specialties,
      items: matched.map((item) => ({
        id: `spec-${item.name}`,
        kind: viaSymptom ? 'symptom' : 'specialty',
        title: item.name,
        subtitle: viaSymptom ? `${labels.symptomPrefix}${item.keyword}` : item.name,
        initials: item.name.slice(0, 1),
        fill: item.name,
        href: `/doctors?specialty=${encodeURIComponent(item.name)}&takingBookings=1`,
      })),
    });
  }

  if (doctors.length) {
    groups.push({
      group: labels.doctors,
      items: doctors.slice(0, 5).map((doc) => ({
        id: `doc-${doc.slug}`,
        kind: 'doctor',
        title: doc.displayName,
        subtitle: `${doc.specialty} · ${modeLine}${doc.city ? ` · ${doc.city}` : ''}`,
        initials: initialsFromName(doc.displayName),
        fill: doc.displayName,
        href: `/doctors/${encodeURIComponent(doc.slug)}`,
      })),
    });
  }

  return groups;
}
