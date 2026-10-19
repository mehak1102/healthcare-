import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RegisterPage } from './register-page';

function renderRegisterPage() {
  const router = createMemoryRouter(
    [
      { path: '/register', Component: RegisterPage },
      { path: '/account', Component: () => <h1>Account home</h1> },
    ],
    { initialEntries: ['/register'] },
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

afterEach(() => vi.unstubAllGlobals());

describe('RegisterPage', () => {
  it('shows accessible validation errors without calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderRegisterPage();

    await userEvent.type(screen.getByLabelText('Email address'), 'not-an-email');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Please enter your full name')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText(/Use at least 12 characters/)).toBeInTheDocument();
    expect(screen.getByText(/Please accept the Terms/)).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a duplicate email from the server onto the email field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          Response.json(
            {
              error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists.' },
            },
            { status: 409 },
          ),
        ),
      ),
    );
    renderRegisterPage();

    await userEvent.type(screen.getByLabelText('Full name'), 'Asha Rao');
    await userEvent.type(screen.getByLabelText('Email address'), 'asha@example.test');
    await userEvent.type(screen.getByLabelText('Password'), 'quiet river morning tea');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(/already exists. Try signing in instead/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Account home' })).not.toBeInTheDocument();
  });
});
