import { apiRequest } from '@/lib/api-client';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export type HomeVisitPreferredWindow = 'asap' | 'morning' | 'afternoon' | 'evening';

export type HomeVisitRequestStatus =
  | 'pending_payment'
  | 'requested'
  | 'matching'
  | 'offered'
  | 'accepted'
  | 'en_route'
  | 'arrived'
  | 'completed'
  | 'unassigned'
  | 'cancelled';

export interface HomeVisitStatus {
  available: boolean;
  message: string;
  pilot: {
    states: string[];
    pinCodeLookup: boolean;
    bookingOpen: boolean;
  };
}

export interface PinCoverage {
  pin: string | null;
  valid: boolean;
  inPilotArea: boolean;
  stateCode: string | null;
  areaLabel: string | null;
  bookingOpen: boolean;
  message: string;
}

export interface Money {
  amountMinor: number;
  currency: string;
}

export interface HomeVisitCheckout {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: 'INR';
}

export interface HomeVisitTracking {
  mode: 'live_gps';
  destination: { lat: number; lng: number } | null;
  doctor: { lat: number; lng: number; updatedAt: string } | null;
  routePolyline: string | null;
  etaMinutes: number | null;
  distanceMeters: number | null;
  mapsConfigured: boolean;
  disclaimer: string;
}

export type HomeVisitPaymentStatus =
  | 'not_required'
  | 'pending'
  | 'paid'
  | 'refund_pending'
  | 'refunded'
  | 'refund_failed';

export interface HomeVisitRequest {
  id: string;
  pinCode: string;
  stateCode: string;
  addressLine1: string;
  locality: string | null;
  chiefComplaint: string;
  preferredWindow: HomeVisitPreferredWindow;
  status: HomeVisitRequestStatus;
  assignedDoctorUserId: string | null;
  assignedDoctorName: string | null;
  fee: Money;
  paymentStatus: HomeVisitPaymentStatus;
  checkout: HomeVisitCheckout | null;
  paymentHoldExpiresAt: string | null;
  tracking: HomeVisitTracking | null;
  arrivalVerificationCode: string | null;
  arrivalVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HomeVisitQuote {
  bookingOpen: boolean;
  paymentsAvailable: boolean;
  pin: string;
  inPilotArea: boolean;
  fee: Money;
  preferredWindow: HomeVisitPreferredWindow;
  message: string;
}

export interface HomeVisitAvailableDoctor {
  userId: string;
  slug: string;
  displayName: string;
  specialty: string;
  qualification: string;
  homeVisitFeeInr: number;
  fee: Money;
}

export interface HomeVisitAvailableDoctorList {
  pin: string;
  bookingOpen: boolean;
  items: HomeVisitAvailableDoctor[];
}

export interface CreateHomeVisitInput {
  pin: string;
  addressLine1: string;
  locality?: string;
  chiefComplaint: string;
  preferredWindow: HomeVisitPreferredWindow;
  doctorUserId: string;
  destinationLat?: number;
  destinationLng?: number;
}

export interface ProviderDispatchOfferRow {
  offer: {
    id: string;
    homeVisitRequestId: string;
    status: string;
    expiresAt: string;
  };
  request: {
    id: string;
    pinCode: string;
    locality: string | null;
    addressLine1: string;
    chiefComplaint: string;
    preferredWindow: HomeVisitPreferredWindow;
    status: HomeVisitRequestStatus;
    fee: Money;
  };
}

export interface ProviderAssignedVisit {
  id: string;
  pinCode: string;
  locality: string | null;
  addressLine1: string;
  chiefComplaint: string;
  preferredWindow: HomeVisitPreferredWindow;
  status: HomeVisitRequestStatus;
  fee: Money;
  createdAt: string;
}

export const HOME_VISIT_WINDOWS: { value: HomeVisitPreferredWindow; label: string }[] = [
  { value: 'asap', label: 'As soon as possible' },
  { value: 'morning', label: 'Morning (8 AM – 12 PM)' },
  { value: 'afternoon', label: 'Afternoon (12 PM – 5 PM)' },
  { value: 'evening', label: 'Evening (5 PM – 9 PM)' },
];

export const HOME_VISIT_MINE_KEY = ['home-visits', 'mine'] as const;
export const HOME_VISIT_DETAIL_KEY = (id: string) => ['home-visits', 'mine', id] as const;
export const PROVIDER_HV_OFFERS_KEY = ['provider', 'home-visits', 'offers'] as const;
export const PROVIDER_HV_ASSIGNED_KEY = ['provider', 'home-visits', 'assigned'] as const;

export function formatHomeVisitInr(minor: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(minor / 100);
}

export async function fetchHomeVisitStatus(signal?: AbortSignal): Promise<HomeVisitStatus> {
  const res = await fetch(`${API_BASE}/home-visits/status`, { signal });
  if (!res.ok) throw new Error(`Home visit status failed (${res.status})`);
  return res.json() as Promise<HomeVisitStatus>;
}

export async function fetchPinCoverage(pin: string, signal?: AbortSignal): Promise<PinCoverage> {
  const params = new URLSearchParams({ pin });
  const res = await fetch(`${API_BASE}/home-visits/pin-coverage?${params}`, { signal });
  if (!res.ok) throw new Error(`PIN coverage check failed (${res.status})`);
  return res.json() as Promise<PinCoverage>;
}

export const homeVisitsApi = {
  quote: (body: { pin: string; preferredWindow?: HomeVisitPreferredWindow }) =>
    apiRequest<HomeVisitQuote>('/home-visits/quote', { method: 'POST', body }),

  availableDoctors: (pin: string) =>
    apiRequest<HomeVisitAvailableDoctorList>(
      `/home-visits/available-doctors?${new URLSearchParams({ pin })}`,
    ),

  create: (body: CreateHomeVisitInput) =>
    apiRequest<HomeVisitRequest>('/home-visits', { method: 'POST', body }),

  mine: () => apiRequest<{ items: HomeVisitRequest[] }>('/home-visits/mine'),

  get: (id: string) => apiRequest<HomeVisitRequest>(`/home-visits/mine/${encodeURIComponent(id)}`),

  cancel: (id: string) =>
    apiRequest<HomeVisitRequest>(`/home-visits/mine/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    }),

  confirmPayment: (
    id: string,
    confirmation: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
  ) =>
    apiRequest<HomeVisitRequest>(`/home-visits/mine/${encodeURIComponent(id)}/payment`, {
      method: 'POST',
      body: confirmation,
    }),

  confirmSandboxPayment: (id: string) =>
    apiRequest<HomeVisitRequest>(`/home-visits/mine/${encodeURIComponent(id)}/payment/sandbox`, {
      method: 'POST',
    }),

  providerOffers: () =>
    apiRequest<{ items: ProviderDispatchOfferRow[] }>('/provider/home-visits/dispatch-offers'),

  providerAssigned: () =>
    apiRequest<{ items: ProviderAssignedVisit[] }>('/provider/home-visits/assigned'),

  acceptOffer: (offerId: string) =>
    apiRequest<{ id: string; homeVisitRequestId: string; status: string; expiresAt: string }>(
      `/provider/dispatch-offers/${encodeURIComponent(offerId)}/accept`,
      { method: 'POST' },
    ),

  advanceStatus: (
    requestId: string,
    status: 'en_route' | 'completed',
    coords?: { lat: number; lng: number },
  ) =>
    apiRequest<{ id: string; status: HomeVisitRequestStatus }>(
      `/provider/home-visits/${encodeURIComponent(requestId)}/status`,
      { method: 'POST', body: coords ? { status, ...coords } : { status } },
    ),

  verifyArrival: (requestId: string, code: string) =>
    apiRequest<{ id: string; status: HomeVisitRequestStatus }>(
      `/provider/home-visits/${encodeURIComponent(requestId)}/verify-arrival`,
      { method: 'POST', body: { code } },
    ),

  postDoctorLocation: (requestId: string, coords: { lat: number; lng: number }) =>
    apiRequest<{ id: string; updatedAt: string }>(
      `/provider/home-visits/${encodeURIComponent(requestId)}/location`,
      { method: 'POST', body: coords },
    ),

  opsReassign: (requestId: string, body: { doctorUserId: string; note?: string }) =>
    apiRequest<{ request: HomeVisitRequest; offer: { id: string } }>(
      `/ops/home-visits/${encodeURIComponent(requestId)}/reassign`,
      { method: 'POST', body },
    ),
};

export function homeVisitStatusLabel(status: HomeVisitRequestStatus): string {
  const map: Record<HomeVisitRequestStatus, string> = {
    pending_payment: 'Pay to confirm',
    requested: 'Request received',
    matching: 'Finding a doctor',
    offered: 'Waiting for doctor',
    accepted: 'Doctor assigned',
    en_route: 'On the way',
    arrived: 'Arrived',
    completed: 'Completed',
    unassigned: 'Needs dispatch',
    cancelled: 'Cancelled',
  };
  return map[status] ?? status;
}

export function homeVisitIsActive(status: HomeVisitRequestStatus): boolean {
  return (
    status === 'pending_payment' ||
    status === 'requested' ||
    status === 'matching' ||
    status === 'offered' ||
    status === 'accepted' ||
    status === 'en_route' ||
    status === 'arrived'
  );
}

export function homeVisitStepIndex(status: HomeVisitRequestStatus): number {
  if (status === 'requested' || status === 'matching' || status === 'unassigned') return 0;
  if (status === 'offered') return 1;
  if (status === 'pending_payment') return 2;
  if (status === 'accepted') return 2;
  if (status === 'en_route') return 3;
  if (status === 'arrived' || status === 'completed') return 4;
  return 0;
}
