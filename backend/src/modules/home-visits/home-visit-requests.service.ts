import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { apiError } from '../../common/http/api-error';
import { InjectConfig } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';
import type { AuthContext } from '../auth/auth-context';
import { User } from '../users/user.schema';
import { DispatchOffer, type DispatchOfferDocument } from './dispatch-offer.schema';
import type {
  CreateHomeVisitRequestDto,
  HomeVisitQuoteDto,
  ListOpsHomeVisitsQueryDto,
  ReassignHomeVisitDto,
} from './dto/home-visit-requests.dto';
import {
  homeVisitBookingClosedMessage,
  isHomeVisitBookingOpen,
} from './home-visit-booking';
import { HomeVisitRequest, type HomeVisitRequestDocument } from './home-visit-request.schema';
import {
  DISPATCH_OFFER_TTL_MINUTES,
  HOME_VISIT_ACTIVE_STATUSES,
  HOME_VISIT_PILOT_QUOTE_FEE_MINOR,
  type HomeVisitRequestStatus,
} from './home-visit-statuses';
import { ServiceAreasService } from './service-areas.service';

const REASSIGNABLE: readonly HomeVisitRequestStatus[] = [
  'requested',
  'matching',
  'offered',
  'accepted',
  'unassigned',
];

@Injectable()
export class HomeVisitRequestsService {
  constructor(
    @InjectModel(HomeVisitRequest.name)
    private readonly requests: Model<HomeVisitRequestDocument>,
    @InjectModel(DispatchOffer.name) private readonly offers: Model<DispatchOfferDocument>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly areas: ServiceAreasService,
    @InjectConfig() private readonly env: Env,
  ) {}

  async quote(body: HomeVisitQuoteDto) {
    const preferredWindow = body.preferredWindow ?? 'asap';
    const coverage = await this.areas.checkPin(body.pin);
    if (!coverage.valid) {
      throw new BadRequestException(
        apiError('VALIDATION_FAILED', coverage.message),
      );
    }
    if (!coverage.inPilotArea) {
      throw new BadRequestException(
        apiError(
          'HOME_VISIT_OUT_OF_AREA',
          'Home visits are not available for this PIN yet. We will not quote a fee or show an ETA.',
        ),
      );
    }
    const bookingOpen = isHomeVisitBookingOpen(this.env);
    return {
      bookingOpen,
      pin: coverage.pin!,
      inPilotArea: true,
      fee: { amountMinor: HOME_VISIT_PILOT_QUOTE_FEE_MINOR, currency: 'INR' },
      preferredWindow,
      message: bookingOpen
        ? 'This is an indicative fee for a pilot-area visit. Final confirmation depends on doctor acceptance.'
        : `${homeVisitBookingClosedMessage()} A pilot-area quote is shown for planning only.`,
    };
  }

  async create(auth: AuthContext, body: CreateHomeVisitRequestDto) {
    if (!isHomeVisitBookingOpen(this.env)) {
      throw new ServiceUnavailableException(
        apiError('HOME_VISITS_NOT_OPEN', homeVisitBookingClosedMessage()),
      );
    }
    const coverage = await this.areas.checkPin(body.pin);
    if (!coverage.valid || !coverage.inPilotArea || !coverage.pin || !coverage.stateCode) {
      throw new BadRequestException(
        apiError('HOME_VISIT_OUT_OF_AREA', 'This PIN is not in the home-visit pilot area.'),
      );
    }
    const doc = await this.requests.create({
      patientUserId: new Types.ObjectId(auth.userId),
      pinCode: coverage.pin,
      stateCode: coverage.stateCode,
      addressLine1: body.addressLine1.trim(),
      locality: body.locality?.trim() ?? null,
      chiefComplaint: body.chiefComplaint.trim(),
      preferredWindow: body.preferredWindow,
      status: 'requested',
      assignedDoctorUserId: null,
      quotedFeeMinor: HOME_VISIT_PILOT_QUOTE_FEE_MINOR,
      currency: 'INR',
    });
    return this.toPatientDto(doc);
  }

  async listMine(auth: AuthContext) {
    const rows = await this.requests
      .find({ patientUserId: new Types.ObjectId(auth.userId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
    return rows.map((row) => this.toPatientDto(row));
  }

  async countActive(): Promise<number> {
    return this.requests.countDocuments({ status: { $in: [...HOME_VISIT_ACTIVE_STATUSES] } }).exec();
  }

  async countActiveForPatient(patientUserId: string): Promise<number> {
    return this.requests
      .countDocuments({
        patientUserId: new Types.ObjectId(patientUserId),
        status: { $in: [...HOME_VISIT_ACTIVE_STATUSES] },
      })
      .exec();
  }

  async listForOps(query: ListOpsHomeVisitsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: {
      status?: HomeVisitRequestStatus;
      pinCode?: string;
      stateCode?: string;
      createdAt?: { $gte?: Date; $lt?: Date };
    } = {};
    if (query.status) filter.status = query.status as HomeVisitRequestStatus;
    if (query.area) {
      const area = query.area.trim().toUpperCase();
      if (/^\d{6}$/.test(area)) filter.pinCode = area;
      else filter.stateCode = area;
    }
    if (query.from || query.to) {
      const createdAt: { $gte?: Date; $lt?: Date } = {};
      if (query.from) createdAt.$gte = new Date(query.from);
      if (query.to) createdAt.$lt = new Date(query.to);
      filter.createdAt = createdAt;
    }
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.requests.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.requests.countDocuments(filter).exec(),
    ]);
    const patientIds = [...new Set(items.map((i) => i.patientUserId.toString()))];
    const patients = await this.users
      .find({ _id: { $in: patientIds.map((id) => new Types.ObjectId(id)) } })
      .select({ fullName: 1 })
      .lean()
      .exec();
    const names = new Map(patients.map((p) => [p._id.toString(), p.fullName as string]));
    return {
      items: items.map((row) => ({
        id: row._id.toString(),
        status: row.status,
        pinCode: row.pinCode,
        stateCode: row.stateCode,
        preferredWindow: row.preferredWindow,
        patientUserId: row.patientUserId.toString(),
        patientName: names.get(row.patientUserId.toString()) ?? 'Patient',
        assignedDoctorUserId: row.assignedDoctorUserId?.toString() ?? null,
        fee: { amountMinor: row.quotedFeeMinor, currency: row.currency },
        createdAt: (row.get('createdAt') as Date).toISOString(),
      })),
      page,
      limit,
      total,
    };
  }

  async reassign(requestId: string, body: ReassignHomeVisitDto, actorUserId: string) {
    const request = await this.requests.findById(requestId).exec();
    if (!request) {
      throw new NotFoundException(apiError('NOT_FOUND', 'Home visit request not found.'));
    }
    if (!REASSIGNABLE.includes(request.status)) {
      throw new ConflictException(
        apiError('INVALID_STATUS', 'This request cannot be reassigned in its current state.'),
      );
    }
    const doctor = await this.users.findById(body.doctorUserId).select({ roles: 1 }).lean().exec();
    if (!doctor?.roles.includes('doctor')) {
      throw new BadRequestException(
        apiError('VALIDATION_FAILED', 'doctorUserId must belong to a doctor account.'),
      );
    }
    const doctorId = new Types.ObjectId(body.doctorUserId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DISPATCH_OFFER_TTL_MINUTES * 60 * 1000);

    await this.offers.updateMany(
      {
        homeVisitRequestId: request._id,
        status: 'offered',
      },
      { $set: { status: 'withdrawn', respondedAt: now } },
    );

    const offer = await this.offers.create({
      homeVisitRequestId: request._id,
      doctorUserId: doctorId,
      status: 'offered',
      expiresAt,
      respondedAt: null,
    });

    request.assignedDoctorUserId = doctorId;
    request.status = 'offered';
    await request.save();

    return {
      request: this.toPatientDto(request),
      offer: {
        id: offer.id,
        homeVisitRequestId: request.id,
        status: offer.status,
        expiresAt: offer.expiresAt.toISOString(),
      },
      note: body.note ?? null,
      reassignedByUserId: actorUserId,
    };
  }

  async acceptOffer(auth: AuthContext, offerId: string) {
    const offer = await this.offers.findById(offerId).exec();
    if (!offer || offer.doctorUserId.toString() !== auth.userId) {
      throw new NotFoundException(apiError('NOT_FOUND', 'Dispatch offer not found.'));
    }
    const now = new Date();
    if (offer.status !== 'offered' || offer.expiresAt <= now) {
      throw new ConflictException(
        apiError('OFFER_NOT_AVAILABLE', 'This dispatch offer is no longer available.'),
      );
    }
    const updated = await this.offers
      .findOneAndUpdate(
        { _id: offer._id, status: 'offered', expiresAt: { $gt: now } },
        { $set: { status: 'accepted', respondedAt: now } },
        { returnDocument: 'after' },
      )
      .exec();
    if (!updated) {
      throw new ConflictException(
        apiError('OFFER_NOT_AVAILABLE', 'This dispatch offer is no longer available.'),
      );
    }
    await this.requests
      .findByIdAndUpdate(offer.homeVisitRequestId, {
        $set: { status: 'accepted', assignedDoctorUserId: offer.doctorUserId },
      })
      .exec();
    return {
      id: updated.id,
      homeVisitRequestId: updated.homeVisitRequestId.toString(),
      status: updated.status,
      expiresAt: updated.expiresAt.toISOString(),
    };
  }

  private toPatientDto(doc: HomeVisitRequestDocument) {
    return {
      id: doc.id,
      pinCode: doc.pinCode,
      stateCode: doc.stateCode,
      addressLine1: doc.addressLine1,
      locality: doc.locality,
      chiefComplaint: doc.chiefComplaint,
      preferredWindow: doc.preferredWindow,
      status: doc.status,
      assignedDoctorUserId: doc.assignedDoctorUserId?.toString() ?? null,
      fee: { amountMinor: doc.quotedFeeMinor, currency: doc.currency },
      createdAt: (doc.get('createdAt') as Date).toISOString(),
    };
  }
}
