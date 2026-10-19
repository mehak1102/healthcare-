import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, MapPin, Search, Video } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePageTitle } from '@/lib/use-page-title';
import {
  AVAIL_WHEN,
  AVAIL_WHEN_LABELS,
  CONSULTATION_MODES,
  DIRECTORY_SORTS,
  DIRECTORY_SORT_LABELS,
  FEE_BANDS,
  FEE_BAND_LABELS,
  doctorName,
  doctorsApi,
  formatFee,
  LANGUAGES,
  MODE_LABELS,
  PILOT_STATE_CODES,
  PILOT_STATE_LABELS,
  type AvailWhen,
  type DoctorCard,
  type DirectorySort,
  type FeeBand,
} from './api';
import { formatDay } from '@/features/appointments/api';
import { fetchPublicHolidays } from '@/features/calendar/api';
import { DoctorAvatar } from './doctor-avatar';

const PAGE_SIZE = 12;
const CURRENT_YEAR = new Date().getFullYear();
const FILTER_KEYS = [
  'specialty',
  'city',
  'mode',
  'language',
  'availWhen',
  'holidayState',
  'feeBand',
  'sort',
] as const;

function parseSort(value: string | null): DirectorySort {
  return value === 'next_available' ? 'next_available' : 'name';
}

function parseFeeBand(value: string | null): FeeBand | undefined {
  return FEE_BANDS.includes(value as FeeBand) ? (value as FeeBand) : undefined;
}

function parseHolidayState(value: string | null) {
  return PILOT_STATE_CODES.includes(value as (typeof PILOT_STATE_CODES)[number])
    ? (value as (typeof PILOT_STATE_CODES)[number])
    : undefined;
}

function parseAvailWhen(value: string | null): AvailWhen | undefined {
  return value === 'today' ||
    value === 'tonight' ||
    value === 'weekend' ||
    value === 'public_holiday'
    ? value
    : undefined;
}
const selectClass =
  'h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-[0.95rem] hover:border-rose focus-visible:border-coral-ink';

export function FindDoctorsPage() {
  usePageTitle('Find a doctor');
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [name, setName] = useState('');
  const debouncedName = useDebouncedValue(name.trim(), 350);

  const update = (changes: Record<string, string>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (!('page' in changes)) next.delete('page');
        return next;
      },
      { replace: true },
    );

  const takingBookings = params.get('takingBookings') === '1';
  const hasOpenSlots = params.get('hasOpenSlots') === '1';
  const availWhen = parseAvailWhen(params.get('availWhen'));
  const holidayState = parseHolidayState(params.get('holidayState'));
  const feeBand = parseFeeBand(params.get('feeBand'));
  const sort = parseSort(params.get('sort'));
  const query = {
    specialty: params.get('specialty') ?? undefined,
    city: params.get('city') ?? undefined,
    mode: params.get('mode') ?? undefined,
    language: params.get('language') ?? undefined,
    q: debouncedName || undefined,
    takingBookings: takingBookings || undefined,
    hasOpenSlots: hasOpenSlots || undefined,
    availWhen,
    holidayState: availWhen === 'public_holiday' ? holidayState : undefined,
    feeBand,
    sort,
    page,
  };
  const filters = useQuery({ queryKey: ['doctors', 'filters'], queryFn: doctorsApi.filters });
  const doctors = useQuery({
    queryKey: ['doctors', 'list', query],
    queryFn: ({ signal }) => doctorsApi.directory(query, signal),
    placeholderData: keepPreviousData,
  });
  const holidayList = useQuery({
    queryKey: ['calendar', 'public-holidays', 120],
    queryFn: ({ signal }) => fetchPublicHolidays({ days: 120 }, signal),
    enabled: availWhen === 'public_holiday',
    staleTime: 60_000,
  });

  const filtered =
    FILTER_KEYS.some((key) => params.get(key)) ||
    Boolean(debouncedName) ||
    takingBookings ||
    hasOpenSlots ||
    Boolean(availWhen) ||
    Boolean(holidayState) ||
    Boolean(feeBand) ||
    sort !== 'name';
  const totalPages = doctors.data ? Math.max(1, Math.ceil(doctors.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Find a doctor"
        title="Doctors you can trust"
        description="Every doctor listed here has had their medical registration checked by our team against the official council register."
      />

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Search by name</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={name}
            maxLength={60}
            onChange={(event) => {
              setName(event.target.value);
              if (page > 1) update({});
            }}
            placeholder="Doctor's name"
            className={`${selectClass} pl-10`}
          />
        </label>
        <label>
          <span className="sr-only">Speciality</span>
          <select
            value={params.get('specialty') ?? ''}
            onChange={(event) => update({ specialty: event.target.value })}
            className={selectClass}
          >
            <option value="">All specialities</option>
            {filters.data?.specialties.map((specialty) => (
              <option key={specialty} value={specialty}>
                {specialty}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">City</span>
          <select
            value={params.get('city') ?? ''}
            onChange={(event) => update({ city: event.target.value })}
            className={selectClass}
          >
            <option value="">All cities</option>
            {filters.data?.cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Consultation type</span>
          <select
            value={params.get('mode') ?? ''}
            onChange={(event) => update({ mode: event.target.value })}
            className={selectClass}
          >
            <option value="">Video or in-clinic</option>
            {CONSULTATION_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Language</span>
          <select
            value={params.get('language') ?? ''}
            onChange={(event) => update({ language: event.target.value })}
            className={selectClass}
          >
            <option value="">Any language</option>
            {LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
        </label>
        <label className="flex h-11 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm sm:col-span-2 lg:col-span-3">
          <input
            type="checkbox"
            className="size-4 accent-coral-ink"
            checked={takingBookings}
            onChange={(event) => update({ takingBookings: event.target.checked ? '1' : '' })}
          />
          Taking new bookings
        </label>
        <label className="flex h-11 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm sm:col-span-2 lg:col-span-2">
          <input
            type="checkbox"
            className="size-4 accent-coral-ink"
            checked={hasOpenSlots}
            onChange={(event) => update({ hasOpenSlots: event.target.checked ? '1' : '' })}
          />
          Has open slots (30 days)
        </label>
        <label className="sm:col-span-2 lg:col-span-3">
          <span className="sr-only">Available when</span>
          <select
            value={availWhen ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              if (value !== 'public_holiday') update({ availWhen: value, holidayState: '' });
              else update({ availWhen: value });
            }}
            className={selectClass}
          >
            <option value="">Any time in the next 30 days</option>
            {AVAIL_WHEN.map((when) => (
              <option key={when} value={when}>
                {AVAIL_WHEN_LABELS[when]}
              </option>
            ))}
          </select>
        </label>
        {availWhen === 'public_holiday' && (
          <label className="sm:col-span-2 lg:col-span-2">
            <span className="sr-only">State holidays</span>
            <select
              value={holidayState ?? ''}
              onChange={(event) => update({ holidayState: event.target.value })}
              className={selectClass}
            >
              <option value="">National holidays only</option>
              {PILOT_STATE_CODES.map((code) => (
                <option key={code} value={code}>
                  {PILOT_STATE_LABELS[code]} state holidays too
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="sm:col-span-2 lg:col-span-2">
          <span className="sr-only">Consultation fee</span>
          <select
            value={feeBand ?? ''}
            onChange={(event) => update({ feeBand: event.target.value })}
            className={selectClass}
          >
            <option value="">Any fee</option>
            {FEE_BANDS.map((band) => (
              <option key={band} value={band}>
                {FEE_BAND_LABELS[band]}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2 lg:col-span-5">
          <span className="sr-only">Sort by</span>
          <select
            value={sort}
            onChange={(event) => update({ sort: event.target.value })}
            className={selectClass}
          >
            {DIRECTORY_SORTS.map((key) => (
              <option key={key} value={key}>
                {DIRECTORY_SORT_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {availWhen === 'public_holiday' && (
        <Alert tone="info" title="India national public holidays" className="mt-6">
          {holidayList.isPending && (
            <p className="text-sm text-ink-muted">Loading upcoming holiday dates…</p>
          )}
          {holidayList.isError && (
            <p className="text-sm text-ink-muted">
              We could not load the holiday calendar. The filter still uses the server&apos;s
              built-in national dates.
            </p>
          )}
          {holidayList.data && holidayList.data.items.length === 0 && (
            <p className="text-sm text-ink-muted">
              No national public holidays fall in the next 120 days in our calendar.
            </p>
          )}
          {holidayList.data && holidayList.data.items.length > 0 && (
            <p className="text-sm text-ink-muted">
              Showing doctors with open slots on upcoming holidays (IST)
              {holidayState
                ? ` — national plus ${PILOT_STATE_LABELS[holidayState]} state dates`
                : ' — national gazetted dates'}
              :{' '}
              {holidayList.data.items
                .slice(0, 6)
                .map((row) => `${row.name} (${formatDay(row.date)})`)
                .join(' · ')}
              {holidayList.data.items.length > 6
                ? ` · +${holidayList.data.items.length - 6} more`
                : ''}
              {holidayList.data.source === 'static' && (
                <>
                  {' '}
                  <span className="text-ink-muted/80">
                    (Built-in list until holidays are seeded in the database.)
                  </span>
                </>
              )}
            </p>
          )}
        </Alert>
      )}

      <div className="mt-8">
        {doctors.isError && (
          <Alert tone="error">We could not load doctors. Please try again.</Alert>
        )}
        {doctors.isPending && (
          <div className="grid gap-4 md:grid-cols-2" role="status">
            <span className="sr-only">Loading doctors…</span>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-44" />
            ))}
          </div>
        )}
        {doctors.data && doctors.data.items.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              {filtered ? (
                <>
                  <p className="font-semibold">No doctors match these filters</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {availWhen || hasOpenSlots || takingBookings
                      ? 'Try widening the time or booking filters, another speciality or city, or clear everything below.'
                      : 'Try another speciality or city, or clear the filters.'}
                  </p>
                  <Button
                    variant="secondary"
                    className="mt-4"
                    onClick={() => {
                      setName('');
                      setParams(new URLSearchParams(), { replace: true });
                    }}
                  >
                    Clear filters
                  </Button>
                </>
              ) : (
                <>
                  <p className="font-semibold">No doctors are listed yet</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    Doctors appear here once we have checked their registration and they have
                    published their profile.
                  </p>
                  <Link
                    to="/doctors/join"
                    className="mt-4 inline-block text-sm font-semibold text-coral-ink hover:underline"
                  >
                    Are you a doctor? Join Sukoon
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        )}
        {doctors.data && doctors.data.items.length > 0 && (
          <>
            <p className="mb-4 text-sm text-ink-muted" aria-live="polite">
              {doctors.data.total} {doctors.data.total === 1 ? 'doctor' : 'doctors'}
            </p>
            <ul className="grid gap-4 md:grid-cols-2">
              {doctors.data.items.map((doctor) => (
                <li key={doctor.slug}>
                  <DoctorResult doctor={doctor} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {doctors.data && doctors.data.total > PAGE_SIZE && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4">
          <p className="text-sm text-ink-muted">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => update({ page: String(page - 1) })}
            >
              <ChevronLeft className="size-4" aria-hidden="true" /> Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => update({ page: String(page + 1) })}
            >
              Next <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}

function DoctorResult({ doctor }: { doctor: DoctorCard }) {
  const fee = formatFee(doctor.consultationFeeInr);
  const years = CURRENT_YEAR - doctor.registrationYear;
  return (
    <Card className="h-full">
      <CardContent className="flex h-full gap-4 pt-6">
        <DoctorAvatar name={doctor.displayName} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            to={`/doctors/${doctor.slug}`}
            className="text-lg font-semibold hover:text-coral-ink hover:underline"
          >
            {doctorName(doctor.displayName)}
          </Link>
          <p className="text-sm font-medium">{doctor.specialty}</p>
          {doctor.availabilityStatus === 'available' ? (
            <Badge tone="success" className="mt-1 w-fit">
              Taking bookings
            </Badge>
          ) : (
            doctor.availabilityStatus && (
              <Badge tone="warning" className="mt-1 w-fit">
                {doctor.availabilityStatus === 'on_leave'
                  ? 'On leave'
                  : doctor.availabilityStatus === 'busy'
                    ? 'Busy'
                    : 'Unavailable'}
              </Badge>
            )
          )}
          <p className="text-sm text-ink-muted">{doctor.qualification}</p>
          {years > 0 && (
            <p className="mt-1 text-sm text-ink-muted">
              Registered {years} {years === 1 ? 'year' : 'years'} ago
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {doctor.consultationModes.includes('online') && (
              <Badge tone="soon">
                <Video className="size-3" aria-hidden="true" /> Video
              </Badge>
            )}
            {doctor.consultationModes.includes('clinic') && doctor.city && (
              <Badge>
                <MapPin className="size-3" aria-hidden="true" />
                {[doctor.locality, doctor.city].filter(Boolean).join(', ')}
              </Badge>
            )}
          </div>
          {fee && <p className="mt-3 text-sm font-semibold">{fee}</p>}
          {doctor.nextAvailableDate && (
            <p className="mt-2 text-sm text-ink-muted">
              Next available: <span className="font-medium text-ink">{formatDay(doctor.nextAvailableDate)}</span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
