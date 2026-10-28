import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoading } from '@/components/layout/page-loading';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePageTitle } from '@/lib/use-page-title';
import { ApiError } from '@/lib/api-client';
import { OPS_DISPATCH_DOCTORS_KEY, OPS_HOME_VISITS_KEY, opsApi } from './api';

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));

const inr = (minor: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(minor / 100);

export function OpsHomeVisitsPage() {
  usePageTitle('Home visit requests');
  const queryClient = useQueryClient();
  const [reassignId, setReassignId] = useState<string | null>(null);
  const [reassignPin, setReassignPin] = useState('');
  const [showAllDoctors, setShowAllDoctors] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [doctorUserId, setDoctorUserId] = useState('');
  const [selectedDoctorLabel, setSelectedDoctorLabel] = useState('');
  const [note, setNote] = useState('');
  const debouncedDoctorSearch = useDebouncedValue(doctorSearch, 300);

  const doctorQuery = {
    q: debouncedDoctorSearch,
    pin: reassignPin,
    all: showAllDoctors,
  };

  const doctorOptions = useQuery({
    queryKey: OPS_DISPATCH_DOCTORS_KEY(doctorQuery),
    queryFn: () => opsApi.dispatchDoctors(doctorQuery),
    enabled: Boolean(reassignId),
  });

  const list = useQuery({
    queryKey: OPS_HOME_VISITS_KEY,
    queryFn: () => opsApi.homeVisits(),
    refetchInterval: 30_000,
  });

  const reassign = useMutation({
    mutationFn: () =>
      opsApi.reassignHomeVisit(reassignId!, {
        doctorUserId: doctorUserId.trim(),
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      setReassignId(null);
      setDoctorUserId('');
      setDoctorSearch('');
      setSelectedDoctorLabel('');
      setNote('');
      void queryClient.invalidateQueries({ queryKey: OPS_HOME_VISITS_KEY });
    },
  });

  useEffect(() => {
    if (!reassignId) return;
    if (doctorUserId && !selectedDoctorLabel) {
      void opsApi.dispatchDoctors({ q: doctorUserId, pin: reassignPin, all: showAllDoctors }).then((res) => {
        const match = res.items.find((d) => d.userId === doctorUserId);
        if (match) setSelectedDoctorLabel(`${match.displayName} · ${match.specialty}`);
      });
    }
  }, [reassignId, doctorUserId, selectedDoctorLabel, reassignPin, showAllDoctors]);

  if (list.isPending) return <PageLoading />;
  if (list.isError || !list.data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Alert tone="error" title="Could not load home visit requests">
          Try refreshing the page.
        </Alert>
      </div>
    );
  }

  const { items, total } = list.data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Operations"
        title="Home visit requests"
        description="Pilot-area requests only. Reassignment and dispatch offers require the dispatch permission."
        actions={
          <Link to="/ops" className={buttonVariants({ variant: 'ghost' })}>
            Back to ops summary
          </Link>
        }
      />

      {total === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No requests yet. Patient booking stays off until{' '}
            <code className="text-sm">HOME_VISIT_BOOKING_OPEN=true</code> in the API environment.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-sand/80 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Patient</th>
                <th className="px-4 py-3 font-semibold">PIN</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Fee</th>
                <th className="px-4 py-3 font-semibold">Dispatch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {items.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{when(row.createdAt)}</td>
                  <td className="px-4 py-3">{row.patientName}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.pinCode}</td>
                  <td className="px-4 py-3">
                    <Badge tone="neutral">{row.status.replaceAll('_', ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{inr(row.fee.amountMinor)}</td>
                  <td className="px-4 py-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setReassignId(row.id);
                        setReassignPin(row.pinCode);
                        setShowAllDoctors(false);
                        setDoctorUserId(row.assignedDoctorUserId ?? '');
                        setDoctorSearch('');
                        setSelectedDoctorLabel('');
                      }}
                    >
                      Assign doctor
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reassignId && (
        <Card className="mt-6">
          <CardContent className="flex flex-col gap-4 pt-6">
            <p className="text-sm font-semibold">Assign doctor to request {reassignId}</p>
            <p className="text-sm text-ink-muted">
              Patient PIN <span className="font-mono font-semibold text-ink">{reassignPin}</span> —
              only verified doctors with the same home visit service PIN are listed unless you override
              below.
            </p>
            <label className="flex max-w-md flex-col gap-1.5">
              <span className="text-sm font-semibold text-ink">Search verified doctors</span>
              <input
                id="ops-doctor-search"
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
                placeholder="Name, slug, or user id"
                className="h-11 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm"
              />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-coral-ink"
                checked={showAllDoctors}
                onChange={(e) => setShowAllDoctors(e.target.checked)}
              />
              <span>
                Show all verified doctors (ignore PIN). Dispatch still requires the doctor’s service
                PIN to match.
              </span>
            </label>
            {selectedDoctorLabel && (
              <p className="text-sm text-ink-muted">
                Selected: <span className="font-semibold text-ink">{selectedDoctorLabel}</span>
              </p>
            )}
            {doctorOptions.data && doctorOptions.data.items.length > 0 && (
              <ul className="max-w-md divide-y divide-line rounded-lg border border-line bg-surface text-sm">
                {doctorOptions.data.items.map((doc) => (
                  <li key={doc.userId}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start px-3 py-2.5 text-left hover:bg-sand/60"
                      onClick={() => {
                        setDoctorUserId(doc.userId);
                        setSelectedDoctorLabel(
                          `${doc.displayName} · ${doc.specialty}${doc.city ? ` · ${doc.city}` : ''}`,
                        );
                      }}
                    >
                      <span className="font-semibold">{doc.displayName}</span>
                      <span className="text-xs text-ink-muted">
                        {doc.specialty}
                        {doc.city ? ` · ${doc.city}` : ''}
                        {doc.homeVisitServicePinCode ? ` · PIN ${doc.homeVisitServicePinCode}` : ''} ·{' '}
                        {doc.userId}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {doctorOptions.data &&
              doctorOptions.data.items.length === 0 &&
              !doctorOptions.isFetching && (
                <Alert tone="info" title="No matching doctors">
                  No verified doctor has home visit service PIN {reassignPin}. Ask the doctor to set it
                  on their profile, or search with “show all” and fix their PIN before dispatch.
                </Alert>
              )}
            {doctorOptions.isFetching && (
              <p className="text-sm text-ink-muted">Searching doctors…</p>
            )}
            <FormField
              label="Note (optional)"
              id="ops-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="max-w-md"
            />
            {reassign.error instanceof ApiError && (
              <p className="text-sm text-ink-muted">{reassign.error.message}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={!doctorUserId.trim() || reassign.isPending}
                onClick={() => reassign.mutate()}
              >
                {reassign.isPending ? 'Sending offer…' : 'Create dispatch offer'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setReassignId(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
