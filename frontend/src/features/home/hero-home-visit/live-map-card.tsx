import { useMemo, useState, type MouseEvent } from 'react';
import { cn } from '@/lib/cn';
import {
  CLINIC,
  CYCLE_SECS,
  HOME,
  NEARBY,
  ROUTE,
  ROUTE_LEN,
  THEMES,
  TRIP_SECS,
  VIEWBOX_H,
  VIEWBOX_W,
  headingAt,
  mapPointPct,
  pointAt,
  type MapTheme,
} from './demo-map';

/** Top-down car art faces east (right) at rotate(0). */
const CAR_ART_FACING_DEG = 0;

function DoctorCarMarker({ heading, jump, night }: { heading: number; jump: boolean; night: boolean }) {
  return (
    <div
      className={cn(
        'relative',
        night
          ? 'drop-shadow-[0_0_14px_rgba(126,182,255,0.55)] drop-shadow-[0_12px_20px_rgba(0,0,0,0.65)]'
          : 'drop-shadow-[0_10px_18px_rgba(14,18,34,0.4)]',
      )}
      style={{
        transform: `rotate(${(heading - CAR_ART_FACING_DEG).toFixed(1)}deg)`,
        transition: jump ? 'none' : 'transform 1s linear',
      }}
    >
      <img
        src="/home-visit/car-pin.png"
        alt=""
        width={120}
        height={120}
        className="block h-[76px] w-auto max-w-none select-none"
        draggable={false}
      />
      <img
        src="/home-visit/doctor-preview.png"
        alt=""
        className="pointer-events-none absolute top-[6%] left-[56%] size-[22px] -translate-x-1/2 rounded-full border-2 border-white object-cover object-[center_22%] shadow-sm"
      />
    </div>
  );
}

const ROUTE_D = ROUTE.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join('');

function markerStyle(x: number, y: number) {
  return mapPointPct(x, y);
}

export function LiveMapCard({
  tick,
  reduced,
  allowTilt,
}: {
  tick: number;
  reduced: boolean;
  allowTilt: boolean;
}) {
  const hour = new Date().getHours();
  const [theme, setTheme] = useState<MapTheme>(() => (hour >= 19 || hour < 6 ? 'night' : 'day'));
  const [hover, setHover] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const night = theme === 'night';
  const c = THEMES[theme];
  const ph = reduced ? 15 : tick % CYCLE_SECS;
  const f = Math.min(1, ph / TRIP_SECS);
  const arrived = ph >= TRIP_SECS;
  const mins = Math.max(0, TRIP_SECS - ph);
  const jump = !reduced && ph === 0;
  const pt = pointAt(f);
  const car = mapPointPct(pt[0], pt[1]);
  const carHeading = headingAt(f);
  const home = mapPointPct(HOME[0], HOME[1]);
  const stageIdx = arrived ? 3 : f > 0.06 ? 2 : 1;
  const stageNames = ['Booked', 'Assigned', 'On the way', 'Arrived'] as const;
  const rx = hover ? (hover.y / hover.h - 0.5) * -3 : 0;
  const ry = hover ? (hover.x / hover.w - 0.5) * 3 : 0;

  const toast = useMemo(() => {
    if (arrived) return { title: 'Dr. Rao has arrived', sub: 'Please open the door', d: 'M20 6 9 17l-5-5', bg: '#E3F6EC', fg: '#1C8A5A' };
    if (ph < 4) return { title: 'Visit accepted', sub: 'Dr. Ananya Rao is getting ready', d: 'M20 6 9 17l-5-5', bg: '#EEEDFF', fg: '#4C4FE0' };
    if (ph < 15) return { title: 'On the way', sub: 'Leaving the clinic now', d: 'M5 12h14M13 6l6 6-6 6', bg: '#EEEDFF', fg: '#4C4FE0' };
    if (ph < 25) return { title: 'Halfway there', sub: 'Live estimate updated', d: 'M12 7v5l3 2', bg: '#EEEDFF', fg: '#4C4FE0' };
    return { title: 'Almost there', sub: `About ${mins} min away`, d: 'M3 11 12 4l9 7M5 10v10h14V10', bg: '#FFEDE4', fg: '#C25A2E' };
  }, [arrived, mins, ph]);

  const onMove = (event: MouseEvent<HTMLElement>) => {
    if (!allowTilt || reduced) return;
    const r = event.currentTarget.getBoundingClientRect();
    setHover({ x: event.clientX - r.left, y: event.clientY - r.top, w: r.width, h: r.height });
  };

  const route = ROUTE_D;
  const seg =
    'inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-[9px] border-0 px-2.5 text-[12.5px] font-semibold';

  return (
    <section aria-label="Example of a home visit on its way" className="h30-rv h30-d6 relative min-w-0 flex-[1.12_1_540px]" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <div
        className="h30-map relative overflow-hidden rounded-[36px]"
        style={{
          border: `1px solid ${c.cardBorder}`,
          boxShadow: `0 1px 2px rgba(14,18,34,0.04), 0 60px 110px -50px rgba(40,40,120,0.6), inset 0 0 0 6px ${c.inset}`,
          transform: `perspective(1500px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`,
          transition: `transform ${hover ? '0.15s' : '0.6s'} cubic-bezier(.2,.7,.2,1), border-color 0.6s`,
        }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 transition-colors duration-700"
          style={{ background: night ? '#0a1024' : '#e8f0f8' }}
        />

        <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
          <img
            src="/home-visit/map-day.jpg"
            alt=""
            className={cn('absolute inset-0 size-full object-cover object-center transition-opacity duration-700', night && 'opacity-0')}
          />
          <img
            src="/home-visit/map-night.jpg"
            alt=""
            className={cn(
              'absolute inset-0 size-full object-cover object-center transition-opacity duration-700',
              !night && 'opacity-0',
            )}
          />
          <svg
            viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 block size-full"
          >
            <defs>
              <filter id="h30-route-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="5" />
              </filter>
            </defs>
            <path
              d={route}
              fill="none"
              stroke={night ? '#7EB6FF' : '#5B8DEF'}
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={night ? 0.5 : 0.35}
              filter="url(#h30-route-glow)"
            />
            <path
              d={route}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="13"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={night ? 0.85 : 0.55}
            />
            <path
              d={route}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="11"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={ROUTE_LEN.toFixed(0)}
              strokeDashoffset={(ROUTE_LEN * (1 - f)).toFixed(1)}
              style={{ transition: jump ? 'none' : 'stroke-dashoffset 1s linear' }}
            />
            <path
              d={route}
              fill="none"
              stroke={night ? '#9CC8FF' : '#5B8DEF'}
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={ROUTE_LEN.toFixed(0)}
              strokeDashoffset={(ROUTE_LEN * (1 - f)).toFixed(1)}
              style={{ transition: jump ? 'none' : 'stroke-dashoffset 1s linear' }}
            />
            <circle cx={HOME[0]} cy={HOME[1]} r="34" fill="#4C4FE0" opacity="0.12" />
            <ellipse cx={HOME[0]} cy={HOME[1]} rx="16" ry="16" fill="#4C4FE0" opacity="0.25" />
          </svg>
        </div>

        <div
          aria-hidden="true"
          className="absolute z-[3] -translate-x-1/2 -translate-y-1/2"
          style={markerStyle(CLINIC[0], CLINIC[1])}
        >
          <div className="flex flex-col items-center gap-1">
            <span className="rounded-[7px] bg-white px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-[#4C4FE0] shadow-[0_6px_14px_-8px_rgba(14,18,34,0.5)]">Clinic</span>
            <span className="grid size-[26px] place-items-center rounded-full border-[3px] border-[#C9CCF8] bg-white">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4C4FE0" strokeWidth="4" strokeLinecap="round">
                <path d="M5 12h14M12 5v14" />
              </svg>
            </span>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="h30-nearby absolute z-[3] -translate-x-1/2 -translate-y-1/2"
          style={markerStyle(NEARBY[0]![0], NEARBY[0]![1])}
        >
          <div className="relative size-[30px]">
            <span className="h30-ping bg-emerald-400/35" />
            <span className="relative grid size-[30px] place-items-center rounded-full border-2 border-white bg-[#E3F6EC] text-[10px] font-bold text-[#1C7A50] shadow-[0_8px_18px_-8px_rgba(14,18,34,0.5)]">RD</span>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="h30-nearby absolute z-[3] -translate-x-1/2 -translate-y-1/2"
          style={markerStyle(NEARBY[1]![0], NEARBY[1]![1])}
        >
          <div className="relative size-[30px]">
            <span className="h30-ping h30-ping2 bg-emerald-400/35" />
            <span className="relative grid size-[30px] place-items-center rounded-full border-2 border-white bg-[#E4F2FF] text-[10px] font-bold text-[#1F5F9E] shadow-[0_8px_18px_-8px_rgba(14,18,34,0.5)]">PM</span>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="h30-bob absolute z-[4] -translate-x-1/2 -translate-y-full"
          style={home}
        >
          <div className="flex flex-col items-center">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#0E1222] px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white shadow-[0_12px_24px_-10px_rgba(14,18,34,0.6)]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11 12 4l9 7" />
                <path d="M5 10v10h14V10" />
              </svg>
              Your home
            </span>
            <span className="h-[18px] w-0.5 bg-[#0E1222]" />
            <span className="-mt-0.5 size-2.5 rounded-full bg-[#0E1222] shadow-[0_0_0_5px_rgba(76,79,224,0.25)]" />
          </div>
        </div>
        <div
          aria-hidden="true"
          className="absolute z-[5]"
          style={{
            left: car.left,
            top: car.top,
            transform: 'translate(-50%, -50%)',
            transition: jump ? 'none' : 'left 1s linear, top 1s linear',
          }}
        >
          <DoctorCarMarker heading={carHeading} jump={jump} night={night} />
        </div>

        <div className="absolute top-4 right-4 left-4 z-[6] flex flex-wrap items-start justify-between gap-2.5">
          <div
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3 py-2 text-[12.5px] font-semibold shadow-[0_10px_24px_-16px_rgba(14,18,34,0.4)]',
              night
                ? 'border border-[#4A5588] bg-[#12162e]/92 text-white'
                : 'border border-white bg-white/92 text-[#3B4155]',
            )}
          >
            <span className="h30-blink size-[7px] rounded-full bg-[#34D399]" />
            Live preview · Malviya Nagar, Delhi
          </div>
          <div
            role="group"
            aria-label="Map theme"
            className={cn(
              'flex rounded-xl p-[3px] shadow-[0_10px_24px_-16px_rgba(14,18,34,0.4)]',
              night ? 'border border-[#4A5588] bg-[#12162e]/92' : 'border border-white bg-white/92',
            )}
          >
            <button type="button" aria-pressed={!night} onClick={() => setTheme('day')} className={cn(seg, night ? 'bg-transparent text-[#3B4155] opacity-75' : 'bg-[#0E1222] text-white')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
              Day
            </button>
            <button type="button" aria-pressed={night} onClick={() => setTheme('night')} className={cn(seg, night ? 'bg-[#0E1222] text-white' : 'bg-transparent text-[#3B4155] opacity-75')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
              Night
            </button>
          </div>
        </div>

        <div aria-live="polite" className="absolute top-[66px] left-4 z-[6] max-w-[290px]">
          <div
            key={toast.title}
            className={cn(
              'h30-pop flex items-center gap-2.5 rounded-2xl px-3 py-2.5 shadow-[0_18px_36px_-18px_rgba(14,18,34,0.5)]',
              night ? 'border border-[#4A5588] bg-[#12162e]/95' : 'border border-white bg-white/96',
            )}
          >
            <span aria-hidden="true" className="grid size-[30px] shrink-0 place-items-center rounded-[10px]" style={{ background: toast.bg, color: toast.fg }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d={toast.d} />
              </svg>
            </span>
            <span>
              <span className={cn('block text-[13px] font-semibold', night ? 'text-white' : 'text-[#0E1222]')}>{toast.title}</span>
              <span className={cn('block text-[11.5px]', night ? 'text-[#B8BFD4]' : 'text-[#6B7186]')}>{toast.sub}</span>
            </span>
          </div>
        </div>

        <div
          className={cn(
            'h30-fa absolute top-[70px] right-4 z-[6] w-[236px] rounded-[22px] p-4 shadow-[0_30px_60px_-30px_rgba(40,40,110,0.6)] backdrop-blur-[14px]',
            night ? 'border border-[#4A5588] bg-[#12162e]/95' : 'border border-white bg-white/95',
          )}
        >
          <div className="flex items-center gap-3.5">
            <div className="relative size-[66px] shrink-0">
              <svg width="66" height="66" viewBox="0 0 64 64" aria-hidden="true">
                <defs>
                  <linearGradient id="h30-rgb2" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#4C4FE0" />
                    <stop offset="1" stopColor="#8C7AF5" />
                  </linearGradient>
                </defs>
                <circle cx="32" cy="32" r="27" fill="none" stroke="#EEEDFF" strokeWidth="6" />
                <circle
                  cx="32"
                  cy="32"
                  r="27"
                  fill="none"
                  stroke="url(#h30-rgb2)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray="169.6"
                  strokeDashoffset={(169.6 * (1 - f)).toFixed(1)}
                  transform="rotate(-90 32 32)"
                  style={{ transition: jump ? 'none' : 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                <span className="text-xl font-bold tabular-nums">{arrived ? '✓' : String(mins)}</span>
                <span className={cn('text-[9.5px] font-bold tracking-[0.06em]', night ? 'text-[#B8BFD4]' : 'text-[#6B7186]')}>
                {arrived ? 'HERE' : 'MIN'}
              </span>
            </span>
            </div>
            <div className="min-w-0">
              <div className={cn('text-[12.5px] font-semibold', night ? 'text-[#B8BFD4]' : 'text-[#6B7186]')}>
                {arrived ? 'Dr. Rao is' : 'Arriving in about'}
              </div>
              <div className={cn('text-xl leading-[1.15] font-bold tracking-[-0.03em]', night && 'text-white')}>
                {arrived ? 'At your door' : `${mins} minutes`}
              </div>
              <div className={cn('mt-0.5 text-xs', night ? 'text-[#B8BFD4]' : 'text-[#6B7186]')}>{Math.max(0.1, 1.4 * (1 - f)).toFixed(1)} km · via Press Enclave Marg</div>
            </div>
          </div>
          <div className="mt-3.5 grid grid-cols-4 gap-1">
            {stageNames.map((label, i) => {
              const done = i < stageIdx || (arrived && i === 3);
              const cur = i === stageIdx && !arrived;
              return (
                <div key={label} className="flex flex-col gap-1.5">
                  <span
                    className="block h-1 rounded"
                    style={{ background: done ? '#1C8A5A' : cur ? 'linear-gradient(90deg, #4C4FE0, #C9CCF8)' : '#E6E8EF' }}
                  />
                  <span className={cn('text-[10.5px] font-semibold whitespace-nowrap', done ? 'text-[#1C7A50]' : cur ? 'text-[#3D3FC4]' : 'text-[#8A90A3]')}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="pointer-events-none absolute bottom-[88px] left-4 z-[6] max-w-[70%] text-[10px] leading-snug text-white/85 drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]">
          {night ? 'Example area · Illustration' : 'Example area · Map data © Google'}
        </p>
        <div
          className={cn(
            'h30-fb absolute right-3 bottom-3 left-3 z-[6] flex items-center gap-3 rounded-[20px] px-3.5 py-3 shadow-[0_16px_44px_-18px_rgba(14,18,34,0.28)]',
            night ? 'border border-[#4A5588] bg-[#12162e]/95' : 'bg-white',
          )}
          role="group"
          aria-label="Example assigned doctor (preview)"
        >
          <div className="relative shrink-0">
            <img
              src="/home-visit/doctor-preview.png"
              alt=""
              width={52}
              height={52}
              className="size-[52px] rounded-full object-cover object-[center_22%] ring-1 ring-[#ECEEF4]"
            />
            <span aria-hidden="true" className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-white bg-[#22C55E]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className={cn('truncate text-[15px] font-semibold leading-tight', night ? 'text-white' : 'text-[#0E1222]')}>Dr. Ananya Rao</div>
            <div className={cn('text-[13px]', night ? 'text-[#B8BFD4]' : 'text-[#6B7186]')}>General Physician</div>
            <div className={cn('mt-0.5 flex items-center gap-1 text-[12.5px]', night ? 'text-[#B8BFD4]' : 'text-[#6B7186]')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#F5A623" aria-hidden="true">
                <path d="M12 2l2.9 6.9L22 9.8l-5.2 4.5 1.6 6.9L12 17.8 5.6 21.2 7.2 14.3 2 9.8l7.1-.9L12 2z" />
              </svg>
              <span>Example profile · Reg. checked</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled
              className="grid size-11 cursor-default place-items-center rounded-full border border-[#ECEEF4] bg-white shadow-[0_4px_14px_-6px_rgba(14,18,34,0.25)]"
              aria-label="Message (preview only)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5C6378" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
              </svg>
            </button>
            <button
              type="button"
              disabled
              className="grid size-11 cursor-default place-items-center rounded-full border border-[#ECEEF4] bg-white shadow-[0_4px_14px_-6px_rgba(14,18,34,0.25)]"
              aria-label="Call (preview only)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5C6378" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
