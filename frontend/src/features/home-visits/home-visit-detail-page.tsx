import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoading } from '@/components/layout/page-loading';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { usePageTitle } from '@/lib/use-page-title';
import {
  formatHomeVisitInr,
  HOME_VISIT_DETAIL_KEY,
  HOME_VISIT_MINE_KEY,
  homeVisitIsActive,
  homeVisitStatusLabel,
  homeVisitStepIndex,
  homeVisitsApi,
  type HomeVisitRequestStatus,
} from './api';
import { HomeVisitTrackingMap } from './home-visit-tracking-map';
import { HomeVisitDoctorAcceptedDialog } from './home-visit-doctor-accepted-dialog';
import {
  homeVisitPaymentErrorMessage,
  useHomeVisitPayment,
} from './use-home-visit-payment';

const STEPS = ['Request sent', 'Doctor accepts', 'You pay', 'On the way', 'Arrived'] as const;

export function HomeVisitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  usePageTitle('Home visit');

  const visit = useQuery({
    queryKey: HOME_VISIT_DETAIL_KEY(id ?? ''),
    queryFn: () => homeVisitsApi.get(id!),
    enabled: Boolean(id),
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      if (!s) return false;
      if (s === 'offered' || s === 'pending_payment') return 5_000;
      if (s === 'en_route') return 5_000;
      return homeVisitIsActive(s) ? 10_000 : false;
    },
  });

  const pay = useHomeVisitPayment();
  const [paymentPromptOpen, setPaymentPromptOpen] = useState(false);
  const previousStatus = useRef<HomeVisitRequestStatus | null>(null);

  useEffect(() => {
    if (!visit.data || !id) return;
    const data = visit.data;
    const prev = previousStatus.current;
    const next = data.status;
    const needsPay = next === 'pending_payment' && data.paymentStatus === 'pending';
    const becamePayable = needsPay && prev != null && prev !== 'pending_payment';
    const firstLoadPending = needsPay && prev === null;
    const dismissed = sessionStorage.getItem(`hv-pay-dismiss-${id}`) === '1';
    if ((becamePayable || (firstLoadPending && !dismissed)) && needsPay) {
      setPaymentPromptOpen(true);
    }
    previousStatus.current = next;
  }, [id, visit.data?.status, visit.data?.paymentStatus, visit.data]);

  const cancel = useMutation({
    mutationFn: () => homeVisitsApi.cancel(id!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: HOME_VISIT_MINE_KEY });
      void queryClient.invalidateQueries({ queryKey: HOME_VISIT_DETAIL_KEY(id!) });
    },
  });

  if (!id) {
    return (
      <Alert tone="error" title="Missing visit id">
        <Link to="/doctor-at-home">Back to doctor at home</Link>
      </Alert>
    );
  }

  if (visit.isPending) return <PageLoading />;
  if (visit.isError || !visit.data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Alert tone="error" title="Visit not found">
          This request may belong to another account or no longer exists.{' '}
          <Link to="/doctor-at-home" className="font-semibold underline">
            Doctor at home
          </Link>
        </Alert>
      </div>
    );
  }

  const data = visit.data;
  const step = homeVisitStepIndex(data.status);
  const canCancel =
    data.status === 'pending_payment' ||
    data.status === 'requested' ||
    data.status === 'matching' ||
    data.status === 'offered' ||
    data.status === 'unassigned';

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <HomeVisitDoctorAcceptedDialog
        visit={data}
        open={paymentPromptOpen && data.status === 'pending_payment'}
        onClose={() => {
          setPaymentPromptOpen(false);
          if (id) sessionStorage.setItem(`hv-pay-dismiss-${id}`, '1');
        }}
        onPay={() => {
          pay.mutate(data, {
            onSuccess: () => {
              setPaymentPromptOpen(false);
              void visit.refetch();
            },
          });
        }}
        paying={pay.isPending}
      />
      <PageHeader
        eyebrow="Doctor at home"
        title="Your visit"
        description={`PIN ${data.pinCode} · ${data.preferredWindow.replaceAll('_', ' ')}`}
        actions={
          <Link to="/doctor-at-home" className="text-sm font-semibold text-coral-ink hover:underline">
            All visits
          </Link>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Badge tone={data.status === 'cancelled' ? 'neutral' : 'success'}>
          {homeVisitStatusLabel(data.status)}
        </Badge>
        {data.assignedDoctorName && (
          <span className="text-sm text-ink-muted">Dr. {data.assignedDoctorName}</span>
        )}
      </div>

      {data.status !== 'cancelled' && data.status !== 'completed' && (
        <ol className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                i <= step ? 'bg-coral-ink/10 text-coral-ink' : 'bg-sand text-ink-muted'
              }`}
            >
              {label}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-8 space-y-3 text-sm">
        <p>
          <span className="font-semibold text-ink">Address:</span> {data.addressLine1}
          {data.locality ? `, ${data.locality}` : ''}
        </p>
        <p>
          <span className="font-semibold text-ink">Concern:</span> {data.chiefComplaint}
        </p>
        <p>
          <span className="font-semibold text-ink">Visit fee:</span>{' '}
          {formatHomeVisitInr(data.fee.amountMinor)}
          {data.paymentStatus === 'paid' && (
            <span className="text-ink-muted"> · Paid</span>
          )}
          {data.status === 'pending_payment' && data.paymentStatus === 'pending' && (
            <span className="text-ink-muted"> · Due after doctor accepted</span>
          )}
          {data.status === 'offered' && data.paymentStatus === 'pending' && (
            <span className="text-ink-muted"> · Pay after doctor accepts</span>
          )}
        </p>
      </div>

      {data.checkout && (
        <div className="mt-8 flex flex-col gap-3">
          <Alert tone="warning" title="Payment required">
            Your doctor accepted this visit. Pay the fee below to confirm the booking.
            {data.paymentHoldExpiresAt && (
              <>
                {' '}
                Hold expires{' '}
                {new Intl.DateTimeFormat('en-IN', {
                  timeStyle: 'short',
                  dateStyle: 'medium',
                  timeZone: 'Asia/Kolkata',
                }).format(new Date(data.paymentHoldExpiresAt))}
                .
              </>
            )}
          </Alert>
          <Button
            disabled={pay.isPending}
            onClick={() => pay.mutate(data, { onSuccess: () => visit.refetch() })}
          >
            {pay.isPending ? 'Opening payment…' : `Pay ${formatHomeVisitInr(data.fee.amountMinor)}`}
          </Button>
          {pay.error && (
            <p className="text-sm text-ink-muted">{homeVisitPaymentErrorMessage(pay.error)}</p>
          )}
        </div>
      )}

      {data.arrivalVerificationCode &&
        (data.status === 'accepted' || data.status === 'en_route') && (
          <Alert tone="info" title="Arrival code" className="mt-8">
            <p className="text-sm text-ink-muted">
              When your doctor arrives, tell them this code — they must enter it to start the visit.
            </p>
            <p
              className="mt-3 text-center font-mono text-4xl font-bold tracking-[0.35em] text-ink tabular-nums"
              aria-label={`Arrival code ${data.arrivalVerificationCode}`}
            >
              {data.arrivalVerificationCode}
            </p>
          </Alert>
        )}

      {data.tracking && (
        <div className="mt-8">
          <HomeVisitTrackingMap tracking={data.tracking} doctorName={data.assignedDoctorName} />
        </div>
      )}

      {statusHelp(data.status, Boolean(data.tracking))}

      {canCancel && (
        <div className="mt-8">
          <Button
            variant="secondary"
            disabled={cancel.isPending}
            onClick={() => {
              if (window.confirm('Cancel this home visit request?')) cancel.mutate();
            }}
          >
            {cancel.isPending ? 'Cancelling…' : 'Cancel request'}
          </Button>
          {cancel.error instanceof ApiError && (
            <p className="mt-2 text-sm text-ink-muted">{cancel.error.message}</p>
          )}
        </div>
      )}

      {data.status === 'completed' && (
        <Alert tone="success" title="Visit completed" className="mt-8">
          Thank you. If you need follow-up care, book a clinic or video visit from Find a doctor.
        </Alert>
      )}
    </div>
  );
}

function statusHelp(status: HomeVisitRequestStatus, hasTracking: boolean) {
  if (status === 'pending_payment') {
    return (
      <Alert tone="info" title="Doctor accepted" className="mt-8">
        Your doctor accepted this visit. Complete payment below to confirm — they can head to you
        after that.
      </Alert>
    );
  }
  if (status === 'requested' || status === 'matching' || status === 'unassigned') {
    return (
      <Alert tone="info" title="Waiting for dispatch" className="mt-8">
        Operations will assign a verified doctor in the pilot area. You will see updates here — we
        do not show a fake map or ETA until a doctor is on the way.
      </Alert>
    );
  }
  if (status === 'offered') {
    return (
      <Alert tone="info" title="Waiting for doctor" className="mt-8">
        Your chosen doctor must accept the request before you pay. You will get a pay button here
        after they accept.
      </Alert>
    );
  }
  if (status === 'accepted') {
    return (
      <Alert tone="info" title="Visit confirmed" className="mt-8">
        Payment is complete. Your arrival code is above — share it when the doctor reaches your
        door. Live tracking appears when they mark en route.
      </Alert>
    );
  }
  if (status === 'en_route') {
    if (hasTracking) return null;
    return (
      <Alert tone="success" title="On the way" className="mt-8">
        Your doctor is en route. The live map above uses OpenStreetMap and updates from their GPS.
      </Alert>
    );
  }
  if (status === 'arrived') {
    if (hasTracking) return null;
    return (
      <Alert tone="success" title="Doctor arrived" className="mt-8">
        Your doctor has marked arrival at your location.
      </Alert>
    );
  }
  return null;
}
