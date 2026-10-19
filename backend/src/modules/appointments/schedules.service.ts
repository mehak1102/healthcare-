import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type ClientSession, Model, Types } from 'mongoose';
import { apiError } from '../../common/http/api-error';
import type { RequestMeta } from '../../common/http/app-request';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import {
  acceptsNewBookings,
  type ConsultationMode,
  type DoctorProfileDocument,
} from '../doctors/doctor-profile.schema';
import { DoctorProfilesService } from '../doctors/doctor-profiles.service';
import { InjectPaymentGateway, type PaymentGateway } from '../payments/payment-gateway';
import { InjectVideoGateway, type VideoGateway } from '../video/video-gateway';
import { firstBookableDate } from './availability-when';
import type { SlotFilterOptions } from './slot-filter-options';
import { isNextAvailableCacheFresh } from './next-available-cache';
import { BOOKING_WINDOW_DAYS, MIN_NOTICE_MINUTES } from './booking-rules';
import { DoctorSchedule, type DoctorScheduleDocument } from './doctor-schedule.schema';
import type { SlotsQueryDto, UpdateScheduleDto } from './dto/schedule.dto';
import { addDays, istDate, istInstant, isValidIstDate } from './ist-time';
import { SlotReservation } from './slot-reservation.schema';
import {
  extraBlockProblems,
  generateSlots,
  scheduleProblems,
  type Interval,
  type Slot,
} from './slots';

const invalid = (details: string[]) =>
  new BadRequestException(apiError('SCHEDULE_INVALID', 'Please fix your timetable.', details));

/** Modes patients may book right now for a doctor offering `offered`. */
export function bookableModes(
  offered: readonly ConsultationMode[],
  videoAvailable: boolean,
): ConsultationMode[] {
  return offered.filter((mode) => mode !== 'online' || videoAvailable);
}

@Injectable()
export class SchedulesService {
  constructor(
    @InjectModel(DoctorSchedule.name) private readonly schedules: Model<DoctorSchedule>,
    @InjectModel(SlotReservation.name) private readonly reservations: Model<SlotReservation>,
    private readonly profiles: DoctorProfilesService,
    private readonly audit: AuditService,
    @InjectPaymentGateway() private readonly gateway: PaymentGateway,
    @InjectVideoGateway() private readonly video: VideoGateway,
  ) {}

  /** Whether patients can book video consultations at all right now. */
  get onlineBookingOpen(): boolean {
    return this.video.available;
  }

  findMine(userId: string): Promise<DoctorScheduleDocument | null> {
    return this.schedules.findOne({ doctorUserId: new Types.ObjectId(userId) }).exec();
  }

  async updateMine(
    auth: AuthContext,
    input: UpdateScheduleDto,
    meta: RequestMeta,
  ): Promise<DoctorScheduleDocument> {
    const profile = await this.profiles.findMine(auth.userId);
    const extraBlocks = input.extraBlocks ?? [];
    const problems = scheduleProblems(input.rules);
    problems.push(...extraBlockProblems(extraBlocks));
    for (const mode of new Set([
      ...input.rules.map((rule) => rule.mode),
      ...extraBlocks.map((block) => block.mode),
    ])) {
      if (!profile.consultationModes.includes(mode)) {
        problems.push(
          `Your profile does not offer ${mode === 'online' ? 'video consultations' : 'in-clinic visits'}; add it to your profile first`,
        );
      }
    }
    const today = istDate(new Date());
    for (const day of input.daysOff) {
      if (!isValidIstDate(day)) problems.push(`${day} is not a real date`);
    }
    for (const block of extraBlocks) {
      if (!isValidIstDate(block.date)) problems.push(`${block.date} is not a real date`);
    }
    if (problems.length > 0) throw invalid(problems);

    const rules = [...input.rules].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
    const daysOff = input.daysOff.filter((day) => day >= today).sort();
    const sortedExtra = [...extraBlocks]
      .filter((block) => block.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
    const schedule = await this.schedules
      .findOneAndUpdate(
        { doctorUserId: new Types.ObjectId(auth.userId) },
        { $set: { rules, daysOff, extraBlocks: sortedExtra } },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();
    await this.audit.record({
      action: 'doctor_schedule.update',
      outcome: 'success',
      actorUserId: auth.userId,
      targetType: 'doctor_schedule',
      targetId: schedule.id,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      metadata: { blocks: rules.length, extraBlocks: sortedExtra.length, daysOff: daysOff.length },
    });
    await this.refreshNextAvailableCache(profile);
    return schedule;
  }

  /** Recomputes and stores the next bookable IST date on the doctor profile. */
  async refreshNextAvailableCache(profile: DoctorProfileDocument, now = new Date()): Promise<string | null> {
    if (!acceptsNewBookings(profile.availabilityStatus)) {
      await this.profiles.saveNextAvailableCache(profile.userId, null);
      return null;
    }
    const date = await this.nextAvailableDateFor(profile, { now });
    await this.profiles.saveNextAvailableCache(profile.userId, date);
    profile.nextAvailableDate = date;
    profile.nextAvailableDateAt = now;
    return date;
  }

  /** Uses the profile cache when fresh; otherwise recomputes (not mode- or availWhen-specific). */
  async nextAvailableDateForDirectory(
    profile: DoctorProfileDocument,
    options: SlotFilterOptions = {},
  ): Promise<string | null> {
    const now = options.now ?? new Date();
    if (options.mode || options.availWhen) {
      return this.nextAvailableDateFor(profile, options);
    }
    const today = istDate(now);
    if (isNextAvailableCacheFresh(profile, today)) {
      return profile.nextAvailableDate;
    }
    return this.refreshNextAvailableCache(profile, now);
  }

  async nextAvailableDatesForDirectory(
    profiles: DoctorProfileDocument[],
    options: SlotFilterOptions = {},
  ): Promise<Map<string, string | null>> {
    if (options.mode || options.availWhen) {
      return this.nextAvailableDatesFor(profiles, options);
    }
    const result = new Map<string, string | null>();
    for (const profile of profiles) {
      result.set(profile.slug, await this.nextAvailableDateForDirectory(profile, options));
    }
    return result;
  }

  /** Public list of free slots for a listed doctor. */
  async slotsFor(slug: string, query: SlotsQueryDto, now = new Date()) {
    const profile = await this.profiles.findPublicBySlug(slug);
    const today = istDate(now);
    const lastDay = addDays(today, BOOKING_WINDOW_DAYS - 1);
    if (!acceptsNewBookings(profile.availabilityStatus)) {
      const requested = query.from ?? today;
      const from =
        isValidIstDate(requested) && requested >= today && requested <= lastDay ? requested : today;
      const offset = this.daysBetween(today, from);
      const count = Math.min(query.days, Math.max(BOOKING_WINDOW_DAYS - offset, 0));
      return {
        feeInr: profile.consultationFeeInr,
        bookableUntil: lastDay,
        unavailableReason: 'not_accepting' as const,
        nextAvailableDate: null,
        days: Array.from({ length: count }, (_, i) => ({
          date: addDays(from, i),
          slots: [] as Slot[],
        })),
      };
    }
    const from = query.from ?? today;
    if (!isValidIstDate(from) || from < today || from > lastDay) {
      throw new BadRequestException(
        apiError('VALIDATION_FAILED', 'The request is invalid.', [
          `from must be between ${today} and ${lastDay}`,
        ]),
      );
    }
    const offset = this.daysBetween(today, from);
    const count = Math.min(query.days, BOOKING_WINDOW_DAYS - offset);
    const window = await this.freeSlots(profile, today, BOOKING_WINDOW_DAYS, now);
    const hasTimetable = window.length > 0;
    const paid = (profile.consultationFeeInr ?? 0) > 0;
    return {
      feeInr: profile.consultationFeeInr,
      bookableUntil: lastDay,
      unavailableReason: !hasTimetable
        ? ('no_timetable' as const)
        : paid && !this.gateway.available
          ? ('payments_unavailable' as const)
          : null,
      nextAvailableDate: window.find((day) => day.slots.length > 0)?.date ?? null,
      days: hasTimetable
        ? window.slice(offset, offset + count)
        : Array.from({ length: count }, (_, i) => ({
            date: addDays(from, i),
            slots: [] as Slot[],
          })),
    };
  }

  /**
   * Whether `startsAt` is a slot the doctor's timetable currently offers in `mode` and inside the
   * booking window. Does not check other bookings; the booking transaction does that.
   */
  async findOfferedSlot(
    profile: DoctorProfileDocument,
    startsAt: Date,
    mode: ConsultationMode,
    now: Date,
  ): Promise<Slot | null> {
    const date = istDate(startsAt);
    const today = istDate(now);
    if (date < today || date > addDays(today, BOOKING_WINDOW_DAYS - 1)) return null;
    const schedule = await this.schedules.findOne({ doctorUserId: profile.userId }).exec();
    if (!schedule) return null;
    const [day] = generateSlots({
      rules: schedule.rules,
      extraBlocks: schedule.extraBlocks,
      daysOff: schedule.daysOff,
      from: date,
      days: 1,
      notBefore: this.notBefore(now),
      busy: [],
      modes: [mode],
    });
    return day?.slots.find((slot) => slot.startsAt.getTime() === startsAt.getTime()) ?? null;
  }

  /**
   * Serialises booking transactions for one doctor (see `bookingVersion`). False when the doctor
   * has no timetable any more, for example because the account was deleted meanwhile.
   */
  async lockForBooking(doctorUserId: Types.ObjectId, session: ClientSession): Promise<boolean> {
    const result = await this.schedules
      .updateOne({ doctorUserId }, { $inc: { bookingVersion: 1 } }, { session })
      .exec();
    return result.matchedCount === 1;
  }

  /** Part of account deletion; call after `lockForBooking` in the same transaction. */
  async deleteForDoctor(doctorUserId: Types.ObjectId, session: ClientSession): Promise<number> {
    const result = await this.schedules.deleteMany({ doctorUserId }, { session }).exec();
    return result.deletedCount;
  }

  /**
   * First India date in the booking window with a free slot for this doctor, or null.
   * Respects video availability and optional consultation `mode`.
   */
  async nextAvailableDateFor(
    profile: DoctorProfileDocument,
    options: SlotFilterOptions = {},
  ): Promise<string | null> {
    const now = options.now ?? new Date();
    if (!acceptsNewBookings(profile.availabilityStatus)) return null;
    const today = istDate(now);
    const window = await this.freeSlots(profile, today, BOOKING_WINDOW_DAYS, now, options.mode);
    return firstBookableDate(window, now, options.availWhen, options.holidayState);
  }

  /** Batch version of {@link nextAvailableDateFor} for directory cards and filters. */
  async nextAvailableDatesFor(
    profiles: DoctorProfileDocument[],
    options: SlotFilterOptions = {},
  ): Promise<Map<string, string | null>> {
    const result = new Map<string, string | null>();
    if (profiles.length === 0) return result;

    const now = options.now ?? new Date();
    const today = istDate(now);
    const rangeStart = istInstant(today, 0);
    const rangeEnd = istInstant(addDays(today, BOOKING_WINDOW_DAYS), 0);
    const userIds = profiles.map((profile) => profile.userId);

    const scheduleDocs = await this.schedules
      .find({ doctorUserId: { $in: userIds } })
      .lean()
      .exec();
    const scheduleByDoctor = new Map(
      scheduleDocs.map((doc) => [doc.doctorUserId.toString(), doc]),
    );

    const reservationDocs = await this.reservations
      .find(
        {
          doctorUserId: { $in: userIds },
          active: true,
          startsAt: { $lt: rangeEnd },
          endsAt: { $gt: rangeStart },
          $or: [{ state: 'booked' }, { state: 'held', holdExpiresAt: { $gt: now } }],
        },
        { doctorUserId: 1, startsAt: 1, endsAt: 1 },
      )
      .lean()
      .exec();
    const busyByDoctor = new Map<string, Interval[]>();
    for (const hold of reservationDocs) {
      const key = hold.doctorUserId.toString();
      const list = busyByDoctor.get(key) ?? [];
      list.push({ startsAt: hold.startsAt, endsAt: hold.endsAt });
      busyByDoctor.set(key, list);
    }

    const notBefore = this.notBefore(now);
    const videoOpen = this.video.available;

    for (const profile of profiles) {
      if (!acceptsNewBookings(profile.availabilityStatus)) {
        result.set(profile.slug, null);
        continue;
      }
      const modes = bookableModes(profile.consultationModes, videoOpen);
      const slotModes =
        options.mode && modes.includes(options.mode) ? [options.mode] : modes.length ? modes : [];
      const schedule = scheduleByDoctor.get(profile.userId.toString());
      const hasBookableBlocks =
        schedule?.rules.some((rule) => slotModes.includes(rule.mode)) ||
        schedule?.extraBlocks.some((block) => slotModes.includes(block.mode));
      if (!schedule || !hasBookableBlocks || slotModes.length === 0) {
        result.set(profile.slug, null);
        continue;
      }
      const busy = busyByDoctor.get(profile.userId.toString()) ?? [];
      const days = generateSlots({
        rules: schedule.rules,
        extraBlocks: schedule.extraBlocks,
        daysOff: schedule.daysOff,
        from: today,
        days: BOOKING_WINDOW_DAYS,
        notBefore,
        busy,
        modes: slotModes,
      });
      result.set(
        profile.slug,
        firstBookableDate(days, now, options.availWhen, options.holidayState),
      );
    }
    return result;
  }

  /** Free slots per day, or an empty list when no timetable block is bookable right now. */
  private async freeSlots(
    profile: DoctorProfileDocument,
    from: string,
    days: number,
    now: Date,
    mode?: ConsultationMode,
  ) {
    const modes = bookableModes(profile.consultationModes, this.video.available);
    const slotModes = mode && modes.includes(mode) ? [mode] : modes;
    const schedule = await this.schedules.findOne({ doctorUserId: profile.userId }).exec();
    const hasBookableBlocks =
      schedule?.rules.some((rule) => slotModes.includes(rule.mode)) ||
      schedule?.extraBlocks.some((block) => slotModes.includes(block.mode));
    if (!hasBookableBlocks) return [];
    const rangeStart = istInstant(from, 0);
    const rangeEnd = istInstant(addDays(from, days), 0);
    const busy: Interval[] = await this.reservations
      .find(
        {
          doctorUserId: profile.userId,
          active: true,
          startsAt: { $lt: rangeEnd },
          endsAt: { $gt: rangeStart },
          $or: [{ state: 'booked' }, { state: 'held', holdExpiresAt: { $gt: now } }],
        },
        { startsAt: 1, endsAt: 1 },
      )
      .lean()
      .exec();
    return generateSlots({
      rules: schedule!.rules,
      extraBlocks: schedule!.extraBlocks,
      daysOff: schedule!.daysOff,
      from,
      days,
      notBefore: this.notBefore(now),
      busy,
      modes: slotModes,
    });
  }

  private notBefore(now: Date): Date {
    return new Date(now.getTime() + MIN_NOTICE_MINUTES * 60_000);
  }

  private daysBetween(a: string, b: string): number {
    return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
  }
}
