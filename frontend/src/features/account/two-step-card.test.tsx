import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TwoStepCard } from './two-step-card';

const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const CODES = Array.from({ length: 10 }, (_, i) => `abcd${'efghjk'[i % 6]}-mnp${i}${i}`);

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TwoStepCard />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('TwoStepCard', () => {
  it('walks through password, QR code, code check and recovery codes', async () => {
    let enabled = false;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url.endsWith('/auth/mfa') && (init?.method ?? 'GET') === 'GET') {
        return Promise.resolve(
          Response.json({
            enabled,
            enrolledAt: enabled ? '2026-10-13T08:00:00.000Z' : null,
            recoveryCodesRemaining: enabled ? 10 : 0,
            canDisable: true,
          }),
        );
      }
      if (url.endsWith('/auth/mfa/setup')) {
        return Promise.resolve(
          Response.json({
            secret: SECRET,
            otpauthUri: `otpauth://totp/Sukoon%20Health:a@b.test?secret=${SECRET}`,
          }),
        );
      }
      if (url.endsWith('/auth/mfa/enable')) {
        enabled = true;
        return Promise.resolve(Response.json({ recoveryCodes: CODES }));
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderCard();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Turn on two-step verification' }),
    );
    await userEvent.type(screen.getByLabelText('Current password'), 'any synthetic passphrase');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByTitle('QR code for your authenticator app')).toBeInTheDocument();
    expect(screen.getByText('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('6-digit code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Turn on' }));

    const list = await screen.findByRole('list', { name: 'Recovery codes' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(10);
    expect(within(list).getByText(CODES[0]!)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'I have saved my recovery codes' }));
    expect(await screen.findByText(/10 of 10 recovery codes left/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Recovery codes' })).not.toBeInTheDocument();

    const enableCall = fetchMock.mock.calls.find(([input]) =>
      input.toString().endsWith('/auth/mfa/enable'),
    );
    expect(JSON.parse(String(enableCall?.[1]?.body))).toEqual({ code: '123456' });
  });

  it('explains that staff accounts cannot turn it off', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          Response.json({
            enabled: true,
            enrolledAt: '2026-10-13T08:00:00.000Z',
            recoveryCodesRemaining: 2,
            canDisable: false,
          }),
        ),
      ),
    );
    renderCard();
    expect(await screen.findByText('Required for staff accounts.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Turn off' })).not.toBeInTheDocument();
    expect(screen.getByText(/running low on recovery codes/)).toBeInTheDocument();
  });
});
