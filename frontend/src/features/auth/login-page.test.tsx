import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './login-page';
import { RedirectIfSignedIn } from './route-guards';

const signedInUser = {
  id: '665f1c2e9b1d4a0012345678',
  fullName: 'Demo Admin',
  email: 'admin.demo@sukoon.test',
  roles: ['platform_admin'],
  permissions: ['users:read'],
  emailVerified: true,
  createdAt: '2026-10-01T00:00:00.000Z',
};

function renderLogin(initialEntry: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/login',
        Component: () => (
          <RedirectIfSignedIn>
            <LoginPage />
          </RedirectIfSignedIn>
        ),
      },
      { path: '/account', Component: () => <h1>Account home</h1> },
      { path: '/admin/users', Component: () => <h1>Admin users</h1> },
    ],
    { initialEntries: [initialEntry] },
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

function stubAuthApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(
          Response.json(
            { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } },
            { status: 401 },
          ),
        );
      }
      return Promise.resolve(Response.json({ user: signedInUser, csrfToken: 'test-csrf-token' }));
    }),
  );
}

async function signIn() {
  await userEvent.type(await screen.findByLabelText('Email address'), signedInUser.email);
  await userEvent.type(screen.getByLabelText('Password'), 'any synthetic passphrase');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

afterEach(() => vi.unstubAllGlobals());

describe('LoginPage redirects', () => {
  it('returns to the page that required sign-in', async () => {
    stubAuthApi();
    renderLogin('/login?next=%2Fadmin%2Fusers');
    await signIn();
    expect(await screen.findByRole('heading', { name: 'Admin users' })).toBeInTheDocument();
  });

  it('ignores off-site next values', async () => {
    stubAuthApi();
    renderLogin('/login?next=%2F%2Fevil.example');
    await signIn();
    expect(await screen.findByRole('heading', { name: 'Account home' })).toBeInTheDocument();
  });
});
