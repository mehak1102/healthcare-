import { useQueries, useQuery } from '@tanstack/react-query';
import { appointmentsApi, formatTime, type Slot } from '@/features/appointments/api';
import { doctorName, doctorsApi, type AvailWhen, type DoctorCard } from '@/features/doctors/api';

export function initials(name: string) {
  const parts = doctorName(name)
    .replace(/^dr\.?\s*/i, '')
    .split(/\s+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase() || 'DR';
}

export function kolkataHour(date = new Date()) {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(date),
  );
}

export function formatHourLabel(hour: number) {
  const ap = hour < 12 ? 'AM' : 'PM';
  const hh = hour % 12 || 12;
  return `${hh}:00 ${ap}`;
}

export function formatClock(date = new Date()) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function slotHour(iso: string) {
  return kolkataHour(new Date(iso));
}

export interface TrustFilters {
  online: boolean;
  clinic: boolean;
  weekend: boolean;
  holiday: boolean;
  home: boolean;
}

export function useTrustLive(filters: TrustFilters) {
  const availWhen: AvailWhen | undefined = filters.holiday
    ? 'public_holiday'
    : filters.weekend
      ? 'weekend'
      : undefined;
  const mode =
    filters.online && !filters.clinic ? 'online' : filters.clinic && !filters.online ? 'clinic' : undefined;

  const directory = useQuery({
    queryKey: ['home', 'trust', 'directory', mode, availWhen],
    queryFn: ({ signal }) =>
      doctorsApi.directory(
        {
          page: 1,
          takingBookings: true,
          sort: 'next_available',
          mode,
          availWhen,
        },
        signal,
      ),
  });

  const doctors = (directory.data?.items ?? []).slice(0, 5);
  const slotQueries = useQueries({
    queries: doctors.map((doctor) => ({
      queryKey: ['home', 'trust', 'slots', doctor.slug],
      queryFn: ({ signal }: { signal?: AbortSignal }) => appointmentsApi.slots(doctor.slug, null, signal),
      enabled: Boolean(doctor.slug),
    })),
  });

  const bySlug = new Map<string, Slot[]>();
  doctors.forEach((doctor, i) => {
    const days = slotQueries[i]?.data?.days ?? [];
    bySlug.set(
      doctor.slug,
      days.flatMap((day) => day.slots),
    );
  });

  const counts = Array.from({ length: 24 }, () => 0);
  for (const slots of bySlug.values()) {
    const hours = new Set(slots.map((slot) => slotHour(slot.startsAt)));
    for (const hour of hours) counts[hour] += 1;
  }

  const atHour = (hour: number): { doctor: DoctorCard; slots: Slot[]; until: string | null }[] =>
    doctors
      .map((doctor) => {
        const slots = (bySlug.get(doctor.slug) ?? []).filter((slot) => slotHour(slot.startsAt) === hour);
        const last = slots[slots.length - 1];
        return {
          doctor,
          slots,
          until: last ? formatTime(last.startsAt) : null,
        };
      })
      .filter((row) => row.slots.length > 0);

  const nextSlotLabel = doctors
    .flatMap((doctor) => bySlug.get(doctor.slug) ?? [])
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];

  const hoursFor = (slug: string) => {
    const hours = new Set((bySlug.get(slug) ?? []).map((slot) => slotHour(slot.startsAt)));
    return Array.from({ length: 24 }, (_, hour) => hours.has(hour));
  };

  return {
    total: directory.data?.total ?? doctors.length,
    doctors,
    counts,
    atHour,
    hoursFor,
    nextSlotLabel: nextSlotLabel ? formatTime(nextSlotLabel.startsAt) : null,
    sample: doctors[0],
  };
}
