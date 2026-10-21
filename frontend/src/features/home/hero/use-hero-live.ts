import { useQuery } from '@tanstack/react-query';
import { accountApi } from '@/features/account/api';
import { appointmentsApi, formatTime, istCalendarDate, type Slot } from '@/features/appointments/api';
import { dashboardsApi } from '@/features/dashboards/api';
import {
  type DoctorCard,
  type DoctorPublicProfile,
  doctorsApi,
} from '@/features/doctors/api';
import { useCurrentUser } from '@/features/auth/use-auth';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import type { ConsultMode } from './hero-copy';
import { consultApiMode } from './hero-data';

export function useHeroLive(
  mode: ConsultMode,
  query: string,
  city: string,
  currentLocationLabel: string,
) {
  const { data: user } = useCurrentUser();
  const apiMode = consultApiMode(mode);
  const cityFilter = city.trim() && city !== currentLocationLabel ? city.trim() : undefined;
  const debouncedQ = useDebouncedValue(query.trim(), 280);

  const filters = useQuery({
    queryKey: ['doctors', 'filters'],
    queryFn: doctorsApi.filters,
  });

  const featured = useQuery({
    queryKey: ['hero', 'featured', apiMode, cityFilter],
    queryFn: ({ signal }) =>
      doctorsApi.directory(
        {
          page: 1,
          mode: apiMode,
          city: cityFilter,
          takingBookings: true,
          sort: 'next_available',
        },
        signal,
      ),
  });

  const search = useQuery({
    queryKey: ['hero', 'search', apiMode, cityFilter, debouncedQ],
    queryFn: ({ signal }) =>
      doctorsApi.directory(
        {
          page: 1,
          mode: apiMode,
          city: cityFilter,
          q: debouncedQ || undefined,
          takingBookings: true,
          sort: 'next_available',
        },
        signal,
      ),
  });

  const featuredDoctor: DoctorCard | undefined = featured.data?.items.find((item) =>
    item.consultationModes.includes(apiMode),
  ) ?? featured.data?.items[0];

  const profile = useQuery({
    queryKey: ['hero', 'profile', featuredDoctor?.slug],
    queryFn: () => doctorsApi.publicProfile(featuredDoctor!.slug),
    enabled: Boolean(featuredDoctor?.slug),
  });

  const slots = useQuery({
    queryKey: ['hero', 'slots', featuredDoctor?.slug, apiMode],
    queryFn: ({ signal }) => appointmentsApi.slots(featuredDoctor!.slug, null, signal),
    enabled: Boolean(featuredDoctor?.slug),
  });

  const dashboard = useQuery({
    queryKey: ['patient-dashboard'],
    queryFn: dashboardsApi.patient,
    enabled: Boolean(user?.roles.includes('patient')),
  });

  const sessions = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: accountApi.listSessions,
    enabled: Boolean(user),
  });

  const today = istCalendarDate();
  const modeSlots: Slot[] = (slots.data?.days ?? []).flatMap((day) =>
    day.slots.filter((slot) => slot.mode === apiMode),
  );
  const openSlots = modeSlots.slice(0, 4);
  const soonest = openSlots[0] ?? modeSlots[0] ?? null;

  const upcoming = dashboard.data?.upcoming[0] ?? null;

  return {
    user,
    filters: filters.data,
    doctorCount: featured.data?.total ?? 0,
    cityCount: filters.data?.cities.length ?? 0,
    specialties: filters.data?.specialties ?? [],
    cities: filters.data?.cities ?? [],
    searchDoctors: (debouncedQ ? search.data?.items : featured.data?.items) ?? [],
    searchPending: Boolean(debouncedQ) && search.isFetching,
    featuredDoctor,
    profile: profile.data as DoctorPublicProfile | undefined,
    openSlots,
    soonest,
    soonestLabel: soonest
      ? formatTime(soonest.startsAt)
      : featuredDoctor?.nextAvailableDate && featuredDoctor.nextAvailableDate > today
        ? featuredDoctor.nextAvailableDate
        : null,
    upcoming,
    sessions: sessions.data?.items ?? [],
    recordsMessage: dashboard.data?.records.message,
    loadingShowcase: featured.isLoading,
  };
}
