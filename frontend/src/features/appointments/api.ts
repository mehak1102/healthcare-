import type { ConsultationMode } from '@/features/doctors/api';
import { apiRequest } from '@/lib/api-client';

export type AppointmentStatus =
  | 'pending_payment'
  | 'pending_doctor'
  | 'confirmed'
  | 'rejected_by_doctor'
  | 'completed'
  | 'no_show'
  | 'cancelled_by_patient'
  | 'cancelled_by_doctor'
  | 'expired';

export type PaymentStatus =
  'not_required' | 'pending' | 'paid' | 'refund_pending' | 'refunded' | 'refund_failed';

export interface Slot {
  startsAt: string;
  endsAt: string;
  mode: ConsultationMode;
}

export interface DoctorSlots {
  timezone: string;
  feeInr: number | null;
  bookableUntil: string;
  unavailableReason: 'no_timetable' | 'payments_unavailable' | 'not_accepting' | null;
  nextAvailableDate: string | null;
  videoBookingOpen: boolean;
  days: { date: string; slots: Slot[] }[];
}

/** Matches backend sandbox gateway; Checkout skips Razorpay's window and uses /payment/sandbox. */
export const SANDBOX_RAZORPAY_KEY_ID = 'rzp_test_SukoonSandbox';

export interface Checkout {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: 'INR';
}

interface AppointmentBase {
  id: string;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  mode: ConsultationMode;
  feeInr: number;
  paymentStatus: PaymentStatus;
  patientNote: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  canCancel: boolean;
  /** Set only for active video consultations. */
  videoOpensAt: string | null;
}

export interface VideoJoin {
  url: string;
  token: string;
}

export interface PatientAppointment extends AppointmentBase {
  doctor: {
    slug: string;
    displayName: string;
    specialty: string;
    clinicName: string | null;
    city: string | null;
    locality: string | null;
  };
  holdExpiresAt: string | null;
  checkout: Checkout | null;
}

export interface DoctorAppointment extends AppointmentBase {
  patientName: string;
  canRecordOutcome: boolean;
  canAccept: boolean;
  canReject: boolean;
}

export interface BookingInput {
  doctorSlug: string;
  startsAt: string;
  mode: ConsultationMode;
  patientNote?: string;
}

export interface PaymentConfirmation {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export const SLOT_LENGTHS = [10, 15, 20, 30, 45, 60] as const;

export interface WeeklyBlock {
  day: number;
  start: string;
  end: string;
  slotMinutes: number;
  mode: ConsultationMode;
}

export interface OneOffBlock {
  date: string;
  start: string;
  end: string;
  slotMinutes: number;
  mode: ConsultationMode;
}

export interface Schedule {
  rules: WeeklyBlock[];
  extraBlocks: OneOffBlock[];
  daysOff: string[];
  timezone: string;
  onlineBookingOpen: boolean;
}

export type Scope = 'upcoming' | 'past';

export const MY_APPOINTMENTS_KEY = ['appointments', 'mine'] as const;
export const DOCTOR_APPOINTMENTS_KEY = ['appointments', 'doctor'] as const;
export const MY_SCHEDULE_KEY = ['doctor-schedule', 'me'] as const;

const IST = 'Asia/Kolkata';

/** `YYYY-MM-DD` in India time, for timetable days off and date inputs. */
export function istCalendarDate(daysFromToday = 0): string {
  const when = new Date(Date.now() + daysFromToday * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(when);
}

const timeFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST,
  hour: 'numeric',
  minute: '2-digit',
});
const dateTimeFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const dayFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** All appointment times are shown in India time, whatever the device's time zone. */
export const formatTime = (iso: string) => timeFormat.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));
/** `date` is an India calendar date (YYYY-MM-DD). */
export const formatDay = (date: string) => dayFormat.format(new Date(`${date}T12:00:00+05:30`));

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending_payment: 'Pending payment',
  pending_doctor: 'Pending',
  confirmed: 'Accepted',
  rejected_by_doctor: 'Rejected',
  completed: 'Completed',
  no_show: 'Missed',
  cancelled_by_patient: 'Cancelled',
  cancelled_by_doctor: 'Cancelled',
  expired: 'Not booked',
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  not_required: 'Free consultation',
  pending: 'Payment due',
  paid: 'Paid',
  refund_pending: 'Refund on its way',
  refunded: 'Refunded',
  refund_failed: 'Refund delayed – our team is on it',
};

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const id = (value: string) => encodeURIComponent(value);

export const appointmentsApi = {
  slots: (slug: string, from: string | null, signal?: AbortSignal) => {
    const params = new URLSearchParams({ days: '7' });
    if (from) params.set('from', from);
    return apiRequest<DoctorSlots>(`/doctors/${id(slug)}/slots?${params}`, { signal });
  },
  book: (input: BookingInput, idempotencyKey: string) =>
    apiRequest<PatientAppointment>('/appointments', {
      method: 'POST',
      body: input,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  confirmSandboxPayment: (appointmentId: string) =>
    apiRequest<PatientAppointment>(`/appointments/${id(appointmentId)}/payment/sandbox`, {
      method: 'POST',
    }),
  confirmPayment: (appointmentId: string, confirmation: PaymentConfirmation) =>
    apiRequest<PatientAppointment>(`/appointments/${id(appointmentId)}/payment`, {
      method: 'POST',
      body: confirmation,
    }),
  mine: (scope: Scope) =>
    apiRequest<{ items: PatientAppointment[] }>(`/appointments?scope=${scope}`),
  get: (appointmentId: string) =>
    apiRequest<PatientAppointment>(`/appointments/${id(appointmentId)}`),
  reschedule: (appointmentId: string, startsAt: string) =>
    apiRequest<PatientAppointment>(`/appointments/${id(appointmentId)}/reschedule`, {
      method: 'POST',
      body: { startsAt },
    }),
  cancel: (appointmentId: string, reason: string) =>
    apiRequest<PatientAppointment>(`/appointments/${id(appointmentId)}/cancel`, {
      method: 'POST',
      body: reason ? { reason } : {},
    }),
  forDoctor: (scope: Scope) =>
    apiRequest<{ items: DoctorAppointment[] }>(`/doctor/appointments?scope=${scope}`),
  cancelAsDoctor: (appointmentId: string, reason: string) =>
    apiRequest<DoctorAppointment>(`/doctor/appointments/${id(appointmentId)}/cancel`, {
      method: 'POST',
      body: { reason },
    }),
  acceptAsDoctor: (appointmentId: string) =>
    apiRequest<DoctorAppointment>(`/doctor/appointments/${id(appointmentId)}/accept`, {
      method: 'POST',
    }),
  rejectAsDoctor: (appointmentId: string, reason?: string) =>
    apiRequest<DoctorAppointment>(`/doctor/appointments/${id(appointmentId)}/reject`, {
      method: 'POST',
      body: reason ? { reason } : {},
    }),
  recordOutcome: (appointmentId: string, outcome: 'completed' | 'no_show') =>
    apiRequest<DoctorAppointment>(`/doctor/appointments/${id(appointmentId)}/outcome`, {
      method: 'POST',
      body: { outcome },
    }),
  joinVideo: (appointmentId: string, as: 'patient' | 'doctor') =>
    apiRequest<VideoJoin>(
      `${as === 'doctor' ? '/doctor' : ''}/appointments/${id(appointmentId)}/video`,
      { method: 'POST' },
    ),
  mySchedule: () => apiRequest<Schedule>('/doctor-schedule/me'),
  saveSchedule: (input: { rules: WeeklyBlock[]; extraBlocks: OneOffBlock[]; daysOff: string[] }) =>
    apiRequest<Schedule>('/doctor-schedule/me', { method: 'PUT', body: input }),
};
