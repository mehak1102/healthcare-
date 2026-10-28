import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { ApiError } from '@/lib/api-client';
import { usePageTitle } from '@/lib/use-page-title';
import { doctorName } from '@/features/doctors/api';
import {
  fetchPinCoverage,
  formatHomeVisitInr,
  HOME_VISIT_WINDOWS,
  homeVisitsApi,
  type HomeVisitAvailableDoctor,
  type HomeVisitPreferredWindow,
} from './api';

export function BookHomeVisitPage() {
  usePageTitle('Book doctor at home');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [pin, setPin] = useState(params.get('pin') ?? '');
  const [addressLine1, setAddressLine1] = useState('');
  const [locality, setLocality] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [preferredWindow, setPreferredWindow] = useState<HomeVisitPreferredWindow>('asap');
  const [step, setStep] = useState<'form' | 'doctors'>('form');
  const [selectedDoctor, setSelectedDoctor] = useState<HomeVisitAvailableDoctor | null>(null);

  const normalizedPin = pin.replace(/\s/g, '');

  const coverage = useQuery({
    queryKey: ['home-visits', 'pin', normalizedPin],
    queryFn: ({ signal }) => fetchPinCoverage(normalizedPin, signal),
    enabled: normalizedPin.length >= 6,
  });

  const availableDoctors = useQuery({
    queryKey: ['home-visits', 'available-doctors', normalizedPin],
    queryFn: () => homeVisitsApi.availableDoctors(normalizedPin),
    enabled: step === 'doctors' && normalizedPin.length >= 6,
  });

  const book = useMutation({
    mutationFn: async () => {
      let destinationLat: number | undefined;
      let destinationLng: number | undefined;
      try {
        const { readCurrentPosition } = await import('./geolocation');
        const pos = await readCurrentPosition();
        destinationLat = pos.lat;
        destinationLng = pos.lng;
      } catch {
        /* address geocoding on server */
      }
      return homeVisitsApi.create({
        pin: normalizedPin,
        addressLine1: addressLine1.trim(),
        locality: locality.trim() || undefined,
        chiefComplaint: chiefComplaint.trim(),
        preferredWindow,
        doctorUserId: selectedDoctor!.userId,
        destinationLat,
        destinationLng,
      });
    },
    onSuccess: (request) => {
      navigate(`/doctor-at-home/visits/${request.id}`, { replace: true });
    },
  });

  const pinOk = coverage.data?.valid && coverage.data.inPilotArea;
  const bookingOpen =
    coverage.data?.bookingOpen ?? availableDoctors.data?.bookingOpen ?? false;

  const formError =
    (availableDoctors.error instanceof ApiError && availableDoctors.error.message) ||
    (book.error instanceof ApiError && book.error.message) ||
    null;

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <PageHeader
        eyebrow="Doctor at home"
        title="Book a visit"
        description="Choose a verified doctor in your pilot PIN. Each doctor sets their own visit fee."
        actions={
          <Link to="/doctor-at-home" className="text-sm font-semibold text-coral-ink hover:underline">
            Back
          </Link>
        }
      />

      {formError && (
        <Alert tone="error" title="Could not continue" className="mt-6">
          {formError}
        </Alert>
      )}

      {step === 'form' && (
        <form
          className="mt-8 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pinOk) return;
            setSelectedDoctor(null);
            setStep('doctors');
          }}
        >
          <FormField
            label="PIN code"
            id="hv-pin"
            required
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          {coverage.data && !coverage.data.inPilotArea && (
            <p className="text-sm text-ink-muted">{coverage.data.message}</p>
          )}

          <FormField
            label="Address"
            id="hv-address"
            required
            minLength={5}
            maxLength={200}
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            placeholder="Flat / house, street"
          />

          <FormField
            label="Locality (optional)"
            id="hv-locality"
            maxLength={120}
            value={locality}
            onChange={(e) => setLocality(e.target.value)}
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">What do you need help with?</span>
            <textarea
              id="hv-complaint"
              required
              minLength={10}
              maxLength={500}
              rows={4}
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              className="w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">Preferred window</span>
            <select
              id="hv-window"
              value={preferredWindow}
              onChange={(e) => setPreferredWindow(e.target.value as HomeVisitPreferredWindow)}
              className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3"
            >
              {HOME_VISIT_WINDOWS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>

          <Button type="submit" disabled={!pinOk}>
            See available doctors
          </Button>
        </form>
      )}

      {step === 'doctors' && (
        <div className="mt-8 flex flex-col gap-4">
          <p className="text-sm text-ink-muted">
            PIN <span className="font-mono font-semibold text-ink">{normalizedPin}</span> ·{' '}
            {addressLine1.trim()}
          </p>

          {availableDoctors.isPending && (
            <p className="text-sm text-ink-muted">Loading doctors for your area…</p>
          )}

          {availableDoctors.data && availableDoctors.data.items.length === 0 && (
            <Alert tone="info" title="No doctors listed yet">
              No verified doctor has set a home visit fee for this PIN. Try another pilot area or check
              back later.
            </Alert>
          )}

          {availableDoctors.data && availableDoctors.data.items.length > 0 && (
            <ul className="flex flex-col gap-3">
              {availableDoctors.data.items.map((doc) => {
                const selected = selectedDoctor?.userId === doc.userId;
                return (
                  <li key={doc.userId}>
                    <button
                      type="button"
                      onClick={() => setSelectedDoctor(doc)}
                      className={`flex w-full flex-col items-start rounded-[var(--radius-card)] border px-4 py-3 text-left transition-colors ${
                        selected
                          ? 'border-coral-ink bg-coral/10'
                          : 'border-line bg-surface hover:bg-sand/50'
                      }`}
                    >
                      <span className="font-semibold text-ink">{doctorName(doc.displayName)}</span>
                      <span className="text-sm text-ink-muted">
                        {doc.specialty} · {doc.qualification}
                      </span>
                      <span className="mt-1 text-sm font-semibold tabular-nums text-ink">
                        Home visit fee: {formatHomeVisitInr(doc.fee.amountMinor)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {!bookingOpen && (
            <Alert tone="warning" title="Booking is closed">
              The server will not accept new requests until HOME_VISIT_BOOKING_OPEN is enabled.
            </Alert>
          )}

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep('form')}>
              Edit details
            </Button>
            <Button
              type="button"
              disabled={
                !bookingOpen ||
                !selectedDoctor ||
                book.isPending ||
                !availableDoctors.data?.items.length
              }
              onClick={() => book.mutate()}
            >
              {book.isPending ? 'Submitting…' : 'Request this doctor'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
