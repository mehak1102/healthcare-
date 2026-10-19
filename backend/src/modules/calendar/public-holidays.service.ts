import { ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { apiError } from '../../common/http/api-error';
import { addDays, istDate } from '../appointments/ist-time';
import {
  applyIndiaPublicHolidayDates,
  applyStatePublicHolidayDates,
  resetStatePublicHolidayDates,
  STATIC_INDIA_PUBLIC_HOLIDAY_DATES,
  useStaticIndiaPublicHolidayDates,
} from '../appointments/india-public-holidays';
import type { PublicHolidayRegion } from './holiday-regions';
import { INDIA_PUBLIC_HOLIDAY_SEED } from './india-public-holiday-seed';
import { PublicHoliday, type PublicHolidayDocument } from './public-holiday.schema';

export type PublicHolidayDateSource = 'database' | 'static';

export interface PublicHolidayRow {
  date: string;
  name: string;
}

@Injectable()
export class PublicHolidaysService implements OnModuleInit {
  constructor(
    @InjectModel(PublicHoliday.name)
    private readonly holidays: Model<PublicHolidayDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshActiveDates();
  }

  async usesDatabase(region: PublicHolidayRegion = 'IN'): Promise<boolean> {
    return (await this.holidays.countDocuments({ region }).exec()) > 0;
  }

  /** Loads `public_holidays` into the in-memory directory filter caches. */
  async refreshActiveDates(): Promise<{ source: PublicHolidayDateSource; count: number }> {
    const national = await this.holidays.find({ region: 'IN' }).select('date').lean().exec();
    if (national.length === 0) {
      useStaticIndiaPublicHolidayDates();
    } else {
      applyIndiaPublicHolidayDates(national.map((row) => row.date));
    }

    resetStatePublicHolidayDates();
    const stateRows = await this.holidays
      .find({ region: /^IN-/ })
      .select('region date')
      .lean()
      .exec();
    const byRegion = new Map<string, string[]>();
    for (const row of stateRows) {
      const list = byRegion.get(row.region) ?? [];
      list.push(row.date);
      byRegion.set(row.region, list);
    }
    for (const [region, dates] of byRegion) {
      applyStatePublicHolidayDates(region, dates);
    }

    const nationalCount =
      national.length === 0 ? STATIC_INDIA_PUBLIC_HOLIDAY_DATES.size : national.length;
    return {
      source: national.length === 0 ? 'static' : 'database',
      count: nationalCount + stateRows.length,
    };
  }

  async upsertSeedRows(): Promise<number> {
    let changed = 0;
    for (const row of INDIA_PUBLIC_HOLIDAY_SEED) {
      const result = await this.holidays.updateOne(
        { region: 'IN', date: row.date },
        { $set: { name: row.name, region: 'IN', date: row.date } },
        { upsert: true },
      );
      if (result.upsertedCount > 0 || result.modifiedCount > 0) changed++;
    }
    await this.refreshActiveDates();
    return changed;
  }

  async listInRange(
    region: PublicHolidayRegion,
    from: string,
    days: number,
  ): Promise<{ source: PublicHolidayDateSource; items: PublicHolidayRow[] }> {
    const last = addDays(from, days - 1);
    if (await this.usesDatabase(region)) {
      const docs = await this.holidays
        .find({ region, date: { $gte: from, $lte: last } })
        .sort({ date: 1 })
        .select('date name')
        .lean()
        .exec();
      return {
        source: 'database',
        items: docs.map((row) => ({ date: row.date, name: row.name })),
      };
    }
    const items = INDIA_PUBLIC_HOLIDAY_SEED.filter(
      (row) => row.date >= from && row.date <= last,
    ).map((row) => ({ date: row.date, name: row.name }));
    return { source: 'static', items };
  }

  async listAllAdmin(region?: PublicHolidayRegion) {
    const filter = region ? { region } : {};
    return this.holidays.find(filter).sort({ region: 1, date: 1 }).exec();
  }

  async create(row: PublicHolidayRow & { region: PublicHolidayRegion }) {
    try {
      const doc = await this.holidays.create({
        date: row.date,
        name: row.name,
        region: row.region,
      });
      await this.refreshActiveDates();
      return doc;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11_000) {
        throw new ConflictException(
          apiError('HOLIDAY_EXISTS', 'A public holiday already exists for that date and region.'),
        );
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const removed = await this.holidays.findByIdAndDelete(id).exec();
    if (!removed) throw new NotFoundException();
    await this.refreshActiveDates();
  }

  defaultFromDate(now = new Date()): string {
    return istDate(now);
  }
}
