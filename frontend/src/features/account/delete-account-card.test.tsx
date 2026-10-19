import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeleteAccountCard } from './delete-account-card';

function LoginProbe() {
  const state = useLocation().state as { accountDeleted?: boolean } | null;
  return <p>{state?.accountDeleted ? 'login: account deleted' : 'login'}</p>;
}

function renderCard(props: { isDoctor?: boolean; mfaEnabled?: boolean } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/account']}>
        <Routes>
          <Route
            path="/account"
            element={
              <DeleteAccountCard
                isDoctor={props.isDoctor ?? false}
                mfaEnabled={props.mfaEnabled ?? false}
              />
            }
          />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function stubFetch(response: () => Response) {
  const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve(response()),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('DeleteAccountCard', () => {
  it('needs the password and a ticked box, then deletes and goes to sign-in', async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }));
    renderCard({ mfaEnabled: true });

    await userEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    await userEvent.type(screen.getByLabelText('Current password'), 'any synthetic passphrase');
    await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(await screen.findByText('Tick this box to confirm')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(/recovery code/), '123456');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));

    expect(await screen.findByText('login: account deleted')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toMatch(/\/account\/delete$/);
    expect(JSON.parse(init!.body as string)).toEqual({
      password: 'any synthetic passphrase',
      code: '123456',
    });
  });

  it('points to appointments that must be cancelled first', async () => {
    stubFetch(() =>
      Response.json(
        {
          error: {
            code: 'ACCOUNT_HAS_OPEN_APPOINTMENTS',
            message: 'Cancel your upcoming appointments before deleting your account.',
            details: ['1 upcoming appointment'],
          },
        },
        { status: 409 },
      ),
    );
    renderCard({ isDoctor: true });

    await userEvent.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(screen.getByText(/doctor profile, application and timetable/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Current password'), 'any synthetic passphrase');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));

    expect(await screen.findByText(/Cancel your upcoming appointments/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See appointments' })).toHaveAttribute(
      'href',
      '/doctor/appointments',
    );
  });
});
