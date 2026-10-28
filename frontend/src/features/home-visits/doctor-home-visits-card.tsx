import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { ApiError } from '@/lib/api-client';
import {
  formatHomeVisitInr,
  homeVisitStatusLabel,
  PROVIDER_HV_ASSIGNED_KEY,
  PROVIDER_HV_OFFERS_KEY,
  homeVisitsApi,
  type HomeVisitRequestStatus,
  type ProviderAssignedVisit,
} from './api';
import { readCurrentPosition } from './geolocation';
import { useDoctorVisitGps } from './use-doctor-visit-gps';

const NEXT_STATUS: Partial<Record<HomeVisitRequestStatus, 'en_route' | 'completed'>> = {
  accepted: 'en_route',
  arrived: 'completed',
};

const NEXT_LABEL: Record<'en_route' | 'completed', string> = {
  en_route: 'Mark en route (share GPS)',
  completed: 'Mark completed',
};

export function DoctorHomeVisitsCard() {
  const queryClient = useQueryClient();

  const offers = useQuery({
    queryKey: PROVIDER_HV_OFFERS_KEY,
    queryFn: () => homeVisitsApi.providerOffers(),
    refetchInterval: 15_000,
  });

  const assigned = useQuery({
    queryKey: PROVIDER_HV_ASSIGNED_KEY,
    queryFn: () => homeVisitsApi.providerAssigned(),
    refetchInterval: 15_000,
  });

  const accept = useMutation({
    mutationFn: (offerId: string) => homeVisitsApi.acceptOffer(offerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROVIDER_HV_OFFERS_KEY });
      void queryClient.invalidateQueries({ queryKey: PROVIDER_HV_ASSIGNED_KEY });
    },
  });

  const advance = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: 'en_route' | 'completed';
    }) => {
      if (status === 'en_route') {
        const coords = await readCurrentPosition();
        return homeVisitsApi.advanceStatus(id, status, coords);
      }
      return homeVisitsApi.advanceStatus(id, status);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROVIDER_HV_ASSIGNED_KEY });
    },
  });

  const offerItems = offers.data?.items ?? [];
  const assignedItems = assigned.data?.items ?? [];

  if (offerItems.length === 0 && assignedItems.length === 0 && !offers.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Home visits</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-ink-muted">
          No dispatch offers or active home visits. Operations assigns visits after payment — set your
          home visit service PIN on{' '}
          <Link to="/doctor/profile" className="font-semibold text-coral-ink hover:underline">
            your profile
          </Link>{' '}
          to match the patient’s area (same 6-digit PIN).
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Home visits</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {offerItems.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-ink">Dispatch offers</h3>
            <ul className="mt-3 flex flex-col gap-4">
              {offerItems.map(({ offer, request }) => (
                <li
                  key={offer.id}
                  className="rounded-lg border border-line bg-sand/40 p-4 text-sm"
                >
                  <p className="font-semibold">PIN {request.pinCode}</p>
                  <p className="text-ink-muted">{request.chiefComplaint}</p>
                  <p className="mt-1 text-ink-muted">
                    {request.addressLine1}
                    {request.locality ? ` · ${request.locality}` : ''}
                  </p>
                  <p className="mt-1 tabular-nums">{formatHomeVisitInr(request.fee.amountMinor)}</p>
                  <p className="text-xs text-ink-muted">
                    Offer expires {new Date(offer.expiresAt).toLocaleString('en-IN')}
                  </p>
                  <Button
                    size="sm"
                    className="mt-3"
                    disabled={accept.isPending}
                    onClick={() => accept.mutate(offer.id)}
                  >
                    Accept visit
                  </Button>
                  {accept.isError && accept.error instanceof ApiError && (
                    <p className="mt-2 text-ink-muted">{accept.error.message}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {assignedItems.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-ink">Active visits</h3>
            <ul className="mt-3 flex flex-col gap-4">
              {assignedItems.map((row) => (
                <DoctorActiveVisitRow
                  key={row.id}
                  row={row}
                  advancePending={advance.isPending}
                  onAdvance={(status) => advance.mutate({ id: row.id, status })}
                  advanceError={advance.isError && advance.error instanceof ApiError ? advance.error.message : null}
                />
              ))}
            </ul>
          </div>
        )}

        {(offers.isError || assigned.isError) && (
          <Alert tone="error" title="Could not refresh home visits">
            Try again in a moment.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function DoctorActiveVisitRow({
  row,
  advancePending,
  onAdvance,
  advanceError,
}: {
  row: ProviderAssignedVisit;
  advancePending: boolean;
  onAdvance: (status: 'en_route' | 'completed') => void;
  advanceError: string | null;
}) {
  const queryClient = useQueryClient();
  const [arrivalCode, setArrivalCode] = useState('');
  const next = NEXT_STATUS[row.status];
  useDoctorVisitGps(row.id, row.status === 'en_route');

  const verifyArrival = useMutation({
    mutationFn: () => homeVisitsApi.verifyArrival(row.id, arrivalCode.trim()),
    onSuccess: () => {
      setArrivalCode('');
      void queryClient.invalidateQueries({ queryKey: PROVIDER_HV_ASSIGNED_KEY });
    },
  });

  const verifyError =
    verifyArrival.error instanceof ApiError ? verifyArrival.error.message : null;

  return (
    <li className="rounded-lg border border-line bg-surface p-4 text-sm">
      <p className="font-semibold">
        PIN {row.pinCode} · {homeVisitStatusLabel(row.status)}
      </p>
      <p className="text-ink-muted">{row.addressLine1}</p>
      {row.status === 'en_route' && (
        <p className="mt-1 text-xs text-ink-muted">
          Sharing live GPS with the patient map. Keep this tab open on your phone until you arrive.
        </p>
      )}
      {row.status === 'en_route' && (
        <div className="mt-3 flex flex-col gap-2">
          <FormField
            label="Patient arrival code"
            id={`hv-arrival-${row.id}`}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={arrivalCode}
            onChange={(e) => setArrivalCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6 digits"
          />
          <Button
            size="sm"
            disabled={arrivalCode.length < 6 || verifyArrival.isPending}
            onClick={() => verifyArrival.mutate()}
          >
            {verifyArrival.isPending ? 'Verifying…' : 'Verify code & mark arrived'}
          </Button>
          {verifyError && <p className="text-ink-muted">{verifyError}</p>}
        </div>
      )}
      {next && row.status !== 'en_route' && (
        <Button
          size="sm"
          variant="secondary"
          className="mt-3"
          disabled={advancePending}
          onClick={() => onAdvance(next)}
        >
          {NEXT_LABEL[next]}
        </Button>
      )}
      {advanceError && <p className="mt-2 text-ink-muted">{advanceError}</p>}
    </li>
  );
}
