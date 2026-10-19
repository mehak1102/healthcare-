import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicHolidays } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('fetchPublicHolidays', () => {
  it('parses the public holidays list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              region: 'IN',
              timezone: 'Asia/Kolkata',
              source: 'static',
              items: [{ date: '2026-10-02', name: 'Gandhi Jayanti' }],
            }),
          ),
        ),
      ),
    );
    const data = await fetchPublicHolidays({ from: '2026-10-01', days: 10 });
    expect(data.items[0]?.name).toBe('Gandhi Jayanti');
  });
});
