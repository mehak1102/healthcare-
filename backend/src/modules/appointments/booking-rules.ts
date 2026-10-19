/** How long an unpaid booking holds its slot while the patient completes payment. */
export const HOLD_MINUTES = 10;
/** Slots starting sooner than this are not offered. */
export const MIN_NOTICE_MINUTES = 30;
/** How far ahead patients can book, in India calendar days including today. */
export const BOOKING_WINDOW_DAYS = 30;
export const MAX_SLOT_DAYS_PER_REQUEST = 14;
/** Unpaid bookings a patient may have at once, so nobody can block a doctor's diary. */
export const MAX_PENDING_PAYMENTS = 2;
/** Default: join from this many minutes before start until the slot ends. */
export const VIDEO_JOIN_EARLY_MINUTES = 5;

export interface VideoJoinSettings {
  /** Development only: join as soon as the booking is accepted, until it ends. */
  joinAnytime: boolean;
  earlyMinutes: number;
}

export function videoOpensAt(startsAt: Date, earlyMinutes = VIDEO_JOIN_EARLY_MINUTES): Date {
  return new Date(startsAt.getTime() - earlyMinutes * 60_000);
}

/** When the patient/doctor UI may show the join control (server still enforces join on POST). */
export function clientVideoOpensAt(
  appointment: {
    mode: string;
    status: string;
    startsAt: Date;
    endsAt: Date;
    confirmedAt: Date | null;
  },
  now: Date,
  settings: VideoJoinSettings,
): Date | null {
  if (appointment.mode !== 'online' || appointment.status !== 'confirmed' || now >= appointment.endsAt) {
    return null;
  }
  if (settings.joinAnytime && appointment.confirmedAt) {
    return appointment.confirmedAt;
  }
  return videoOpensAt(appointment.startsAt, settings.earlyMinutes);
}
