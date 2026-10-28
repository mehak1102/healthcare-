import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { fetchPinCoverage, type PinCoverage } from '@/features/home-visits/api';
import { cn } from '@/lib/cn';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';
import { PILOT_CITY, TRIP_SECS, WHO } from './demo-map';
import './home-visit-hero.css';
import { LiveMapCard } from './live-map-card';

const PIN_OK = /^[1-9]\d{5}$/;
const NOTIFY_KEY = 'sukoon-home-visit-notify';
const HOW = [
  { n: '1', title: 'Enter your pincode', sub: 'We check verified doctors near you', bg: '#EEEDFF', fg: '#4C4FE0' },
  { n: '2', title: 'See a real arrival estimate', sub: 'From live schedules — before you pay', bg: '#E4F2FF', fg: '#2A72C2' },
  { n: '3', title: 'Doctor at your door', sub: 'Track them live until they knock', bg: '#E3F6EC', fg: '#1C8A5A' },
] as const;

function readNotify(): string[] {
  try {
    const raw = window.localStorage.getItem(NOTIFY_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function Arrow() {
  return (
    <svg className="h30-ba" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function HomeVisitHero() {
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [tick, setTick] = useState(reduced ? 15 : 0);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');
  const [coverage, setCoverage] = useState<PinCoverage | null>(null);
  const [notify, setNotify] = useState(false);
  const [finePointer, setFinePointer] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sync = () => setFinePointer(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? true), { threshold: 0.08 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (reduced || !visible || hidden) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [reduced, visible, hidden]);

  const who = WHO[Math.floor(tick / 3) % WHO.length] ?? WHO[0];
  const mins = reduced ? 15 : Math.max(0, TRIP_SECS - (tick % 36));
  const ringOffset = (88 * (1 - mins / TRIP_SECS)).toFixed(1);
  const available = coverage?.valid && coverage.inPilotArea;
  const unavailable = coverage?.valid && !coverage.inPilotArea;
  const howActive = available ? 1 : 0;

  const onCheck = async (event: FormEvent) => {
    event.preventDefault();
    const v = pin.trim();
    if (!PIN_OK.test(v)) {
      setErr(true);
      return;
    }
    setBusy(true);
    setFail('');
    try {
      const result = await fetchPinCoverage(v);
      setCoverage(result);
      setNotify(readNotify().includes(v));
    } catch {
      setFail('We could not check that PIN. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const toggleNotify = () => {
    const v = (coverage?.pin ?? pin).trim();
    const next = !notify;
    setNotify(next);
    const list = readNotify().filter((p) => p !== v);
    if (next) list.push(v);
    window.localStorage.setItem(NOTIFY_KEY, JSON.stringify(list));
  };

  const focusPin = () => {
    pinRef.current?.focus();
    pinRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div ref={rootRef} data-h30 className="relative overflow-hidden bg-white">
      <div aria-hidden="true" className="pointer-events-none absolute top-[120px] -right-[8%] h-[820px] w-[66%]">
        <div className="absolute top-[6%] left-[4%] h-[64%] w-[52%] rounded-full bg-[#DCD8FF] opacity-95 blur-[110px]" />
        <div className="absolute top-0 right-0 h-[60%] w-1/2 rounded-full bg-[#CDEBFF] opacity-95 blur-[110px]" />
        <div className="absolute bottom-0 left-[26%] h-1/2 w-[48%] rounded-full bg-[#D3F5E4] opacity-85 blur-[110px]" />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute top-[380px] -left-[12%] h-[460px] w-[42%] rounded-full bg-[#FFE1D3] opacity-55 blur-[130px]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(#E9EBF2_1px,transparent_1px)] bg-size-[28px_28px] opacity-55" />

      <button
        type="button"
        onClick={focusPin}
        className="h30-annc relative z-40 flex min-h-11 w-full flex-wrap items-center justify-center gap-3 bg-linear-to-r from-[#3F42D6] via-[#6556EE] to-[#8C7AF5] px-4 py-2.5 text-sm font-medium text-white"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/18 px-2.5 py-0.5 text-[12px] font-bold tracking-[0.08em] uppercase">
          <span className="h30-blink size-1.5 rounded-full bg-[#34D399]" />
          New
        </span>
        <span className="h30-shim font-semibold">Doctor at home — in as little as 30 minutes</span>
        <span className="opacity-85">Rolling out area by area · {PILOT_CITY}</span>
        <span className="font-semibold">
          Check your area <span className="h30-annc-go">→</span>
        </span>
      </button>

      <div className="relative z-10 w-full lg:grid lg:grid-cols-[minmax(0,48%)_minmax(0,1fr)] lg:items-stretch">
        <div className="relative z-20 px-6 pt-[52px] pb-10 lg:flex lg:justify-end lg:py-[52px] lg:pl-[max(24px,calc((100vw-1240px)/2+24px))] lg:pr-10">
          <section aria-labelledby="h30b" className="flex w-full max-w-[560px] flex-col gap-[22px]">
          <div className="h30-rv h30-d1 inline-flex items-center gap-2.5 self-start rounded-full border border-[#ECEEF4] bg-white/85 py-1.5 pr-3.5 pl-1.5 text-[13.5px] font-medium text-[#3B4155] shadow-[0_6px_20px_-14px_rgba(14,18,34,0.3)]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFEDE4] px-2.5 py-1 font-bold text-[#9A4521]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C25A2E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 11 12 4l9 7" />
                <path d="M5 10v10h14V10" />
              </svg>
              Doctor at home
            </span>
            <span className="relative inline-block min-w-[11em] text-left">
              <span key={who} className="h30-word">
                {who}
              </span>
            </span>
          </div>

          <h1 id="h30b" className="h30-rv h30-d2 m-0 text-[clamp(46px,5.6vw,86px)] leading-[0.98] font-semibold tracking-[-0.05em]">
            A doctor at
            <br />
            your door in
            <br />
            <span className="inline-flex items-center gap-[0.16em] whitespace-nowrap">
              <span
                className="h30-serif pr-[0.05em] tracking-[-0.02em]"
                style={{ background: 'linear-gradient(90deg, #4C4FE0, #8C7AF5 60%, #4FA8E8)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
              >
                30 minutes
              </span>
              <span aria-hidden="true" className="inline-flex size-[0.82em] items-center justify-center rounded-full bg-white shadow-[0_12px_30px_-12px_rgba(76,79,224,0.55),inset_0_0_0_1px_#ECEEF4]">
                <svg width="70%" height="70%" viewBox="0 0 40 40">
                  <circle cx="20" cy="22" r="14" fill="none" stroke="#EEEDFF" strokeWidth="4" />
                  <circle
                    cx="20"
                    cy="22"
                    r="14"
                    fill="none"
                    stroke="#4C4FE0"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="88"
                    strokeDashoffset={ringOffset}
                    transform="rotate(-90 20 22)"
                    style={{ transition: reduced ? 'none' : 'stroke-dashoffset 1s linear' }}
                  />
                  <path d="M16 3h8M20 3v5" stroke="#4C4FE0" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
            </span>
          </h1>

          <p className="h30-rv h30-d3 m-0 max-w-[520px] text-[18.5px] leading-[1.6] text-[#545A6E]">
            A verified doctor, at home, when travel is hard. You'll see an honest arrival estimate{' '}
            <b className="font-semibold text-[#0E1222]">before</b> you confirm — and track them live until they knock.
          </p>

          <div className="h30-rv h30-d4 flex max-w-[560px] flex-col gap-2.5">
            {!coverage && (
              <form aria-label="Check doctor-at-home availability" className="flex flex-wrap gap-2 rounded-[22px] border border-[#E8EAF1] bg-white/94 p-2 shadow-[0_24px_50px_-28px_rgba(60,60,140,0.45)]" onSubmit={onCheck}>
                <div className="h30-pin flex min-h-[60px] min-w-0 flex-[1_1_220px] items-center gap-3 rounded-2xl border border-transparent bg-[#F7F8FC] px-3.5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4C4FE0" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
                    <circle cx="12" cy="9.5" r="2.5" />
                  </svg>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <label htmlFor="pin30b" className="text-xs font-semibold text-[#545A6E]">
                      Your pincode
                    </label>
                    <input
                      ref={pinRef}
                      id="pin30b"
                      type="text"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={6}
                      value={pin}
                      placeholder="6-digit pincode"
                      onChange={(e) => {
                        setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                        setErr(false);
                        setFail('');
                      }}
                      className="w-full border-0 bg-transparent py-0.5 text-lg font-semibold tracking-[0.14em] text-[#0E1222] outline-none placeholder:text-sm placeholder:font-medium placeholder:tracking-normal placeholder:text-[#8A90A3]"
                    />
                  </div>
                  <span aria-hidden="true" className="flex gap-0.5">
                    {Array.from({ length: 6 }, (_, i) => (
                      <span key={i} className="size-1.5 rounded-full transition-colors" style={{ background: i < pin.length ? '#4C4FE0' : '#DDDFEA' }} />
                    ))}
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="h30-btn inline-flex min-h-[60px] shrink-0 cursor-pointer items-center gap-2.5 rounded-2xl border-0 bg-[#0E1222] px-[22px] text-base font-semibold text-white shadow-[0_10px_24px_-10px_rgba(14,18,34,0.55),inset_0_1px_0_rgba(255,255,255,0.18)] disabled:opacity-70"
                >
                  {busy ? 'Checking…' : 'Check my area'}
                  <Arrow />
                </button>
              </form>
            )}
            {err && (
              <div role="alert" className="text-sm font-medium text-[#B42318]">
                Please enter a valid 6-digit pincode.
              </div>
            )}
            {fail && (
              <div role="alert" className="text-sm font-medium text-[#B42318]">
                {fail}
              </div>
            )}
            {available && coverage && (
              <div className="h30-pop flex flex-col gap-3.5 rounded-[22px] border border-[#CDEBDA] bg-white p-[18px] shadow-[0_24px_50px_-30px_rgba(20,100,70,0.45)]" role="status">
                <div className="flex items-center gap-3.5">
                  <span aria-hidden="true" className="grid size-[46px] shrink-0 place-items-center rounded-[14px] bg-linear-to-br from-[#E3F6EC] to-[#C9EFDB]">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1C8A5A" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16.5px] font-semibold">
                      {coverage.areaLabel ? `${coverage.areaLabel} is on our pilot list` : `PIN ${coverage.pin} is on our pilot list`}
                    </span>
                    <span className="block text-sm text-[#545A6E]">{coverage.message}</span>
                  </span>
                  <button type="button" className="min-h-11 shrink-0 cursor-pointer border-0 bg-transparent text-[13px] font-semibold text-[#3D3FC4]" onClick={() => setCoverage(null)}>
                    Change
                  </button>
                </div>
                <Link
                  to="/doctor-at-home"
                  className="h30-btn flex min-h-[54px] items-center justify-center gap-2.5 rounded-[15px] bg-[#0E1222] text-[15.5px] font-semibold text-white no-underline"
                >
                  {coverage.bookingOpen ? 'Book a home visit' : 'See how home visits will work'}
                  <Arrow />
                </Link>
              </div>
            )}
            {unavailable && coverage && (
              <div className="h30-pop flex flex-wrap items-center gap-3.5 rounded-[22px] border border-[#F2D9C8] bg-white p-[18px] shadow-[0_24px_50px_-30px_rgba(180,90,40,0.35)]" role="status">
                <span aria-hidden="true" className="grid size-[46px] shrink-0 place-items-center rounded-[14px] bg-[#FFEDE4]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C25A2E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                </span>
                <span className="min-w-0 flex-[1_1_220px]">
                  <span className="block text-[16.5px] font-semibold">Not in {coverage.pin} yet</span>
                  <span className="block text-sm text-[#545A6E]">We open area by area — only once we can genuinely reach you in time.</span>
                </span>
                <button
                  type="button"
                  aria-pressed={notify}
                  onClick={toggleNotify}
                  className={cn(
                    'min-h-11 shrink-0 cursor-pointer rounded-[13px] px-4 text-sm font-semibold',
                    notify ? 'border border-[#C9CCF8] bg-[#EEEDFF] text-[#3D3FC4]' : 'border border-[#0E1222] bg-[#0E1222] text-white',
                  )}
                >
                  {notify ? "✓ We'll tell you" : 'Notify me'}
                </button>
                <button type="button" className="min-h-11 cursor-pointer border-0 bg-transparent text-[13px] font-semibold text-[#3D3FC4]" onClick={() => setCoverage(null)}>
                  Try another
                </button>
              </div>
            )}
          </div>

          <div className="h30-rv h30-d5 grid max-w-[560px] grid-cols-3 gap-2.5">
            {[
              { title: 'Verified only', sub: 'Registration checked', path: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3z', extra: 'm9 12 2 2 4-4' },
              { title: 'Estimate first', sub: 'Before you confirm', path: '', extra: '' },
              { title: 'Live tracking', sub: 'Until they arrive', path: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z', extra: '' },
            ].map((card) => (
              <div key={card.title} className="rounded-[18px] border border-[#ECEEF4] bg-white/80 p-3.5">
                {card.title === 'Estimate first' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4C4FE0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                ) : card.title === 'Live tracking' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4C4FE0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={card.path} />
                    <circle cx="12" cy="9.5" r="2.5" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4C4FE0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={card.path} />
                    <path d={card.extra} />
                  </svg>
                )}
                <div className="mt-2 text-[14.5px] font-semibold">{card.title}</div>
                <div className="mt-0.5 text-[12.5px] text-[#6B7186]">{card.sub}</div>
              </div>
            ))}
          </div>
          <div className="h30-rv h30-d5 inline-flex items-center gap-2 text-[13.5px] text-[#545A6E]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D92D20" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 8v5M12 17h.01" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            Not for emergencies — call{' '}
            <a href="tel:112" className="font-bold text-[#B42318]">
              112
            </a>
          </div>
          </section>
        </div>

        <div className="relative z-10 h-[min(480px,56vh)] min-h-[440px] w-full lg:h-auto lg:min-h-0">
          <LiveMapCard tick={tick} reduced={reduced} allowTilt={finePointer} />
        </div>
      </div>

      <section aria-label="How doctor at home works" className="h30-rv h30-d6 relative z-10 mx-auto max-w-[1240px] px-6 pt-10 pb-6">
        <ol className="relative m-0 grid list-none grid-cols-1 gap-2 rounded-[26px] border border-[#ECEEF4] bg-white/80 p-2 shadow-[0_24px_60px_-40px_rgba(60,60,140,0.45)] backdrop-blur-[14px] sm:grid-cols-3">
          {HOW.map((step, i) => {
            const on = i === howActive;
            return (
              <li
                key={step.n}
                className={cn('relative flex items-center gap-3.5 overflow-hidden rounded-[20px] px-[18px] py-4 transition-[background,box-shadow] duration-300', on ? 'bg-white shadow-[0_14px_30px_-20px_rgba(60,60,140,0.5)]' : 'bg-white/55')}
              >
                <span
                  aria-hidden="true"
                  className="h30-serif grid size-[46px] shrink-0 place-items-center rounded-[14px] text-2xl"
                  style={{ background: step.bg, color: step.fg }}
                >
                  {step.n}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">{step.title}</span>
                  <span className="block text-[13.5px] text-[#6B7186]">{step.sub}</span>
                </span>
                <span aria-hidden="true" className="absolute bottom-0 left-0 h-[3px] transition-[width] duration-500" style={{ background: step.fg, width: on ? '100%' : '0%' }} />
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
