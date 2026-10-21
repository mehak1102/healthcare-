import {
  Calendar,
  Check,
  Clock,
  House,
  Moon,
  Pause,
  Phone,
  Play,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { doctorName } from '@/features/doctors/api';
import { cn } from '@/lib/cn';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';
import './home-trust.css';
import {
  formatClock,
  formatHourLabel,
  initials,
  kolkataHour,
  useTrustLive,
  type TrustFilters,
} from './use-trust-live';

const FLAGS = [
  'Chest pain or pressure',
  'Trouble breathing',
  'Severe bleeding',
  'Fainting or unresponsive',
  'Face drooping or slurred speech',
];

const STARS = (() => {
  const out: { left: string; top: string; width: string; height: string; animationDelay: string }[] = [];
  let seed = 11;
  const r = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < 34; i += 1) {
    out.push({
      left: `${(r() * 100).toFixed(1)}%`,
      top: `${(r() * 60).toFixed(1)}%`,
      width: `${(1 + r() * 2).toFixed(1)}px`,
      height: `${(1 + r() * 2).toFixed(1)}px`,
      animationDelay: `${(r() * 3).toFixed(2)}s`,
    });
  }
  return out;
})();

const AVATARS = [
  { bg: '#FFE9DE', fg: '#9A4521' },
  { bg: '#E3F6EC', fg: '#1C7A50' },
  { bg: '#E4F2FF', fg: '#1F5F9E' },
  { bg: '#EEEDFF', fg: '#3D3FC4' },
  { bg: '#FFF1D6', fg: '#8A5300' },
];

function periodLabel(hour: number) {
  if (hour < 5) return 'Late night';
  if (hour < 8) return 'Early morning';
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  if (hour < 20) return 'Evening';
  return 'Night';
}

function phaseOf(hour: number): 'night' | 'dawn' | 'day' | 'dusk' {
  if (hour >= 20 || hour < 5) return 'night';
  if (hour < 8) return 'dawn';
  if (hour < 17) return 'day';
  return 'dusk';
}

const SKY: Record<string, string> = {
  night: 'linear-gradient(170deg, #0B0F2E 0%, #151A4A 55%, #23205E 100%)',
  dawn: 'linear-gradient(170deg, #FFD3BD 0%, #FBE4F0 45%, #D8E8FF 100%)',
  day: 'linear-gradient(170deg, #BFE0FF 0%, #E3F1FF 55%, #F4F2FF 100%)',
  dusk: 'linear-gradient(170deg, #2A2470 0%, #6B4FD8 45%, #F08A6A 100%)',
};

const SKYLINE: Record<string, [string, string]> = {
  night: ['#070A22', '#10143A'],
  dawn: ['#C9A9BE', '#E2C6D4'],
  day: ['#AFC8E6', '#CADDF3'],
  dusk: ['#1A1446', '#3A2C7A'],
};

function TiltCard({
  className,
  spot,
  delay,
  children,
}: {
  className: string;
  spot: string;
  delay?: string;
  children: ReactNode;
}) {
  const reduced = usePrefersReducedMotion();
  const [hot, setHot] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const onMove = (event: MouseEvent<HTMLElement>) => {
    if (reduced) return;
    const r = event.currentTarget.getBoundingClientRect();
    setHot({ x: event.clientX - r.left, y: event.clientY - r.top, w: r.width, h: r.height });
  };
  const rx = hot ? (hot.y / hot.h - 0.5) * -4 : 0;
  const ry = hot ? (hot.x / hot.w - 0.5) * 4 : 0;
  return (
    <article
      className={cn('tr-card tr-rv', hot && 'is-hot', className)}
      style={{
        animationDelay: delay,
        transform: hot
          ? `perspective(1200px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-4px)`
          : undefined,
        boxShadow: hot
          ? '0 2px 4px rgba(14,18,34,0.04), 0 40px 70px -40px rgba(60,60,140,0.55)'
          : '0 1px 2px rgba(14,18,34,0.03)',
      }}
      onMouseMove={onMove}
      onMouseLeave={() => setHot(null)}
    >
      <div
        aria-hidden="true"
        className="tr-spot"
        style={{
          background: `radial-gradient(420px circle at ${hot?.x ?? 0}px ${hot?.y ?? 0}px, ${spot}, transparent 60%)`,
        }}
      />
      {children}
    </article>
  );
}

export function HomeTrust() {
  const reduced = usePrefersReducedMotion();
  const nowHour = kolkataHour();
  const [hour, setHour] = useState(nowHour);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [tick, setTick] = useState(0);
  const [filters, setFilters] = useState<TrustFilters>({
    online: false,
    clinic: false,
    weekend: false,
    holiday: false,
    home: false,
  });
  const [access, setAccess] = useState({ doc: true, lab: false });
  const [signedOut, setSignedOut] = useState(false);
  const [log, setLog] = useState<{ text: string; when: string; color: string }[]>([
    { text: 'You allowed your doctor to view records', when: 'Yesterday', color: '#1C8A5A' },
    { text: 'You signed in on this browser', when: 'Earlier this week', color: '#4C4FE0' },
  ]);
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  const live = useTrustLive(filters);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setNow(new Date());
      setTick((n) => n + 1);
      if (playing) setHour((h) => (h + 1) % 24);
    }, 600);
    return () => window.clearInterval(id);
  }, [playing, reduced]);

  const phase = phaseOf(hour);
  const dark = phase === 'night' || phase === 'dusk';
  const atHour = live.atHour(hour);
  const nextHint = useMemo(() => {
    for (let i = 1; i < 24; i += 1) {
      const h = (hour + i) % 24;
      if (live.atHour(h).length) return `Next match: ${formatHourLabel(h)}.`;
    }
    return 'Try removing a filter.';
  }, [hour, live]);

  const x = 4 + (hour / 23) * 92;
  const y =
    phase === 'night'
      ? 34 + 120 * (1 - Math.sin(Math.PI * (((hour + 12) % 24 + 0.5) / 24)))
      : 34 + 120 * (1 - Math.sin(Math.PI * ((hour + 0.5) / 24)));

  const chipOn = (on: boolean) =>
    on
      ? dark
        ? 'bg-white text-[#0E1222] border-white'
        : 'bg-[#0E1222] text-white border-[#0E1222]'
      : dark
        ? 'bg-white/8 text-white border-white/28'
        : 'bg-white/70 text-[#0E1222] border-[rgba(14,18,34,0.14)]';

  const directoryTo = () => {
    const params = new URLSearchParams({ takingBookings: '1', sort: 'next_available' });
    if (filters.online && !filters.clinic) params.set('mode', 'online');
    if (filters.clinic && !filters.online) params.set('mode', 'clinic');
    if (filters.weekend) params.set('availWhen', 'weekend');
    if (filters.holiday) params.set('availWhen', 'public_holiday');
    if (hour === nowHour) params.set('availWhen', params.get('availWhen') ?? 'today');
    return `/doctors?${params}`;
  };

  const addLog = (text: string, color: string) => {
    setLog((prev) => [{ text, when: `Just now · ${formatClock()}`, color }, ...prev].slice(0, 3));
  };

  const vp = Math.floor(tick / 2) % 7;
  const nDone = Math.min(3, vp);
  const checks = [
    'Registration matched with medical council',
    'Degree confirmed',
    'Clinic address confirmed',
  ].map((label, i) => ({
    label,
    done: i < nDone,
    current: i === nDone,
    st: i < nDone ? 'Checked' : i === nDone ? 'Checking…' : 'Pending',
  }));
  const verified = nDone >= 3;
  const danger = Object.values(flags).some(Boolean);
  const sampleName = live.sample ? doctorName(live.sample.displayName) : 'A listed doctor';
  const sampleIni = live.sample ? initials(live.sample.displayName) : 'DR';

  return (
    <div data-sukoon-trust className="relative overflow-hidden bg-white">
      <div aria-hidden="true" className="tr-grid pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="pointer-events-none absolute top-[1250px] -left-[180px] h-[520px] w-[640px] rounded-full bg-[#DCD8FF] opacity-50 blur-[130px]" />
      <div aria-hidden="true" className="pointer-events-none absolute top-[1600px] -right-[160px] h-[520px] w-[600px] rounded-full bg-[#CDEBFF] opacity-55 blur-[130px]" />

      <section id="around-the-clock" aria-labelledby="av2-h" className="relative mx-auto max-w-[1240px] scroll-mt-28 px-6 pt-24">
        <div
          className="tr-rv relative min-h-[760px] overflow-hidden rounded-[40px] px-7 pt-10 pb-11 transition-[background,color] duration-700 sm:px-11"
          style={{ background: SKY[phase], color: dark ? '#fff' : '#0E1222', boxShadow: '0 50px 100px -50px rgba(20,20,80,0.6)' }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 transition-opacity duration-700" style={{ opacity: phase === 'night' ? 1 : phase === 'dusk' ? 0.35 : 0 }}>
            {STARS.map((style, i) => (
              <span key={i} className="tr-star" style={style} />
            ))}
            <span className="tr-shoot top-[12%] right-[8%]" />
            <span className="tr-shoot top-[6%] right-[38%]" style={{ animationDelay: '3.5s' }} />
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 transition-opacity duration-700" style={{ opacity: phase === 'day' ? 0.9 : phase === 'dawn' ? 0.6 : 0 }}>
            <span className="tr-cloud top-[70px] h-[34px] w-[140px]" style={{ animationDuration: '60s', animationDelay: '-10s' }} />
            <span className="tr-cloud top-[120px] h-6 w-[90px] opacity-80" style={{ animationDuration: '75s', animationDelay: '-40s' }} />
            <span className="tr-cloud top-10 h-7 w-[110px] opacity-70" style={{ animationDuration: '90s', animationDelay: '-70s' }} />
          </div>
          <svg aria-hidden="true" viewBox="0 0 1000 200" preserveAspectRatio="none" className="pointer-events-none absolute top-0 right-0 left-0 h-[200px] w-full">
            <path d="M0 190 Q 500 -60 1000 190" fill="none" stroke={dark ? 'rgba(255,255,255,0.25)' : 'rgba(14,18,34,0.15)'} strokeWidth="1.5" strokeDasharray="4 8" />
          </svg>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute size-[54px] rounded-full transition-[left,top,background,box-shadow] duration-700"
            style={{
              marginLeft: -27,
              left: `${x.toFixed(1)}%`,
              top: y,
              background: phase === 'night'
                ? 'radial-gradient(circle at 35% 35%, #FFFFFF, #E3E6FF 60%, #B8BEF0)'
                : 'radial-gradient(circle at 40% 40%, #FFF6C9, #FFC75A 60%, #FF9F43)',
              boxShadow: phase === 'night' ? '0 0 40px 10px rgba(201,204,248,0.35)' : '0 0 60px 18px rgba(255,190,90,0.45)',
            }}
          />
          <svg aria-hidden="true" viewBox="0 0 1200 160" preserveAspectRatio="none" className="pointer-events-none absolute right-0 bottom-0 left-0 h-40 w-full">
            <path fill={SKYLINE[phase][1]} d="M0 160V110h40V90h30v20h25V70h45v40h30V95h35v-30h20v45h40V80h50v30h25V60h30v50h45V85h40v25h30V75h55v35h25V90h40v20h35V65h45v45h30V95h40v15h25V80h50v30h30V70h40v40h45V90h30v20h40V60h45v50h25V100h35v60z" />
            <path fill={SKYLINE[phase][0]} d="M0 160v-30h60v-20h40v25h50v-40h35v55h40v-30h60v-25h30v40h45v-20h55v35h30v-45h50v30h40v-15h45v25h35v-35h55v40h40v-20h45v15h30v-40h50v50h40v-25h55v20h35v-30h40v35h45v35z" />
            <g style={{ opacity: phase === 'night' ? 1 : phase === 'dusk' ? 0.6 : 0 }}>
              {[110, 122, 268, 280, 455, 470, 612, 760, 772, 905, 1040, 1052].map((xPos, i) => (
                <rect key={xPos} x={xPos} y={[122, 132, 112, 124, 118, 130, 124, 116, 128, 122, 126, 138][i]} width="4" height="5" fill="#FFD27A" />
              ))}
            </g>
          </svg>

          <div className="relative flex flex-wrap items-stretch gap-10">
            <div className="flex min-w-0 flex-[1.15_1_460px] flex-col gap-5 pt-[70px]">
              <div className="flex flex-wrap items-center gap-2">
                <div className={cn('inline-flex items-center gap-2.5 rounded-full px-3.5 py-2 text-[13.5px] font-semibold', dark ? 'border border-white/18 bg-white/10' : 'border border-black/8 bg-white/75')}>
                  <span aria-hidden="true" className="tr-blink size-2 rounded-full bg-[#34D399]" />
                  Right now · <span className="tabular-nums">{formatClock(now)}</span>
                </div>
                <div className={cn('inline-flex items-center rounded-full px-3.5 py-2 text-[13.5px] font-semibold', dark ? 'border border-white/18 bg-white/10' : 'border border-black/8 bg-white/75')}>
                  {periodLabel(hour)}
                </div>
              </div>
              <h2 id="av2-h" className="m-0 text-[clamp(42px,5vw,68px)] leading-[1.02] font-semibold tracking-[-0.045em]" style={{ color: dark ? '#fff' : '#0E1222' }}>
                Doctors available <span className="tr-serif">24×7</span>
              </h2>
              <p className="m-0 max-w-[560px] text-[17px] leading-[1.6]" style={{ opacity: dark ? 0.85 : 0.8 }}>
                Night, weekend and public-holiday care — shown only when it is real. “Available now” appears only when a verified doctor's schedule, capacity, consultation mode and your location all genuinely allow it.
              </p>
              <div className={cn('flex max-w-[580px] flex-col gap-1.5 rounded-[22px] px-5 pt-[18px] pb-3.5', dark ? 'border border-white/14 bg-white/7' : 'border border-black/8 bg-white/60')}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label htmlFor="hour2" className="text-[13px] font-semibold tracking-[0.08em] uppercase opacity-85">
                    Doctors by hour
                  </label>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[22px] font-semibold tracking-[-0.02em] tabular-nums">{formatHourLabel(hour)}</span>
                    <button
                      type="button"
                      aria-pressed={playing}
                      onClick={() => setPlaying((v) => !v)}
                      className={cn('inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border-0 px-3.5 text-[13px] font-semibold', dark ? 'bg-white text-[#0E1222]' : 'bg-[#0E1222] text-white')}
                    >
                      {playing ? <Pause className="size-3 fill-current" /> : <Play className="size-3 fill-current" />}
                      {playing ? 'Pause' : 'Play the day'}
                    </button>
                  </div>
                </div>
                <div role="group" aria-label="Number of available doctors for each hour" className="mt-2 grid h-[92px] items-end gap-[3px]" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                  {live.counts.map((n, hr) => {
                    const sel = hr === hour;
                    return (
                      <button
                        key={hr}
                        type="button"
                        className="tr-barbtn relative flex h-[92px] cursor-pointer flex-col items-center justify-end gap-[3px] border-0 bg-transparent p-0"
                        aria-label={`${formatHourLabel(hr)}: ${n} doctor${n === 1 ? '' : 's'} available`}
                        aria-pressed={sel}
                        onClick={() => {
                          setHour(hr);
                          setPlaying(false);
                        }}
                      >
                        {hr === nowHour && (
                          <span className="absolute top-0 left-1/2 -translate-x-1/2 rounded bg-[#34D399] px-1 text-[9.5px] font-bold whitespace-nowrap text-[#052E1C]">
                            Now
                          </span>
                        )}
                        <span
                          className="tr-bar block w-full rounded-t-[4px] rounded-b-[2px]"
                          style={{
                            height: 4 + n * 15,
                            background: sel ? (dark ? '#fff' : '#4C4FE0') : dark ? 'rgba(255,255,255,0.32)' : 'rgba(76,79,224,0.28)',
                            boxShadow: sel ? (dark ? '0 0 14px rgba(255,255,255,0.6)' : '0 0 14px rgba(76,79,224,0.5)') : undefined,
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
                <input
                  id="hour2"
                  className="tr-hr"
                  type="range"
                  min={0}
                  max={23}
                  step={1}
                  value={hour}
                  aria-valuetext={formatHourLabel(hour)}
                  onChange={(e) => {
                    setHour(Number(e.target.value));
                    setPlaying(false);
                  }}
                />
                <div aria-hidden="true" className="mt-[-6px] flex justify-between text-xs opacity-70">
                  <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span>
                </div>
              </div>
              <div>
                <div className="mb-2.5 text-[13px] font-semibold tracking-[0.08em] uppercase opacity-85">Quick filters</div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={cn('inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold', chipOn(hour === nowHour))} onClick={() => { setHour(nowHour); setPlaying(false); }}>
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-[#34D399]" />
                    Available now
                  </button>
                  <button type="button" className={cn('inline-flex min-h-[42px] cursor-pointer items-center rounded-full border px-4 text-sm font-semibold', chipOn(hour === 22))} onClick={() => { setHour(22); setPlaying(false); }}>
                    Tonight
                  </button>
                  {(
                    [
                      ['online', 'Online'],
                      ['clinic', 'Clinic visit'],
                      ['weekend', 'Weekend'],
                      ['holiday', 'Public holiday'],
                      ['home', 'Home visit'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={filters[key]}
                      onClick={() => setFilters((f) => ({ ...f, [key]: !f[key] }))}
                      className={cn('inline-flex min-h-[42px] cursor-pointer items-center rounded-full border px-4 text-sm font-semibold', chipOn(filters[key]))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="m-0 max-w-[520px] text-[13.5px] leading-[1.55] opacity-70">
                Not every specialty or home-visit service runs around the clock — and we will always say so clearly.
              </p>
            </div>

            <div aria-live="polite" className="mb-10 flex min-w-0 flex-[1_1_400px] flex-col gap-3.5 self-end rounded-[28px] border border-white/70 bg-white/95 p-[22px] text-[#0E1222] shadow-[0_40px_80px_-40px_rgba(10,12,40,0.7)] backdrop-blur-[16px]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[12.5px] font-semibold text-[var(--tr-muted)]">Verified doctors at {formatHourLabel(hour)}</div>
                  <div className="mt-0.5 text-[26px] font-semibold tracking-[-0.03em] text-[#0E1222]">
                    {filters.home ? 'Not bookable yet' : atHour.length === 0 ? 'None right now' : `${atHour.length} available`}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {filters.home && (
                  <div className="tr-pop flex items-center gap-3 rounded-[18px] border border-dashed border-[#F2C6A8] bg-[#FFF6EE] px-3.5 py-3">
                    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#FFEDE4]">
                      <House className="size-[18px] text-[#C25A2E]" />
                    </span>
                    <span className="flex-1 text-[13.5px] leading-[1.45] text-[var(--tr-dark)]">
                      <b className="font-semibold text-[#0E1222]">Home visits aren't bookable yet.</b>{' '}
                      <Link to="/doctor-at-home" className="font-semibold text-[#9A4521]">See what we're building first →</Link>
                    </span>
                  </div>
                )}
                {!filters.home && atHour.length === 0 && (
                  <div className="tr-pop flex items-start gap-3 rounded-[18px] bg-[#F7F8FC] p-4">
                    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#EEEDFF]">
                      <Clock className="size-[18px] text-[#4C4FE0]" />
                    </span>
                    <span className="text-sm leading-relaxed text-[var(--tr-dark)]">
                      <b className="font-semibold text-[#0E1222]">No verified doctor matches this right now.</b>
                      <br />
                      We won't pretend otherwise. {nextHint}
                    </span>
                  </div>
                )}
                {!filters.home &&
                  atHour.slice(0, 3).map((row, i) => {
                    const av = AVATARS[i % AVATARS.length];
                    return (
                      <Link key={row.doctor.slug} to={`/doctors/${row.doctor.slug}`} className="tr-pop flex flex-col gap-2.5 rounded-[18px] bg-[#F7F8FC] px-3.5 py-3 text-[#0E1222] hover:bg-[#EEEDFF]">
                        <div className="flex items-center gap-3">
                          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-bold" style={{ background: av.bg, color: av.fg }}>
                            {initials(row.doctor.displayName)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1 text-[15px] font-semibold">
                              {doctorName(row.doctor.displayName)}
                              <ShieldCheck className="size-3.5 text-[#4C4FE0]" aria-label="Verified" />
                            </span>
                            <span className="block text-[13px] text-[var(--tr-muted)]">
                              {row.doctor.specialty}
                              {row.until ? ` · until ${row.until}` : ''}
                            </span>
                          </span>
                          <span className="flex flex-wrap justify-end gap-1">
                            {row.doctor.consultationModes.includes('online') && (
                              <span className="rounded-full bg-[#EEEDFF] px-2 py-0.5 text-[11.5px] font-semibold text-[#3D3FC4]">Online</span>
                            )}
                            {row.doctor.consultationModes.includes('clinic') && (
                              <span className="rounded-full bg-[#E3F6EC] px-2 py-0.5 text-[11.5px] font-semibold text-[#1C7A50]">Clinic</span>
                            )}
                          </span>
                        </div>
                        <div role="img" aria-label={`${doctorName(row.doctor.displayName)} schedule`} className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                          {live.hoursFor(row.doctor.slug).map((on, hr) => (
                            <span
                              key={hr}
                              className="h-1.5 rounded-sm"
                              style={{
                                background: hr === hour ? '#4C4FE0' : on ? '#C9CCF8' : '#E6E8EF',
                                transform: hr === hour ? 'scaleY(1.6)' : undefined,
                              }}
                            />
                          ))}
                        </div>
                      </Link>
                    );
                  })}
              </div>
              <div className="flex items-center gap-2 text-[12.5px] text-[var(--tr-muted)]">
                <span aria-hidden="true" className="h-1.5 w-3.5 rounded-sm bg-[#C9CCF8]" />
                Each bar is from live open slots
                <span aria-hidden="true" className="ml-1.5 size-1.5 rounded-sm bg-[#4C4FE0]" />
                selected hour
              </div>
              <Link to={directoryTo()} className="flex min-h-[50px] items-center justify-center gap-2.5 rounded-[15px] bg-[#0E1222] text-[15px] font-semibold text-white no-underline">
                See all available doctors
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="our-commitments" aria-labelledby="tr2-h" className="relative mx-auto flex max-w-[1240px] scroll-mt-28 flex-col gap-[52px] px-6 pt-[120px] pb-[110px]">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="tr-rv flex min-w-0 flex-[1_1_560px] flex-col gap-4">
            <div className="inline-flex items-center gap-2.5 self-start rounded-full border border-[var(--tr-border)] bg-white/85 py-1.5 pr-3.5 pl-1.5 text-[13.5px] font-semibold text-[var(--tr-dark)]">
              <span className="rounded-full bg-[var(--tr-indigo)] px-2.5 py-1 text-xs font-bold tracking-[0.12em] text-white uppercase">Our commitments</span>
              Four promises behind every feature
            </div>
            <h2 id="tr2-h" className="m-0 text-[clamp(42px,5vw,68px)] leading-[1.03] font-semibold tracking-[-0.045em] text-[#0E1222]">
              Trust is designed in,
              <br />
              not <span className="tr-serif tracking-[-0.02em] text-[var(--tr-indigo)]">added later</span>
            </h2>
          </div>
          <div className="tr-rv flex flex-[0_1_380px] flex-col gap-3.5" style={{ animationDelay: '0.15s' }}>
            <p className="m-0 text-[17px] leading-[1.6] text-[var(--tr-body)]">
              These aren't slogans. Each promise shapes what you see on Sukoon — and what you'll never see. Try them below.
            </p>
            <div aria-hidden="true" className="flex gap-1.5">
              <span className="h-1 flex-1 rounded-full bg-[#4C4FE0]" />
              <span className="h-1 flex-1 rounded-full bg-[#2A72C2]" />
              <span className="h-1 flex-1 rounded-full bg-[#1C8A5A]" />
              <span className="h-1 flex-1 rounded-full bg-[#E5484D]" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-2">
          <TiltCard delay="0.25s" spot="rgba(76,79,224,0.13)" className="border border-[#E6E3FB] bg-gradient-to-b from-[#F2F1FF] to-white">
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <h3 className="m-0 text-[28px] font-semibold tracking-[-0.03em] text-[#0E1222]">Verified before listed</h3>
                <p className="mt-2 mb-0 max-w-[420px] text-[15.5px] leading-[1.6] text-[var(--tr-body)]">
                  Doctors appear only after their registration and qualifications are checked against the relevant medical council.
                </p>
              </div>
              <span aria-hidden="true" className="tr-serif text-[48px] leading-none text-[#C9CCF8]">01</span>
            </div>
            <div aria-label="Example verification check" className="relative mt-auto flex flex-wrap items-stretch gap-3.5">
              <div aria-hidden="true" className="relative flex min-h-[190px] w-[150px] shrink-0 flex-col gap-2 overflow-hidden rounded-[18px] bg-white p-3.5 shadow-[0_24px_44px_-28px_rgba(60,60,140,0.55)]">
                <div className="flex items-center gap-1.5"><span className="size-[18px] rounded-full border-2 border-[#C9CCF8]" /><span className="h-1.5 flex-1 rounded-sm bg-[#E5E3FF]" /></div>
                <span className="h-[5px] w-4/5 rounded-sm bg-[var(--tr-border)]" />
                <span className="h-[5px] w-[92%] rounded-sm bg-[var(--tr-border)]" />
                <span className="h-[5px] w-[64%] rounded-sm bg-[var(--tr-border)]" />
                <div className="mt-1.5 text-[10px] font-bold tracking-wide text-[var(--tr-muted)]">REG. NO.</div>
                <div className="text-[13px] font-bold tabular-nums">{live.sample?.registrationYear ?? '—'} · checked</div>
                <span className="h-[5px] w-[70%] rounded-sm bg-[var(--tr-border)]" />
                <div className="mt-auto size-[34px] self-end rounded-full border-2 border-dashed border-[#C9CCF8]" />
                <span className="tr-scan" />
              </div>
              <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2 rounded-[22px] bg-white p-4 shadow-[0_24px_44px_-28px_rgba(60,60,140,0.5)]">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="grid size-[38px] place-items-center rounded-full bg-gradient-to-br from-[#FFEFE6] to-[#FFD9C4] text-xs font-bold text-[#9A4521]">{sampleIni}</span>
                  <span className="flex-1">
                    <span className="block text-[14.5px] font-semibold">{sampleName}</span>
                    <span className="block text-xs text-[var(--tr-muted)]">{verified ? 'Listed on Sukoon' : 'Not listed until all checks pass'}</span>
                  </span>
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', verified ? 'bg-[#E3F6EC] text-[#1C7A50]' : 'bg-[#EEEDFF] text-[#3D3FC4]')}>
                    {verified ? 'Verified' : 'Checking'}
                  </span>
                </div>
                {checks.map((c) => (
                  <div key={c.label} className="flex items-center gap-2.5 border-t border-[#F0F1F6] py-1.5 text-[13.5px]">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                        c.done ? 'border-[#1C8A5A] bg-[#1C8A5A]' : c.current ? 'border-[#4C4FE0] bg-white shadow-[0_0_0_4px_rgba(76,79,224,0.15)]' : 'border-[#D5D8E1] bg-white',
                      )}
                    >
                      {c.done && <Check className="tr-pop size-2.5 text-white" strokeWidth={3.6} />}
                    </span>
                    <span className="flex-1 text-[var(--tr-dark)]">{c.label}</span>
                    <span className={cn('text-xs font-semibold whitespace-nowrap', c.done ? 'text-[#1C7A50]' : c.current ? 'text-[#3D3FC4]' : 'text-[#8A90A3]')}>{c.st}</span>
                  </div>
                ))}
              </div>
            </div>
          </TiltCard>

          <TiltCard delay="0.35s" spot="rgba(42,114,194,0.13)" className="border border-[#DDEBFA] bg-gradient-to-b from-[#EDF5FF] to-white">
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <h3 className="m-0 text-[28px] font-semibold tracking-[-0.03em] text-[#0E1222]">Honest availability</h3>
                <p className="mt-2 mb-0 max-w-[420px] text-[15.5px] leading-[1.6] text-[var(--tr-body)]">
                  Slots and arrival estimates come from real schedules and live conditions. We never invent ratings, reviews or ETAs.
                </p>
              </div>
              <span aria-hidden="true" className="tr-serif text-[48px] leading-none text-[#BFD8F2]">02</span>
            </div>
            <div className="relative mt-auto grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="flex flex-col gap-3 rounded-[20px] border border-dashed border-[#E8C9C9] bg-white p-4">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide text-[#B42318] uppercase">
                  <X className="size-3" strokeWidth={3} /> We'll never show
                </div>
                <div className="flex items-center gap-2 text-[14.5px] text-[#8A90A3]">
                  <span aria-hidden="true" className="rounded-md bg-[#F5A524] px-1.5 py-0.5 text-[11px] font-bold text-white">★ 4.9</span>
                  <span className="tr-strike">2,341 reviews</span>
                </div>
                <div className="text-[14.5px] text-[#8A90A3]"><span className="tr-strike tr-s2">“Doctor arriving in 5 min”</span></div>
                <div className="flex items-center gap-2 text-[14.5px] text-[#8A90A3]">
                  <span aria-hidden="true" className="tr-blink size-1.5 rounded-full bg-[#E5484D]" />
                  <span className="tr-strike tr-s3">“Only 1 slot left — hurry!”</span>
                </div>
              </div>
              <div className="flex flex-col gap-3 rounded-[20px] border border-[#CDEBDA] bg-white p-4 shadow-[0_20px_40px_-28px_rgba(20,100,70,0.45)]">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide text-[#1C7A50] uppercase">
                  <Check className="size-3" strokeWidth={3.2} /> What you'll see
                </div>
                <div className="flex items-center gap-2 text-[14.5px] font-semibold">
                  <Calendar className="size-[15px] text-[#1C8A5A]" />
                  Next real slot · {live.nextSlotLabel ?? 'on the doctor page'}
                </div>
                <div className="flex items-center gap-2 text-[14.5px] font-semibold">
                  <Clock className="size-[15px] text-[#1C8A5A]" />
                  Estimate from the live schedule
                </div>
                <div className="flex items-center gap-2 text-[14.5px] font-semibold">
                  <Moon className="size-[15px] text-[#1C8A5A]" />
                  “Not available tonight” — when it isn't
                </div>
              </div>
            </div>
          </TiltCard>

          <TiltCard delay="0.45s" spot="rgba(28,138,90,0.13)" className="border border-[#D6EEE1] bg-gradient-to-b from-[#EAF8F1] to-white">
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <h3 className="m-0 text-[28px] font-semibold tracking-[-0.03em] text-[#0E1222]">Privacy you control</h3>
                <p className="mt-2 mb-0 max-w-[420px] text-[15.5px] leading-[1.6] text-[var(--tr-body)]">
                  See who can access your records, manage consent, and sign out devices you no longer use — all from your account.
                </p>
              </div>
              <span aria-hidden="true" className="tr-serif text-[48px] leading-none text-[#B8E2CB]">03</span>
            </div>
            <div className="relative mt-auto flex flex-wrap gap-3">
              <div className="flex min-w-0 flex-[1_1_260px] flex-col rounded-[22px] bg-white p-4 shadow-[0_24px_44px_-28px_rgba(20,100,70,0.45)]">
                <div className="pb-1.5 text-xs font-bold tracking-wide text-[var(--tr-muted)] uppercase">Record access</div>
                {(
                  [
                    ['doc', live.sample ? doctorName(live.sample.displayName) : 'Your doctor'],
                    ['lab', 'Lab partner'],
                  ] as const
                ).map(([key, label]) => {
                  const on = access[key];
                  return (
                    <div key={key} className="flex items-center justify-between gap-3 py-1.5">
                      <span>
                        <span className="block text-[14.5px] font-semibold">{label}</span>
                        <span className="block text-[12.5px] text-[var(--tr-muted)]">{on ? 'Can view your records' : 'No access'}</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={`Allow ${label} to view your records`}
                        onClick={() => {
                          const next = !on;
                          setAccess((a) => ({ ...a, [key]: next }));
                          addLog(next ? `You allowed ${label} to view records` : `You removed access for ${label}`, next ? '#1C8A5A' : '#E5484D');
                        }}
                        className={cn('flex h-[26px] w-11 shrink-0 cursor-pointer items-center rounded-full border-0 p-[3px] transition', on ? 'justify-end bg-[#1C8A5A]' : 'justify-start bg-[#D9DCE5]')}
                      >
                        <span className="size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(14,18,34,0.3)]" />
                      </button>
                    </div>
                  );
                })}
                <div className="my-1.5 h-px bg-[#F0F1F6]" />
                <div className="flex items-center gap-3 py-1.5">
                  <span aria-hidden="true" className="grid size-[34px] place-items-center rounded-[10px] bg-[#F2F3F8]">
                    <Smartphone className="size-4 text-[var(--tr-dark)]" />
                  </span>
                  <span className="flex-1">
                    <span className={cn('block text-[14.5px] font-semibold', signedOut && 'line-through')}>This device</span>
                    <span className="block text-[12.5px] text-[var(--tr-muted)]">{signedOut ? 'Signed out' : 'Last active recently'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (signedOut) {
                        setSignedOut(false);
                        return;
                      }
                      setSignedOut(true);
                      addLog('You signed out this device', '#4C4FE0');
                    }}
                    className={cn(
                      'min-h-10 shrink-0 cursor-pointer rounded-xl border px-3.5 text-[13.5px] font-semibold',
                      signedOut ? 'border-[#CDEBDA] bg-[#E3F6EC] text-[#1C7A50]' : 'border-[#E6E8EF] bg-white text-[#0E1222] hover:border-[#4C4FE0] hover:text-[#3D3FC4]',
                    )}
                  >
                    {signedOut ? 'Signed out' : 'Sign out'}
                  </button>
                </div>
              </div>
              <div aria-live="polite" className="flex min-w-0 flex-[1_1_200px] flex-col gap-2.5 rounded-[22px] border border-[#D6EEE1] bg-white/70 p-4">
                <div className="flex items-center gap-2 text-xs font-bold tracking-wide text-[var(--tr-muted)] uppercase">Consent log</div>
                {log.map((entry) => (
                  <div key={entry.text + entry.when} className="tr-slide flex items-start gap-2.5">
                    <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: entry.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] leading-snug font-semibold">{entry.text}</span>
                      <span className="block text-xs text-[var(--tr-muted)]">{entry.when}</span>
                    </span>
                  </div>
                ))}
                <div className="mt-auto text-xs text-[var(--tr-muted)]">This demo stays on this page. Manage real sessions from your account.</div>
                <Link to="/account" className="text-[13px] font-semibold text-[#3D3FC4] hover:underline">Go to your account →</Link>
              </div>
            </div>
          </TiltCard>

          <TiltCard delay="0.55s" spot="rgba(229,72,77,0.11)" className="border border-[#F8D7D3] bg-gradient-to-b from-[#FFF1EF] to-white">
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <h3 className="m-0 text-[28px] font-semibold tracking-[-0.03em] text-[#0E1222]">Clear about emergencies</h3>
                <p className="mt-2 mb-0 max-w-[420px] text-[15.5px] leading-[1.6] text-[var(--tr-body)]">
                  Sukoon is not an emergency service. In a life-threatening situation we will always point you to 112 first.
                </p>
              </div>
              <span aria-hidden="true" className="tr-serif text-[48px] leading-none text-[#F2B8B0]">04</span>
            </div>
            <div className="relative mt-auto flex flex-col gap-3.5 rounded-[22px] bg-white p-[18px] shadow-[0_24px_44px_-28px_rgba(180,35,24,0.4)]">
              <div className="text-sm font-semibold">Is anyone experiencing any of these right now?</div>
              <div role="group" aria-label="Emergency warning signs" className="flex flex-wrap gap-2">
                {FLAGS.map((label) => {
                  const on = Boolean(flags[label]);
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setFlags((f) => ({ ...f, [label]: !f[label] }))}
                      className={cn(
                        'tr-flag min-h-10 cursor-pointer rounded-full border px-3.5 text-[13.5px] font-semibold transition',
                        on ? 'border-[#D92D20] bg-[#D92D20] text-white' : 'border-[#F1D5D2] bg-white text-[var(--tr-dark)]',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {danger ? (
                <div role="alert" className="tr-pop flex flex-wrap items-center gap-4 rounded-[18px] border border-[#F8C9C3] bg-gradient-to-br from-[#FDECEA] to-[#FFF6F5] px-4 py-3.5">
                  <div className="relative size-[60px] shrink-0">
                    <span className="tr-pr" aria-hidden="true" />
                    <span aria-hidden="true" className="relative grid size-[60px] place-items-center rounded-[18px] bg-gradient-to-br from-[#F04438] to-[#C0281C]">
                      <Phone className="size-[26px] text-white" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-[1_1_160px]">
                    <div className="text-[17px] font-bold text-[#B42318]">Call 112 now</div>
                    <div className="text-[13.5px] leading-[1.45] text-[var(--tr-dark)]">Don't wait for an online booking. Call emergency services or go to the nearest hospital.</div>
                  </div>
                  <a href="tel:112" className="tr-call inline-flex min-h-[50px] shrink-0 items-center rounded-[15px] bg-[#D92D20] px-[22px] text-[15px] font-semibold text-white no-underline">
                    Call 112
                  </a>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3.5 rounded-[18px] bg-[#F7F8FC] px-4 py-3.5">
                  <div className="flex shrink-0 flex-col leading-none">
                    <span className="text-xs font-semibold text-[#B42318]">Emergency</span>
                    <span className="text-[40px] font-bold tracking-[-0.04em] text-[#0E1222]">112</span>
                  </div>
                  <div className="min-w-0 flex-[1_1_160px] text-[13.5px] leading-[1.45] text-[var(--tr-dark)]">
                    None of these? For non-urgent care, Sukoon can help you book a verified doctor.
                  </div>
                  <a href="tel:112" className="tr-call inline-flex min-h-[46px] shrink-0 items-center rounded-[14px] bg-[#D92D20] px-[18px] text-[14.5px] font-semibold text-white no-underline">
                    Call 112
                  </a>
                </div>
              )}
              <div className="text-xs text-[var(--tr-muted)]">This is a guide, not a diagnosis. If in doubt, call 112.</div>
            </div>
          </TiltCard>
        </div>
      </section>
    </div>
  );
}
