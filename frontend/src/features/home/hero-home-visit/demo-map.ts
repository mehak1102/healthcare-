/** Must match `map-day.jpg` (1600×1000) and SVG viewBox. */
export const VIEWBOX_W = 1600;
export const VIEWBOX_H = 1000;

/**
 * Clinic → home: traced from user red-line annotation, snapped to map roads (orthogonal).
 */
export const ROUTE: [number, number][] = [
  [1120, 540],
  [1000, 540],
  [820, 540],
  [820, 500],
  [700, 500],
  [700, 540],
  [580, 540],
  [305, 540],
  [305, 460],
];

export const CLINIC: [number, number] = [1120, 540];
export const HOME: [number, number] = [305, 460];
export const NEARBY: [number, number][] = [
  [850, 720],
  [1280, 380],
];

const SEG: number[] = [];
export let ROUTE_LEN = 0;
for (let i = 1; i < ROUTE.length; i += 1) {
  const dx = ROUTE[i]![0] - ROUTE[i - 1]![0];
  const dy = ROUTE[i]![1] - ROUTE[i - 1]![1];
  const len = Math.hypot(dx, dy);
  SEG.push(len);
  ROUTE_LEN += len;
}

export const MAP_H = 640;
export const TILT_DEG = 0;
export const TILT = (TILT_DEG * Math.PI) / 180;
export const PERSP = 1600;
export const MAP_K = 1;
export const PLANE_TOP = 0;
export const PLANE_H = MAP_H - PLANE_TOP;
export const TRIP_SECS = 30;
export const CYCLE_SECS = 36;

export function pointAt(frac: number): [number, number] {
  let d = frac * ROUTE_LEN;
  for (let i = 0; i < SEG.length; i += 1) {
    const seg = SEG[i]!;
    if (d <= seg) {
      const t = d / seg;
      return [
        ROUTE[i]![0] + (ROUTE[i + 1]![0] - ROUTE[i]![0]) * t,
        ROUTE[i]![1] + (ROUTE[i + 1]![1] - ROUTE[i]![1]) * t,
      ];
    }
    d -= seg;
  }
  return ROUTE[ROUTE.length - 1]!;
}

/** Degrees along the route in SVG space (0° = east, 90° = south). */
export function headingAt(frac: number): number {
  const eps = 0.012;
  const a = pointAt(Math.max(0, frac - eps));
  const b = pointAt(Math.min(1, frac + eps));
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** Same frame as the map SVG (percent of overlay box). */
export function mapPointPct(x: number, y: number) {
  return {
    left: `${((x / VIEWBOX_W) * 100).toFixed(3)}%`,
    top: `${((y / VIEWBOX_H) * 100).toFixed(3)}%`,
  };
}

export const WHO = ['for your parents', 'for your little one', 'when travel is hard', 'for the whole family'] as const;

export const THEMES = {
  day: {
    ground: '#F3F5FB',
    block: '#E7E6FA',
    roof: 'rgba(255,255,255,0.75)',
    lights: 'rgba(0,0,0,0)',
    park: '#DDF5E8',
    tree: '#BFE8D2',
    water: '#D9EEFC',
    wave: '#C3E3F8',
    roadEdge: '#E1E5F0',
    road: '#FFFFFF',
    lane: '#EEF0F7',
    routeDash: '#B9BBF5',
    glowOp: 0.2,
    fog: '#F3F5FB',
    sky: 'linear-gradient(180deg, #E4EEFF 0%, #F1EEFF 30%, #FFF1EA 42%, #F3F5FB 58%)',
    cardBorder: '#FFFFFF',
    inset: 'rgba(255,255,255,0.6)',
  },
  night: {
    ground: '#0E1330',
    block: '#171D45',
    roof: '#1F2656',
    lights: '#FFD27A',
    park: '#123A35',
    tree: '#1B5148',
    water: '#0F2A4A',
    wave: '#1B3D66',
    roadEdge: '#0A0E26',
    road: '#252C5E',
    lane: '#3A4280',
    routeDash: '#4A4FA8',
    glowOp: 0.55,
    fog: '#0E1330',
    sky: 'linear-gradient(180deg, #070A22 0%, #141A48 30%, #1E2560 45%, #0E1330 60%)',
    cardBorder: '#2A3170',
    inset: 'rgba(255,255,255,0.04)',
  },
} as const;

export type MapTheme = keyof typeof THEMES;

export function defaultTheme(): MapTheme {
  const h = new Date().getHours();
  return h >= 19 || h < 6 ? 'night' : 'day';
}

export const PILOT_CITY = 'Bengaluru';
