import { useMemo, useState, type MouseEvent } from 'react';
import { cn } from '@/lib/cn';
import {
  CYCLE_SECS,
  MAP_K,
  PERSP,
  PLANE_H,
  PLANE_TOP,
  ROUTE_LEN,
  THEMES,
  TILT_DEG,
  TRIP_SECS,
  pointAt,
  projectToPlane,
  type MapTheme,
} from './demo-map';

const STARS = [
  { left: '12%', top: '6%', delay: '0s' },
  { left: '30%', top: '12%', delay: '0.8s' },
  { left: '52%', top: '5%', delay: '1.6s' },
  { left: '70%', top: '14%', delay: '0.4s' },
  { left: '86%', top: '7%', delay: '2.2s' },
  { left: '42%', top: '18%', delay: '1.2s' },
];

function markerStyle(x: number, y: number) {
  const p = projectToPlane(x, y);
  return {
    left: `${p.leftPct.toFixed(2)}%`,
    top: `${p.topPx.toFixed(1)}px`,
  };
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
  const car = projectToPlane(pt[0], pt[1]);
  const home = projectToPlane(520, 120);
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

  const roads = 'M-20 120H620M-20 200H620M-20 340H620M-20 480H620M90 -20V580M250 -20V580M430 -20V350M520 -20V350';
  const route = 'M90 480V340H250V200H430V120H520';
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
        <div aria-hidden="true" className="absolute inset-0 transition-[background] duration-700" style={{ background: c.sky }} />
        <div aria-hidden="true" className="absolute top-0 right-0 left-0 h-[140px] transition-opacity duration-700" style={{ opacity: night ? 1 : 0 }}>
          {STARS.map((s) => (
            <span key={s.left} className="h30-star" style={{ left: s.left, top: s.top, animationDelay: s.delay }} />
          ))}
        </div>
        <div
          aria-hidden="true"
          className="absolute top-[34px] right-[28%] size-[46px] rounded-full transition-all duration-700"
          style={
            night
              ? { background: 'radial-gradient(circle at 35% 35%, #FFFFFF, #E3E6FF 60%, #B8BEF0)', boxShadow: '0 0 40px 12px rgba(201,204,248,0.35)' }
              : { background: 'radial-gradient(circle at 40% 40%, #FFF6C9, #FFC75A 60%, #FF9F43)', boxShadow: '0 0 60px 20px rgba(255,190,90,0.45)' }
          }
        />

        <div
          aria-hidden="true"
          className="absolute right-0 left-0"
          style={{
            top: PLANE_TOP,
            height: PLANE_H,
            transformOrigin: '50% 50%',
            transform: `perspective(${PERSP}px) rotateX(${TILT_DEG}deg) scale(${MAP_K})`,
          }}
        >
          <svg viewBox="0 0 600 560" preserveAspectRatio="none" className="block size-full">
            <defs>
              <linearGradient id="h30-rgb" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0" stopColor="#4C4FE0" />
                <stop offset="1" stopColor="#8C7AF5" />
              </linearGradient>
              <filter id="h30-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="7" />
              </filter>
            </defs>
            <rect width="600" height="560" fill={c.ground} />
            <g fill={c.block}>
              <rect x="0" y="0" width="76" height="106" rx="12" />
              <rect x="104" y="0" width="132" height="106" rx="12" />
              <rect x="264" y="0" width="152" height="106" rx="12" />
              <rect x="444" y="0" width="62" height="106" rx="12" />
              <rect x="534" y="0" width="66" height="106" rx="12" />
              <rect x="0" y="134" width="76" height="52" rx="12" />
              <rect x="104" y="134" width="132" height="52" rx="12" />
              <rect x="264" y="134" width="152" height="52" rx="12" />
              <rect x="534" y="134" width="66" height="52" rx="12" />
              <rect x="0" y="214" width="76" height="112" rx="12" />
              <rect x="104" y="214" width="132" height="112" rx="12" />
              <rect x="444" y="214" width="156" height="112" rx="12" />
              <rect x="0" y="354" width="76" height="112" rx="12" />
              <rect x="104" y="354" width="132" height="112" rx="12" />
              <rect x="0" y="494" width="76" height="66" rx="12" />
              <rect x="104" y="494" width="132" height="66" rx="12" />
              <rect x="264" y="494" width="336" height="66" rx="12" />
            </g>
            <g fill={c.roof}>
              <rect x="116" y="18" width="40" height="30" rx="6" />
              <rect x="168" y="18" width="56" height="30" rx="6" />
              <rect x="280" y="22" width="60" height="70" rx="8" />
              <rect x="350" y="22" width="50" height="34" rx="6" />
              <rect x="116" y="232" width="50" height="40" rx="6" />
              <rect x="176" y="232" width="48" height="76" rx="6" />
              <rect x="460" y="232" width="60" height="44" rx="6" />
              <rect x="530" y="232" width="56" height="78" rx="6" />
              <rect x="116" y="370" width="104" height="40" rx="6" />
              <rect x="12" y="230" width="52" height="40" rx="6" />
              <rect x="12" y="370" width="52" height="80" rx="6" />
            </g>
            <g fill={c.lights}>
              <circle cx="130" cy="34" r="2.5" />
              <circle cx="190" cy="30" r="2.5" />
              <circle cx="300" cy="50" r="2.5" />
              <circle cx="374" cy="38" r="2.5" />
              <circle cx="140" cy="250" r="2.5" />
              <circle cx="198" cy="270" r="2.5" />
              <circle cx="488" cy="250" r="2.5" />
              <circle cx="556" cy="282" r="2.5" />
              <circle cx="160" cy="388" r="2.5" />
              <circle cx="36" cy="400" r="2.5" />
            </g>
            <rect x="264" y="214" width="152" height="112" rx="14" fill={c.park} />
            <g fill={c.tree}>
              <circle cx="296" cy="246" r="12" />
              <circle cx="330" cy="272" r="15" />
              <circle cx="372" cy="244" r="11" />
              <circle cx="390" cy="296" r="13" />
              <circle cx="300" cy="300" r="10" />
            </g>
            <path d="M264 354h336v112H300c-20 0-36-16-36-36z" fill={c.water} />
            <path d="M300 410c30-10 60 10 90 0s60-10 90 0 60 10 90 0" stroke={c.wave} strokeWidth="3" fill="none" strokeLinecap="round" />
            <g stroke={c.roadEdge} strokeWidth="26" strokeLinecap="round" fill="none">
              <path d={roads} />
            </g>
            <g stroke={c.road} strokeWidth="20" strokeLinecap="round" fill="none">
              <path d={roads} />
            </g>
            <g stroke={c.lane} strokeWidth="2" strokeDasharray="10 12" fill="none">
              <path d="M-20 340H620M250 -20V580" />
            </g>
            <path d={route} fill="none" stroke="#6E70F0" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" opacity={c.glowOp} filter="url(#h30-glow)" />
            <path className="h30-flow" d={route} fill="none" stroke={c.routeDash} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 12" />
            <path
              d={route}
              fill="none"
              stroke="url(#h30-rgb)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={ROUTE_LEN.toFixed(0)}
              strokeDashoffset={(ROUTE_LEN * (1 - f)).toFixed(1)}
              style={{ transition: jump ? 'none' : 'stroke-dashoffset 1s linear' }}
            />
            <circle cx="520" cy="120" r="34" fill="#4C4FE0" opacity="0.12" />
            <ellipse cx="520" cy="120" rx="16" ry="16" fill="#4C4FE0" opacity="0.25" />
          </svg>
          <div className="pointer-events-none absolute top-0 right-0 left-0 h-[45%]" style={{ background: `linear-gradient(180deg, ${c.fog} 0%, transparent 100%)` }} />
        </div>

        <div aria-hidden="true" className="absolute z-[3] -translate-x-1/2 -translate-y-1/2" style={markerStyle(90, 480)}>
          <div className="flex flex-col items-center gap-1">
            <span className="rounded-[7px] bg-white px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-[#4C4FE0] shadow-[0_6px_14px_-8px_rgba(14,18,34,0.5)]">Clinic</span>
            <span className="grid size-[26px] place-items-center rounded-full border-[3px] border-[#C9CCF8] bg-white">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4C4FE0" strokeWidth="4" strokeLinecap="round">
                <path d="M5 12h14M12 5v14" />
              </svg>
            </span>
          </div>
        </div>
        <div aria-hidden="true" className="h30-nearby absolute z-[3] -translate-x-1/2 -translate-y-1/2" style={markerStyle(180, 270)}>
          <div className="relative size-[30px]">
            <span className="h30-ping bg-emerald-400/35" />
            <span className="relative grid size-[30px] place-items-center rounded-full border-2 border-white bg-[#E3F6EC] text-[10px] font-bold text-[#1C7A50] shadow-[0_8px_18px_-8px_rgba(14,18,34,0.5)]">RD</span>
          </div>
        </div>
        <div aria-hidden="true" className="h30-nearby absolute z-[3] -translate-x-1/2 -translate-y-1/2" style={markerStyle(470, 270)}>
          <div className="relative size-[30px]">
            <span className="h30-ping h30-ping2 bg-emerald-400/35" />
            <span className="relative grid size-[30px] place-items-center rounded-full border-2 border-white bg-[#E4F2FF] text-[10px] font-bold text-[#1F5F9E] shadow-[0_8px_18px_-8px_rgba(14,18,34,0.5)]">PM</span>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="h30-bob absolute z-[4]"
          style={{ left: `${home.leftPct.toFixed(2)}%`, top: `${(home.topPx + 4).toFixed(1)}px` }}
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
          className="absolute z-[5] -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${car.leftPct.toFixed(2)}%`,
            top: `${car.topPx.toFixed(1)}px`,
            transition: jump ? 'none' : 'left 1s linear, top 1s linear',
          }}
        >
          <div className="relative size-[46px]">
            <span className="h30-ping bg-indigo-500/30" />
            <span className="relative grid size-[46px] place-items-center rounded-full border-[3px] border-white bg-linear-to-br from-[#5B5EF2] to-[#8C7AF5] shadow-[0_14px_28px_-10px_rgba(76,79,224,0.8)]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="5.5" cy="17" r="2.6" />
                <circle cx="18.5" cy="17" r="2.6" />
                <path d="M8 17h7l2.5-6H13M17.5 11 16 7h-3M4 14l3-4h5" />
              </svg>
            </span>
          </div>
        </div>

        <div className="absolute top-4 right-4 left-4 z-[6] flex flex-wrap items-start justify-between gap-2.5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white bg-white/92 px-3 py-2 text-[12.5px] font-semibold text-[#3B4155] shadow-[0_10px_24px_-16px_rgba(14,18,34,0.4)]">
            <span className="h30-blink size-[7px] rounded-full bg-[#34D399]" />
            Live preview · example
          </div>
          <div role="group" aria-label="Map theme" className="flex rounded-xl border border-white bg-white/92 p-[3px] shadow-[0_10px_24px_-16px_rgba(14,18,34,0.4)]">
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
          <div key={toast.title} className="h30-pop flex items-center gap-2.5 rounded-2xl border border-white bg-white/96 px-3 py-2.5 shadow-[0_18px_36px_-18px_rgba(14,18,34,0.5)]">
            <span aria-hidden="true" className="grid size-[30px] shrink-0 place-items-center rounded-[10px]" style={{ background: toast.bg, color: toast.fg }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d={toast.d} />
              </svg>
            </span>
            <span>
              <span className="block text-[13px] font-semibold text-[#0E1222]">{toast.title}</span>
              <span className="block text-[11.5px] text-[#6B7186]">{toast.sub}</span>
            </span>
          </div>
        </div>

        <div className="h30-fa absolute top-[70px] right-4 z-[6] w-[236px] rounded-[22px] border border-white bg-white/95 p-4 shadow-[0_30px_60px_-30px_rgba(40,40,110,0.6)] backdrop-blur-[14px]">
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
                <span className="text-[9.5px] font-bold tracking-[0.06em] text-[#6B7186]">{arrived ? 'HERE' : 'MIN'}</span>
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold text-[#6B7186]">{arrived ? 'Dr. Rao is' : 'Arriving in about'}</div>
              <div className="text-xl leading-[1.15] font-bold tracking-[-0.03em]">{arrived ? 'At your door' : `${mins} minutes`}</div>
              <div className="mt-0.5 text-xs text-[#6B7186]">{Math.max(0.1, 6.2 * (1 - f)).toFixed(1)} km · via Main Rd</div>
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

        <div className="h30-fb absolute right-4 bottom-4 left-4 z-[6] flex items-center gap-3.5 rounded-[22px] border border-white bg-white/96 px-4 py-3.5 shadow-[0_30px_60px_-30px_rgba(40,40,110,0.6)] backdrop-blur-[14px]">
          <span aria-hidden="true" className="grid size-[52px] shrink-0 place-items-center rounded-2xl bg-linear-to-br from-[#FFEFE6] to-[#FFD9C4] text-base font-bold text-[#9A4521]">
            AR
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-base font-semibold">
              Dr. Ananya Rao
              <svg width="15" height="15" viewBox="0 0 24 24" role="img" aria-label="Verified">
                <circle cx="12" cy="12" r="10" fill="#4C4FE0" />
                <path d="m8 12.5 2.6 2.5L16 9.5" stroke="#FFFFFF" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="block text-[13px] text-[#6B7186]">General physician · MBBS, MD · Reg. checked</span>
          </span>
          <span aria-hidden="true" className="flex gap-2">
            <span className="grid size-[42px] place-items-center rounded-[13px] bg-[#EEEDFF]">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4C4FE0" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
              </svg>
            </span>
            <span className="grid size-[42px] place-items-center rounded-[13px] bg-[#0E1222]">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
              </svg>
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
