import { apiRequest } from '@/lib/api-client';

export type OpsSummary = {
  generatedAt: string;
  timezone: 'Asia/Kolkata';
  doctorApplications: { pending: number };
  appointments: {
    pendingDoctorApproval: number;
    confirmedToday: number;
    startingNext24Hours: number;
  };
  directory: { publishedDoctors: number; takingBookings: number };
  homeVisits: { pilotPinCount: number; bookingOpen: boolean; openRequests: number };
  integrations: { videoCalls: boolean; paymentWebhooks: boolean };
};

export const OPS_SUMMARY_KEY = ['ops', 'summary'] as const;

export type OpsHomeVisitRow = {
  id: string;
  status: string;
  pinCode: string;
  stateCode: string;
  preferredWindow: string;
  patientUserId: string;
  patientName: string;
  assignedDoctorUserId: string | null;
  fee: { amountMinor: number; currency: string };
  createdAt: string;
};

export type OpsHomeVisitList = {
  items: OpsHomeVisitRow[];
  page: number;
  limit: number;
  total: number;
};

export const OPS_HOME_VISITS_KEY = ['ops', 'home-visits'] as const;

export const opsApi = {
  summary: () => apiRequest<OpsSummary>('/ops/summary'),
  homeVisits: (params?: { status?: string; area?: string; page?: number }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.area) search.set('area', params.area);
    if (params?.page) search.set('page', String(params.page));
    const q = search.toString();
    return apiRequest<OpsHomeVisitList>(`/ops/home-visits${q ? `?${q}` : ''}`);
  },
};
