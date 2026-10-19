import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { formatDay } from '@/features/appointments/api';
import { calendarApi, type PublicHolidayRegion } from '@/features/calendar/api';
import { ApiError } from '@/lib/api-client';
import { usePageTitle } from '@/lib/use-page-title';

const ADMIN_HOLIDAYS_KEY = ['admin', 'public-holidays'] as const;

const REGION_OPTIONS: { value: PublicHolidayRegion; label: string }[] = [
  { value: 'IN', label: 'India (national)' },
  { value: 'IN-KA', label: 'Karnataka' },
  { value: 'IN-MH', label: 'Maharashtra' },
  { value: 'IN-TN', label: 'Tamil Nadu' },
  { value: 'IN-DL', label: 'Delhi' },
  { value: 'IN-TG', label: 'Telangana' },
];

export function AdminPublicHolidaysPage() {
  usePageTitle('Public holidays');
  const queryClient = useQueryClient();
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [region, setRegion] = useState<PublicHolidayRegion>('IN');

  const list = useQuery({
    queryKey: ADMIN_HOLIDAYS_KEY,
    queryFn: ({ signal }) => calendarApi.admin.list(signal),
  });

  const create = useMutation({
    mutationFn: () => calendarApi.admin.create({ date, name: name.trim(), region }),
    onSuccess: async () => {
      setDate('');
      setName('');
      await queryClient.invalidateQueries({ queryKey: ADMIN_HOLIDAYS_KEY });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => calendarApi.admin.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_HOLIDAYS_KEY }),
  });

  const createError =
    create.error instanceof ApiError ? create.error.message : create.isError ? 'Could not add holiday.' : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Administration"
        title="India public holidays"
        description="National and pilot state holidays for the “On a public holiday” directory filter. National dates always count; state rows add to that when patients pick a state. Every list view and change is audited."
      />

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Add a holiday</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!date || !name.trim()) return;
              create.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-sm font-semibold text-ink">Region</span>
                <select
                  value={region}
                  onChange={(event) => setRegion(event.target.value as PublicHolidayRegion)}
                  className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[0.95rem] hover:border-rose focus-visible:border-coral-ink"
                >
                  {REGION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <FormField
                label="Date (IST)"
                id="holiday-date"
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
              <FormField
                label="Name"
                id="holiday-name"
                type="text"
                required
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Republic Day"
              />
            </div>
            {createError && (
              <Alert tone="error" title="Could not save">
                {createError}
              </Alert>
            )}
            <Button type="submit" loading={create.isPending} className="w-fit">
              Add holiday
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-5" aria-hidden="true" />
            Scheduled holidays
          </CardTitle>
        </CardHeader>
        <CardContent>
          {list.isError && (
            <Alert tone="error" title="Could not load holidays">
              Try refreshing the page.
            </Alert>
          )}
          {list.isPending && <p className="text-sm text-ink-muted">Loading…</p>}
          {list.data?.length === 0 && (
            <p className="text-sm text-ink-muted">
              No rows in the database yet. The directory filter uses the built-in national list until
              you add holidays here or run <code className="text-xs">db:seed-public-holidays</code>.
            </p>
          )}
          {list.data && list.data.length > 0 && (
            <ul className="flex flex-col divide-y divide-line">
              {list.data.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-sm text-ink-muted">
                      {formatDay(row.date)} · {row.region}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={remove.isPending && remove.variables === row.id}
                    onClick={() => remove.mutate(row.id)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
