import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForgotPasswordPage } from './forgot-password-page';
import { LoginPage } from './login-page';
import { ResetPasswordPage } from './reset-password-page';
import { VerifyEmailPage } from './verify-email-page';

const TOKEN = 'synthetic-token-for-tests_0123456789abcdefghij';
const NEW_PASSWORD = 'lantern harbour evening walk';

type Handler = (url: string, init?: RequestInit) => Response;

const unauthenticated = () =>
  Response.json(
    { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } },
    { status: 401 },
  );

function stubFetch(handler: Handler) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    if (url.endsWith('/auth/me')) return Promise.resolve(unauthenticated());
    return Promise.resolve(handler(url, init));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const callsTo = (fetchMock: ReturnType<typeof stubFetch>, path: string) =>
  fetchMock.mock.calls.filter(([input]) => input.toString().endsWith(path));

function renderAt(initialEntry: string) {
  const router = createMemoryRouter(
    [
      { path: '/forgot-password', Component: ForgotPasswordPage },
      { path: '/reset-password', Component: ResetPasswordPage },
      { path: '/verify-email', Component: VerifyEmailPage },
      { path: '/login', Component: LoginPage },
    ],
    { initialEntries: [initialEntry] },
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
  return router;
}

afterEach(() => vi.unstubAllGlobals());

describe('ForgotPasswordPage', () => {
  it('shows the same neutral confirmation whatever the address', async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }));
    renderAt('/forgot-password');

    await userEvent.type(screen.getByLabelText('Email address'), 'someone@example.test');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText(/If an account exists for/)).toBeInTheDocument();
    const [call] = callsTo(fetchMock, '/auth/password-reset/request');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ email: 'someone@example.test' });
  });
});

describe('ResetPasswordPage', () => {
  it('explains when the link has no token', () => {
    stubFetch(() => new Response(null, { status: 204 }));
    renderAt('/reset-password');
    expect(screen.getByRole('heading', { name: 'Link incomplete' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toBeInTheDocument();
  });

  it('removes the token from the address bar, saves, and returns to sign-in', async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }));
    const router = renderAt(`/reset-password#token=${TOKEN}`);
    expect(router.state.location.hash).toBe('');

    await userEvent.type(screen.getByLabelText('New password'), NEW_PASSWORD);
    await userEvent.type(screen.getByLabelText('Confirm new password'), NEW_PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(await screen.findByText(/Your password has been reset/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    const [call] = callsTo(fetchMock, '/auth/password-reset/confirm');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      token: TOKEN,
      newPassword: NEW_PASSWORD,
    });
  });

  it('offers a new link when the token has expired', async () => {
    stubFetch(() =>
      Response.json(
        {
          error: {
            code: 'INVALID_OR_EXPIRED_LINK',
            message: 'This link is invalid or has expired.',
          },
        },
        { status: 400 },
      ),
    );
    renderAt(`/reset-password#token=${TOKEN}`);

    await userEvent.type(screen.getByLabelText('New password'), NEW_PASSWORD);
    await userEvent.type(screen.getByLabelText('Confirm new password'), NEW_PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('invalid or has expired');
    expect(screen.getByRole('link', { name: 'Request a new link' })).toBeInTheDocument();
  });
});

describe('VerifyEmailPage', () => {
  it('submits the single-use token exactly once', async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }));
    renderAt(`/verify-email#token=${TOKEN}`);

    expect(await screen.findByRole('heading', { name: 'Email verified' })).toBeInTheDocument();
    const calls = callsTo(fetchMock, '/auth/email-verification/confirm');
    expect(calls).toHaveLength(1);
    expect(JSON.parse(String(calls[0]?.[1]?.body))).toEqual({ token: TOKEN });
  });

  it('reports an invalid link without retrying', async () => {
    const fetchMock = stubFetch(() =>
      Response.json(
        {
          error: {
            code: 'INVALID_OR_EXPIRED_LINK',
            message: 'This link is invalid or has expired.',
          },
        },
        { status: 400 },
      ),
    );
    renderAt(`/verify-email#token=${TOKEN}`);

    expect(
      await screen.findByRole('heading', { name: 'We could not verify your email' }),
    ).toBeInTheDocument();
    expect(callsTo(fetchMock, '/auth/email-verification/confirm')).toHaveLength(1);
  });
});
