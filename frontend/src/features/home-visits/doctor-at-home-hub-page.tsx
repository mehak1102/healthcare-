import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoading } from '@/components/layout/page-loading';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePageTitle } from '@/lib/use-page-title';
import { hasPermission, useCurrentUser } from '@/features/auth/use-auth';
import {
  fetchHomeVisitStatus,
  fetchPinCoverage,
  homeVisitIsActive,
  homeVisitStatusLabel,
  HOME_VISIT_MINE_KEY,
  homeVisitsApi,
} from './api';
import { useState } from 'react';

export function DoctorAtHomeHubPage() {
  usePageTitle('Doctor at home');
  const { data: user } = useCurrentUser();
  const canBook = hasPermission(user, 'appointments:self:book');
  const [pinInput, setPinInput] = useState('');
  const debouncedPin = useDebouncedValue(pinInput.replace(/\s/g, ''), 400);

  const status = useQuery({
    queryKey: ['home-visits', 'status'],
    queryFn: ({ signal }) => fetchHomeVisitStatus(signal),
    staleTime: 60_000,
  });

  const pinCheck = useQuery({
    queryKey: ['home-visits', 'pin', debouncedPin],
    queryFn: ({ signal }) => fetchPinCoverage(debouncedPin, signal),
    enabled: debouncedPin.length >= 6 && status.data?.pilot.pinCodeLookup === true,
  });

  const mine = useQuery({
    queryKey: HOME_VISIT_MINE_KEY,
    queryFn: () => homeVisitsApi.mine(),
    enabled: Boolean(user && canBook),
    refetchInterval: (q) => {
      const active = q.state.data?.items.some((i) => homeVisitIsActive(i.status));
      return active ? 12_000 : false;
    },
  });

  if (status.isPending) return <PageLoading />;

  const bookingOpen = status.data?.pilot.bookingOpen === true;
  const activeVisit = mine.data?.items.find((i) => homeVisitIsActive(i.status));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Services"
        title="Doctor at home"
        description={
          bookingOpen
            ? 'Book a verified doctor for a pilot-area home visit. Status and fees come from the server — nothing is invented here.'
            : status.data?.message ??
              'Home visits are controlled by a server flag until dispatch is ready in your environment.'
        }
      />

      <div className="mt-6 flex flex-wrap gap-2">
        <Badge tone={bookingOpen ? 'success' : 'soon'}>
          {bookingOpen ? 'Booking open (pilot PINs)' : 'Booking closed'}
        </Badge>
        {status.data?.pilot.states.length ? (
          <Badge tone="neutral">Pilot: {status.data.pilot.states.join(', ')}</Badge>
        ) : null}
      </div>

      {activeVisit && (
        <Alert tone="warning" title="You have an open home visit" className="mt-6">
          Status: {homeVisitStatusLabel(activeVisit.status)}.{' '}
          <Link
            to={`/doctor-at-home/visits/${activeVisit.id}`}
            className="font-semibold text-coral-ink hover:underline"
          >
            Track this visit
          </Link>
        </Alert>
      )}

      {canBook && bookingOpen && !activeVisit && (
        <Link to="/doctor-at-home/book" className={buttonVariants({ className: 'mt-6 w-fit' })}>
          Book a home visit
        </Link>
      )}

      {canBook && bookingOpen && activeVisit && (
        <p className="mt-4 text-sm text-ink-muted">
          Finish or cancel your current visit before starting another request.
        </p>
      )}

      {!user && bookingOpen && (
        <p className="mt-6 text-sm text-ink-muted">
          <Link to="/login?next=%2Fdoctor-at-home%2Fbook" className="font-semibold text-coral-ink hover:underline">
            Sign in
          </Link>{' '}
          as a patient to book.
        </p>
      )}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Check pilot coverage</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">PIN code</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={8}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="e.g. 110064"
              disabled={status.data?.pilot.pinCodeLookup !== true}
              className="h-11 w-full max-w-xs rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[0.95rem]"
            />
          </label>
          {pinCheck.isFetching && debouncedPin.length >= 6 && (
            <span className="text-sm text-ink-muted">Checking…</span>
          )}
          {pinCheck.data && <p className="text-sm text-ink-muted">{pinCheck.data.message}</p>}
        </CardContent>
      </Card>

      {mine.data && mine.data.items.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Your home visits</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3 text-sm">
              {mine.data.items.slice(0, 8).map((row) => (
                <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    to={`/doctor-at-home/visits/${row.id}`}
                    className="font-semibold hover:text-coral-ink hover:underline"
                  >
                    PIN {row.pinCode}
                  </Link>
                  <span className="text-ink-muted">{homeVisitStatusLabel(row.status)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <p className="mt-8 text-sm text-ink-muted">
        Not for emergencies — call{' '}
        <a href="tel:112" className="font-semibold text-ink hover:underline">
          112
        </a>
        . For clinic or video visits, use{' '}
        <Link to="/doctors?takingBookings=1" className="font-semibold text-coral-ink hover:underline">
          Find a doctor
        </Link>
        .
      </p>
    </div>
  );
}
