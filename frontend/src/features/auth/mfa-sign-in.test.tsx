import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './login-page';

const user = {
  id: '665f1c2e9b1d4a0012345678',
  fullName: 'Synthetic Patient',
  email: 'patient.demo@sukoon.test',
  roles: ['patient'],
  permissions: [],
  emailVerified: true,
  mfaEnabled: true,
  staffMfaRequired: false,
  createdAt: '2026-10-01T00:00:00.000Z',
};

const apiError = (code: string, message: string, status = 401) =>
  Response.json({ error: { code, message } }, { status });

function stubFetch(challengeResponse: () => Response) {
  const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = input.toString();
    if (url.endsWith('/auth/me')) return Promise.resolve(apiError('UNAUTHENTICATED', 'Sign in'));
    if (url.endsWith('/auth/login')) return Promise.resolve(Response.json({ mfaRequired: true }));
    if (url.endsWith('/auth/mfa/challenge')) return Promise.resolve(challengeResponse());
    return Promise.resolve(apiError('NOT_FOUND', 'Not found', 404));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const challengeBodies = (fetchMock: ReturnType<typeof stubFetch>) =>
  fetchMock.mock.calls
    .filter(([input]) => input.toString().endsWith('/auth/mfa/challenge'))
    .map(([, init]) => JSON.parse(String(init?.body)) as { code: string });

function renderLogin() {
  const router = createMemoryRouter(
    [
      { path: '/login', Component: LoginPage },
      { path: '/account', Component: () => <h1>Account home</h1> },
      { path: '/patient', Component: () => <h1>Patient dashboard</h1> },
    ],
    { initialEntries: ['/login'] },
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

async function enterPassword() {
  await userEvent.type(screen.getByLabelText('Email address'), user.email);
  await userEvent.type(screen.getByLabelText('Password'), 'any synthetic passphrase');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

afterEach(() => vi.unstubAllGlobals());

describe('signing in with two-step verification', () => {
  it('asks for the authenticator code after the password, then signs in', async () => {
    const fetchMock = stubFetch(() => Response.json({ user, csrfToken: 'csrf' }));
    renderLogin();
    await enterPassword();

    expect(
      await screen.findByRole('heading', { name: 'Two-step verification' }),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Authentication code'), '123 456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));

    expect(await screen.findByRole('heading', { name: 'Patient dashboard' })).toBeInTheDocument();
    expect(challengeBodies(fetchMock)).toEqual([{ code: '123456' }]);
  });

  it('checks the code format before sending', async () => {
    const fetchMock = stubFetch(() => Response.json({ user, csrfToken: 'csrf' }));
    renderLogin();
    await enterPassword();

    await userEvent.type(await screen.findByLabelText('Authentication code'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));
    expect(await screen.findByText(/Enter the 6-digit code/)).toBeInTheDocument();
    expect(challengeBodies(fetchMock)).toHaveLength(0);
  });

  it('accepts a recovery code instead', async () => {
    const fetchMock = stubFetch(() => Response.json({ user, csrfToken: 'csrf' }));
    renderLogin();
    await enterPassword();

    await userEvent.click(await screen.findByRole('button', { name: 'Use a recovery code' }));
    await userEvent.type(screen.getByLabelText('Recovery code'), 'abcde-fgh23');
    await userEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));

    expect(await screen.findByRole('heading', { name: 'Patient dashboard' })).toBeInTheDocument();
    expect(challengeBodies(fetchMock)).toEqual([{ code: 'abcde-fgh23' }]);
  });

  it('shows wrong codes inline and sends people back to the password step once locked', async () => {
    let attempts = 0;
    stubFetch(() =>
      ++attempts === 1
        ? apiError('INVALID_MFA_CODE', 'That code did not work.')
        : apiError('MFA_LOCKED', 'Too many incorrect codes.'),
    );
    renderLogin();
    await enterPassword();

    const field = await screen.findByLabelText('Authentication code');
    await userEvent.type(field, '111111');
    await userEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That code did not work.');

    await userEvent.clear(field);
    await userEvent.type(field, '222222');
    await userEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many incorrect codes.');

    await userEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
});
