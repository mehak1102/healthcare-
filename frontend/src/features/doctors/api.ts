import { apiRequest } from '@/lib/api-client';

export type DoctorApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface DoctorApplicationInput {
  registrationNumber: string;
  registrationCouncil: string;
  registrationYear: number;
  qualification: string;
  specialty: string;
}

export interface DoctorApplication extends DoctorApplicationInput {
  id: string;
  status: DoctorApplicationStatus;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

export interface AdminDoctorApplication extends DoctorApplication {
  reviewNote: string | null;
  applicant: { id: string; fullName: string; email: string; emailVerified: boolean } | null;
}

export interface AdminDoctorApplicationPage {
  items: AdminDoctorApplication[];
  page: number;
  limit: number;
  total: number;
}

export const LANGUAGES = [
  'English',
  'Hindi',
  'Assamese',
  'Bengali',
  'Gujarati',
  'Kannada',
  'Malayalam',
  'Marathi',
  'Odia',
  'Punjabi',
  'Tamil',
  'Telugu',
  'Urdu',
] as const;
export type Language = (typeof LANGUAGES)[number];

export const CONSULTATION_MODES = ['online', 'clinic'] as const;
export type ConsultationMode = (typeof CONSULTATION_MODES)[number];
export const MODE_LABELS: Record<ConsultationMode, string> = {
  online: 'Video consultation',
  clinic: 'In-clinic visit',
};

export type AvailabilityStatus = 'available' | 'unavailable' | 'busy' | 'on_leave';

export const AVAIL_WHEN = ['today', 'tonight', 'weekend', 'public_holiday'] as const;
export type AvailWhen = (typeof AVAIL_WHEN)[number];

export const FEE_BANDS = ['free', 'under_500', 'under_1000', 'under_2000'] as const;
export type FeeBand = (typeof FEE_BANDS)[number];

export const DIRECTORY_SORTS = ['name', 'next_available'] as const;
export type DirectorySort = (typeof DIRECTORY_SORTS)[number];

export const DIRECTORY_SORT_LABELS: Record<DirectorySort, string> = {
  name: 'Name (A–Z)',
  next_available: 'Soonest appointment',
};

export const FEE_BAND_LABELS: Record<FeeBand, string> = {
  free: 'Free only',
  under_500: 'Up to ₹500',
  under_1000: 'Up to ₹1,000',
  under_2000: 'Up to ₹2,000',
};

export const PILOT_STATE_CODES = ['KA', 'MH', 'TN', 'DL', 'TG'] as const;
export type PilotStateCode = (typeof PILOT_STATE_CODES)[number];

export const PILOT_STATE_LABELS: Record<PilotStateCode, string> = {
  KA: 'Karnataka',
  MH: 'Maharashtra',
  TN: 'Tamil Nadu',
  DL: 'Delhi',
  TG: 'Telangana',
};

export const AVAIL_WHEN_LABELS: Record<AvailWhen, string> = {
  today: 'Today (IST)',
  tonight: 'Tonight (from 6 pm IST)',
  weekend: 'This weekend',
  public_holiday: 'On a public holiday',
};

export interface DoctorCard {
  slug: string;
  displayName: string;
  specialty: string;
  qualification: string;
  registrationYear: number;
  languages: Language[];
  consultationModes: ConsultationMode[];
  consultationFeeInr: number | null;
  clinicName: string | null;
  city: string | null;
  locality: string | null;
  availabilityStatus?: AvailabilityStatus;
  nextAvailableDate?: string | null;
}

export interface DoctorPublicProfile extends DoctorCard {
  bio: string;
  registrationNumber: string;
  registrationCouncil: string;
  registrationCheckedAt: string | null;
}

export interface MyDoctorProfile extends DoctorPublicProfile {
  requiresBookingApproval: boolean;
  published: boolean;
  publishedAt: string | null;
  missing: string[];
}

export interface DoctorProfileInput {
  bio: string;
  languages: Language[];
  consultationModes: ConsultationMode[];
  consultationFeeInr: number | null;
  clinicName: string | null;
  city: string | null;
  locality: string | null;
  requiresBookingApproval?: boolean;
  published: boolean;
}

export interface DirectoryQuery {
  specialty?: string;
  city?: string;
  mode?: string;
  language?: string;
  q?: string;
  takingBookings?: boolean;
  hasOpenSlots?: boolean;
  availWhen?: AvailWhen;
  holidayState?: PilotStateCode;
  feeBand?: FeeBand;
  sort?: DirectorySort;
  page: number;
}

export interface DoctorDirectoryPage {
  items: DoctorCard[];
  page: number;
  limit: number;
  total: number;
}

export const MY_APPLICATION_KEY = ['doctor-application', 'me'] as const;
export const MY_PROFILE_KEY = ['doctor-profile', 'me'] as const;

/** Adds the "Dr." title unless the stored name already has it. */
export const doctorName = (name: string) => (/^dr\.?\s/i.test(name) ? name : `Dr. ${name}`);

export const formatFee = (fee: number | null) =>
  fee === null
    ? null
    : fee === 0
      ? 'Free consultation'
      : `₹${new Intl.NumberFormat('en-IN').format(fee)} consultation fee`;

export const doctorsApi = {
  myApplication: () =>
    apiRequest<{ application: DoctorApplication | null }>('/doctor-applications/me'),
  apply: (input: DoctorApplicationInput) =>
    apiRequest<DoctorApplication>('/doctor-applications', { method: 'POST', body: input }),
  updateApplication: (input: DoctorApplicationInput) =>
    apiRequest<DoctorApplication>('/doctor-applications/me', { method: 'PUT', body: input }),
  setAvailability: (availabilityStatus: AvailabilityStatus) =>
    apiRequest<MyDoctorProfile>('/doctor-profile/me/availability', {
      method: 'PATCH',
      body: { availabilityStatus },
    }),
  list: (status: DoctorApplicationStatus, page: number, signal?: AbortSignal) =>
    apiRequest<AdminDoctorApplicationPage>(
      `/admin/doctor-applications?${new URLSearchParams({ status, page: String(page) })}`,
      { signal },
    ),
  approve: (id: string, note: string) =>
    apiRequest<AdminDoctorApplication>(
      `/admin/doctor-applications/${encodeURIComponent(id)}/approve`,
      { method: 'POST', body: { registerChecked: true, ...(note ? { note } : {}) } },
    ),
  reject: (id: string, reason: string) =>
    apiRequest<AdminDoctorApplication>(
      `/admin/doctor-applications/${encodeURIComponent(id)}/reject`,
      { method: 'POST', body: { reason } },
    ),
  myProfile: () => apiRequest<MyDoctorProfile>('/doctor-profile/me'),
  saveProfile: (input: DoctorProfileInput) =>
    apiRequest<MyDoctorProfile>('/doctor-profile/me', { method: 'PUT', body: input }),
  directory: (query: DirectoryQuery, signal?: AbortSignal) => {
    const params = new URLSearchParams({ page: String(query.page) });
    for (const key of ['specialty', 'city', 'mode', 'language', 'q'] as const) {
      const value = query[key];
      if (value) params.set(key, value);
    }
    if (query.takingBookings) params.set('takingBookings', '1');
    if (query.hasOpenSlots) params.set('hasOpenSlots', '1');
    if (query.availWhen) params.set('availWhen', query.availWhen);
    if (query.holidayState) params.set('holidayState', query.holidayState);
    if (query.feeBand) params.set('feeBand', query.feeBand);
    if (query.sort && query.sort !== 'name') params.set('sort', query.sort);
    return apiRequest<DoctorDirectoryPage>(`/doctors?${params}`, { signal });
  },
  filters: () => apiRequest<{ specialties: string[]; cities: string[] }>('/doctors/filters'),
  publicProfile: (slug: string) =>
    apiRequest<DoctorPublicProfile>(`/doctors/${encodeURIComponent(slug)}`),
};
