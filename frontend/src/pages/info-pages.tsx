import { useQuery } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button-variants';
import { fetchHealthReady } from '@/lib/health-api';
import { usePageTitle } from '@/lib/use-page-title';

export function InfoPage({
  title,
  eyebrow,
  description,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  children: ReactNode;
}) {
  usePageTitle(title);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="mt-8 flex flex-col gap-6 text-base leading-relaxed text-ink-muted">
        {children}
      </div>
    </div>
  );
}

export function CarePage() {
  return (
    <InfoPage
      eyebrow="Care"
      title="Healthcare categories"
      description="Browse the kinds of care Sukoon is building. Booking is open only where a verified doctor has published real appointment times."
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {CATEGORIES.map((item) => (
          <li key={item.title}>
            <Link
              to={item.to}
              className="block rounded-[var(--radius-card)] border border-line bg-surface p-5 hover:border-blush"
            >
              <span className="font-semibold text-ink">{item.title}</span>
              <span className="mt-1 block text-sm">{item.text}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p>
        <Link to="/doctors" className={buttonVariants()}>
          Find a doctor
        </Link>
      </p>
    </InfoPage>
  );
}

const CATEGORIES: { title: string; text: string; to: string }[] = [
  {
    title: 'Find a doctor',
    text: 'Search published profiles and book a clinic visit.',
    to: '/doctors',
  },
  {
    title: 'Doctor at home',
    text: 'Pilot-area home visits when booking is open on the server.',
    to: '/doctor-at-home',
  },
  {
    title: 'Online consultation',
    text: 'Book video visits when your clinic has LiveKit configured and doctors publish video hours.',
    to: '/online-consultation',
  },
  { title: 'Diagnostics', text: 'Lab and imaging orders are not open yet.', to: '/diagnostics' },
  { title: 'About Sukoon', text: 'How we think about verification and privacy.', to: '/about' },
  { title: 'Contact', text: 'How to reach us, and what to do in an emergency.', to: '/contact' },
];

// Doctor at home hub lives in @/features/home-visits/doctor-at-home-hub-page (see router).

export function OnlineConsultationPage() {
  const health = useQuery({
    queryKey: ['health', 'ready'],
    queryFn: ({ signal }) => fetchHealthReady(signal),
    staleTime: 60_000,
  });

  const videoOn = health.data?.integrations.videoCalls === true;

  return (
    <InfoPage
      eyebrow="Services"
      title="Online consultation"
      description="Private video visits inside Sukoon when video is configured and a doctor publishes real video hours."
    >
      {health.isSuccess && videoOn && (
        <Badge tone="success" className="w-fit">Video booking is on in this environment</Badge>
      )}
      {health.isSuccess && !videoOn && (
        <Alert tone="warning" title="Video booking is off right now">
          Doctors may still list video on their profile, but appointment times for video are hidden
          until the API has LiveKit configured (`VIDEO_PROVIDER=livekit` and valid `LIVEKIT_*` in{' '}
          <code className="text-sm">backend/.env</code>). In-clinic booking is unaffected.
        </Alert>
      )}
      {health.isError && (
        <Alert tone="error">We could not check whether video is enabled. In-clinic booking may still work.</Alert>
      )}
      <p>
        Video slots appear only while the platform has a video provider configured (LiveKit in
        development) and the doctor is taking bookings with online hours on their timetable. The
        call itself opens in your browser from the appointment page — not a separate app.
      </p>
      <p>
        <Link
          to="/doctors?mode=online&takingBookings=1"
          className={buttonVariants({ className: 'w-fit' })}
        >
          Doctors offering video
        </Link>
      </p>
      <p>
        In-clinic visits are on{' '}
        <Link to="/doctors?mode=clinic&takingBookings=1" className="font-semibold text-coral-ink hover:underline">
          Find a doctor
        </Link>
        .
      </p>
    </InfoPage>
  );
}

export function HomeHealthcarePage() {
  return (
    <InfoPage
      eyebrow="Services"
      title="Home healthcare"
      description="Nursing, physiotherapy and longer-term home care are planned after doctor-at-home and diagnostics are stable."
    >
      <Badge tone="soon" className="w-fit">
        Not open for booking
      </Badge>
      <p>
        Sukoon will list home-care partners only after verification, service areas and honest
        scheduling exist. There is no catalogue or booking in this version.
      </p>
      <p>
        For clinic or video visits today, start at{' '}
        <Link to="/doctors" className="font-semibold text-coral-ink hover:underline">
          Find a doctor
        </Link>
        .
      </p>
    </InfoPage>
  );
}

export function HealthPackagesPage() {
  return (
    <InfoPage
      eyebrow="Plans"
      title="Health packages"
      description="Bundled check-ups and wellness plans are on the roadmap after core booking and payments are proven."
    >
      <Badge tone="soon" className="w-fit">
        Coming soon
      </Badge>
      <p>
        Packages will combine verified doctors, diagnostics and follow-ups with clear pricing. Until
        partners and fulfilment are ready, we are not listing placeholder offers.
      </p>
    </InfoPage>
  );
}

export function HealthLibraryPage() {
  return (
    <InfoPage
      eyebrow="Learn"
      title="Health library"
      description="Patient-friendly articles reviewed by clinicians — not AI symptom checking."
    >
      <Badge tone="soon" className="w-fit">
        Coming soon
      </Badge>
      <p>
        The library will publish short guides on booking, privacy and common care journeys. Content
        appears here only after medical review, in line with our non-goals on unvalidated advice.
      </p>
      <p>
        <Link to="/about" className={buttonVariants({ variant: 'secondary', className: 'w-fit' })}>
          About Sukoon
        </Link>
      </p>
    </InfoPage>
  );
}

export function DiagnosticsPage() {
  return (
    <InfoPage
      eyebrow="Services"
      title="Diagnostics"
      description="Lab tests, imaging and home sample collection are not available to order yet."
    >
      <Badge tone="soon" className="w-fit">
        Not open for orders
      </Badge>
      <p>
        Sukoon will list a diagnostic partner only after an agreement is in place. There is no
        catalogue, price or booking for tests in this version.
      </p>
      <p>
        If you need a doctor first, start at{' '}
        <Link to="/doctors" className="font-semibold text-coral-ink hover:underline">
          Find a doctor
        </Link>
        .
      </p>
    </InfoPage>
  );
}

export function AboutPage() {
  return (
    <InfoPage
      eyebrow="Sukoon Health"
      title="About us"
      description="Sukoon is a healthcare discovery and booking service being built for families in India."
    >
      <p>
        Doctors appear in the public directory only after an administrator has checked their medical
        registration and the doctor has published a complete profile. Availability on a booking page
        comes from that doctor’s timetable, not from a guessed rating or a fabricated “available
        now” flag.
      </p>
      <p>
        Patients and doctors use separate dashboards. Both can read the public site. A person cannot
        grant themselves administrator access, and a doctor cannot verify their own registration.
      </p>
      <p>
        Sukoon is not an emergency service. In a life-threatening situation, call{' '}
        <a className="font-semibold text-ink hover:underline" href="tel:112">
          112
        </a>
        .
      </p>
    </InfoPage>
  );
}

export function ContactPage() {
  return (
    <InfoPage
      eyebrow="Contact"
      title="Contact"
      description="This development build does not collect messages through the website."
    >
      <p>
        There is no inbox connected to this page, so a contact form would not deliver anything. Use
        the emergency guidance if someone is in immediate danger, and your account page if you are
        signed in and need to review security settings.
      </p>
      <ul className="flex flex-col gap-2 text-ink">
        <li>
          <Link to="/emergency" className="font-semibold text-coral-ink hover:underline">
            Emergency guidance
          </Link>
        </li>
        <li>
          <Link to="/account" className="font-semibold text-coral-ink hover:underline">
            Your account
          </Link>
        </li>
        <li>
          <Link to="/doctors" className="font-semibold text-coral-ink hover:underline">
            Find a doctor
          </Link>
        </li>
      </ul>
    </InfoPage>
  );
}
