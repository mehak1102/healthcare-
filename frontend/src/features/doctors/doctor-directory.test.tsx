import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DoctorPublicProfile, MyDoctorProfile } from './api';
import { DoctorProfileEditorPage } from './doctor-profile-editor-page';
import { DoctorPublicPage } from './doctor-public-page';
import { FindDoctorsPage } from './find-doctors-page';

const DOCTOR: DoctorPublicProfile = {
  slug: 'dr-kavya-rao-a1b2c3',
  displayName: 'Kavya Rao',
  specialty: 'Pulmonologist',
  qualification: 'MBBS, MD (Respiratory Medicine)',
  registrationYear: 2015,
  languages: ['English', 'Kannada'],
  consultationModes: ['online', 'clinic'],
  consultationFeeInr: 600,
  clinicName: 'Synthetic Chest Clinic',
  city: 'Mysuru',
  locality: 'Gokulam',
  bio: 'Treats asthma, COPD and long-term cough.',
  registrationNumber: 'TEST-12345',
  registrationCouncil: 'Karnataka Medical Council',
  registrationCheckedAt: '2026-10-13T08:00:00.000Z',
};

function renderAt(path: string, routes: { path: string; element: React.ReactNode }[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          {routes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response | undefined) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(input.toString(), init) ?? new Response(null, { status: 404 })),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('FindDoctorsPage', () => {
  it('lists doctors and sends the chosen filters to the API', async () => {
    const fetchMock = stubFetch((url) => {
      if (url.endsWith('/doctors/filters')) {
        return Response.json({ specialties: ['Pulmonologist'], cities: ['Mysuru'] });
      }
      if (url.includes('/doctors?')) {
        return Response.json({ items: [DOCTOR], page: 1, limit: 12, total: 1 });
      }
      return undefined;
    });
    renderAt('/doctors', [{ path: '/doctors', element: <FindDoctorsPage /> }]);

    expect(await screen.findByRole('link', { name: 'Dr. Kavya Rao' })).toHaveAttribute(
      'href',
      '/doctors/dr-kavya-rao-a1b2c3',
    );
    expect(screen.getByText('₹600 consultation fee')).toBeInTheDocument();

    await screen.findByRole('option', { name: 'Pulmonologist' });
    await userEvent.selectOptions(screen.getByLabelText('Speciality'), 'Pulmonologist');
    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          input.toString().includes('specialty=Pulmonologist'),
        ),
      ).toBe(true),
    );
  });

  it('sends feeBand when selected in the URL', async () => {
    const fetchMock = stubFetch((url) => {
      if (url.endsWith('/doctors/filters')) {
        return Response.json({ specialties: [], cities: [] });
      }
      if (url.includes('/doctors?')) {
        return Response.json({ items: [], page: 1, limit: 12, total: 0 });
      }
      return undefined;
    });
    renderAt('/doctors?feeBand=under_500', [{ path: '/doctors', element: <FindDoctorsPage /> }]);

    expect(await screen.findByLabelText('Consultation fee')).toHaveValue('under_500');
    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => input.toString().includes('feeBand=under_500')),
      ).toBe(true),
    );
  });

  it('sends hasOpenSlots when the checkbox is on', async () => {
    const fetchMock = stubFetch((url) => {
      if (url.endsWith('/doctors/filters')) {
        return Response.json({ specialties: [], cities: [] });
      }
      if (url.includes('/doctors?')) {
        return Response.json({ items: [], page: 1, limit: 12, total: 0 });
      }
      return undefined;
    });
    renderAt('/doctors?hasOpenSlots=1', [{ path: '/doctors', element: <FindDoctorsPage /> }]);

    expect(await screen.findByLabelText('Has open slots (30 days)')).toBeChecked();
    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => input.toString().includes('hasOpenSlots=1')),
      ).toBe(true),
    );
  });

  it('sends takingBookings when the checkbox is on', async () => {
    const fetchMock = stubFetch((url) => {
      if (url.endsWith('/doctors/filters')) {
        return Response.json({ specialties: [], cities: [] });
      }
      if (url.includes('/doctors?')) {
        return Response.json({ items: [], page: 1, limit: 12, total: 0 });
      }
      return undefined;
    });
    renderAt('/doctors?takingBookings=1', [{ path: '/doctors', element: <FindDoctorsPage /> }]);

    expect(await screen.findByLabelText('Taking new bookings')).toBeChecked();
    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => input.toString().includes('takingBookings=1')),
      ).toBe(true),
    );
  });

  it('is honest when nobody is listed yet', async () => {
    stubFetch((url) =>
      url.endsWith('/doctors/filters')
        ? Response.json({ specialties: [], cities: [] })
        : Response.json({ items: [], page: 1, limit: 12, total: 0 }),
    );
    renderAt('/doctors', [{ path: '/doctors', element: <FindDoctorsPage /> }]);
    expect(await screen.findByText('No doctors are listed yet')).toBeInTheDocument();
  });
});

describe('DoctorPublicPage', () => {
  it('shows when and against what the registration was checked', async () => {
    stubFetch((url) =>
      url.endsWith(`/doctors/${DOCTOR.slug}`) ? Response.json(DOCTOR) : undefined,
    );
    renderAt(`/doctors/${DOCTOR.slug}`, [
      { path: '/doctors/:slug', element: <DoctorPublicPage /> },
    ]);
    expect(await screen.findByRole('heading', { name: 'Dr. Kavya Rao' })).toBeInTheDocument();
    expect(
      screen.getByText(/TEST-12345 with the Karnataka Medical Council \(2015\) was checked/),
    ).toBeInTheDocument();
    expect(screen.getByText(/13 October 2026/)).toBeInTheDocument();
  });

  it('says so when a doctor is not listed', async () => {
    stubFetch(() =>
      Response.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 }),
    );
    renderAt('/doctors/dr-nobody-000000', [
      { path: '/doctors/:slug', element: <DoctorPublicPage /> },
    ]);
    expect(
      await screen.findByText('This doctor is not listed on Sukoon Health.'),
    ).toBeInTheDocument();
  });
});

describe('DoctorProfileEditorPage', () => {
  const draft: MyDoctorProfile = {
    ...DOCTOR,
    bio: '',
    languages: [],
    consultationModes: [],
    consultationFeeInr: null,
    clinicName: null,
    city: null,
    locality: null,
    requiresBookingApproval: true,
    published: false,
    publishedAt: null,
    missing: ['a consultation fee'],
  };

  it('saves only the doctor-managed fields and explains what blocks publishing', async () => {
    const fetchMock = stubFetch((url, init) => {
      if (url.endsWith('/doctor-profile/me') && init?.method === 'PUT') {
        return Response.json(
          {
            error: {
              code: 'PROFILE_INCOMPLETE',
              message: 'Complete your profile before showing it to patients.',
              details: ['a consultation fee'],
            },
          },
          { status: 400 },
        );
      }
      if (url.endsWith('/doctor-profile/me')) return Response.json(draft);
      return undefined;
    });
    renderAt('/doctor/profile', [
      { path: '/doctor/profile', element: <DoctorProfileEditorPage /> },
    ]);

    await userEvent.type(
      await screen.findByLabelText('About you'),
      'Treats asthma, COPD and long-term cough in adults and children.',
    );
    await userEvent.click(screen.getByLabelText('Video consultation'));
    await userEvent.click(screen.getByLabelText('English'));
    await userEvent.click(screen.getByLabelText(/Show my profile to patients/));
    await userEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByText('Add these before publishing')).toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      bio: 'Treats asthma, COPD and long-term cough in adults and children.',
      languages: ['English'],
      consultationModes: ['online'],
      consultationFeeInr: null,
      clinicName: null,
      city: null,
      locality: null,
      published: true,
      requiresBookingApproval: true,
    });
  });
});
