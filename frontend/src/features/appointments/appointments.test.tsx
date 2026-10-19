import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DoctorPublicProfile } from '@/features/doctors/api';
import type { PatientAppointment } from './api';
import { AppointmentDetailPage } from './appointment-detail-page';
import { BookingPanel } from './booking-panel';
import { DoctorSchedulePage } from './doctor-schedule-page';

const DOCTOR: DoctorPublicProfile = {
  slug: 'dr-kavya-rao-a1b2c3',
  displayName: 'Kavya Rao',
  specialty: 'Pulmonologist',
  qualification: 'MBBS',
  registrationYear: 2015,
  languages: ['English'],
  consultationModes: ['clinic'],
  consultationFeeInr: 500,
  clinicName: 'Synthetic Chest Clinic',
  city: 'Mysuru',
  locality: null,
  bio: 'Synthetic profile for tests.',
  registrationNumber: 'TEST-12345',
  registrationCouncil: 'Karnataka Medical Council',
  registrationCheckedAt: '2026-10-13T08:00:00.000Z',
};

const USER = {
  id: 'u1',
  fullName: 'Asha Test',
  email: 'asha@example.test',
  roles: ['patient'],
  permissions: ['account:self:manage', 'appointments:self:book'],
  emailVerified: true,
  mfaEnabled: false,
  staffMfaRequired: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const SLOTS = {
  timezone: 'Asia/Kolkata',
  feeInr: 500,
  bookableUntil: '2026-11-11',
  unavailableReason: null,
  nextAvailableDate: '2026-10-20',
  videoBookingOpen: false,
  days: [
    {
      date: '2026-10-20',
      slots: [
        {
          startsAt: '2026-10-20T04:30:00.000Z',
          endsAt: '2026-10-20T04:45:00.000Z',
          mode: 'clinic',
        },
        {
          startsAt: '2026-10-20T04:45:00.000Z',
          endsAt: '2026-10-20T05:00:00.000Z',
          mode: 'clinic',
        },
      ],
    },
    { date: '2026-10-21', slots: [] },
  ],
};

const appointment = (overrides: Partial<PatientAppointment> = {}): PatientAppointment => ({
  id: 'appt1',
  status: 'pending_payment',
  startsAt: '2026-10-20T04:30:00.000Z',
  endsAt: '2026-10-20T04:45:00.000Z',
  mode: 'clinic',
  feeInr: 500,
  paymentStatus: 'pending',
  patientNote: null,
  cancelReason: null,
  cancelledAt: null,
  canCancel: true,
  videoOpensAt: null,
  doctor: {
    slug: DOCTOR.slug,
    displayName: DOCTOR.displayName,
    specialty: DOCTOR.specialty,
    clinicName: DOCTOR.clinicName,
    city: DOCTOR.city,
    locality: null,
  },
  holdExpiresAt: '2026-10-13T10:10:00.000Z',
  checkout: {
    keyId: 'rzp_test_FakeKey',
    orderId: 'order_Fake0001',
    amountPaise: 50_000,
    currency: 'INR',
  },
  ...overrides,
});

type Handler = (url: string, init?: RequestInit) => Response | undefined;

function stubFetch(handler: Handler) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(input.toString(), init) ?? new Response(null, { status: 404 })),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

interface CheckoutOptions {
  order_id: string;
  handler: (response: Record<string, string>) => void;
  modal: { ondismiss: () => void };
}

function stubRazorpay(behaviour: 'pay' | 'dismiss') {
  const opened: CheckoutOptions[] = [];
  class FakeRazorpay {
    private readonly options: CheckoutOptions;
    constructor(options: CheckoutOptions) {
      this.options = options;
      opened.push(options);
    }
    open() {
      if (behaviour === 'pay') {
        this.options.handler({
          razorpay_order_id: this.options.order_id,
          razorpay_payment_id: 'pay_Fake0001',
          razorpay_signature: 'f'.repeat(64),
        });
      } else {
        this.options.modal.ondismiss();
      }
    }
  }
  vi.stubGlobal('Razorpay', FakeRazorpay);
  return opened;
}

function renderRoutes(path: string, routes: { path: string; element: React.ReactNode }[]) {
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

const bookingRoutes = [
  { path: '/doctors/:slug', element: <BookingPanel doctor={DOCTOR} /> },
  { path: '/appointments/:id', element: <AppointmentDetailPage /> },
];

afterEach(() => vi.unstubAllGlobals());

describe('BookingPanel', () => {
  it('asks signed-out visitors to sign in and come back', async () => {
    stubFetch((url) => {
      if (url.endsWith('/auth/me'))
        return Response.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 });
      if (url.includes('/slots')) return Response.json(SLOTS);
      return undefined;
    });
    renderRoutes(`/doctors/${DOCTOR.slug}`, bookingRoutes);
    expect(await screen.findByRole('link', { name: 'Sign in to book' })).toHaveAttribute(
      'href',
      `/login?next=${encodeURIComponent(`/doctors/${DOCTOR.slug}`)}`,
    );
    expect(await screen.findByRole('button', { name: '10:00 am' })).toBeInTheDocument();
  });

  it('books a slot, pays through Razorpay and lets the server confirm it', async () => {
    let state = appointment();
    const fetchMock = stubFetch((url, init) => {
      if (url.endsWith('/auth/me')) return Response.json({ user: USER, csrfToken: 'csrf' });
      if (url.includes('/slots')) return Response.json(SLOTS);
      if (url.endsWith('/appointments') && init?.method === 'POST') return Response.json(state);
      if (url.endsWith('/appointments/appt1/payment')) {
        state = appointment({
          status: 'confirmed',
          paymentStatus: 'paid',
          checkout: null,
          holdExpiresAt: null,
        });
        return Response.json(state);
      }
      if (url.endsWith('/appointments/appt1')) return Response.json(state);
      return undefined;
    });
    const opened = stubRazorpay('pay');
    renderRoutes(`/doctors/${DOCTOR.slug}`, bookingRoutes);

    await userEvent.click(await screen.findByRole('button', { name: '10:15 am' }));
    await userEvent.type(screen.getByLabelText(/Reason for visit/), 'Cough for two weeks');
    await userEvent.click(screen.getByRole('button', { name: 'Book and pay ₹500' }));

    expect(await screen.findByText(/Your appointment is confirmed/)).toBeInTheDocument();

    const bookCall = fetchMock.mock.calls.find(
      ([input, init]) => input.toString().endsWith('/appointments') && init?.method === 'POST',
    )!;
    const headers = bookCall[1]!.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(bookCall[1]!.body as string)).toEqual({
      doctorSlug: DOCTOR.slug,
      startsAt: '2026-10-20T04:45:00.000Z',
      mode: 'clinic',
      patientNote: 'Cough for two weeks',
    });
    expect(opened[0]).toMatchObject({
      key: 'rzp_test_FakeKey',
      order_id: 'order_Fake0001',
      amount: 50_000,
    });

    const payCall = fetchMock.mock.calls.find(([input]) =>
      input.toString().endsWith('/appointments/appt1/payment'),
    )!;
    expect(JSON.parse(payCall[1]!.body as string)).toEqual({
      razorpayOrderId: 'order_Fake0001',
      razorpayPaymentId: 'pay_Fake0001',
      razorpaySignature: 'f'.repeat(64),
    });
  });

  it('keeps the booking payable when the payment window is closed', async () => {
    stubFetch((url, init) => {
      if (url.endsWith('/auth/me')) return Response.json({ user: USER, csrfToken: 'csrf' });
      if (url.includes('/slots')) return Response.json(SLOTS);
      if (url.endsWith('/appointments') && init?.method === 'POST')
        return Response.json(appointment());
      if (url.endsWith('/appointments/appt1')) return Response.json(appointment());
      return undefined;
    });
    stubRazorpay('dismiss');
    renderRoutes(`/doctors/${DOCTOR.slug}`, bookingRoutes);

    await userEvent.click(await screen.findByRole('button', { name: '10:00 am' }));
    await userEvent.click(screen.getByRole('button', { name: 'Book and pay ₹500' }));

    expect(await screen.findByText(/Payment was not completed/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Pay ₹500 now' })).toBeInTheDocument();
  });

  it('refreshes the times when someone else took the slot first', async () => {
    let slotCalls = 0;
    stubFetch((url, init) => {
      if (url.endsWith('/auth/me')) return Response.json({ user: USER, csrfToken: 'csrf' });
      if (url.includes('/slots')) {
        slotCalls += 1;
        return Response.json(SLOTS);
      }
      if (url.endsWith('/appointments') && init?.method === 'POST') {
        return Response.json(
          {
            error: {
              code: 'SLOT_UNAVAILABLE',
              message: 'That time is no longer available. Please pick another slot.',
            },
          },
          { status: 409 },
        );
      }
      return undefined;
    });
    renderRoutes(`/doctors/${DOCTOR.slug}`, bookingRoutes);
    await userEvent.click(await screen.findByRole('button', { name: '10:00 am' }));
    await userEvent.click(screen.getByRole('button', { name: 'Book and pay ₹500' }));
    await vi.waitFor(() => expect(slotCalls).toBe(2));
    expect(screen.queryByRole('button', { name: /Book and pay/ })).not.toBeInTheDocument();
  });

  it('explains when the doctor has not published a timetable', async () => {
    stubFetch((url) => {
      if (url.endsWith('/auth/me')) return Response.json({ user: USER, csrfToken: 'csrf' });
      if (url.includes('/slots')) {
        return Response.json({
          ...SLOTS,
          unavailableReason: 'no_timetable',
          nextAvailableDate: null,
          days: SLOTS.days.map((day) => ({ ...day, slots: [] })),
        });
      }
      return undefined;
    });
    renderRoutes(`/doctors/${DOCTOR.slug}`, bookingRoutes);
    expect(await screen.findByText(/has not published their available times/)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Days' })).not.toBeInTheDocument();
  });

  it('shows times but pauses booking while online payment is switched off', async () => {
    stubFetch((url) => {
      if (url.endsWith('/auth/me')) return Response.json({ user: USER, csrfToken: 'csrf' });
      if (url.includes('/slots')) {
        return Response.json({ ...SLOTS, unavailableReason: 'payments_unavailable' });
      }
      return undefined;
    });
    renderRoutes(`/doctors/${DOCTOR.slug}`, bookingRoutes);
    await userEvent.click(await screen.findByRole('button', { name: '10:00 am' }));
    expect(screen.getByText(/Online payment is not switched on yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Book and pay/ })).not.toBeInTheDocument();
  });

  it('jumps to the next free day when this week is full', async () => {
    const requested: string[] = [];
    stubFetch((url) => {
      if (url.endsWith('/auth/me')) return Response.json({ user: USER, csrfToken: 'csrf' });
      if (url.includes('/slots')) {
        requested.push(url);
        if (url.includes('from=2026-11-02')) {
          return Response.json({
            ...SLOTS,
            nextAvailableDate: '2026-11-02',
            days: [{ date: '2026-11-02', slots: SLOTS.days[0]!.slots }],
          });
        }
        return Response.json({
          ...SLOTS,
          nextAvailableDate: '2026-11-02',
          days: SLOTS.days.map((day) => ({ ...day, slots: [] })),
        });
      }
      return undefined;
    });
    renderRoutes(`/doctors/${DOCTOR.slug}`, bookingRoutes);
    await userEvent.click(await screen.findByRole('button', { name: /Next available/ }));
    expect(await screen.findByRole('button', { name: '10:00 am' })).toBeInTheDocument();
    expect(requested.some((url) => url.includes('from=2026-11-02'))).toBe(true);
  });
});

describe('AppointmentDetailPage', () => {
  it('cancels a paid appointment and explains the refund', async () => {
    let state = appointment({ status: 'confirmed', paymentStatus: 'paid', checkout: null });
    const fetchMock = stubFetch((url, init) => {
      if (url.endsWith('/appointments/appt1/cancel') && init?.method === 'POST') {
        state = {
          ...state,
          status: 'cancelled_by_patient',
          paymentStatus: 'refunded',
          canCancel: false,
        };
        return Response.json(state);
      }
      if (url.endsWith('/appointments/appt1')) return Response.json(state);
      return undefined;
    });
    renderRoutes('/appointments/appt1', bookingRoutes);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel appointment' }));
    expect(screen.getByText('You will get a full refund of ₹500.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel it' }));

    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByText(/full refund of ₹500 has been sent/)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        input.toString().endsWith('/appointments/appt1/cancel'),
      ),
    ).toBe(true);
  });
});

describe('DoctorSchedulePage', () => {
  it('adds hours and shows the problems the server found', async () => {
    const fetchMock = stubFetch((url, init) => {
      if (url.endsWith('/doctor-profile/me')) {
        return Response.json({ ...DOCTOR, published: true, publishedAt: null, missing: [] });
      }
      if (url.endsWith('/doctor-schedule/me') && init?.method === 'PUT') {
        return Response.json(
          {
            error: {
              code: 'SCHEDULE_INVALID',
              message: 'Please fix your timetable.',
              details: ['Monday 10:00–13:00 overlaps Monday 12:00–14:00'],
            },
          },
          { status: 400 },
        );
      }
      if (url.endsWith('/doctor-schedule/me')) {
        return Response.json({
          rules: [],
          extraBlocks: [],
          daysOff: [],
          timezone: 'Asia/Kolkata',
          onlineBookingOpen: false,
        });
      }
      return undefined;
    });
    renderRoutes('/doctor/schedule', [
      { path: '/doctor/schedule', element: <DoctorSchedulePage /> },
    ]);

    expect(await screen.findByRole('link', { name: /Set yourself to Available/ })).toHaveAttribute(
      'href',
      '/doctor',
    );
    await userEvent.click(await screen.findByRole('button', { name: /Add hours/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save timetable' }));

    expect(
      await screen.findByText('Monday 10:00–13:00 overlaps Monday 12:00–14:00'),
    ).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!;
    expect(JSON.parse(put[1]!.body as string)).toEqual({
      rules: [{ day: 1, start: '10:00', end: '13:00', slotMinutes: 15, mode: 'clinic' }],
      extraBlocks: [],
      daysOff: [],
    });
  });
});
