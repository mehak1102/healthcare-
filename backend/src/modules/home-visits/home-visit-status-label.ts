import type { HomeVisitRequestStatus } from './home-visit-statuses';

const LABELS: Record<HomeVisitRequestStatus, string> = {
  pending_payment: 'awaiting payment',
  requested: 'request received',
  matching: 'finding a doctor',
  offered: 'waiting for doctor',
  accepted: 'doctor assigned',
  en_route: 'on the way',
  arrived: 'arrived',
  completed: 'completed',
  unassigned: 'needs dispatch',
  cancelled: 'cancelled',
};

export function homeVisitStatusLabelForEmail(status: string): string {
  return LABELS[status as HomeVisitRequestStatus] ?? status.replaceAll('_', ' ');
}
