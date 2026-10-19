import { useQuery } from '@tanstack/react-query';
import { Activity, CalendarClock, Home, Stethoscope, Video } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoading } from '@/components/layout/page-loading';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { hasPermission, useCurrentUser } from '@/features/auth/use-auth';
import { usePageTitle } from '@/lib/use-page-title';
import { OPS_SUMMARY_KEY, opsApi } from './api';

function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
        {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function IntegrationBadge({ on, label }: { on: boolean; label: string }) {
  return (
    <Badge tone={on ? 'success' : 'neutral'}>
      {label}: {on ? 'On' : 'Off'}
    </Badge>
  );
}

export function OpsDashboardPage() {
  usePageTitle('Operations');
  const user = useCurrentUser().data;
  const summary = useQuery({
    queryKey: OPS_SUMMARY_KEY,
    queryFn: opsApi.summary,
    refetchInterval: 60_000,
  });

  if (summary.isPending) return <PageLoading />;
  if (summary.isError || !summary.data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Alert tone="error" title="We could not load the operations summary">
          Refresh the page. If this keeps happening, try again in a few minutes.
        </Alert>
      </div>
    );
  }

  const data = summary.data;
  const generated = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(data.generatedAt));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Operations"
        title="Today at a glance"
        description="Read-only counts for bookings, directory health and pilot home-visit coverage. Dispatch and reassignment will land in a later release."
        actions={
          <>
            {user && hasPermission(user, 'providers:verify') && (
              <Link
                to="/admin/doctor-applications"
                className={buttonVariants({ variant: 'primary' })}
              >
                <Stethoscope className="size-4" aria-hidden="true" />
                Doctor applications
              </Link>
            )}
            <Link to="/account" className={buttonVariants({ variant: 'ghost' })}>
              Account
            </Link>
          </>
        }
      />

      <p className="mb-6 text-sm text-muted-foreground">
        Snapshot as of {generated} ({data.timezone}).
      </p>

      <div className="mb-8 flex flex-wrap gap-2">
        <IntegrationBadge on={data.integrations.videoCalls} label="Video" />
        <IntegrationBadge on={data.integrations.paymentWebhooks} label="Payment webhooks" />
        <Badge tone="neutral">
          <Home className="mr-1 size-3" aria-hidden="true" />
          Home visits: pilot only
        </Badge>
      </div>

      <section className="mb-10">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <CalendarClock className="size-5" aria-hidden="true" />
          Appointments
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Awaiting doctor response"
            value={data.appointments.pendingDoctorApproval}
            hint="Paid bookings pending accept or decline"
          />
          <StatCard
            title="Confirmed today"
            value={data.appointments.confirmedToday}
            hint="Starts today in IST"
          />
          <StatCard
            title="Next 24 hours"
            value={data.appointments.startingNext24Hours}
            hint="Confirmed starts from now"
          />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Activity className="size-5" aria-hidden="true" />
          Directory & onboarding
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Pending doctor applications"
            value={data.doctorApplications.pending}
          />
          <StatCard title="Published doctors" value={data.directory.publishedDoctors} />
          <StatCard
            title="Taking bookings"
            value={data.directory.takingBookings}
            hint="Published and marked available"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Video className="size-5" aria-hidden="true" />
          Home visits pilot
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            title="Active pilot PINs"
            value={data.homeVisits.pilotPinCount}
            hint={
              data.homeVisits.bookingOpen
                ? 'Booking open in this API environment'
                : 'PIN lookup only — booking is not open'
            }
          />
          <StatCard
            title="Open requests"
            value={data.homeVisits.openRequests}
            hint="Not completed or cancelled"
          />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Patient-facing status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                Online booking for doctor at home is{' '}
                <strong>{data.homeVisits.bookingOpen ? 'open' : 'closed'}</strong>.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/ops/home-visits" className={buttonVariants({ variant: 'link', size: 'sm' })}>
                  View request queue
                </Link>
                <Link to="/doctor-at-home" className={buttonVariants({ variant: 'link', size: 'sm' })}>
                  Doctor-at-home page
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
