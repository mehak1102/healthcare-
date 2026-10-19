import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoading } from '@/components/layout/page-loading';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchHealthReady } from '@/lib/health-api';
import { usePageTitle } from '@/lib/use-page-title';
import {
  PATIENT_DASHBOARD_KEY,
  dashboardsApi,
  formatInr,
  formatWhen,
  type DashboardAppointment,
} from './api';

export function PatientDashboardPage() {
  usePageTitle('Patient dashboard');
  const health = useQuery({
    queryKey: ['health', 'ready'],
    queryFn: ({ signal }) => fetchHealthReady(signal),
    staleTime: 60_000,
  });
  const videoBookingOpen = health.data?.integrations.videoCalls === true;

  const dashboard = useQuery({
    queryKey: PATIENT_DASHBOARD_KEY,
    queryFn: dashboardsApi.patient,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const watch = (item: { status: string }) =>
        item.status === 'pending_doctor' || item.status === 'pending_payment';
      if (data.upcoming.some(watch)) return 8_000;
      if (data.onlineConsultations.items.some(watch)) return 8_000;
      return false;
    },
  });

  if (dashboard.isPending) return <PageLoading />;
  if (dashboard.isError || !dashboard.data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Alert tone="error" title="We could not load your dashboard">
          Refresh the page. If this keeps happening, try again in a few minutes.
        </Alert>
      </div>
    );
  }

  const data = dashboard.data;
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Patient"
        title="Your care"
        description="Appointments, payments and shortcuts. This page only shows your own records."
        actions={
          <>
            <Link to="/doctors" className={buttonVariants()}>
              Find a doctor
            </Link>
            {videoBookingOpen && (
              <Link
                to="/doctors?mode=online&takingBookings=1"
                className={buttonVariants({ variant: 'secondary' })}
              >
                Book video visit
              </Link>
            )}
            <Link to="/appointments" className={buttonVariants({ variant: 'secondary' })}>
              All appointments
            </Link>
            <Link to="/account" className={buttonVariants({ variant: 'ghost' })}>
              Account settings
            </Link>
          </>
        }
      />

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Upcoming" value={String(data.upcomingCount)} />
        <Stat label="Previous" value={String(data.previousCount)} />
        <Stat label="Paid" value={formatInr(data.payments.paidInr)} />
      </dl>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <AppointmentList
          title="Upcoming appointments"
          items={data.upcoming}
          empty="No upcoming appointments."
        />
        <AppointmentList
          title="Previous appointments"
          items={data.previous}
          empty="No previous appointments yet."
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Online consultations</CardTitle>
          </CardHeader>
          <CardContent>
            {data.onlineConsultations.items.length === 0 ? (
              <div className="flex flex-col gap-3 text-sm text-ink-muted">
                <p>
                  No video appointments yet. When you book a <strong>video</strong> slot, it appears
                  here. Open the appointment to see when you can join the call.
                </p>
                {videoBookingOpen ? (
                  <Link
                    to="/doctors?mode=online&takingBookings=1&sort=next_available"
                    className={buttonVariants({ size: 'sm', className: 'w-fit' })}
                  >
                    Find doctors with video slots
                  </Link>
                ) : (
                  <p>Video booking is not enabled on this server yet.</p>
                )}
              </div>
            ) : (
              <AppointmentRows items={data.onlineConsultations.items} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Doctor at home</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-ink-muted">{data.homeVisits.message}</p>
            <Link
              to="/doctor-at-home"
              className="text-sm font-semibold text-coral-ink hover:underline"
            >
              Read how home visits will work
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Prescriptions and records</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-muted">{data.records.message}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-ink-muted">{data.payments.message}</p>
            <p className="text-sm">
              Paid {formatInr(data.payments.paidInr)} · Pending{' '}
              {formatInr(data.payments.pendingInr)} · Refunded{' '}
              {formatInr(data.payments.refundedInr)}
            </p>
            {data.payments.items.length === 0 ? (
              <p className="text-sm text-ink-muted">No payments yet.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {data.payments.items.map((item) => (
                  <li
                    key={item.appointmentId}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <Link
                      to={`/appointments/${item.appointmentId}`}
                      className="font-semibold hover:text-coral-ink hover:underline"
                    >
                      {item.doctorName}
                    </Link>
                    <span className="text-ink-muted">
                      {formatInr(item.amountInr)} · {item.status.replaceAll('_', ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold">{value}</dd>
    </div>
  );
}

function AppointmentList({
  title,
  items,
  empty,
}: {
  title: string;
  items: DashboardAppointment[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-ink-muted">{empty}</p>
        ) : (
          <AppointmentRows items={items} />
        )}
      </CardContent>
    </Card>
  );
}

function AppointmentRows({ items }: { items: DashboardAppointment[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-3 text-sm">
          <div>
            <Link
              to={`/appointments/${item.id}`}
              className="font-semibold hover:text-coral-ink hover:underline"
            >
              {item.doctorName}
            </Link>
            <p className="text-ink-muted">
              {item.specialty} · {formatWhen(item.startsAt)}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {item.mode === 'online' && item.status === 'confirmed' && (
              <Link
                to={`/appointments/${item.id}/call`}
                className="text-sm font-semibold text-coral-ink hover:underline"
              >
                Video room
              </Link>
            )}
            <span className="text-ink-muted">{item.status.replaceAll('_', ' ')}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
