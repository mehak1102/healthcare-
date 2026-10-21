import { useQuery } from '@tanstack/react-query';
import { appointmentsApi, formatTime, type Slot } from '@/features/appointments/api';
import { doctorName, doctorsApi, type DoctorCard } from '@/features/doctors/api';

function pickBySpecialty(items: DoctorCard[], needle: string) {
  const n = needle.toLowerCase();
  return items.find((item) => item.specialty.toLowerCase().includes(n));
}

export function initials(name: string) {
  const parts = doctorName(name)
    .replace(/^dr\.?\s*/i, '')
    .split(/\s+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase() || 'DR';
}

export function useServicesLive() {
  const filters = useQuery({
    queryKey: ['doctors', 'filters'],
    queryFn: doctorsApi.filters,
  });

  const directory = useQuery({
    queryKey: ['home', 'services', 'directory'],
    queryFn: ({ signal }) =>
      doctorsApi.directory(
        { page: 1, takingBookings: true, sort: 'next_available' },
        signal,
      ),
  });

  const items = directory.data?.items ?? [];
  const gp =
    pickBySpecialty(items, 'general') ??
    pickBySpecialty(items, 'family') ??
    items.find((item) => item.consultationModes.includes('clinic')) ??
    items[0];
  const online =
    items.find((item) => item.consultationModes.includes('online')) ??
    pickBySpecialty(items, 'general') ??
    items[0];

  const gpSlots = useQuery({
    queryKey: ['home', 'services', 'slots', gp?.slug],
    queryFn: ({ signal }) => appointmentsApi.slots(gp!.slug, null, signal),
    enabled: Boolean(gp?.slug),
  });

  const openSlots: Slot[] = (gpSlots.data?.days ?? []).flatMap((day) => day.slots).slice(0, 3);

  return {
    specialties: filters.data?.specialties ?? [],
    gp,
    online,
    gpSlots: openSlots.map((slot) => ({ slot, label: formatTime(slot.startsAt) })),
    gpOpenToday: Boolean(gpSlots.data?.days.some((day) => day.slots.length > 0)),
  };
}
