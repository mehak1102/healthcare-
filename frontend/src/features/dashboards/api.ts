import { apiRequest } from '@/lib/api-client';

export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended';
export type AvailabilityStatus = 'available' | 'unavailable' | 'busy' | 'on_leave';
export type ProfileCompletion = 'incomplete' | 'complete';

export interface DashboardAppointment {
  id: string;
  startsAt: string;
  endsAt: string;
  mode: 'online' | 'clinic';
  status: string;
  feeInr: number;
  paymentStatus: string;
  doctorName: string;
  specialty: string;
}

export interface PatientDashboard {
  upcomingCount: number;
  previousCount: number;
  upcoming: DashboardAppointment[];
  previous: DashboardAppointment[];
  onlineConsultations: { count: number; items: DashboardAppointment[] };
  homeVisits: { available: boolean; count: number; message: string };
  records: { available: false; message: string };
  payments: {
    currency: 'INR';
    paidInr: number;
    pendingInr: number;
    refundedInr: number;
    message: string;
    items: {
      appointmentId: string;
      status: string;
      amountInr: number;
      paidAt: string | null;
      doctorName: string;
    }[];
  };
}

export interface DoctorDashboard {
  verificationStatus: VerificationStatus;
  availabilityStatus: AvailabilityStatus | null;
  profileCompletion: ProfileCompletion;
  suspensionNote: string | null;
  nextSteps: string[];
  application: {
    id: string;
    status: 'pending' | 'approved' | 'rejected';
    registrationNumber: string;
    registrationCouncil: string;
    registrationYear: number;
    qualification: string;
    specialty: string;
    rejectionReason: string | null;
  } | null;
  profile: {
    slug: string;
    displayName: string;
    specialty: string;
    qualification: string;
    consultationModes: ('online' | 'clinic')[];
    consultationFeeInr: number | null;
    published: boolean;
    missing: string[];
    nextAvailableDate: string | null;
  } | null;
  schedule: { blocks: number; daysOff: number; onlineBlocks: number };
  video: {
    offeredOnProfile: boolean;
    platformReady: boolean;
    patientBookingOpen: boolean;
  };
  appointments: {
    upcomingCount: number;
    pastCount: number;
    pendingApprovalCount: number;
    upcoming: {
      id: string;
      patientName: string;
      startsAt: string;
      endsAt: string;
      mode: 'online' | 'clinic';
      status: string;
      videoOpensAt: string | null;
    }[];
  };
}

export const PATIENT_DASHBOARD_KEY = ['patient-dashboard'] as const;
export const DOCTOR_DASHBOARD_KEY = ['doctor-dashboard'] as const;

export const dashboardsApi = {
  patient: () => apiRequest<PatientDashboard>('/patient/dashboard'),
  doctor: () => apiRequest<DoctorDashboard>('/doctor/dashboard'),
};

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export const formatInr = (amount: number) => inr.format(amount);

const when = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Kolkata',
});

export const formatWhen = (iso: string) => when.format(new Date(iso));
