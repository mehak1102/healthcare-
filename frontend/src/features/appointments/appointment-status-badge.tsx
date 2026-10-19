import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS, type AppointmentStatus } from './api';

const TONES: Record<AppointmentStatus, 'success' | 'warning' | 'neutral' | 'accent'> = {
  pending_payment: 'warning',
  pending_doctor: 'warning',
  confirmed: 'success',
  rejected_by_doctor: 'neutral',
  completed: 'accent',
  no_show: 'neutral',
  cancelled_by_patient: 'neutral',
  cancelled_by_doctor: 'neutral',
  expired: 'neutral',
};

export function AppointmentStatusBadge({
  status,
  labels = STATUS_LABELS,
}: {
  status: AppointmentStatus;
  labels?: Record<AppointmentStatus, string>;
}) {
  return <Badge tone={TONES[status]}>{labels[status]}</Badge>;
}
