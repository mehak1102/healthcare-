import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DoctorPublicProfile } from '@/features/doctors/api';
import { BookingPanel } from './booking-panel';
import { VideoCallPage } from './video-call-page';
import { VideoJoinLink } from './video-join-link';

vi.mock('@livekit/components-styles', () => ({}));
vi.mock('livekit-client', () => ({
  Track: { Source: { Camera: 'camera', ScreenShare: 'screen_share' } },
}));
vi.mock('@livekit/components-react', () => ({
  LiveKitRoom: (props: {
    serverUrl: string;
    token: string;
    onDisconnected?: () => void;
    children?: ReactNode;
  }) => (
    <div data-testid="room" data-url={props.serverUrl} data-token={props.token}>
      <button type="button" onClick={() => props.onDisconnected?.()}>
        Leave
      </button>
    </div>
  ),
  GridLayout: () => null,
  ParticipantTile: () => null,
  ControlBar: () => null,
  RoomAudioRenderer: () => null,
  useTracks: () => [],
}));

const DOCTOR: DoctorPublicProfile = {
  slug: 'dr-kavya-rao-a1b2c3',
  displayName: 'Kavya Rao',
  specialty: 'Pulmonologist',
  qualification: 'MBBS',
  registrationYear: 2015,
  languages: ['English'],
  consultationModes: ['clinic', 'online'],
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

const slots = (videoBookingOpen: boolean) => ({
  timezone: 'Asia/Kolkata',
  feeInr: 500,
  bookableUntil: '2026-11-11',
  unavailableReason: null,
  nextAvailableDate: '2026-10-20',
  videoBookingOpen,
  days: [
    {
      date: '2026-10-20',
      slots: [
        {
          startsAt: '2026-10-20T04:30:00.000Z',
          endsAt: '2026-10-20T04:45:00.000Z',
          mode: 'clinic',
        },
        ...(videoBookingOpen
          ? [
              {
                startsAt: '2026-10-20T08:30:00.000Z',
                endsAt: '2026-10-20T08:45:00.000Z',
                mode: 'online',
              },
            ]
          : []),
      ],
    },
  ],
});

type Handler = (url: string, init?: RequestInit) => Response | undefined;

function stubFetch(handler: Handler) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(input.toString(), init) ?? new Response(null, { status: 404 })),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderAt(path: string, routes: { path: string; element: ReactNode }[]) {
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

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

afterEach(() => vi.unstubAllGlobals());

describe('booking a video consultation', () => {
  it('lets the patient pick video times when video is open', async () => {
    stubFetch((url) => {
      if (url.endsWith('/auth/me')) return Response.json({ user: USER, csrfToken: 'csrf' });
      if (url.includes('/slots')) return Response.json(slots(true));
      return undefined;
    });
    renderAt(`/doctors/${DOCTOR.slug}`, [
      { path: '/doctors/:slug', element: <BookingPanel doctor={DOCTOR} /> },
    ]);

    const both = await screen.findByRole('button', { name: /10:00 am/ });
    expect(both).toHaveTextContent('Clinic');
    await userEvent.click(screen.getByRole('button', { name: 'Video consultation' }));
    expect(screen.queryByRole('button', { name: /10:00 am/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '2:00 pm' }));
    expect(screen.getByText(/video consultation\. You can/)).toBeInTheDocument();
  });

  it('says video is unavailable and offers only clinic times when it is switched off', async () => {
    stubFetch((url) => {
      if (url.endsWith('/auth/me')) return Response.json({ user: USER, csrfToken: 'csrf' });
      if (url.includes('/slots')) return Response.json(slots(false));
      return undefined;
    });
    renderAt(`/doctors/${DOCTOR.slug}`, [
      { path: '/doctors/:slug', element: <BookingPanel doctor={DOCTOR} /> },
    ]);
    expect(
      await screen.findByText(/Video consultations are not on this site yet/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Type of consultation' })).not.toBeInTheDocument();
  });
});

describe('VideoJoinLink', () => {
  const renderLink = (videoOpensAt: string | null, endsAt: string) =>
    renderAt('/', [
      {
        path: '/',
        element: (
          <VideoJoinLink appointment={{ videoOpensAt, endsAt }} to="/appointments/a1/call" />
        ),
      },
    ]);

  it('says when the call opens', () => {
    renderLink(minutesFromNow(30), minutesFromNow(50));
    expect(screen.getByText(/The video call opens at/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('links to the call once it is open', () => {
    renderLink(minutesFromNow(-2), minutesFromNow(18));
    expect(screen.getByRole('link', { name: 'Join video call' })).toHaveAttribute(
      'href',
      '/appointments/a1/call',
    );
  });

  it('disappears after the end time', () => {
    renderLink(minutesFromNow(-30), minutesFromNow(-10));
    expect(screen.queryByText(/video call/)).not.toBeInTheDocument();
  });
});

describe('VideoCallPage', () => {
  it('joins the call with a server-issued pass and allows rejoining', async () => {
    const fetchMock = stubFetch((url, init) => {
      if (url.endsWith('/appointments/a1/video') && init?.method === 'POST') {
        return Response.json({ url: 'wss://video.test.invalid', token: 'pass-1' });
      }
      return undefined;
    });
    renderAt('/appointments/a1/call', [
      { path: '/appointments/:id/call', element: <VideoCallPage as="patient" /> },
    ]);

    expect(screen.getByText(/not end-to-end encrypted/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Join call' }));
    const room = await screen.findByTestId('room');
    expect(room).toHaveAttribute('data-url', 'wss://video.test.invalid');
    expect(room).toHaveAttribute('data-token', 'pass-1');
    expect(fetchMock.mock.calls[0]![0].toString()).toMatch(/\/api\/v1\/appointments\/a1\/video$/);

    await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(await screen.findByText(/You have left the call/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rejoin call' })).toBeInTheDocument();
  });

  it('uses the doctor endpoint and shows why joining was refused', async () => {
    const fetchMock = stubFetch((url) => {
      if (url.endsWith('/doctor/appointments/a1/video')) {
        return Response.json(
          {
            error: {
              code: 'TOO_EARLY',
              message: 'The call opens 5 minutes before the appointment starts.',
            },
          },
          { status: 409 },
        );
      }
      return undefined;
    });
    renderAt('/doctor/appointments/a1/call', [
      { path: '/doctor/appointments/:id/call', element: <VideoCallPage as="doctor" /> },
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Join call' }));
    expect(
      await screen.findByText('The call opens 5 minutes before the appointment starts.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('room')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
