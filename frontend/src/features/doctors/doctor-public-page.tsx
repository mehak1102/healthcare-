import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Languages, MapPin, ShieldCheck, Video } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { formatDay } from '@/features/appointments/api';
import { PageLoading } from '@/components/layout/page-loading';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookingPanel } from '@/features/appointments/booking-panel';
import { ApiError } from '@/lib/api-client';
import { usePageTitle } from '@/lib/use-page-title';
import { doctorName, doctorsApi, formatFee, MODE_LABELS } from './api';
import { DoctorAvatar } from './doctor-avatar';

const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'long' });

export function DoctorPublicPage() {
  const { slug = '' } = useParams();
  const doctor = useQuery({
    queryKey: ['doctors', 'profile', slug],
    queryFn: () => doctorsApi.publicProfile(slug),
  });
  usePageTitle(doctor.data ? doctorName(doctor.data.displayName) : 'Doctor');

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        to="/doctors"
        className="inline-flex items-center gap-1 text-sm font-semibold text-coral-ink hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden="true" /> All doctors
      </Link>

      <div className="mt-6">
        {doctor.isPending && <PageLoading />}
        {doctor.isError && (
          <Alert tone="error">
            {doctor.error instanceof ApiError && doctor.error.status === 404
              ? 'This doctor is not listed on Sukoon Health.'
              : 'We could not load this profile. Please try again.'}
          </Alert>
        )}
        {doctor.data && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <DoctorAvatar name={doctor.data.displayName} className="size-20 text-2xl" />
              <div>
                <h1 className="text-3xl font-semibold">{doctorName(doctor.data.displayName)}</h1>
                <p className="mt-1 text-lg">{doctor.data.specialty}</p>
                <p className="text-ink-muted">{doctor.data.qualification}</p>
                {doctor.data.availabilityStatus === 'available' ? (
                  <Badge tone="success" className="mt-3 w-fit">Taking bookings</Badge>
                ) : (
                  doctor.data.availabilityStatus && (
                    <Badge tone="warning" className="mt-3 w-fit">
                      {doctor.data.availabilityStatus === 'on_leave'
                        ? 'On leave'
                        : doctor.data.availabilityStatus === 'busy'
                          ? 'Busy'
                          : 'Not taking bookings'}
                    </Badge>
                  )
                )}
                {doctor.data.nextAvailableDate && (
                  <p className="mt-2 text-sm text-ink-muted">
                    Next available:{' '}
                    <span className="font-medium text-ink">
                      {formatDay(doctor.data.nextAvailableDate)}
                    </span>{' '}
                    (India time)
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-[var(--radius-control)] border border-sage/60 bg-success-surface px-4 py-3 text-sm text-success-ink">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                Registration {doctor.data.registrationNumber} with the{' '}
                {doctor.data.registrationCouncil} ({doctor.data.registrationYear}) was checked
                against the medical register by our team
                {doctor.data.registrationCheckedAt
                  ? ` on ${dateFormat.format(new Date(doctor.data.registrationCheckedAt))}`
                  : ''}
                .
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>About</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{doctor.data.bio}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Consultation</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                  {formatFee(doctor.data.consultationFeeInr) && (
                    <p className="text-base font-semibold">
                      {formatFee(doctor.data.consultationFeeInr)}
                    </p>
                  )}
                  {doctor.data.consultationModes.includes('online') && (
                    <p className="flex items-center gap-2">
                      <Video className="size-4 text-coral-ink" aria-hidden="true" />
                      {MODE_LABELS.online}
                    </p>
                  )}
                  {doctor.data.consultationModes.includes('clinic') && (
                    <p className="flex items-start gap-2">
                      <MapPin
                        className="mt-0.5 size-4 shrink-0 text-coral-ink"
                        aria-hidden="true"
                      />
                      <span>
                        {MODE_LABELS.clinic}
                        {doctor.data.clinicName && (
                          <span className="block text-ink-muted">
                            {[doctor.data.clinicName, doctor.data.locality, doctor.data.city]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        )}
                      </span>
                    </p>
                  )}
                  <p className="flex items-start gap-2">
                    <Languages
                      className="mt-0.5 size-4 shrink-0 text-coral-ink"
                      aria-hidden="true"
                    />
                    {doctor.data.languages.join(', ')}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Book an appointment</CardTitle>
              </CardHeader>
              <CardContent>
                <BookingPanel doctor={doctor.data} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
