import { Bell, Check, Lock, Mail, Phone, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useCurrentUser } from '@/features/auth/use-auth';
import { cn } from '@/lib/cn';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';
import { useSiteLanguage } from '@/lib/use-site-language';
import './site-footer.css';

const CURRENT_YEAR = new Date().getFullYear();
const SAMPLES = ['priya@gmail.com', '98765 43210', 'rahul.mehta@outlook.com', '+91 91234 56789'];

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isMobile(value: string) {
  return /^(\+91[\s-]?)?[6-9]\d{9}$/.test(value.replace(/\s/g, ''));
}

function Chip({
  className,
  floatClass,
  icon,
  label,
  shift,
  tone,
}: {
  className: string;
  floatClass: string;
  icon: ReactNode;
  label: string;
  shift?: string;
  tone: string;
}) {
  return (
    <div
      className={cn('pointer-events-none absolute z-[1] hidden lg:block', className)}
      style={shift ? { transform: shift } : undefined}
    >
      <div
        className={cn(
          floatClass,
          'inline-flex items-center gap-2 rounded-[14px] border border-white bg-white/95 px-3 py-2.5 text-[13px] font-semibold text-[#3B4155] shadow-[0_16px_34px_-18px_rgba(60,60,140,0.55)]',
        )}
      >
        <span className="grid size-[26px] place-items-center rounded-[9px]" style={{ background: tone }}>
          {icon}
        </span>
        {label}
      </div>
    </div>
  );
}

function typedPlaceholder(tick: number) {
  const lens = SAMPLES.map((s) => s.length * 2 + 18);
  const total = lens.reduce((a, b) => a + b, 0);
  let p = tick % total;
  let idx = 0;
  for (; idx < SAMPLES.length; idx += 1) {
    if (p < lens[idx]!) break;
    p -= lens[idx]!;
  }
  const s = SAMPLES[idx] ?? SAMPLES[0];
  const L = s.length;
  let shown = s;
  if (p < L) shown = s.slice(0, p + 1);
  else if (p >= L + 14) shown = s.slice(0, Math.max(0, L - (p - L - 14) * 3));
  return `Try ${shown}`;
}

export function SiteFooter() {
  const { data: user } = useCurrentUser();
  const { lang, setLang } = useSiteLanguage();
  const reduced = usePrefersReducedMotion();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState(false);
  const [focus, setFocus] = useState(false);
  const [tick, setTick] = useState(0);
  const [hover, setHover] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [letter, setLetter] = useState(-10);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 110);
    return () => window.clearInterval(id);
  }, [reduced]);

  const showCta = !user && pathname === '/';
  const typed = typedPlaceholder(tick);
  const showType = !email && !focus;
  const rx = hover ? (hover.y / hover.h - 0.5) * -3 : 0;
  const ry = hover ? (hover.x / hover.w - 0.5) * 3 : 0;
  const px = hover ? hover.x / hover.w - 0.5 : 0;
  const py = hover ? hover.y / hover.h - 0.5 : 0;

  const onCardMove = (event: MouseEvent<HTMLDivElement>) => {
    if (reduced) return;
    const r = event.currentTarget.getBoundingClientRect();
    setHover({ x: event.clientX - r.left, y: event.clientY - r.top, w: r.width, h: r.height });
  };

  const onJoin = (event: FormEvent) => {
    event.preventDefault();
    const v = email.trim();
    if (isEmail(v)) {
      navigate(`/register?email=${encodeURIComponent(v)}`);
      return;
    }
    if (isMobile(v)) {
      navigate('/register');
      return;
    }
    setErr(true);
  };

  const word = 'sukoon'.split('');

  return (
    <div data-sukoon-footer className="bg-white">
      {showCta && (
        <section aria-labelledby="cta2-h" className="relative mx-auto max-w-[1240px] px-6 pt-20 pb-16">
          <div aria-hidden="true" className="pointer-events-none absolute top-[50px] left-1/2 h-[520px] w-[1150px] max-w-none -translate-x-1/2">
            <div className="absolute top-[10%] left-[2%] h-[78%] w-[44%] rounded-full bg-[#DCD8FF] opacity-95 blur-[90px]" />
            <div className="absolute top-0 right-[2%] h-[74%] w-[44%] rounded-full bg-[#CDEBFF] opacity-95 blur-[90px]" />
            <div className="absolute top-[48%] left-[34%] h-[52%] w-[36%] rounded-full bg-[#D3F5E4] opacity-85 blur-[90px]" />
            <div className="absolute top-[56%] right-[22%] h-[38%] w-[20%] rounded-full bg-[#FFE1D3] opacity-80 blur-[80px]" />
          </div>
          <div
            className="ft-rv relative overflow-hidden rounded-[37px] bg-white/60 p-0.5"
            style={{
              transform: hover
                ? `perspective(1400px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`
                : undefined,
              boxShadow: '0 50px 100px -50px rgba(60,60,160,0.55)',
            }}
            onMouseMove={onCardMove}
            onMouseLeave={() => setHover(null)}
          >
            <div
              aria-hidden="true"
              className="ft-spin pointer-events-none absolute top-1/2 left-1/2 size-[1600px] -mt-[800px] -ml-[800px]"
              style={{
                background:
                  'conic-gradient(from 0deg, rgba(76,79,224,0) 0deg, #4C4FE0 50deg, #8C7AF5 90deg, #4FC3F7 130deg, rgba(76,79,224,0) 180deg, rgba(76,79,224,0) 360deg)',
              }}
            />
            <div className="relative flex flex-col items-center gap-[22px] overflow-hidden rounded-[35px] bg-white/86 px-6 py-12 text-center backdrop-blur-[22px] sm:px-12 sm:py-[58px]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 transition-opacity duration-300"
                style={{
                  opacity: hover ? 1 : 0,
                  background: `radial-gradient(520px circle at ${hover?.x ?? 0}px ${hover?.y ?? 0}px, rgba(76,79,224,0.10), transparent 60%)`,
                }}
              />
              <Chip
                className="top-10 left-9"
                floatClass="ft-fa"
                tone="#EEEDFF"
                label="Privacy first"
                shift={hover ? `translate3d(${(px * -22).toFixed(1)}px, ${(py * -22).toFixed(1)}px, 0)` : undefined}
                icon={<Lock className="size-[13px] text-[#4C4FE0]" />}
              />
              <Chip
                className="top-[52px] right-10"
                floatClass="ft-fb"
                tone="#E3F6EC"
                label="Verified doctors only"
                shift={hover ? `translate3d(${(px * 18).toFixed(1)}px, ${(py * -16).toFixed(1)}px, 0)` : undefined}
                icon={<Check className="size-[13px] text-[#1C8A5A]" strokeWidth={2.6} />}
              />
              <Chip
                className="right-20 bottom-[120px]"
                floatClass="ft-fc"
                tone="#FFEDE4"
                label="Told the day it opens"
                shift={hover ? `translate3d(${(px * -14).toFixed(1)}px, ${(py * 20).toFixed(1)}px, 0)` : undefined}
                icon={<Bell className="size-[13px] text-[#C25A2E]" />}
              />
              <Chip
                className="bottom-[132px] left-[70px]"
                floatClass="ft-fd"
                tone="#E4F2FF"
                label="Add your family"
                shift={hover ? `translate3d(${(px * 20).toFixed(1)}px, ${(py * 14).toFixed(1)}px, 0)` : undefined}
                icon={<Users className="size-[13px] text-[#2A72C2]" />}
              />

              <span className="relative inline-flex items-center gap-2.5 rounded-full border border-[#ECEEF4] bg-white py-1.5 pr-3.5 pl-1.5 text-[13.5px] font-medium text-[#3B4155] shadow-[0_6px_20px_-14px_rgba(14,18,34,0.3)]">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEEDFF] px-2.5 py-1 font-semibold text-[#3D3FC4]">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-[#4C4FE0]" />
                  Opening soon
                </span>
                Booking launches in stages
              </span>
              <h2 id="cta2-h" className="relative m-0 text-[clamp(42px,5.4vw,74px)] leading-[1.02] font-semibold tracking-[-0.045em] text-[#0E1222]">
                Be ready when
                <br />
                booking{' '}
                <span className="ft-serif pr-[0.06em] tracking-[-0.02em]" style={{ background: 'linear-gradient(90deg, #4C4FE0, #8C7AF5, #4FA8E8)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                  opens
                </span>
              </h2>
              <p className="relative m-0 max-w-[520px] text-lg leading-[1.6] text-[var(--ft-body)]">
                Create your account now and manage your privacy settings from day one — before you ever share a record.
              </p>
              <form aria-label="Create your account" className="relative w-full max-w-[580px] text-left" onSubmit={onJoin}>
                <div className="flex flex-wrap gap-2 rounded-[22px] border border-[#E8EAF1] bg-white p-2 shadow-[0_24px_50px_-28px_rgba(60,60,140,0.5)]">
                  <div className="ft-em relative flex min-h-[58px] min-w-0 flex-[1_1_250px] items-center gap-3 rounded-2xl border border-transparent bg-[#F7F8FC] px-3.5">
                    <Mail className="size-[19px] shrink-0 text-[#4C4FE0]" aria-hidden="true" />
                    <label htmlFor="cta2-em" className="sr-only">
                      Email or mobile number
                    </label>
                    <span className="relative min-w-0 flex-1">
                      <input
                        id="cta2-em"
                        type="text"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setErr(false);
                        }}
                        onFocus={() => setFocus(true)}
                        onBlur={() => setFocus(false)}
                        className="w-full border-0 bg-transparent p-0 text-base text-[#0E1222] outline-none"
                      />
                      {showType && (
                        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 whitespace-nowrap text-base text-[#8A90A3]">
                          {typed}
                          <span className="ft-caret" />
                        </span>
                      )}
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="ft-btn inline-flex min-h-[58px] shrink-0 cursor-pointer items-center gap-2.5 rounded-2xl border-0 bg-[#0E1222] px-6 text-base font-semibold text-white shadow-[0_10px_24px_-10px_rgba(14,18,34,0.55),inset_0_1px_0_rgba(255,255,255,0.18)]"
                  >
                    Create account
                    <svg className="ft-ba" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>
                {err && (
                  <div role="alert" className="mt-2.5 text-sm font-medium text-[#B42318]">
                    Please enter a valid email or a 10-digit mobile number.
                  </div>
                )}
              </form>
              <ol aria-label="Getting started" className="relative mt-1.5 mb-0 grid w-full max-w-[580px] list-none grid-cols-3 p-0">
                <span aria-hidden="true" className="absolute top-[15px] right-[16.6%] left-[16.6%] h-[3px] rounded-sm bg-[#E6E8EF]" />
                {['Create your account', 'Set privacy controls', 'Get told when booking opens'].map((label, i) => {
                  const cur = i === 0;
                  return (
                    <li key={label} className="relative flex flex-col items-center gap-2 text-[13.5px]">
                      <span
                        aria-hidden="true"
                        className={cn(
                          'relative inline-flex size-8 items-center justify-center rounded-full text-[13px] font-bold',
                          cur ? 'bg-[#4C4FE0] text-white shadow-[0_0_0_5px_#EEEDFF]' : 'border-2 border-[#E6E8EF] bg-white text-[#8A90A3]',
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className={cn(cur ? 'font-semibold text-[#0E1222]' : 'font-medium text-[#8A90A3]')}>{label}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </section>
      )}

      <footer className="relative overflow-hidden bg-linear-to-b from-white via-[#F6F7FC] to-[#F0F1FA]">
        <div aria-hidden="true" className="pointer-events-none absolute bottom-10 -left-[120px] h-[380px] w-[520px] rounded-full bg-[#DCD8FF] opacity-60 blur-[120px]" />
        <div aria-hidden="true" className="pointer-events-none absolute right-[-100px] bottom-0 h-[380px] w-[520px] rounded-full bg-[#CDEBFF] opacity-65 blur-[120px]" />

        <div className={cn('relative mx-auto max-w-[1240px] px-6', showCta ? 'pt-12' : 'pt-14')}>
          <div className="flex flex-wrap gap-x-8 gap-y-11 pb-11">
            <div className="flex min-w-0 flex-[1.5_1_300px] flex-col gap-[18px]">
              <Link to="/" className="inline-flex items-center gap-3 text-[#0E1222] no-underline">
                <svg width="38" height="38" viewBox="0 0 30 30" aria-hidden="true">
                  <circle cx="15" cy="15" r="15" fill="#0E1222" />
                  <path d="M8 16.5c2.4-4 11.6-4 14 0" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeLinecap="round" />
                  <circle cx="15" cy="10.5" r="2.2" fill="#A9A6FF" />
                </svg>
                <span className="text-[23px] font-semibold tracking-[-0.02em]">
                  Sukoon <span className="ft-serif text-[#4C4FE0]">Health</span>
                </span>
              </Link>
              <p className="m-0 max-w-[340px] text-[15.5px] leading-[1.65] text-[var(--ft-body)]">
                Calm, verified care for patients in India. We're building carefully — features appear here only when they genuinely work.
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <div role="group" aria-label="Language" className="flex rounded-xl border border-[#E8EAF1] bg-white p-[3px]">
                  <button
                    type="button"
                    aria-pressed={lang === 'en'}
                    onClick={() => setLang('en')}
                    className={cn('min-h-9 cursor-pointer rounded-[9px] border-0 px-3 text-[13px] font-semibold', lang === 'en' ? 'bg-[#0E1222] text-white' : 'bg-transparent text-[var(--ft-muted)] hover:text-[#0E1222]')}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    lang="hi"
                    aria-pressed={lang === 'hi'}
                    onClick={() => setLang('hi')}
                    className={cn('min-h-9 cursor-pointer rounded-[9px] border-0 px-3 font-[family-name:Noto_Sans_Devanagari,sans-serif] text-[13px] font-semibold', lang === 'hi' ? 'bg-[#0E1222] text-white' : 'bg-transparent text-[var(--ft-muted)] hover:text-[#0E1222]')}
                  >
                    हिन्दी
                  </button>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F6E0B0] bg-[#FFF6E3] px-2.5 py-1.5 text-[12.5px] font-semibold text-[#8A5300]">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-[#E0A422]" />
                  Development build
                </span>
              </div>
            </div>
            <nav aria-label="Care" className="min-w-0 flex-[1_1_170px]">
              <h3 className="mb-3.5 text-[12.5px] font-bold tracking-[0.14em] text-[#8A90A3] uppercase">Care</h3>
              <ul className="m-0 flex list-none flex-col p-0 text-[15px]">
                <li><Link className="ft-link inline-flex min-h-[38px] items-center" to="/doctors">Find a doctor</Link></li>
                <li><Link className="ft-link inline-flex min-h-[38px] items-center" to="/care">Healthcare categories</Link></li>
                <li><Link className="ft-link inline-flex min-h-[38px] items-center" to="/online-consultation">Online consultation</Link></li>
                <li><Link className="ft-link inline-flex min-h-[38px] items-center" to="/diagnostics">Diagnostics</Link></li>
                <li className="flex items-center gap-2">
                  <Link className="ft-link inline-flex min-h-[38px] items-center" to="/doctor-at-home">Doctor at home</Link>
                  <span className="rounded-full bg-[#ECEEF4] px-1.5 py-0.5 text-[11px] font-bold text-[var(--ft-body)]">Soon</span>
                </li>
              </ul>
            </nav>
            <nav aria-label="Company" className="min-w-0 flex-[1_1_140px]">
              <h3 className="mb-3.5 text-[12.5px] font-bold tracking-[0.14em] text-[#8A90A3] uppercase">Company</h3>
              <ul className="m-0 flex list-none flex-col p-0 text-[15px]">
                <li><Link className="ft-link inline-flex min-h-[38px] items-center" to="/about">About us</Link></li>
                <li><Link className="ft-link inline-flex min-h-[38px] items-center" to="/contact">Contact</Link></li>
                <li><Link className="ft-link inline-flex min-h-[38px] items-center" to="/doctors/join">For doctors</Link></li>
              </ul>
            </nav>
            <nav aria-label="Policies" className="min-w-0 flex-[1_1_150px]">
              <h3 className="mb-3.5 text-[12.5px] font-bold tracking-[0.14em] text-[#8A90A3] uppercase">Policies</h3>
              <ul className="m-0 flex list-none flex-col p-0 text-[15px]">
                <li className="flex items-center gap-2">
                  <Link className="ft-link inline-flex min-h-[38px] items-center" to="/privacy">Privacy notice</Link>
                  <span className="rounded-full bg-[#FFF6E3] px-1.5 py-0.5 text-[11px] font-bold text-[#8A5300]">Draft</span>
                </li>
                <li className="flex items-center gap-2">
                  <Link className="ft-link inline-flex min-h-[38px] items-center" to="/terms">Terms of use</Link>
                  <span className="rounded-full bg-[#FFF6E3] px-1.5 py-0.5 text-[11px] font-bold text-[#8A5300]">Draft</span>
                </li>
              </ul>
            </nav>
          </div>

          <div role="note" className="flex flex-wrap items-center gap-x-5 gap-y-3.5 rounded-[20px] border border-[#F6D6D2] bg-white/90 py-4 pr-4 pl-[18px] shadow-[0_16px_36px_-28px_rgba(180,35,24,0.4)]">
            <span aria-hidden="true" className="ft-pulse grid size-[42px] shrink-0 place-items-center rounded-[13px] bg-[#FDECEA]">
              <Phone className="size-[19px] text-[#D92D20]" />
            </span>
            <span className="min-w-0 flex-[1_1_320px] text-[15px] leading-normal text-[#3B4155]">
              <b className="font-semibold text-[#0E1222]">Medical emergency? Call 112.</b> Sukoon is not an emergency service — in a life-threatening situation, call 112 or go to the nearest hospital.
            </span>
            <span className="flex flex-wrap gap-2">
              <Link to="/emergency" className="ft-ghost inline-flex min-h-11 items-center rounded-[13px] border border-[#E6E8EF] bg-[#F7F8FC] px-4 text-sm font-semibold text-[#0E1222] no-underline">
                Emergency guidance
              </Link>
              <a href="tel:112" className="ft-call inline-flex min-h-11 items-center rounded-[13px] bg-[#D92D20] px-[18px] text-sm font-semibold text-white no-underline">
                Call 112
              </a>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3.5 pt-6 pb-2 text-[13.5px] text-[var(--ft-muted)]">
            <span>© {CURRENT_YEAR} Sukoon Health (working name). Development build — not for real patient use.</span>
            <button
              type="button"
              className="ft-ghost inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-[#E6E8EF] bg-white/80 px-3.5 text-[13.5px] font-semibold text-[#0E1222]"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              Back to top
              <svg className="ft-up" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0E1222" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 19V5M6 11l6-6 6 6" />
              </svg>
            </button>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="relative flex h-[clamp(140px,18vw,270px)] cursor-default justify-center overflow-hidden"
          onMouseLeave={() => setLetter(-10)}
        >
          <div className="pt-[0.06em] text-[clamp(160px,23vw,340px)] leading-[0.8] font-bold tracking-[-0.07em] whitespace-nowrap select-none">
            {word.map((ch, i) => {
              const d = Math.abs(i - letter);
              const lift = d === 0 ? -16 : d === 1 ? -8 : d === 2 ? -3 : 0;
              const color = d === 0 ? '#4C4FE0' : d === 1 ? '#8C8FF0' : d === 2 ? '#C3C5F5' : '#DDDFF2';
              return (
                <span
                  key={`${ch}-${i}`}
                  className="ft-ltr"
                  style={{
                    transform: `translateY(${lift}%)`,
                    color,
                    textShadow: d <= 1 ? '0 20px 60px rgba(76,79,224,0.25)' : undefined,
                  }}
                  onMouseEnter={() => setLetter(i)}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        </div>
      </footer>
    </div>
  );
}
