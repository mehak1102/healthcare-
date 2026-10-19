import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronRight, MapPin } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoading } from '@/components/layout/page-loading';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent } from '@/components/ui/card';
import { doctorName, MODE_LABELS } from '@/features/doctors/api';
import { usePageTitle } from '@/lib/use-page-title';
import { appointmentsApi, formatDateTime, MY_APPOINTMENTS_KEY, type Scope } from './api';
import { AppointmentStatusBadge } from './appointment-status-badge';
import { ScopeTabs } from './scope-tabs';

export function MyAppointmentsPage() {
  usePageTitle('Your appointments');
  const [scope, setScope] = useState<Scope>('upcoming');
  const list = useQuery({
    queryKey: [...MY_APPOINTMENTS_KEY, scope],
    queryFn: () => appointmentsApi.mine(scope),
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Appointments"
        title="Your appointments"
        actions={
          <Link to="/doctors" className={buttonVariants({ variant: 'primary' })}>
            Book an appointment
          </Link>
        }
      />
      <div className="mt-8 flex flex-col gap-4">
        <ScopeTabs scope={scope} onChange={setScope} />
        {list.isPending && <PageLoading />}
        {list.isError && <Alert tone="error">We could not load your appointments.</Alert>}
        {list.data?.items.length === 0 && (
          <p className="text-ink-muted">
            {scope === 'upcoming' ? 'You have no upcoming appointments.' : 'Nothing here yet.'}
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {list.data?.items.map((item) => (
            <li key={item.id}>
              <Link to={`/appointments/${item.id}`} className="block">
                <Card className="transition-colors hover:border-rose">
                  <CardContent className="flex items-center justify-between gap-4 py-4">
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold">{doctorName(item.doctor.displayName)}</p>
                      <p className="text-sm text-ink-muted">{item.doctor.specialty}</p>
                      <p className="flex items-center gap-1.5 text-sm">
                        <CalendarDays className="size-4 text-coral-ink" aria-hidden="true" />
                        {formatDateTime(item.startsAt)}
                      </p>
                      <p className="flex items-center gap-1.5 text-sm text-ink-muted">
                        <MapPin className="size-4" aria-hidden="true" />
                        {MODE_LABELS[item.mode]}
                        {item.mode === 'clinic' && item.doctor.clinicName
                          ? ` · ${item.doctor.clinicName}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <AppointmentStatusBadge status={item.status} />
                      <ChevronRight className="size-4 text-ink-muted" aria-hidden="true" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
