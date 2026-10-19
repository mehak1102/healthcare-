import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '@/features/auth/api';
import { CURRENT_USER_KEY } from '@/features/auth/use-auth';
import { AdminDoctorApplicationsPage } from './admin-doctor-applications-page';
import type { AdminDoctorApplication, DoctorApplication } from './api';
import { DoctorJoinPage } from './doctor-join-page';

const PATIENT: CurrentUser = {
  id: 'u1',
  fullName: 'Asha Rao',
  email: 'asha@example.test',
  roles: ['patient'],
  permissions: ['account:self:manage'],
  emailVerified: true,
  mfaEnabled: false,
  staffMfaRequired: false,
  createdAt: '2026-10-01T00:00:00.000Z',
};

const APPLICATION: DoctorApplication = {
  id: 'a1',
  status: 'pending',
  registrationNumber: 'TEST-12345',
  registrationCouncil: 'Karnataka Medical Council',
  registrationYear: 2015,
  qualification: 'MBBS',
  specialty: 'General Physician',
  submittedAt: '2026-10-12T08:00:00.000Z',
  reviewedAt: null,
  rejectionReason: null,
};

function renderWith(ui: ReactNode, user: CurrentUser | null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(CURRENT_USER_KEY, user);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

type Handler = (url: string, init?: RequestInit) => Response | undefined;

function stubFetch(handler: Handler) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(input.toString(), init) ?? new Response(null, { status: 204 })),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const bodyOf = (fetchMock: ReturnType<typeof stubFetch>, suffix: string) => {
  const call = fetchMock.mock.calls.find(([input]) => input.toString().endsWith(suffix));
  return JSON.parse(String(call?.[1]?.body)) as Record<string, unknown>;
};

afterEach(() => vi.unstubAllGlobals());

describe('DoctorJoinPage', () => {
  it('sends signed-out visitors to sign in or register and back again', () => {
    renderWith(<DoctorJoinPage />, null);
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/register?next=%2Fdoctors%2Fjoin',
    );
    expect(screen.getByRole('link', { name: 'I already have an account' })).toHaveAttribute(
      'href',
      '/login?next=%2Fdoctors%2Fjoin',
    );
  });

  it('submits registration details only, then shows the review status', async () => {
    const fetchMock = stubFetch((url, init) => {
      if (url.endsWith('/doctor-applications/me')) return Response.json({ application: null });
      if (url.endsWith('/doctor-applications') && init?.method === 'POST') {
        return Response.json(APPLICATION, { status: 201 });
      }
      return undefined;
    });
    renderWith(<DoctorJoinPage />, PATIENT);

    await userEvent.type(
      await screen.findByLabelText('Medical council'),
      'Karnataka Medical Council',
    );
    await userEvent.type(screen.getByLabelText('Registration number'), 'TEST-12345');
    await userEvent.type(screen.getByLabelText('Year of registration'), '2015');
    await userEvent.type(screen.getByLabelText('Speciality'), 'General Physician');
    await userEvent.type(screen.getByLabelText('Qualifications'), 'MBBS');
    await userEvent.click(screen.getByRole('button', { name: 'Send for review' }));

    expect(await screen.findByText('Your application is being reviewed')).toBeInTheDocument();
    expect(bodyOf(fetchMock, '/doctor-applications')).toEqual({
      registrationNumber: 'TEST-12345',
      registrationCouncil: 'Karnataka Medical Council',
      registrationYear: 2015,
      qualification: 'MBBS',
      specialty: 'General Physician',
    });
  });

  it('shows why an application was rejected and pre-fills the next attempt', async () => {
    stubFetch(() =>
      Response.json({
        application: {
          ...APPLICATION,
          status: 'rejected',
          rejectionReason: 'The registration year does not match the register.',
        },
      }),
    );
    renderWith(<DoctorJoinPage />, PATIENT);

    expect(
      await screen.findByText('The registration year does not match the register.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Registration number')).toHaveValue('TEST-12345');
    expect(screen.getByRole('button', { name: 'Send for review' })).toBeInTheDocument();
  });

  it('does not offer the form to accounts that are already doctors', async () => {
    stubFetch(() => Response.json({ application: null }));
    renderWith(<DoctorJoinPage />, { ...PATIENT, roles: ['patient', 'doctor'] });
    expect(await screen.findByText('Your account already has doctor access')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send for review' })).not.toBeInTheDocument();
  });
});

describe('AdminDoctorApplicationsPage', () => {
  const pending: AdminDoctorApplication = {
    ...APPLICATION,
    reviewNote: null,
    applicant: { id: 'u1', fullName: 'Asha Rao', email: 'asha@example.test', emailVerified: true },
  };

  it('only approves after the reviewer confirms the register check', async () => {
    const fetchMock = stubFetch((url) => {
      if (url.includes('/admin/doctor-applications?')) {
        return Response.json({ items: [pending], page: 1, limit: 20, total: 1 });
      }
      if (url.endsWith('/approve')) return Response.json({ ...pending, status: 'approved' });
      return undefined;
    });
    renderWith(<AdminDoctorApplicationsPage />, PATIENT);

    const approve = await screen.findByRole('button', { name: 'Approve as doctor' });
    expect(approve).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: /found this registration/ }));
    await userEvent.click(approve);

    await vi.waitFor(() =>
      expect(bodyOf(fetchMock, '/a1/approve')).toEqual({ registerChecked: true }),
    );
  });

  it('requires a reason before rejecting', async () => {
    const fetchMock = stubFetch((url) => {
      if (url.includes('/admin/doctor-applications?')) {
        return Response.json({ items: [pending], page: 1, limit: 20, total: 1 });
      }
      if (url.endsWith('/reject')) return Response.json({ ...pending, status: 'rejected' });
      return undefined;
    });
    renderWith(<AdminDoctorApplicationsPage />, PATIENT);

    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    expect(await screen.findByText(/Explain what the applicant needs to fix/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => input.toString().endsWith('/reject'))).toBe(
      false,
    );

    await userEvent.type(
      screen.getByLabelText(/Reason for rejection/),
      'Registration number not found in the register.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await vi.waitFor(() =>
      expect(bodyOf(fetchMock, '/a1/reject')).toEqual({
        reason: 'Registration number not found in the register.',
      }),
    );
  });
});
