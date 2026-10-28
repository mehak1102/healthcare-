import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { InjectConfig } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';
import { isHomeVisitBookingOpen } from './home-visit-booking';
import { HOME_VISIT_MESSAGE } from './home-visits.constants';
import { normalizeIndiaPin } from './india-pin';
import { HOME_VISIT_SERVICE_AREA_SEED } from './service-area-seed';
import { ServiceArea, type ServiceAreaDocument } from './service-area.schema';

export interface PinCoverageResult {
  pin: string | null;
  valid: boolean;
  inPilotArea: boolean;
  stateCode: string | null;
  areaLabel: string | null;
  bookingOpen: boolean;
  message: string;
}

@Injectable()
export class ServiceAreasService {
  constructor(
    @InjectModel(ServiceArea.name)
    private readonly areas: Model<ServiceAreaDocument>,
    @InjectConfig() private readonly env: Env,
  ) {}

  private bookingOpen(): boolean {
    return isHomeVisitBookingOpen(this.env);
  }

  async upsertSeedRows(): Promise<number> {
    let changed = 0;
    for (const row of HOME_VISIT_SERVICE_AREA_SEED) {
      const result = await this.areas.updateOne(
        { pinCode: row.pinCode },
        {
          $set: {
            pinCode: row.pinCode,
            stateCode: row.stateCode,
            label: row.label,
            active: true,
          },
        },
        { upsert: true },
      );
      if (result.upsertedCount > 0 || result.modifiedCount > 0) changed++;
    }
    const pilotPins = HOME_VISIT_SERVICE_AREA_SEED.map((r) => r.pinCode);
    await this.areas.updateMany(
      { pinCode: { $nin: pilotPins } },
      { $set: { active: false } },
    );
    return changed;
  }

  async checkPin(raw: string): Promise<PinCoverageResult> {
    const pin = normalizeIndiaPin(raw);
    if (!pin) {
      return {
        pin: null,
        valid: false,
        inPilotArea: false,
        stateCode: null,
        areaLabel: null,
        bookingOpen: this.bookingOpen(),
        message: 'Enter a valid 6-digit India PIN code.',
      };
    }
    const area = await this.areas.findOne({ pinCode: pin, active: true }).lean().exec();
    if (!area) {
      return {
        pin,
        valid: true,
        inPilotArea: false,
        stateCode: null,
        areaLabel: null,
        bookingOpen: this.bookingOpen(),
        message:
          'This PIN is not in our home-visit pilot area yet. We will not show a slot or an ETA here.',
      };
    }
    return {
      pin,
      valid: true,
      inPilotArea: true,
      stateCode: area.stateCode,
      areaLabel: area.label ?? null,
      bookingOpen: this.bookingOpen(),
      message: this.bookingOpen()
        ? `Your PIN is in the pilot area (${area.label ?? area.stateCode}). You may request a visit when you are signed in.`
        : `${HOME_VISIT_MESSAGE} Your PIN is on the pilot list (${area.label ?? area.stateCode}), but booking is still closed.`,
    };
  }
}
