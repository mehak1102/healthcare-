import { apiRequest } from '@/lib/api-client';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export interface PublicHolidayItem {
  date: string;
  name: string;
}

export interface PublicHolidayList {
  region: PublicHolidayRegion;
  timezone: 'Asia/Kolkata';
  source: 'database' | 'static';
  items: PublicHolidayItem[];
}

export async function fetchPublicHolidays(
  query?: { from?: string; days?: number; region?: PublicHolidayRegion },
  signal?: AbortSignal,
): Promise<PublicHolidayList> {
  const params = new URLSearchParams();
  if (query?.from) params.set('from', query.from);
  if (query?.days) params.set('days', String(query.days));
  if (query?.region) params.set('region', query.region);
  const qs = params.toString();
  const res = await fetch(`${API_BASE}/calendar/public-holidays${qs ? `?${qs}` : ''}`, { signal });
  if (!res.ok) throw new Error(`Calendar request failed (${res.status})`);
  return res.json() as Promise<PublicHolidayList>;
}

export type PublicHolidayRegion =
  | 'IN'
  | 'IN-KA'
  | 'IN-MH'
  | 'IN-TN'
  | 'IN-DL'
  | 'IN-TG';

export interface AdminPublicHoliday {
  id: string;
  date: string;
  name: string;
  region: PublicHolidayRegion;
}

export const calendarApi = {
  publicHolidays: fetchPublicHolidays,
  admin: {
    list: (signal?: AbortSignal) =>
      apiRequest<AdminPublicHoliday[]>('/admin/public-holidays', { signal }),
    create: (body: { date: string; name: string; region: PublicHolidayRegion }) =>
      apiRequest<AdminPublicHoliday>('/admin/public-holidays', {
        method: 'POST',
        body,
      }),
    remove: (id: string) =>
      apiRequest<{ removed: true }>(`/admin/public-holidays/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
  },
};
