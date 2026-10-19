import {
  Activity,
  Ambulance,
  Baby,
  Brain,
  CalendarClock,
  ClipboardCheck,
  HandHeart,
  HeartPulse,
  House,
  Leaf,
  LockKeyhole,
  Microscope,
  Moon,
  ShieldCheck,
  Siren,
  Smile,
  Stethoscope,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button-variants';
import { homeForRoles } from '@/features/auth/home-for-roles';
import { useCurrentUser } from '@/features/auth/use-auth';
import { usePageTitle } from '@/lib/use-page-title';

interface ServicePreview {
  icon: LucideIcon;
  title: string;
  description: string;
  to: string;
}

const SERVICES: ServicePreview[] = [
  {
    icon: Stethoscope,
    title: 'General medicine',
    description: 'Everyday illness, check-ups and ongoing conditions.',
    to: '/doctors',
  },
  {
    icon: HeartPulse,
    title: 'Specialist doctors',
    description: 'Cardiology, dermatology, neurology, orthopaedics and more.',
    to: '/care',
  },
  {
    icon: House,
    title: 'Doctor at home',
    description: 'A verified doctor at your door, with honest arrival estimates.',
    to: '/doctor-at-home',
  },
  {
    icon: Video,
    title: 'Online consultation',
    description: 'Private video or audio visits with registered doctors.',
    to: '/online-consultation',
  },
  {
    icon: Baby,
    title: 'Child health',
    description: 'Paediatric care, vaccinations and growth check-ins.',
    to: '/care',
  },
  {
    icon: Brain,
    title: 'Mental health',
    description: 'Psychiatrists, psychologists and counsellors — clearly labelled.',
    to: '/care',
  },
  {
    icon: Microscope,
    title: 'Diagnostics',
    description: 'Lab tests, imaging and home sample collection.',
    to: '/diagnostics',
  },
  {
    icon: Activity,
    title: 'Physiotherapy',
    description: 'Rehabilitation at the clinic or at home.',
    to: '/care',
  },
  {
    icon: Leaf,
    title: 'Ayurveda & homeopathy',
    description: 'Qualified practitioners, with their medical system stated.',
    to: '/care',
  },
  {
    icon: Smile,
    title: 'Dental care',
    description: 'Routine dental care and specialist treatment.',
    to: '/care',
  },
  {
    icon: HandHeart,
    title: 'Home nursing',
    description: 'Nursing and caregiver support for recovery and long-term care.',
    to: '/care',
  },
  {
    icon: Ambulance,
    title: 'Medical transport',
    description: 'Non-emergency patient transport with partner providers.',
    to: '/care',
  },
];

const AROUND_THE_CLOCK_QUICK_FILTERS: { label: string; to?: string }[] = [
  {
    label: 'Available now',
    to: '/doctors?availWhen=today&takingBookings=1&sort=next_available',
  },
  { label: 'Online', to: '/doctors?mode=online&takingBookings=1' },
  { label: 'Clinic visit', to: '/doctors?mode=clinic&takingBookings=1' },
  { label: 'Tonight', to: '/doctors?availWhen=tonight&takingBookings=1' },
  { label: 'Weekend', to: '/doctors?availWhen=weekend&takingBookings=1' },
  { label: 'Public holiday', to: '/doctors?availWhen=public_holiday&takingBookings=1' },
  { label: 'Home visit', to: '/doctor-at-home' },
];

const COMMITMENTS = [
  {
    icon: ShieldCheck,
    title: 'Verified before listed',
    body: 'Doctors appear only after their registration and qualifications are checked against the relevant medical council.',
  },
  {
    icon: CalendarClock,
    title: 'Honest availability',
    body: 'Slots and arrival estimates come from real schedules and live conditions. We never invent ratings, reviews or ETAs.',
  },
  {
    icon: LockKeyhole,
    title: 'Privacy you control',
    body: 'See who can access your records, manage consent, and sign out devices you no longer use — all from your account.',
  },
  {
    icon: Siren,
    title: 'Clear about emergencies',
    body: 'Sukoon is not an emergency service. In a life-threatening situation we will always point you to 112 first.',
  },
];

export function HomePage() {
  usePageTitle('');
  const { data: user } = useCurrentUser();
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-40 size-[38rem] rounded-full bg-peach/45 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 -left-32 size-[30rem] rounded-full bg-bluegrey/20 blur-3xl"
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:px-8 lg:pt-20 lg:pb-28">
          <div className="flex flex-col gap-7">
            <Badge tone="accent" className="w-fit px-3 py-1">
              Early access · Built for families in India
            </Badge>
            <h1 className="text-[2.6rem] leading-[1.05] font-semibold sm:text-6xl lg:text-[4.1rem]">
              Care that feels calm, from people you can{' '}
              <em className="text-coral-ink not-italic">trust</em>.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-ink-muted">
              Find verified doctors, see genuine availability, and keep your health records private
              — whether you need an online consultation, a clinic visit, or a doctor at home.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              {user ? (
                <Link to={homeForRoles(user.roles)} className={buttonVariants({ size: 'lg' })}>
                  {homeForRoles(user.roles) === '/account'
                    ? 'Go to your account'
                    : 'Go to your dashboard'}
                </Link>
              ) : (
                <>
                  <Link to="/register" className={buttonVariants({ size: 'lg' })}>
                    Create your free account
                  </Link>
                  <Link
                    to="/login"
                    className={buttonVariants({ size: 'lg', variant: 'secondary' })}
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>
            <p className="text-sm text-ink-muted">
              No fabricated ratings. No hidden availability. Your records, your consent.{' '}
              <Link
                to="/doctors?takingBookings=1"
                className="font-medium text-coral-ink underline-offset-2 hover:underline"
              >
                Browse doctors taking new bookings
              </Link>
              .
            </p>
          </div>

          <div className="relative">
            <div className="rounded-[2rem] border border-line bg-gradient-to-br from-blush/40 via-surface to-peach/30 p-5 shadow-[var(--shadow-lifted)] sm:p-7">
              <p className="px-1 pb-4 text-sm font-semibold text-ink-muted">
                What every booking on Sukoon will promise
              </p>
              <ul className="flex flex-col gap-3">
                {COMMITMENTS.slice(0, 3).map(({ icon: Icon, title, body }) => (
                  <li
                    key={title}
                    className="flex gap-4 rounded-2xl border border-line/70 bg-surface/90 p-4"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-peach/60">
                      <Icon className="size-5 text-coral-ink" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-semibold">{title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="scroll-mt-28 border-y border-line bg-surface/70">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="text-sm font-semibold tracking-wide text-coral-ink uppercase">Services</p>
            <h2 className="text-3xl font-semibold sm:text-4xl">
              One calm place for your family's care
            </h2>
            <p className="text-ink-muted">
              We are opening services one at a time, and each launches only once it is safe and
              genuinely works.
            </p>
          </div>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {SERVICES.map(({ icon: Icon, title, description, to }) => (
              <li key={title}>
                <Link
                  to={to}
                  className="flex h-full flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-canvas p-6 transition-colors hover:border-blush"
                >
                  <span className="grid size-12 place-items-center rounded-2xl bg-blush/35">
                    <Icon className="size-6 text-ink" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-sans text-lg font-semibold text-ink">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="around-the-clock"
        className="scroll-mt-28 mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-12 text-canvas sm:px-12 sm:py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-mauve/40 blur-3xl"
          />
          <div className="relative grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div className="flex flex-col gap-5">
              <span className="grid size-12 place-items-center rounded-2xl bg-canvas/10">
                <Moon className="size-6 text-peach" aria-hidden="true" />
              </span>
              <h2 className="text-3xl font-semibold text-canvas sm:text-4xl">
                Doctors available 24×7
              </h2>
              <p className="max-w-xl leading-relaxed text-canvas/80">
                Night, weekend and public-holiday care — shown only when it is real. "Available now"
                will appear only when a verified doctor's schedule, booking capacity, consultation
                mode and your location all genuinely allow it.
              </p>
              <p className="text-sm text-canvas/65">
                Not every specialty or home-visit service runs around the clock, and we will always
                say so clearly.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <p className="text-sm font-semibold text-canvas/70">Quick filters</p>
              <ul className="flex flex-wrap gap-2" aria-label="Directory quick filters">
                {AROUND_THE_CLOCK_QUICK_FILTERS.map(({ label, to }) => (
                  <li key={label}>
                    {to ? (
                      <Link
                        to={to}
                        className="inline-block rounded-full border border-canvas/30 bg-canvas/10 px-4 py-2 text-sm text-canvas transition hover:border-peach/60 hover:bg-canvas/15"
                      >
                        {label}
                      </Link>
                    ) : (
                      <span
                        className="inline-block rounded-full border border-canvas/20 px-4 py-2 text-sm text-canvas/70"
                        title="Coming soon"
                      >
                        {label}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-canvas/60">
                Home visits are not bookable yet — the Home visit link explains what we are building
                first.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="our-commitments"
        className="scroll-mt-28 mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8"
      >
        <div className="flex max-w-2xl flex-col gap-3">
          <p className="text-sm font-semibold tracking-wide text-coral-ink uppercase">
            Our commitments
          </p>
          <h2 className="text-3xl font-semibold sm:text-4xl">
            Trust is designed in, not added later
          </h2>
        </div>
        <ul className="mt-10 grid gap-5 md:grid-cols-2">
          {COMMITMENTS.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="flex gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-7"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sage/25">
                <Icon className="size-6 text-info-ink" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-sans text-lg font-semibold">{title}</h3>
                <p className="mt-1.5 leading-relaxed text-ink-muted">{body}</p>
              </div>
            </li>
          ))}
        </ul>
        {!user && (
          <div className="mt-14 flex flex-col items-start justify-between gap-6 rounded-[var(--radius-card)] bg-peach/45 p-8 sm:flex-row sm:items-center sm:p-10">
            <div>
              <h2 className="text-2xl font-semibold">Be ready when booking opens</h2>
              <p className="mt-1 text-ink-muted">
                Create your account now and manage your privacy settings from day one.
              </p>
            </div>
            <Link to="/register" className={buttonVariants({ size: 'lg' })}>
              <ClipboardCheck className="size-4" aria-hidden="true" />
              Create account
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
