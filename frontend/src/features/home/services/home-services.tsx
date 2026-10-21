import {
  Activity,
  Ambulance,
  Bell,
  Check,
  FlaskConical,
  HandHeart,
  House,
  Leaf,
  Lock,
  Mic,
  PhoneOff,
  ShieldCheck,
  Smile,
  Syringe,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { doctorName } from '@/features/doctors/api';
import { cn } from '@/lib/cn';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';
import './home-services.css';
import { initials, useServicesLive } from './use-services-live';

const WORDS = ["family's", "parents'", "child's", 'own'] as const;
const LIVE_COUNT = 6;
const SOON_COUNT = 6;
const NOTIFY_KEY = 'sukoon-service-notify';
const SPEC_COLORS = ['#E5484D', '#E07A45', '#4C4FE0', '#1C8A5A', '#2A72C2', '#C2843A', '#8C5BD6', '#2A9DB5', '#3D6FD6', '#D2557C'];
const FALLBACK_SPEC_A = ['Cardiology', 'Dermatology', 'Neurology', 'Orthopaedics', 'ENT'];
const FALLBACK_SPEC_B = ['Gastroenterology', 'Endocrinology', 'Pulmonology', 'Urology', 'Ophthalmology'];

const SOON: { key: string; name: string; desc: string; to: string; icon: LucideIcon }[] = [
  { key: 'dh', name: 'Doctor at home', desc: 'Verified doctor, honest arrival estimates', to: '/doctor-at-home', icon: House },
  { key: 'hn', name: 'Home nursing', desc: 'Recovery and long-term care', to: '/home-healthcare', icon: HandHeart },
  { key: 'ph', name: 'Physiotherapy', desc: 'At the clinic or at home', to: '/care', icon: Activity },
  { key: 'de', name: 'Dental care', desc: 'Routine and specialist treatment', to: '/care', icon: Smile },
  { key: 'ay', name: 'Ayurveda & homeopathy', desc: 'Medical system stated clearly', to: '/care', icon: Leaf },
  { key: 'mt', name: 'Medical transport', desc: 'Non-emergency, with partners', to: '/care', icon: Ambulance },
];

function Arrow() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function LiveBadge({ onDark = false }: { onDark?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        onDark ? 'bg-[#DDF7E9] text-[#0E5C3A]' : 'bg-[var(--svc-success-bg)] text-[var(--svc-success)]',
      )}
    >
      <span aria-hidden="true" className="svc-blink size-1.5 rounded-full bg-[var(--svc-success-dot)]" />
      Live
    </span>
  );
}

function TiltCard({
  className,
  spot,
  children,
  delay,
}: {
  className: string;
  spot: string;
  children: ReactNode;
  delay?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [hot, setHot] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const onMove = (event: MouseEvent<HTMLElement>) => {
    if (reduced) return;
    const r = event.currentTarget.getBoundingClientRect();
    setHot({ x: event.clientX - r.left, y: event.clientY - r.top, w: r.width, h: r.height });
  };

  const rx = hot ? ((hot.y / hot.h) - 0.5) * -5 : 0;
  const ry = hot ? ((hot.x / hot.w) - 0.5) * 5 : 0;

  return (
    <article
      className={cn('svc-card svc-rv', hot && 'is-hot', className)}
      style={{
        animationDelay: delay,
        transform: hot
          ? `perspective(1200px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-4px)`
          : undefined,
      }}
      onMouseMove={onMove}
      onMouseLeave={() => setHot(null)}
    >
      <div
        aria-hidden="true"
        className="svc-spot"
        style={{
          background: `radial-gradient(420px circle at ${hot?.x ?? 0}px ${hot?.y ?? 0}px, ${spot}, transparent 60%)`,
        }}
      />
      {children}
    </article>
  );
}

function splitSpecialties(list: string[]) {
  const source = list.length >= 4 ? list : [...FALLBACK_SPEC_A, ...FALLBACK_SPEC_B];
  const mid = Math.ceil(source.length / 2);
  return [source.slice(0, mid), source.slice(mid || 0)] as const;
}

function readNotify(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NOTIFY_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function HomeServices() {
  const live = useServicesLive();
  const reduced = usePrefersReducedMotion();
  const [tick, setTick] = useState(0);
  const [call, setCall] = useState<'video' | 'audio'>('video');
  const [gmSlot, setGmSlot] = useState(0);
  const [notify, setNotify] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setNotify(readNotify());
  }, []);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [reduced]);

  const word = WORDS[Math.floor(tick / 3) % WORDS.length];
  const secs = 504 + tick;
  const callTime = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  const chatPhase = tick % 8;
  const dxStep = Math.min(3, Math.floor((tick % 12) / 2.5));
  const reportReady = dxStep >= 3;
  const [rowA, rowB] = splitSpecialties(live.specialties);
  const notifyCount = Object.values(notify).filter(Boolean).length;
  const onlineDoctor = live.online;
  const gp = live.gp;
  const gpSlots = live.gpSlots;

  const toggleNotify = (key: string) => {
    setNotify((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(NOTIFY_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota / private mode */
      }
      return next;
    });
  };

  const dxSteps = [
    { label: 'Booked', when: '· Mon, 7:40 PM' },
    { label: 'Sample collected at home', when: '· Tue, 8:10 AM' },
    { label: 'Processing at partner lab', when: '· Tue' },
    { label: 'Report ready', when: '· Tue, 6:30 PM' },
  ];
  const labs = [
    { name: 'Haemoglobin', val: '13.8 g/dL', pct: 58 },
    { name: 'White cells', val: '7.2 ×10³/µL', pct: 46 },
    { name: 'Platelets', val: '2.6 lakh/µL', pct: 40 },
  ];

  const onlineHref = onlineDoctor
    ? `/doctors/${onlineDoctor.slug}`
    : '/doctors?mode=online&takingBookings=1';
  const gpHref = gp ? `/doctors/${gp.slug}` : '/doctors?specialty=General%20Physician&takingBookings=1';
  const paediatricHref = `/doctors?${new URLSearchParams({ takingBookings: '1', q: 'paediatr' })}`;
  const mentalHref = `/doctors?${new URLSearchParams({ takingBookings: '1', q: 'psych' })}`;

  return (
    <section id="services" data-sukoon-services className="scroll-mt-28 relative overflow-hidden bg-white">
      <div aria-hidden="true" className="svc-grid pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="svc-gm pointer-events-none absolute top-[280px] -left-40 size-[560px] rounded-full bg-[#DCD8FF] opacity-55 blur-[130px]" />
      <div aria-hidden="true" className="svc-gm pointer-events-none absolute top-[760px] -right-36 size-[560px] rounded-full bg-[#CDEBFF] opacity-60 blur-[130px] [animation-delay:-6s]" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-[120px] left-[30%] h-[360px] w-[520px] rounded-full bg-[#D3F5E4] opacity-45 blur-[130px]" />

      <div className="relative mx-auto flex max-w-[1240px] flex-col gap-14 px-6 py-[108px]">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="flex min-w-0 flex-[1_1_600px] flex-col gap-[18px]">
            <div className="svc-rv inline-flex items-center gap-2.5 self-start rounded-full border border-[var(--svc-border)] bg-white/85 py-1.5 pr-3.5 pl-1.5 text-[13.5px] font-semibold text-[var(--svc-dark)] shadow-[0_8px_22px_-16px_rgba(14,18,34,0.35)]">
              <span className="rounded-full bg-[var(--svc-indigo)] px-2.5 py-1 text-[12px] font-bold tracking-[0.12em] text-white uppercase">
                Services
              </span>
              Opening one at a time, safely
            </div>
            <h2 id="svc-h" className="svc-rv text-[clamp(44px,5.4vw,74px)] leading-[1.02] font-semibold tracking-[-0.045em]" style={{ animationDelay: '0.15s' }}>
              One <span className="svc-serif tracking-[-0.02em] text-[var(--svc-indigo)]">calm</span> place
              <br />
              for your{' '}
              <span className="relative inline-block min-w-[4.6em]">
                <span key={word} className="svc-word">
                  {word}
                </span>
              </span>{' '}
              care
            </h2>
          </div>
          <div className="svc-rv flex flex-[0_1_380px] flex-col gap-[18px]" style={{ animationDelay: '0.25s' }}>
            <p className="m-0 text-[17px] leading-[1.6] text-[var(--svc-body)]">
              Every service launches only once it is safe and genuinely works. Here's what's open today — and what's coming next.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--svc-success-bg)] px-3.5 py-2 text-sm font-semibold text-[var(--svc-success)]">
                <span aria-hidden="true" className="svc-blink size-2 rounded-full bg-[var(--svc-success-dot)]" />
                {LIVE_COUNT} live now
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#F2F3F8] px-3.5 py-2 text-sm font-semibold text-[var(--svc-body)]">
                <span aria-hidden="true" className="size-2 rounded-full bg-[#A3A8B8]" />
                {SOON_COUNT} opening soon
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-[18px]">
          <TiltCard
            delay="0.35s"
            spot="rgba(255,255,255,0.22)"
            className="col-span-12 min-h-[500px] flex-col gap-[22px] border border-[#5B5EF2] bg-gradient-to-br from-[#4C4FE0] via-[#6556EE] to-[#8C7AF5] p-[34px] text-white shadow-[0_34px_70px_-34px_rgba(76,79,224,0.85)] lg:col-span-7"
          >
            <div aria-hidden="true" className="pointer-events-none absolute -top-[90px] -right-[90px] size-[320px] rounded-full border border-white/16" />
            <div aria-hidden="true" className="pointer-events-none absolute -top-5 -right-5 size-[180px] rounded-full border border-white/16" />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-[380px]">
                <LiveBadge onDark />
                <h3 className="mt-3.5 mb-0 text-[34px] leading-[1.05] font-semibold tracking-[-0.035em] text-white">Online consultation</h3>
                <p className="mt-2.5 mb-0 text-base leading-[1.55] text-[#E6E5FF]">
                  Private video or audio visits with registered doctors — from wherever you are.
                </p>
              </div>
              <div role="group" aria-label="Call type" className="flex rounded-[13px] bg-white/14 p-1">
                {(['video', 'audio'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={call === kind}
                    onClick={() => setCall(kind)}
                    className={cn(
                      'min-h-10 cursor-pointer rounded-[10px] border-0 px-4 text-[13.5px] font-semibold capitalize transition',
                      call === kind ? 'bg-white text-[var(--svc-indigo-dark)]' : 'bg-transparent text-[#E6E5FF] hover:text-white',
                    )}
                  >
                    {kind}
                  </button>
                ))}
              </div>
            </div>
            <div
              aria-hidden="true"
              className="relative flex min-h-[250px] flex-1 items-center justify-center overflow-hidden rounded-[24px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
              style={{ background: 'radial-gradient(120% 90% at 50% 0%, #20265A 0%, #12163A 60%)' }}
            >
              <div className="absolute top-3.5 left-3.5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12.5px] font-semibold tabular-nums">
                <span className="svc-blink size-1.5 rounded-full bg-[#FF6B6B]" />
                {callTime}
              </div>
              <div className="absolute top-3.5 right-3.5 inline-flex items-center gap-1.5 rounded-full bg-white/6 px-2.5 py-1 text-xs text-[#C9CCF8]">
                <Lock className="size-3" />
                Private
              </div>
              <div className="flex flex-col items-center gap-3.5">
                <div className="relative size-[92px]">
                  <span className="svc-rip" />
                  <span className="svc-rip" style={{ animationDelay: '1.2s' }} />
                  <div className="relative grid size-[92px] place-items-center rounded-full bg-gradient-to-br from-[#FFEFE6] to-[#FFD9C4] text-[28px] font-bold text-[#9A4521] shadow-[0_20px_40px_-16px_rgba(0,0,0,0.6)]">
                    {onlineDoctor ? initials(onlineDoctor.displayName) : 'AR'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[15px] font-semibold">{onlineDoctor ? doctorName(onlineDoctor.displayName) : 'A verified doctor'}</div>
                  <div className="mt-0.5 text-[12.5px] text-[#A9ADD0]">
                    {onlineDoctor ? `${onlineDoctor.specialty} · Verified` : 'Video visit · Verified'}
                  </div>
                </div>
                {call === 'audio' && (
                  <div className="flex h-7 items-center gap-1">
                    {Array.from({ length: 9 }, (_, i) => (
                      <span key={i} className="svc-wv" style={{ animationDelay: `${i * 0.12}s` }} />
                    ))}
                  </div>
                )}
              </div>
              {call === 'video' && (
                <div className="absolute right-3.5 bottom-[74px] flex h-[102px] w-[78px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/18 bg-gradient-to-br from-[#343B78] to-[#1E2350] shadow-[0_16px_30px_-14px_rgba(0,0,0,0.6)]">
                  <span className="grid size-8 place-items-center rounded-full bg-[#E5E3FF] text-xs font-bold text-[var(--svc-indigo-dark)]">You</span>
                </div>
              )}
              <div className="absolute bottom-3.5 left-1/2 flex -translate-x-1/2 gap-2.5 rounded-full bg-white/6 p-1.5 backdrop-blur-[10px]">
                <span className="grid size-10 place-items-center rounded-full bg-white/12"><Mic className="size-4 text-white" /></span>
                <span className="grid size-10 place-items-center rounded-full bg-white/12"><Video className="size-4 text-white" /></span>
                <span className="grid size-10 place-items-center rounded-full bg-[#E5484D]"><PhoneOff className="size-4 text-white" /></span>
              </div>
            </div>
            <Link to={onlineHref} className="svc-go-w relative self-start">
              Start a consultation
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4C4FE0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </TiltCard>

          <TiltCard
            delay="0.45s"
            spot="rgba(224,122,69,0.16)"
            className="col-span-12 min-h-[500px] flex-col gap-5 border border-[#F6E3D6] bg-gradient-to-b from-[#FFF1E6] to-white p-[30px] shadow-[0_1px_2px_rgba(14,18,34,0.03),0_20px_50px_-40px_rgba(180,90,40,0.5)] lg:col-span-5"
          >
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <LiveBadge />
                <h3 className="mt-3.5 mb-0 text-[28px] font-semibold tracking-[-0.03em]">Child health</h3>
                <p className="mt-2 mb-0 text-[15.5px] leading-[1.55] text-[var(--svc-body)]">Paediatric care, vaccinations and growth check-ins.</p>
              </div>
              <div role="img" aria-label="3 of 4 vaccines done" className="relative size-[72px] shrink-0">
                <svg width="72" height="72" viewBox="0 0 64 64" aria-hidden="true">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="#FBE3D6" strokeWidth="6" />
                  <circle className="svc-ring" cx="32" cy="32" r="28" fill="none" stroke="#E07A45" strokeWidth="6" strokeLinecap="round" strokeDasharray="176" strokeDashoffset="44" transform="rotate(-90 32 32)" />
                </svg>
                <span className="absolute inset-0 flex flex-col items-center justify-center text-base leading-none font-bold">
                  3/4
                  <span className="mt-0.5 text-[10px] font-semibold text-[#9A4521]">doses</span>
                </span>
              </div>
            </div>
            <div aria-label="Example vaccination tracker" className="relative flex flex-col gap-3.5 rounded-[22px] bg-white p-[18px] shadow-[0_24px_44px_-28px_rgba(180,90,40,0.5)]">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="grid size-[42px] place-items-center rounded-[13px] bg-gradient-to-br from-[#FFEDE4] to-[#FFD9C4]">
                  <Syringe className="size-5 text-[#C25A2E]" />
                </span>
                <div className="flex-1">
                  <div className="text-[15px] font-semibold">Next vaccine due</div>
                  <div className="text-[13px] text-[var(--svc-muted)]">Talk to a paediatrician about your child's schedule</div>
                </div>
              </div>
              <div aria-hidden="true" className="grid grid-cols-4 gap-1.5">
                {['6 wk', '10 wk', '9 mo', '15 mo'].map((label, i) => (
                  <div key={label} className="flex flex-col items-center gap-1.5">
                    <span className={cn('h-1.5 w-full rounded-full', i < 3 ? 'bg-[var(--svc-success-dot)]' : 'bg-[repeating-linear-gradient(90deg,#F2B693_0_6px,#FBE3D6_6px_10px)]')} />
                    <span className={cn('text-xs', i === 3 ? 'font-bold text-[#9A4521]' : 'text-[var(--svc-muted)]')}>{label}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-[#FFF7F2] px-3 py-2.5 text-[13px] text-[var(--svc-dark)]">
                <Bell className="size-3.5 text-[#C25A2E]" />
                Reminder and records stay with you
              </div>
            </div>
            <Link to={paediatricHref} className="svc-go relative mt-auto">
              Find a paediatrician <Arrow />
            </Link>
          </TiltCard>

          <TiltCard
            delay="0.55s"
            spot="rgba(76,79,224,0.12)"
            className="col-span-12 min-h-[450px] flex-col gap-5 border border-[var(--svc-border)] bg-white/92 p-[30px] shadow-[0_1px_2px_rgba(14,18,34,0.03),0_20px_50px_-40px_rgba(60,60,140,0.5)] md:col-span-6 lg:col-span-4"
          >
            <div className="relative">
              <LiveBadge />
              <h3 className="mt-3.5 mb-0 text-[26px] font-semibold tracking-[-0.03em]">General medicine</h3>
              <p className="mt-2 mb-0 text-[15.5px] leading-[1.55] text-[var(--svc-body)]">Everyday illness, check-ups and ongoing conditions.</p>
            </div>
            <div aria-label="Open slots" className="relative flex flex-col gap-3 rounded-[20px] border border-[var(--svc-border)] bg-white p-3.5 shadow-[0_20px_40px_-28px_rgba(60,60,140,0.45)]">
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="grid size-[38px] place-items-center rounded-full bg-gradient-to-br from-[#FFEFE6] to-[#FFD9C4] text-xs font-bold text-[#9A4521]">
                  {gp ? initials(gp.displayName) : 'GP'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-semibold">
                    {gp ? doctorName(gp.displayName) : 'General physicians'}
                    <ShieldCheck className="size-3.5 text-[var(--svc-indigo)]" aria-label="Verified" />
                  </span>
                  <span className="block text-[12.5px] text-[var(--svc-muted)]">
                    {gp
                      ? live.gpOpenToday
                        ? `Open today · ${live.gpSlots.length} slots`
                        : gp.nextAvailableDate
                          ? 'Next slots on their profile'
                          : 'Taking bookings'
                      : 'Find a doctor taking bookings'}
                  </span>
                </span>
              </div>
              {gpSlots.length > 0 ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {gpSlots.map((item, i) => (
                    <button
                      key={item.label}
                      type="button"
                      aria-pressed={gmSlot === i}
                      onClick={() => setGmSlot(i)}
                      className={cn(
                        'min-h-10 cursor-pointer rounded-[11px] text-[13px] font-semibold transition',
                        gmSlot === i
                          ? 'border border-[#0E1222] bg-[#0E1222] text-white'
                          : 'border border-[var(--svc-border)] bg-[#F7F8FC] text-[var(--svc-ink)]',
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="m-0 text-[13px] text-[var(--svc-muted)]">Open times appear here from live schedules.</p>
              )}
            </div>
            <div className="relative flex flex-wrap gap-1.5">
              {['Fever & cold', 'BP', 'Diabetes', 'Check-ups'].map((tag) => (
                <span key={tag} className="rounded-full border border-[var(--svc-border)] bg-white/80 px-2.5 py-1 text-[13px] font-medium text-[var(--svc-dark)]">
                  {tag}
                </span>
              ))}
            </div>
            <Link to={gpHref} className="svc-go relative mt-auto">
              Book {gpSlots[gmSlot]?.label ?? 'a visit'} <Arrow />
            </Link>
          </TiltCard>

          <TiltCard
            delay="0.55s"
            spot="rgba(76,79,224,0.16)"
            className="col-span-12 min-h-[450px] flex-col gap-5 border border-[#E6E3FB] bg-gradient-to-b from-[#F1EFFF] to-white p-[30px] shadow-[0_1px_2px_rgba(14,18,34,0.03),0_20px_50px_-40px_rgba(76,79,224,0.5)] md:col-span-6 lg:col-span-4"
          >
            <div className="relative">
              <LiveBadge />
              <h3 className="mt-3.5 mb-0 text-[26px] font-semibold tracking-[-0.03em]">Mental health</h3>
              <p className="mt-2 mb-0 text-[15.5px] leading-[1.55] text-[var(--svc-body)]">
                Psychiatrists, psychologists and counsellors — always clearly labelled.
              </p>
            </div>
            <div aria-label="Example private chat" className="relative flex min-h-[170px] flex-col gap-2.5">
              <div className="flex items-center gap-2 text-[12.5px]">
                <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-[#E5E3FF] text-[10.5px] font-bold text-[var(--svc-indigo-dark)]">
                  MH
                </span>
                <span className="font-semibold">Counsellor</span>
                <span className="rounded-full bg-[#EEEDFF] px-2 py-0.5 text-[11.5px] font-bold text-[var(--svc-indigo-dark)]">Clearly labelled</span>
              </div>
              <div className="max-w-[88%] self-start rounded-[18px_18px_18px_6px] border border-[var(--svc-border)] bg-white px-3.5 py-2.5 text-sm leading-[1.45] shadow-[0_10px_24px_-18px_rgba(60,60,140,0.5)]">
                How have you been sleeping this week?
              </div>
              {chatPhase >= 1 && chatPhase < 3 && (
                <div className="svc-msg inline-flex gap-1 self-end rounded-[18px_18px_6px_18px] bg-[#EEEDFF] px-3.5 py-3">
                  <span className="svc-td" />
                  <span className="svc-td" style={{ animationDelay: '0.15s' }} />
                  <span className="svc-td" style={{ animationDelay: '0.3s' }} />
                </div>
              )}
              {chatPhase >= 3 && (
                <div className="svc-msg max-w-[88%] self-end rounded-[18px_18px_6px_18px] bg-[var(--svc-indigo)] px-3.5 py-2.5 text-sm leading-[1.45] text-white shadow-[0_12px_24px_-14px_rgba(76,79,224,0.8)]">
                  A little better, thank you.
                </div>
              )}
              <div className="mt-auto inline-flex items-center gap-1.5 text-[12.5px] text-[var(--svc-muted)]">
                <Lock className="size-3" />
                Only you and your counsellor can see this
              </div>
            </div>
            <Link to={mentalHref} className="svc-go relative mt-auto">
              Talk to someone <Arrow />
            </Link>
          </TiltCard>

          <TiltCard
            delay="0.55s"
            spot="rgba(42,114,194,0.14)"
            className="col-span-12 min-h-[450px] flex-col gap-5 border border-[#DDEBFA] bg-gradient-to-b from-[#ECF5FF] to-white p-[30px] shadow-[0_1px_2px_rgba(14,18,34,0.03),0_20px_50px_-40px_rgba(30,80,140,0.5)] md:col-span-12 lg:col-span-4"
          >
            <div className="relative">
              <LiveBadge />
              <h3 className="mt-3.5 mb-0 text-[26px] font-semibold tracking-[-0.03em]">Specialist doctors</h3>
              <p className="mt-2 mb-0 text-[15.5px] leading-[1.55] text-[var(--svc-body)]">
                The right specialist, with registration checked — every time.
              </p>
            </div>
            <div
              className="svc-mqwrap relative mx-[-30px] flex flex-col gap-2.5 overflow-hidden"
              aria-label="Specialties available"
              style={{ maskImage: 'linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent)' }}
            >
              {[rowA, rowB].map((row, rowIndex) => (
                <div key={rowIndex} className={cn('svc-mq', rowIndex === 0 ? 'svc-mq-l' : 'svc-mq-r')}>
                  {[...row, ...row].map((name, i) => (
                    <span
                      key={`${name}-${i}`}
                      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#E3ECF7] bg-white px-3.5 py-2 text-sm font-semibold shadow-[0_8px_20px_-16px_rgba(30,80,140,0.6)]"
                    >
                      <span aria-hidden="true" className="size-2 rounded-full" style={{ background: SPEC_COLORS[i % SPEC_COLORS.length] }} />
                      {name}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <div className="relative inline-flex items-center gap-2 rounded-xl border border-[#DDEBFA] bg-white/80 px-3 py-2.5 text-[13.5px] text-[var(--svc-dark)]">
              <ShieldCheck className="size-4 text-[var(--svc-success-dot)]" />
              Registration checked for every specialist
            </div>
            <Link to="/doctors" className="svc-go relative mt-auto">
              Browse specialists <Arrow />
            </Link>
          </TiltCard>

          <TiltCard
            delay="0.65s"
            spot="rgba(28,138,90,0.14)"
            className="col-span-12 flex-wrap items-stretch gap-9 border border-[#D6EEE1] bg-gradient-to-r from-[#E8F8F0] via-white to-[#EDF5FF] p-9 shadow-[0_1px_2px_rgba(14,18,34,0.03),0_24px_60px_-44px_rgba(20,100,70,0.5)]"
          >
            <div className="relative flex min-w-0 flex-[1_1_320px] flex-col gap-5">
              <div>
                <LiveBadge />
                <h3 className="mt-3.5 mb-0 text-[32px] font-semibold tracking-[-0.035em]">Diagnostics</h3>
                <p className="mt-2 mb-0 text-base leading-[1.55] text-[var(--svc-body)]">
                  Lab tests, imaging and home sample collection — with every report saved straight to your records.
                </p>
              </div>
              <ol aria-label="Example test progress" className="m-0 flex list-none flex-col p-0">
                {dxSteps.map((step, i) => {
                  const done = i <= dxStep;
                  const current = i === dxStep;
                  return (
                    <li key={step.label} className="flex items-start gap-3">
                      <span className="flex flex-col items-center">
                        <span
                          className={cn(
                            'inline-flex size-[22px] items-center justify-center rounded-full border-2 box-border transition',
                            done ? 'border-[var(--svc-success-dot)] bg-[var(--svc-success-dot)]' : 'border-[#CFD3DD] bg-white',
                            current && i < 3 && 'shadow-[0_0_0_5px_rgba(28,138,90,0.15)]',
                          )}
                        >
                          {done && <Check className="size-2.5 text-white" strokeWidth={3.4} />}
                        </span>
                        {i < 3 && (
                          <span className={cn('h-5 w-0.5', i < dxStep ? 'bg-[var(--svc-success-dot)]' : 'bg-[#E3E6EE]')} />
                        )}
                      </span>
                      <span className={cn('pt-px text-[14.5px]', current ? 'font-bold' : 'font-semibold', done ? 'text-[var(--svc-ink)]' : 'text-[#8A90A3]')}>
                        {step.label} {done && <span className="font-normal text-[var(--svc-muted)]">{step.when}</span>}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <Link to="/diagnostics" className="svc-go mt-auto">
                Book a test <Arrow />
              </Link>
            </div>
            <div
              aria-label="Example lab report"
              className="relative flex min-w-0 flex-[1.35_1_440px] flex-col gap-[18px] rounded-[24px] bg-white p-6 shadow-[0_34px_70px_-40px_rgba(20,100,70,0.55)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="grid size-11 place-items-center rounded-[13px] bg-gradient-to-br from-[#E3F6EC] to-[#CDEFDD]">
                    <FlaskConical className="size-5 text-[var(--svc-success-dot)]" />
                  </span>
                  <div>
                    <div className="text-[16.5px] font-semibold">Complete blood count</div>
                    <div className="text-[13px] text-[var(--svc-muted)]">Home collection · Tue</div>
                  </div>
                </div>
                <span className={cn('rounded-full px-2.5 py-1 text-[12.5px] font-semibold', reportReady ? 'bg-[var(--svc-success-bg)] text-[var(--svc-success)]' : 'bg-[#FFF1D6] text-[#8A5300]')}>
                  {reportReady ? 'All in range' : 'In progress'}
                </span>
              </div>
              <div className="flex flex-col gap-4">
                {labs.map((lab) => (
                  <div key={lab.name} className="grid grid-cols-[minmax(100px,1fr)_104px_minmax(130px,1.5fr)] items-center gap-3.5 text-sm">
                    <span className="text-[var(--svc-dark)]">{lab.name}</span>
                    <span className={cn('font-semibold tabular-nums', reportReady ? 'text-[var(--svc-ink)]' : 'text-[#B5BAC8]')}>
                      {reportReady ? lab.val : '—'}
                    </span>
                    <span aria-hidden="true" className="relative h-2 rounded-full" style={{ background: 'linear-gradient(90deg, #F2F3F8 0 20%, #D3F5E4 20% 80%, #F2F3F8 80%)' }}>
                      <span
                        className="absolute top-[-4px] ml-[-8px] size-4 rounded-full border-2 border-white bg-[var(--svc-success-dot)] shadow-[0_2px_6px_rgba(0,0,0,0.2)] transition-[left,opacity] duration-1000"
                        style={{ left: reportReady ? `${lab.pct}%` : '0%', opacity: reportReady ? 1 : 0 }}
                      />
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 border-t border-[#F0F1F6] pt-3.5 text-[13px] text-[var(--svc-muted)]">
                Saved to your records · Share with your doctor in one tap
              </div>
            </div>
          </TiltCard>

          <article className="svc-rv relative col-span-12 flex flex-col gap-[26px] overflow-hidden rounded-[32px] bg-[#0E1222] p-9 text-white" style={{ animationDelay: '0.75s' }}>
            <div aria-hidden="true" className="svc-gm pointer-events-none absolute -top-[180px] -right-[120px] size-[460px] rounded-full bg-[var(--svc-indigo)] opacity-50 blur-[130px]" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-[200px] -left-[100px] size-[380px] rounded-full bg-[#8C7AF5] opacity-30 blur-[130px]" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
            <div className="relative flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-[13px] font-semibold tracking-[0.14em] text-[#A9A6FF] uppercase">Opening soon</div>
                <h3 className="mt-2 mb-0 text-[34px] font-semibold tracking-[-0.035em] text-white">
                  More care, launched <span className="svc-serif text-[#C9C7FF]">carefully</span>
                </h3>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <p className="m-0 max-w-[420px] text-right text-[15px] leading-[1.55] text-[#B4B8CC]">
                  Tap “Notify me” and we'll remember on this device until the service opens.
                </p>
                <span className="text-[13px] font-semibold text-[#C9C7FF]">
                  {notifyCount ? `${notifyCount} reminder${notifyCount > 1 ? 's' : ''} set` : 'No reminders yet'}
                </span>
              </div>
            </div>
            <div className="relative grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-2.5">
              {SOON.map((item) => {
                const on = Boolean(notify[item.key]);
                const Icon = item.icon;
                return (
                  <div
                    key={item.key}
                    className={cn(
                      'flex items-center gap-3.5 rounded-[20px] py-3 pr-3 pl-3.5 transition',
                      on ? 'border border-[rgba(169,166,255,0.45)] bg-[rgba(169,166,255,0.14)]' : 'border border-white/10 bg-white/5',
                    )}
                  >
                    <span aria-hidden="true" className="grid size-[42px] shrink-0 place-items-center rounded-[13px] bg-[rgba(169,166,255,0.16)]">
                      <Icon className="size-[19px] text-[#C9C7FF]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <Link to={item.to} className="block text-[15px] font-semibold text-white hover:underline">
                        {item.name}
                      </Link>
                      <span className="block overflow-hidden text-[12.5px] text-ellipsis whitespace-nowrap text-[#9EA3BA]">{item.desc}</span>
                    </span>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={on ? `Notifications on for ${item.name}` : `Notify me about ${item.name}`}
                      onClick={() => toggleNotify(item.key)}
                      className={cn(
                        'min-h-[42px] shrink-0 cursor-pointer rounded-xl px-3.5 text-[13.5px] font-semibold transition hover:border-white/60',
                        on ? 'border border-[#A9A6FF] bg-[#A9A6FF] text-[var(--svc-ink)]' : 'border border-white/28 bg-transparent text-white',
                      )}
                    >
                      {on ? '✓ On' : 'Notify me'}
                    </button>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
