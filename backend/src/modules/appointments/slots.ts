import type { ConsultationMode } from '../doctors/doctor-profile.schema';
import { addDays, istInstant, istWeekday, isValidTime, minutesOf } from './ist-time';

export const SLOT_LENGTHS = [10, 15, 20, 30, 45, 60] as const;
export type SlotLength = (typeof SLOT_LENGTHS)[number];

export interface WeeklyRule {
  /** 0 = Sunday … 6 = Saturday, India time. */
  day: number;
  /** "HH:mm" India time; a block never crosses midnight. */
  start: string;
  end: string;
  slotMinutes: number;
  mode: ConsultationMode;
}

export interface OneOffRule {
  /** India calendar date YYYY-MM-DD. */
  date: string;
  start: string;
  end: string;
  slotMinutes: number;
  mode: ConsultationMode;
}

export interface Slot {
  startsAt: Date;
  endsAt: Date;
  mode: ConsultationMode;
}

export interface Interval {
  startsAt: Date;
  endsAt: Date;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Human-readable problems with a weekly timetable; empty when it is usable. */
export function scheduleProblems(rules: readonly WeeklyRule[]): string[] {
  const problems: string[] = [];
  const valid: { day: number; start: number; end: number; label: string }[] = [];

  rules.forEach((rule, index) => {
    const label = `${DAY_NAMES[rule.day] ?? 'Unknown day'} ${rule.start}–${rule.end}`;
    if (!isValidTime(rule.start) || !isValidTime(rule.end)) {
      problems.push(`Block ${index + 1}: times must be HH:mm`);
      return;
    }
    const start = minutesOf(rule.start);
    const end = minutesOf(rule.end);
    if (start % 5 !== 0 || end % 5 !== 0) {
      problems.push(`${label}: times must be on a 5-minute boundary`);
      return;
    }
    if (end <= start) {
      problems.push(`${label}: must end after it starts, on the same day`);
      return;
    }
    if (end - start < rule.slotMinutes) {
      problems.push(`${label}: is shorter than one ${rule.slotMinutes}-minute appointment`);
      return;
    }
    valid.push({ day: rule.day, start, end, label });
  });

  const sorted = [...valid].sort((a, b) => a.day - b.day || a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1]!;
    const current = sorted[i]!;
    if (previous.day === current.day && current.start < previous.end) {
      problems.push(`${previous.label} overlaps ${current.label}`);
    }
  }
  return problems;
}

function blockTimeProblems(
  label: string,
  start: string,
  end: string,
  slotMinutes: number,
): string[] {
  const problems: string[] = [];
  if (!isValidTime(start) || !isValidTime(end)) {
    problems.push(`${label}: times must be HH:mm`);
    return problems;
  }
  const startMin = minutesOf(start);
  const endMin = minutesOf(end);
  if (startMin % 5 !== 0 || endMin % 5 !== 0) {
    problems.push(`${label}: times must be on a 5-minute boundary`);
  }
  if (endMin <= startMin) {
    problems.push(`${label}: must end after it starts, on the same day`);
  }
  if (endMin - startMin < slotMinutes) {
    problems.push(`${label}: is shorter than one ${slotMinutes}-minute appointment`);
  }
  return problems;
}

/** Validates one-off extra hours; empty when usable. */
export function extraBlockProblems(blocks: readonly OneOffRule[]): string[] {
  const problems: string[] = [];
  const valid: { date: string; start: number; end: number; label: string }[] = [];

  blocks.forEach((block, index) => {
    const label = `${block.date} ${block.start}–${block.end}`;
    const timeProblems = blockTimeProblems(
      `Extra block ${index + 1}`,
      block.start,
      block.end,
      block.slotMinutes,
    );
    if (timeProblems.length > 0) {
      problems.push(...timeProblems);
      return;
    }
    const start = minutesOf(block.start);
    const end = minutesOf(block.end);
    valid.push({ date: block.date, start, end, label });
  });

  const sorted = [...valid].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start - b.start,
  );
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1]!;
    const current = sorted[i]!;
    if (previous.date === current.date && current.start < previous.end) {
      problems.push(`${previous.label} overlaps ${current.label}`);
    }
  }
  return problems;
}

function slotsForBlock(
  date: string,
  rule: Pick<WeeklyRule, 'start' | 'end' | 'slotMinutes' | 'mode'>,
  input: { notBefore: Date; busy: readonly Interval[] },
): Slot[] {
  const slots: Slot[] = [];
  const end = minutesOf(rule.end);
  for (
    let start = minutesOf(rule.start);
    start + rule.slotMinutes <= end;
    start += rule.slotMinutes
  ) {
    const slot: Slot = {
      startsAt: istInstant(date, start),
      endsAt: istInstant(date, start + rule.slotMinutes),
      mode: rule.mode,
    };
    if (slot.startsAt < input.notBefore) continue;
    if (input.busy.some((busy) => overlaps(slot, busy))) continue;
    slots.push(slot);
  }
  return slots;
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.startsAt < b.endsAt && a.endsAt > b.startsAt;
}

/**
 * Bookable slots for `days` India calendar days starting at `from`. Slots starting before
 * `notBefore`, on days off, or overlapping a busy interval are left out. Slots that do not fit
 * completely inside a block are dropped rather than shortened.
 */
export function generateSlots(input: {
  rules: readonly WeeklyRule[];
  extraBlocks?: readonly OneOffRule[];
  daysOff: readonly string[];
  from: string;
  days: number;
  notBefore: Date;
  busy: readonly Interval[];
  modes?: readonly ConsultationMode[];
}): { date: string; slots: Slot[] }[] {
  const daysOff = new Set(input.daysOff);
  const result: { date: string; slots: Slot[] }[] = [];

  for (let offset = 0; offset < input.days; offset++) {
    const date = addDays(input.from, offset);
    const slots: Slot[] = [];
    if (!daysOff.has(date)) {
      const weekday = istWeekday(date);
      for (const rule of input.rules) {
        if (rule.day !== weekday) continue;
        if (input.modes && !input.modes.includes(rule.mode)) continue;
        slots.push(...slotsForBlock(date, rule, input));
      }
      for (const rule of input.extraBlocks ?? []) {
        if (rule.date !== date) continue;
        if (input.modes && !input.modes.includes(rule.mode)) continue;
        slots.push(...slotsForBlock(date, rule, input));
      }
    }
    slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    result.push({ date, slots });
  }
  return result;
}
