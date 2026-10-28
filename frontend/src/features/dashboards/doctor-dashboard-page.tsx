import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoading } from '@/components/layout/page-loading';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { hasPermission, useCurrentUser } from '@/features/auth/use-auth';
import { formatDay } from '@/features/appointments/api';
import { VideoJoinLink } from '@/features/appointments/video-join-link';
import { doctorsApi, formatFee } from '@/features/doctors/api';
import { doctorApplicationSchema, type DoctorApplicationValues } from '@/features/doctors/schemas';
import { ApiError } from '@/lib/api-client';
import { usePageTitle } from '@/lib/use-page-title';
import {
  DOCTOR_DASHBOARD_KEY,
  dashboardsApi,
  formatWhen,
  type AvailabilityStatus,
  type DoctorDashboard,
} from './api';
import { AvailabilityBadge, CompletionBadge, VerificationBadge } from './status-badges';
import { DoctorHomeVisitsCard } from '@/features/home-visits/doctor-home-visits-card';

const AVAILABILITY_OPTIONS: { value: AvailabilityStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'busy', label: 'Busy' },
  { value: 'on_leave', label: 'On leave' },
];

export function DoctorDashboardPage() {
  usePageTitle('Doctor dashboard');
  const { data: user } = useCurrentUser();
  const dashboard = useQuery({
    queryKey: DOCTOR_DASHBOARD_KEY,
    queryFn: dashboardsApi.doctor,
    refetchInterval: (query) =>
      (query.state.data?.appointments.pendingApprovalCount ?? 0) > 0 ? 8_000 : false,
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
  const verified = data.verificationStatus === 'verified';
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Doctor"
        title="Your practice"
        description="Verification, availability and profile completion are separate. You can edit your profile. You cannot verify yourself."
        actions={
          <>
            <Link to="/" className={buttonVariants({ variant: 'secondary' })}>
              Back to the website
            </Link>
            {data.profile && (
              <Link to="/doctor/profile" className={buttonVariants({ variant: 'ghost' })}>
                Professional profile
              </Link>
            )}
            <Link to="/account" className={buttonVariants({ variant: 'ghost' })}>
              Account settings
            </Link>
          </>
        }
      />

      <div className="mt-8 flex flex-wrap gap-2">
        <VerificationBadge status={data.verificationStatus} />
        <AvailabilityBadge status={data.availabilityStatus} />
        <CompletionBadge status={data.profileCompletion} />
      </div>

      {data.suspensionNote && (
        <Alert tone="warning" title="Suspension note" className="mt-6">
          {data.suspensionNote}
        </Alert>
      )}

      {data.appointments.pendingApprovalCount > 0 && (
        <Alert tone="warning" title="Bookings waiting for you" className="mt-6">
          {data.appointments.pendingApprovalCount}{' '}
          {data.appointments.pendingApprovalCount === 1 ? 'patient is' : 'patients are'} waiting for
          you to accept or decline.{' '}
          <Link to="/doctor/appointments" className="font-semibold underline">
            Review appointments
          </Link>
        </Alert>
      )}

      {data.nextSteps.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Next steps</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-ink-muted">
              {data.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <CredentialsCard data={data} />
        <Card>
          <CardHeader>
            <CardTitle>Availability</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-ink-muted">
              Available means you are willing to take new bookings. Patients still only see times
              that fit your hours, existing appointments and the consultation types you offer.
              {!verified && ' Only a verified doctor can turn availability on.'}
            </p>
            <AvailabilityControls
              current={data.availabilityStatus}
              disabled={!data.profile}
              verified={verified}
            />
            <div className="flex flex-wrap gap-2">
              <Link
                to="/doctor/schedule"
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                Working hours
              </Link>
              <Link
                to="/doctor/appointments"
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                Appointments ({data.appointments.upcomingCount} upcoming)
              </Link>
            </div>
            <p className="text-sm text-ink-muted">
              {data.schedule.blocks === 0
                ? 'No working hours saved yet.'
                : `${data.schedule.blocks} timetable ${data.schedule.blocks === 1 ? 'block' : 'blocks'}`}
              {data.schedule.daysOff > 0 ? ` · ${data.schedule.daysOff} days off` : ''}
            </p>
          </CardContent>
        </Card>

        {verified && <DoctorHomeVisitsCard />}

        <Card>
          <CardHeader>
            <CardTitle>Consultation setup</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {data.profile ? (
              <>
                <p>
                  <span className="text-ink-muted">Specialty · </span>
                  {data.profile.specialty}
                </p>
                <p>
                  <span className="text-ink-muted">Qualification · </span>
                  {data.profile.qualification}
                </p>
                <p>
                  <span className="text-ink-muted">Fee · </span>
                  {formatFee(data.profile.consultationFeeInr) ?? 'Not set'}
                </p>
                <p>
                  <span className="text-ink-muted">Types · </span>
                  {data.profile.consultationModes.length === 0
                    ? 'None yet'
                    : data.profile.consultationModes
                        .map((mode) => (mode === 'online' ? 'Video' : 'In clinic'))
                        .join(', ')}
                </p>
                <p>
                  <span className="text-ink-muted">Home visits · </span>
                  Assigned by operations (not a profile toggle). Use the{' '}
                  <span className="font-semibold text-ink">Home visits</span> card on this dashboard
                  to accept offers and update en-route status.{' '}
                  <Link to="/doctor-at-home" className="font-semibold text-coral-ink hover:underline">
                    Patient info
                  </Link>
                </p>
                {data.video.offeredOnProfile && (
                  <p>
                    <span className="text-ink-muted">Video calls · </span>
                    {data.video.patientBookingOpen
                      ? 'Open for patient booking'
                      : data.video.platformReady
                        ? 'Platform ready — check profile and timetable'
                        : data.schedule.onlineBlocks > 0
                          ? 'Waiting for server setup (LiveKit secret in backend/.env)'
                          : 'Add video hours on your timetable'}
                  </p>
                )}
                <p>
                  <span className="text-ink-muted">Directory · </span>
                  {data.profile.published ? 'Published' : 'Not published'}
                </p>
                {data.profile.published && data.availabilityStatus === 'available' && (
                  <p>
                    <span className="text-ink-muted">Next bookable day · </span>
                    {data.profile.nextAvailableDate
                      ? formatDay(data.profile.nextAvailableDate)
                      : 'No open slots in the next 30 days — check hours and days off'}
                  </p>
                )}
                {data.profile.published && (
                  <div className="flex flex-col gap-1 pt-1">
                    <Link
                      to={`/doctors/${data.profile.slug}`}
                      className="font-semibold text-coral-ink hover:underline"
                    >
                      View your public profile
                    </Link>
                    <Link
                      to="/doctors?sort=next_available&takingBookings=1"
                      className="text-sm font-semibold text-coral-ink hover:underline"
                    >
                      See the public doctor directory
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <p className="text-ink-muted">
                Your professional profile is created when you submit your medical registration.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming patients</CardTitle>
          </CardHeader>
          <CardContent>
            {data.appointments.upcoming.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No confirmed upcoming appointments.
                {data.appointments.pastCount > 0
                  ? ` ${data.appointments.pastCount} earlier appointments are on the appointments page.`
                  : ''}
              </p>
            ) : (
              <ul className="flex flex-col gap-4 text-sm">
                {data.appointments.upcoming.map((item) => (
                  <li key={item.id} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <span className="font-semibold">{item.patientName}</span>
                      <span className="text-ink-muted">
                        {formatWhen(item.startsAt)} · {item.mode === 'online' ? 'Video' : 'Clinic'}
                        {item.status === 'pending_doctor' ? ' · awaiting your response' : ''}
                      </span>
                    </div>
                    {item.mode === 'online' && item.status === 'confirmed' && item.videoOpensAt && (
                      <VideoJoinLink
                        appointment={{ videoOpensAt: item.videoOpensAt, endsAt: item.endsAt }}
                        to={`/doctor/appointments/${item.id}/call`}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {user && hasPermission(user, 'appointments:self:book') && (
        <p className="mt-8 text-sm text-ink-muted">
          This account can also book care as a patient.{' '}
          <Link to="/patient" className="font-semibold text-coral-ink hover:underline">
            Open your patient dashboard
          </Link>
        </p>
      )}
    </div>
  );
}

function CredentialsCard({ data }: { data: DoctorDashboard }) {
  const locked = data.verificationStatus === 'verified' || data.verificationStatus === 'suspended';
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registration and specialty</CardTitle>
      </CardHeader>
      <CardContent>
        {locked && data.application ? (
          <dl className="grid gap-3 text-sm">
            <Item label="Council" value={data.application.registrationCouncil} />
            <Item label="Registration number" value={data.application.registrationNumber} />
            <Item label="Year" value={String(data.application.registrationYear)} />
            <Item label="Qualification" value={data.application.qualification} />
            <Item label="Specialty" value={data.application.specialty} />
            {data.verificationStatus === 'verified' && (
              <p className="text-ink-muted">
                These details were reviewed and can no longer be edited here. About text, languages,
                fees and clinic location stay on your professional profile.
              </p>
            )}
          </dl>
        ) : (
          <CredentialsForm data={data} />
        )}
      </CardContent>
    </Card>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function CredentialsForm({ data }: { data: DoctorDashboard }) {
  const queryClient = useQueryClient();
  const pending = data.application?.status === 'pending';
  const form = useForm<DoctorApplicationValues>({
    resolver: zodResolver(doctorApplicationSchema),
    defaultValues: {
      registrationNumber: data.application?.registrationNumber ?? '',
      registrationCouncil: data.application?.registrationCouncil ?? '',
      registrationYear: data.application ? String(data.application.registrationYear) : '',
      qualification: data.application?.qualification ?? '',
      specialty: data.application?.specialty ?? '',
    },
  });
  const save = useMutation({
    mutationFn: (values: DoctorApplicationValues) => {
      const body = { ...values, registrationYear: Number(values.registrationYear) };
      return pending ? doctorsApi.updateApplication(body) : doctorsApi.apply(body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: DOCTOR_DASHBOARD_KEY });
    },
  });
  const error = save.error instanceof ApiError ? save.error : null;

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={form.handleSubmit((values) => save.mutate(values))}
    >
      <p className="text-sm text-ink-muted">
        {pending
          ? 'You can correct these details while verification is pending. Submitting them does not verify you.'
          : 'Send your registration for an administrator to review. This does not verify you.'}
      </p>
      {error && <Alert tone="error">{error.details[0] ?? error.message}</Alert>}
      <FormField
        label="Medical council"
        error={form.formState.errors.registrationCouncil?.message}
        {...form.register('registrationCouncil')}
      />
      <FormField
        label="Registration number"
        error={form.formState.errors.registrationNumber?.message}
        {...form.register('registrationNumber')}
      />
      <FormField
        label="Year of registration"
        inputMode="numeric"
        error={form.formState.errors.registrationYear?.message}
        {...form.register('registrationYear')}
      />
      <FormField
        label="Qualification"
        error={form.formState.errors.qualification?.message}
        {...form.register('qualification')}
      />
      <FormField
        label="Specialty"
        error={form.formState.errors.specialty?.message}
        {...form.register('specialty')}
      />
      <Button type="submit" loading={save.isPending}>
        {pending ? 'Save registration details' : 'Submit for verification'}
      </Button>
    </form>
  );
}

function AvailabilityControls({
  current,
  disabled,
  verified,
}: {
  current: AvailabilityStatus | null;
  disabled: boolean;
  verified: boolean;
}) {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (availabilityStatus: AvailabilityStatus) =>
      doctorsApi.setAvailability(availabilityStatus),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: DOCTOR_DASHBOARD_KEY });
    },
  });
  const error = save.error instanceof ApiError ? save.error : null;

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error">{error.details[0] ?? error.message}</Alert>}
      <div className="flex flex-wrap gap-2">
        {AVAILABILITY_OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={current === option.value ? 'primary' : 'secondary'}
            disabled={disabled || (option.value === 'available' && !verified)}
            loading={save.isPending && save.variables === option.value}
            onClick={() => save.mutate(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
