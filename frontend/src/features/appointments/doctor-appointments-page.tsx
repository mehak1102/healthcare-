import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoading } from '@/components/layout/page-loading';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent } from '@/components/ui/card';
import { MODE_LABELS } from '@/features/doctors/api';
import { ApiError } from '@/lib/api-client';
import { usePageTitle } from '@/lib/use-page-title';
import {
  appointmentsApi,
  DOCTOR_APPOINTMENTS_KEY,
  formatDateTime,
  STATUS_LABELS,
  type AppointmentStatus,
  type DoctorAppointment,
  type Scope,
} from './api';
import { AppointmentStatusBadge } from './appointment-status-badge';
import { ScopeTabs } from './scope-tabs';
import { VideoJoinLink } from './video-join-link';

const DOCTOR_LABELS: Record<AppointmentStatus, string> = {
  ...STATUS_LABELS,
  pending_doctor: 'Awaiting your response',
  confirmed: 'Accepted',
  cancelled_by_patient: 'Cancelled by patient',
  cancelled_by_doctor: 'Cancelled by you',
  rejected_by_doctor: 'Declined by you',
  no_show: 'Patient did not come',
};

export function DoctorAppointmentsPage() {
  usePageTitle('Doctor appointments');
  const [scope, setScope] = useState<Scope>('upcoming');
  const list = useQuery({
    queryKey: [...DOCTOR_APPOINTMENTS_KEY, scope],
    queryFn: () => appointmentsApi.forDoctor(scope),
    refetchInterval: (query) => {
      if (scope !== 'upcoming') return false;
      return query.state.data?.items.some((item) => item.canAccept) ? 8_000 : false;
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="For doctors"
        title="Your patients’ appointments"
        actions={
          <Link to="/doctor/schedule" className={buttonVariants({ variant: 'secondary' })}>
            <CalendarDays className="size-4" aria-hidden="true" />
            Edit timetable
          </Link>
        }
      />
      <div className="mt-8 flex flex-col gap-4">
        <ScopeTabs scope={scope} onChange={setScope} />
        {list.isPending && <PageLoading />}
        {list.isError && <Alert tone="error">We could not load your appointments.</Alert>}
        {list.data?.items.length === 0 && (
          <p className="text-ink-muted">
            {scope === 'upcoming' ? 'No upcoming appointments.' : 'No past appointments yet.'}
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {list.data?.items.map((item) => (
            <li key={item.id}>
              <DoctorAppointmentCard appointment={item} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DoctorAppointmentCard({ appointment }: { appointment: DoctorAppointment }) {
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const refresh = () => queryClient.invalidateQueries({ queryKey: DOCTOR_APPOINTMENTS_KEY });
  const cancel = useMutation({
    mutationFn: () => appointmentsApi.cancelAsDoctor(appointment.id, reason.trim()),
    onSuccess: refresh,
  });
  const outcome = useMutation({
    mutationFn: (value: 'completed' | 'no_show') =>
      appointmentsApi.recordOutcome(appointment.id, value),
    onSuccess: refresh,
  });
  const accept = useMutation({
    mutationFn: () => appointmentsApi.acceptAsDoctor(appointment.id),
    onSuccess: refresh,
  });
  const reject = useMutation({
    mutationFn: () => appointmentsApi.rejectAsDoctor(appointment.id),
    onSuccess: refresh,
  });
  const error = cancel.error ?? outcome.error ?? accept.error ?? reject.error;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{appointment.patientName}</p>
            <p className="text-sm">{formatDateTime(appointment.startsAt)}</p>
            <p className="text-sm text-ink-muted">{MODE_LABELS[appointment.mode]}</p>
          </div>
          <AppointmentStatusBadge status={appointment.status} labels={DOCTOR_LABELS} />
        </div>
        {appointment.patientNote && (
          <p className="rounded-[var(--radius-control)] bg-canvas px-3 py-2 text-sm">
            <span className="font-semibold">Reason for visit: </span>
            {appointment.patientNote}
          </p>
        )}
        {appointment.cancelReason && (
          <p className="text-sm text-ink-muted">Cancellation reason: {appointment.cancelReason}</p>
        )}
        {appointment.canAccept && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={accept.isPending} onClick={() => accept.mutate()}>
              Accept booking
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={reject.isPending}
              onClick={() => reject.mutate()}
            >
              Decline
            </Button>
          </div>
        )}
        <VideoJoinLink
          appointment={appointment}
          to={`/doctor/appointments/${appointment.id}/call`}
        />
        {error && (
          <Alert tone="error">
            {error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'}
          </Alert>
        )}

        {appointment.canRecordOutcome && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              loading={outcome.isPending}
              onClick={() => outcome.mutate('completed')}
            >
              Mark as completed
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={outcome.isPending}
              onClick={() => outcome.mutate('no_show')}
            >
              Patient did not come
            </Button>
          </div>
        )}

        {appointment.canCancel &&
          (!cancelling ? (
            <Button
              size="sm"
              variant="danger"
              className="self-start"
              onClick={() => setCancelling(true)}
            >
              Cancel appointment
            </Button>
          ) : (
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                cancel.mutate();
              }}
            >
              <label htmlFor={`reason-${appointment.id}`} className="text-sm font-semibold">
                Reason (shown to the patient)
              </label>
              <textarea
                id={`reason-${appointment.id}`}
                rows={2}
                minLength={5}
                maxLength={500}
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-sm"
              />
              <p className="text-xs text-ink-muted">The patient gets a full refund and an email.</p>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  size="sm"
                  variant="danger"
                  loading={cancel.isPending}
                  disabled={reason.trim().length < 5}
                >
                  Cancel and refund
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setCancelling(false)}
                >
                  Keep
                </Button>
              </div>
            </form>
          ))}
      </CardContent>
    </Card>
  );
}
