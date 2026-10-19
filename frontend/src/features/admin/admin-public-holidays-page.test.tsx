import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminPublicHolidaysPage } from './admin-public-holidays-page';

vi.mock('@/features/calendar/api', () => ({
  calendarApi: {
    admin: {
      list: vi.fn().mockResolvedValue([
        { id: 'h1', date: '2026-01-26', name: 'Republic Day', region: 'IN' },
      ]),
      create: vi.fn(),
      remove: vi.fn(),
    },
  },
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminPublicHolidaysPage />
    </QueryClientProvider>,
  );
}

describe('AdminPublicHolidaysPage', () => {
  it('lists holidays from the admin API', async () => {
    renderPage();
    expect(await screen.findByText('Republic Day')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'India public holidays' })).toBeInTheDocument();
  });
});
