import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoading } from '@/components/layout/page-loading';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent } from '@/components/ui/card';
import { usePageTitle } from '@/lib/use-page-title';
import { OPS_HOME_VISITS_KEY, opsApi } from './api';

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
  const list = useQuery({
    queryKey: OPS_HOME_VISITS_KEY,
    queryFn: () => opsApi.homeVisits(),
    refetchInterval: 30_000,
  });

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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
