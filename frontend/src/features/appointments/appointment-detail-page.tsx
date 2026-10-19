import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { PageLoading } from '@/components/layout/page-loading';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { doctorName, MODE_LABELS } from '@/features/doctors/api';
import { ApiError } from '@/lib/api-client';
import { usePageTitle } from '@/lib/use-page-title';
import {
  appointmentsApi,
  formatDateTime,
  formatTime,
  PAYMENT_LABELS,
  type PatientAppointment,
} from './api';
import { AppointmentStatusBadge } from './appointment-status-badge';
import { paymentErrorMessage, usePayment } from './use-payment';
import { OnlineVideoSection } from './online-video-section';
import { RescheduleSection } from './reschedule-section';

export function AppointmentDetailPage() {
  usePageTitle('Appointment');
  const { id = '' } = useParams();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  const appointment = useQuery({
    queryKey: ['appointments', 'detail', id],
    queryFn: () => appointmentsApi.get(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending_doctor' || status === 'pending_payment' ? 8_000 : false;
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        to="/appointments"
        className="inline-flex items-center gap-1 text-sm font-semibold text-coral-ink hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden="true" /> Your appointments
      </Link>
      <div className="mt-6 flex flex-col gap-4">
        {notice && <Alert tone="warning">{notice}</Alert>}
        {appointment.isPending && <PageLoading />}
        {appointment.isError && (
          <Alert tone="error">
            {appointment.error instanceof ApiError && appointment.error.status === 404
              ? 'This appointment does not exist.'
              : 'We could not load this appointment.'}
          </Alert>
        )}
        {appointment.data && <AppointmentDetail appointment={appointment.data} />}
      </div>
    </div>
  );
}

function AppointmentDetail({ appointment }: { appointment: PatientAppointment }) {
  const queryClient = useQueryClient();
  const pay = usePayment();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [justAccepted, setJustAccepted] = useState(false);
  const previousStatus = useRef(appointment.status);
  useEffect(() => {
    if (previousStatus.current === 'pending_doctor' && appointment.status === 'confirmed') {
      setJustAccepted(true);
    }
    previousStatus.current = appointment.status;
  }, [appointment.status]);
  const cancel = useMutation({
    mutationFn: () => appointmentsApi.cancel(appointment.id, reason.trim()),
    onSuccess: (updated) => {
      queryClient.setQueryData(['appointments', 'detail', appointment.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['appointments', 'mine'] });
      setConfirming(false);
    },
  });
  const { doctor } = appointment;
  const place =
    appointment.mode === 'clinic'
      ? [doctor.clinicName, doctor.locality, doctor.city].filter(Boolean).join(', ')
      : 'Video consultation on Sukoon Health';
  const paid = appointment.paymentStatus === 'paid';

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>
          <Link to={`/doctors/${doctor.slug}`} className="hover:underline">
            {doctorName(doctor.displayName)}
          </Link>
          <span className="block text-sm font-normal text-ink-muted">{doctor.specialty}</span>
        </CardTitle>
        <AppointmentStatusBadge status={appointment.status} />
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-muted">When (India time)</dt>
            <dd className="mt-0.5 font-semibold">{formatDateTime(appointment.startsAt)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">{MODE_LABELS[appointment.mode]}</dt>
            <dd className="mt-0.5 font-semibold">{place}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Fee</dt>
            <dd className="mt-0.5 font-semibold">
              {appointment.feeInr > 0 ? `₹${appointment.feeInr}` : 'Free'} ·{' '}
              {appointment.paymentStatus === 'pending' && appointment.status !== 'pending_payment'
                ? 'Not paid'
                : PAYMENT_LABELS[appointment.paymentStatus]}
            </dd>
          </div>
          {appointment.patientNote && (
            <div>
              <dt className="text-ink-muted">Reason for visit</dt>
              <dd className="mt-0.5">{appointment.patientNote}</dd>
            </div>
          )}
          {appointment.cancelReason && (
            <div className="sm:col-span-2">
              <dt className="text-ink-muted">Cancellation reason</dt>
              <dd className="mt-0.5">{appointment.cancelReason}</dd>
            </div>
          )}
        </dl>

        {justAccepted && (
          <Alert tone="success" title="Doctor accepted your booking">
            Your appointment is confirmed.{' '}
            {appointment.mode === 'online'
              ? 'You can join the video call from the section below.'
              : 'Please arrive a few minutes early.'}
          </Alert>
        )}
        {appointment.status === 'confirmed' && appointment.mode === 'clinic' && !justAccepted && (
          <Alert tone="success">
            Your appointment is confirmed. Please arrive a few minutes early.
          </Alert>
        )}
        {appointment.status === 'confirmed' && appointment.mode === 'online' && !justAccepted && (
          <Alert tone="success">
            Your video consultation is accepted. See below for how to join.
          </Alert>
        )}
        <OnlineVideoSection appointment={appointment} />
        {appointment.status === 'expired' && (
          <Alert tone="info">
            Payment was not completed in time, so this slot was released and not booked.{' '}
            <Link to={`/doctors/${doctor.slug}`} className="font-semibold underline">
              Choose another time
            </Link>
            .
          </Alert>
        )}
        {(appointment.paymentStatus === 'refund_pending' ||
          appointment.paymentStatus === 'refunded') && (
          <p className="text-sm text-ink-muted">
            A full refund of ₹{appointment.feeInr} has been sent to your original payment method.
            Banks usually take 5–7 working days to show it.
          </p>
        )}

        {appointment.checkout && (
          <div className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-line bg-canvas p-4">
            <p className="text-sm">
              Pay to confirm this booking.
              {appointment.holdExpiresAt &&
                ` The slot is held for you until ${formatTime(appointment.holdExpiresAt)}.`}
            </p>
            {pay.isError && <Alert tone="error">{paymentErrorMessage(pay.error)}</Alert>}
            <Button
              loading={pay.isPending}
              className="sm:self-start"
              onClick={() =>
                pay.mutate(appointment, {
                  onSuccess: (updated) =>
                    queryClient.setQueryData(['appointments', 'detail', appointment.id], updated),
                })
              }
            >
              Pay ₹{appointment.feeInr} now
            </Button>
          </div>
        )}

        <RescheduleSection appointment={appointment} />

        {appointment.canCancel && (
          <div className="border-t border-line pt-4">
            {!confirming ? (
              <Button variant="danger" onClick={() => setConfirming(true)}>
                Cancel appointment
              </Button>
            ) : (
              <form
                className="flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  cancel.mutate();
                }}
              >
                <p className="text-sm">
                  {paid
                    ? `You will get a full refund of ₹${appointment.feeInr}.`
                    : 'The time will be released for other patients.'}
                </p>
                <label htmlFor="cancel-reason" className="text-sm font-semibold">
                  Reason <span className="font-normal text-ink-muted">(optional)</span>
                </label>
                <textarea
                  id="cancel-reason"
                  rows={2}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-sm"
                />
                {cancel.isError && (
                  <Alert tone="error">
                    {cancel.error instanceof ApiError
                      ? cancel.error.message
                      : 'We could not cancel. Please try again.'}
                  </Alert>
                )}
                <div className="flex gap-2">
                  <Button type="submit" variant="danger" loading={cancel.isPending}>
                    Yes, cancel it
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                    Keep appointment
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
