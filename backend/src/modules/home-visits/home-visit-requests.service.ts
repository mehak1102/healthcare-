import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import type { RequestMeta } from '../../common/http/app-request';
import { apiError } from '../../common/http/api-error';
import { InjectConfig } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';
import type { AuthContext } from '../auth/auth-context';
import { DoctorProfile, acceptsNewBookings } from '../doctors/doctor-profile.schema';
import {
  InjectPaymentGateway,
  type PaymentGateway,
  paymentsUnavailable,
} from '../payments/payment-gateway';
import {
  SANDBOX_RAZORPAY_KEY_ID,
  SandboxPaymentGateway,
} from '../payments/sandbox-payment.gateway';
import type { VerifyPaymentDto } from '../appointments/dto/appointments.dto';
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
import { HomeVisitNotifications } from './home-visit-notifications';
import {
  buildHomeVisitLiveTracking,
  homeVisitCheckout,
  homeVisitPaymentHoldExpires,
} from './home-visit-patient.dto';
import { OsmMapService } from './osm-map.service';
import {
  generateHomeVisitArrivalCode,
  homeVisitArrivalCodesMatch,
  normalizeHomeVisitArrivalCode,
} from './home-visit-arrival-code';
import { HomeVisitRequest, type HomeVisitRequestDocument } from './home-visit-request.schema';
import {
  DISPATCH_OFFER_TTL_MINUTES,
  HOME_VISIT_ACTIVE_STATUSES,
  type HomeVisitRequestStatus,
} from './home-visit-statuses';
import { normalizeIndiaPin } from './india-pin';
import { ServiceAreasService } from './service-areas.service';

const REASSIGNABLE: readonly HomeVisitRequestStatus[] = [
  'requested',
  'matching',
  'offered',
  'accepted',
  'unassigned',
];

const PATIENT_CANCELLABLE: readonly HomeVisitRequestStatus[] = [
  'pending_payment',
  'requested',
  'matching',
  'offered',
  'unassigned',
];

const DOCTOR_STATUS_NEXT: Partial<
  Record<HomeVisitRequestStatus, HomeVisitRequestStatus>
> = {
  accepted: 'en_route',
  arrived: 'completed',
};

const notFound = () => new NotFoundException(apiError('NOT_FOUND', 'Home visit request not found.'));

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class HomeVisitRequestsService {
  private readonly logger = new Logger(HomeVisitRequestsService.name);

  constructor(
    @InjectModel(HomeVisitRequest.name)
    private readonly requests: Model<HomeVisitRequestDocument>,
    @InjectModel(DispatchOffer.name) private readonly offers: Model<DispatchOfferDocument>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(DoctorProfile.name) private readonly profiles: Model<DoctorProfile>,
    private readonly areas: ServiceAreasService,
    private readonly notifications: HomeVisitNotifications,
    @InjectPaymentGateway() private readonly gateway: PaymentGateway,
    @InjectConfig() private readonly env: Env,
    private readonly maps: OsmMapService,
  ) {}

  async quote(body: HomeVisitQuoteDto) {
    const preferredWindow = body.preferredWindow ?? 'asap';
    const coverage = await this.areas.checkPin(body.pin);
    if (!coverage.valid) {
      throw new BadRequestException(apiError('VALIDATION_FAILED', coverage.message));
    }
    if (!coverage.inPilotArea) {
      throw new BadRequestException(
        apiError(
          'HOME_VISIT_OUT_OF_AREA',
          'Home visits are not available for this PIN yet.',
        ),
      );
    }
    const doctors = await this.listAvailableDoctors(body.pin);
    const bookingOpen = isHomeVisitBookingOpen(this.env);
    const sampleFee =
      doctors.items[0]?.fee ?? { amountMinor: 0, currency: 'INR' as const };
    return {
      bookingOpen,
      paymentsAvailable: this.gateway.available && sampleFee.amountMinor > 0,
      pin: coverage.pin!,
      inPilotArea: true,
      fee: sampleFee,
      preferredWindow,
      message: bookingOpen
        ? doctors.items.length > 0
          ? 'Choose a doctor for your PIN — each sets their own home visit fee.'
          : 'No doctors are listed for this PIN yet. Try another pilot PIN or check back later.'
        : `${homeVisitBookingClosedMessage()} Doctor list is for planning only.`,
    };
  }

  async listAvailableDoctors(pinInput: string) {
    const coverage = await this.areas.checkPin(pinInput);
    if (!coverage.valid) {
      throw new BadRequestException(apiError('VALIDATION_FAILED', coverage.message));
    }
    if (!coverage.inPilotArea || !coverage.pin) {
      throw new BadRequestException(
        apiError('HOME_VISIT_OUT_OF_AREA', 'This PIN is not in the home-visit pilot area.'),
      );
    }
    const pin = coverage.pin;
    const rows = await this.profiles
      .find({
        registrationCheckedAt: { $ne: null },
        homeVisitServicePinCode: pin,
        homeVisitFeeInr: { $ne: null },
      })
      .sort({ displayName: 1 })
      .limit(50)
      .select({
        userId: 1,
        slug: 1,
        displayName: 1,
        specialty: 1,
        qualification: 1,
        homeVisitFeeInr: 1,
        availabilityStatus: 1,
      })
      .lean()
      .exec();
    const items = rows
      .filter((row) => acceptsNewBookings(row.availabilityStatus as never))
      .map((row) => {
        const homeVisitFeeInr = row.homeVisitFeeInr as number;
        return {
          userId: row.userId.toString(),
          slug: row.slug as string,
          displayName: row.displayName as string,
          specialty: row.specialty as string,
          qualification: row.qualification as string,
          homeVisitFeeInr,
          fee: { amountMinor: homeVisitFeeInr * 100, currency: 'INR' as const },
        };
      });
    return {
      pin,
      bookingOpen: isHomeVisitBookingOpen(this.env),
      items,
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
    const activeCount = await this.countActiveForPatient(auth.userId);
    if (activeCount > 0) {
      throw new ConflictException(
        apiError(
          'HOME_VISIT_ACTIVE_EXISTS',
          'You already have an open home visit request. Track or cancel it before booking another.',
        ),
      );
    }
    const amountPaise = await this.feePaiseForDoctor(body.doctorUserId, coverage.pin);
    const doctorId = new Types.ObjectId(body.doctorUserId);
    const paymentWillBeRequired = this.gateway.available && amountPaise > 0;
    const doc = await this.requests.create({
      patientUserId: new Types.ObjectId(auth.userId),
      pinCode: coverage.pin,
      stateCode: coverage.stateCode,
      addressLine1: body.addressLine1.trim(),
      locality: body.locality?.trim() ?? null,
      chiefComplaint: body.chiefComplaint.trim(),
      preferredWindow: body.preferredWindow,
      status: 'requested',
      assignedDoctorUserId: doctorId,
      quotedFeeMinor: amountPaise,
      currency: 'INR',
      payment: paymentWillBeRequired
        ? {
            status: 'pending',
            amountPaise,
            orderId: null,
            paymentId: null,
            paidAt: null,
          }
        : {
            status: 'not_required',
            amountPaise,
            orderId: null,
            paymentId: null,
            paidAt: null,
          },
      paymentHoldExpiresAt: null,
      enRouteStartedAt: null,
      arrivedAt: null,
    });
    const saved = await this.sendDispatchOffer(doc, body.doctorUserId);
    await this.resolveDestination(saved, body.destinationLat, body.destinationLng);
    this.notifications.requestReceived(saved);
    return await this.toPatientDto(await this.reload(saved.id));
  }

  private async reload(id: string): Promise<HomeVisitRequestDocument> {
    const doc = await this.requests.findById(id).exec();
    if (!doc) throw notFound();
    return doc;
  }

  private async resolveDestination(
    doc: HomeVisitRequestDocument,
    lat?: number,
    lng?: number,
  ): Promise<void> {
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      doc.destinationLat = lat;
      doc.destinationLng = lng;
      await doc.save();
      return;
    }
    await this.ensureDestinationGeocoded(doc);
  }

  /** Fills destinationLat/Lng from Nominatim when missing (retries on later reads). */
  private async ensureDestinationGeocoded(doc: HomeVisitRequestDocument): Promise<void> {
    if (doc.destinationLat != null && doc.destinationLng != null) return;
    const geocoded = await this.maps.geocodeHomeVisitAddress({
      pinCode: doc.pinCode,
      addressLine1: doc.addressLine1,
      locality: doc.locality,
    });
    if (geocoded) {
      doc.destinationLat = geocoded.lat;
      doc.destinationLng = geocoded.lng;
      await doc.save();
      await this.syncDrivingRoute(doc);
    }
  }

  /** Stores OSRM polyline from current doctor GPS → patient address while en route. */
  private async syncDrivingRoute(doc: HomeVisitRequestDocument): Promise<void> {
    if (doc.status !== 'en_route') return;
    if (doc.doctorLat == null || doc.doctorLng == null) return;
    if (doc.destinationLat == null || doc.destinationLng == null) return;
    const route = await this.maps.drivingRoute(
      { lat: doc.doctorLat, lng: doc.doctorLng },
      { lat: doc.destinationLat, lng: doc.destinationLng },
    );
    if (route) {
      doc.routePolyline = route.polyline;
      await doc.save();
    }
  }

  async verifyPayment(
    auth: AuthContext,
    requestId: string,
    input: VerifyPaymentDto,
    _meta: RequestMeta,
  ) {
    const doc = await this.findOwned(auth, requestId);
    if (!this.gateway.available) throw paymentsUnavailable();
    if (!doc.payment.orderId || doc.payment.orderId !== input.razorpayOrderId) {
      throw new BadRequestException(
        apiError('PAYMENT_MISMATCH', 'This payment does not match your home visit request.'),
      );
    }
    const genuine = this.gateway.verifyCheckout({
      orderId: input.razorpayOrderId,
      paymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
    });
    if (!genuine) {
      throw new BadRequestException(
        apiError('PAYMENT_SIGNATURE_INVALID', 'We could not verify this payment confirmation.'),
      );
    }
    if (doc.payment.paymentId === input.razorpayPaymentId && doc.status === 'accepted') {
      return await this.toPatientDto(doc);
    }
    const payment = await this.gateway.fetchPayment(input.razorpayPaymentId);
    if (
      payment.orderId !== doc.payment.orderId ||
      payment.amountPaise !== doc.payment.amountPaise ||
      payment.currency !== 'INR'
    ) {
      throw new BadRequestException(
        apiError('PAYMENT_MISMATCH', 'This payment does not match your home visit request.'),
      );
    }
    let settled = payment;
    if (settled.status === 'authorized') {
      settled = await this.gateway.capture(settled.paymentId, doc.payment.amountPaise);
    }
    if (settled.status !== 'captured') {
      throw new ConflictException(
        apiError(
          'PAYMENT_NOT_COMPLETED',
          'The payment has not completed. If money left your account, it will be returned automatically by your bank.',
        ),
      );
    }
    if (doc.status !== 'pending_payment') {
      throw new ConflictException(
        apiError(
          'PAYMENT_TOO_LATE',
          'This request is no longer waiting for payment. If you were charged, contact support.',
        ),
      );
    }
    doc.status = 'accepted';
    doc.payment.status = 'paid';
    doc.payment.paymentId = settled.paymentId;
    doc.payment.paidAt = new Date();
    doc.paymentHoldExpiresAt = null;
    this.assignArrivalVerificationCode(doc);
    await doc.save();
    if (doc.arrivalVerificationCode) {
      this.notifications.arrivalCodeReady(doc, doc.arrivalVerificationCode);
    }
    return await this.toPatientDto(doc);
  }

  async completeSandboxPayment(auth: AuthContext, requestId: string, meta: RequestMeta) {
    if (this.gateway.publicKey !== SANDBOX_RAZORPAY_KEY_ID) {
      throw notFound();
    }
    const doc = await this.findOwned(auth, requestId);
    if (!doc.payment.orderId) {
      throw new BadRequestException(
        apiError('PAYMENT_MISMATCH', 'This payment does not match your home visit request.'),
      );
    }
    const confirmation = (this.gateway as SandboxPaymentGateway).completeOrder(
      doc.payment.orderId,
    );
    return this.verifyPayment(
      auth,
      requestId,
      {
        razorpayOrderId: confirmation.orderId,
        razorpayPaymentId: confirmation.paymentId,
        razorpaySignature: confirmation.signature,
      },
      meta,
    );
  }

  async listMine(auth: AuthContext) {
    const rows = await this.requests
      .find({ patientUserId: new Types.ObjectId(auth.userId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
    return Promise.all(rows.map((row) => this.toPatientDto(row)));
  }

  async getForPatient(auth: AuthContext, requestId: string) {
    return this.toPatientDto(await this.findOwned(auth, requestId));
  }

  async cancelForPatient(auth: AuthContext, requestId: string) {
    const doc = await this.findOwned(auth, requestId);
    if (!PATIENT_CANCELLABLE.includes(doc.status)) {
      throw new ConflictException(
        apiError('INVALID_STATUS', 'This request can no longer be cancelled online.'),
      );
    }
    const previous = doc.status;
    const now = new Date();
    await this.offers.updateMany(
      { homeVisitRequestId: doc._id, status: 'offered' },
      { $set: { status: 'withdrawn', respondedAt: now } },
    );
    const refunding =
      this.gateway.available &&
      doc.payment.status === 'paid' &&
      !!doc.payment.paymentId;
    if (refunding && doc.payment.paymentId) {
      try {
        await this.gateway.refund(doc.payment.paymentId, doc.payment.amountPaise, {
          homeVisitRequestId: doc.id,
          reason: 'cancelled_by_patient',
        });
        doc.payment.status = 'refunded';
      } catch (error) {
        this.logger.error(
          `Home visit refund failed for ${doc.id}: ${error instanceof Error ? error.message : 'unknown'}`,
        );
        doc.payment.status = 'refund_failed';
      }
    } else if (doc.status === 'pending_payment') {
      doc.payment.status = 'pending';
    }
    doc.status = 'cancelled';
    doc.assignedDoctorUserId = null;
    doc.paymentHoldExpiresAt = null;
    await doc.save();
    this.notifications.cancelledByPatient(doc, refunding);
    this.notifications.statusUpdated(doc, null, previous);
    return await this.toPatientDto(doc);
  }

  async listDispatchOffersForDoctor(auth: AuthContext) {
    const now = new Date();
    const offers = await this.offers
      .find({
        doctorUserId: new Types.ObjectId(auth.userId),
        status: 'offered',
        expiresAt: { $gt: now },
      })
      .sort({ expiresAt: 1 })
      .limit(20)
      .exec();
    const requestIds = offers.map((o) => o.homeVisitRequestId);
    const requests = await this.requests.find({ _id: { $in: requestIds } }).exec();
    const byId = new Map(requests.map((r) => [r._id.toString(), r]));
    return offers
      .map((offer) => {
        const req = byId.get(offer.homeVisitRequestId.toString());
        if (!req || req.status !== 'offered') return null;
        return {
          offer: {
            id: offer.id,
            homeVisitRequestId: offer.homeVisitRequestId.toString(),
            status: offer.status,
            expiresAt: offer.expiresAt.toISOString(),
          },
          request: {
            id: req.id,
            pinCode: req.pinCode,
            locality: req.locality,
            addressLine1: req.addressLine1,
            chiefComplaint: req.chiefComplaint,
            preferredWindow: req.preferredWindow,
            status: req.status,
            fee: { amountMinor: req.quotedFeeMinor, currency: req.currency },
          },
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }

  async listAssignedForDoctor(auth: AuthContext) {
    const rows = await this.requests
      .find({
        assignedDoctorUserId: new Types.ObjectId(auth.userId),
        status: { $in: ['accepted', 'en_route', 'arrived'] },
      })
      .sort({ updatedAt: -1 })
      .limit(20)
      .exec();
    return rows.map((row) => ({
      id: row.id,
      pinCode: row.pinCode,
      locality: row.locality,
      addressLine1: row.addressLine1,
      chiefComplaint: row.chiefComplaint,
      preferredWindow: row.preferredWindow,
      status: row.status,
      fee: { amountMinor: row.quotedFeeMinor, currency: row.currency },
      createdAt: (row.get('createdAt') as Date).toISOString(),
    }));
  }

  async advanceStatusForDoctor(
    auth: AuthContext,
    requestId: string,
    nextStatus: HomeVisitRequestStatus,
    coords?: { lat?: number; lng?: number },
  ) {
    if (nextStatus === 'arrived') {
      throw new BadRequestException(
        apiError(
          'USE_ARRIVAL_CODE',
          'Enter the patient’s 6-digit arrival code to mark arrived.',
        ),
      );
    }
    const doc = await this.requests.findById(requestId).exec();
    if (!doc || doc.assignedDoctorUserId?.toString() !== auth.userId) {
      throw notFound();
    }
    const expected = DOCTOR_STATUS_NEXT[doc.status];
    if (!expected || expected !== nextStatus) {
      throw new ConflictException(
        apiError(
          'INVALID_STATUS',
          `Cannot move from "${doc.status}" to "${nextStatus}". Follow the visit steps in order.`,
        ),
      );
    }
    if (nextStatus === 'en_route') {
      if (coords?.lat == null || coords?.lng == null) {
        throw new BadRequestException(
          apiError(
            'LOCATION_REQUIRED',
            'Turn on location sharing and try again — we need your live GPS when you mark en route.',
          ),
        );
      }
    }
    const previous = doc.status;
    const now = new Date();
    doc.status = nextStatus;
    if (nextStatus === 'en_route') {
      doc.enRouteStartedAt = now;
      doc.doctorLat = coords!.lat!;
      doc.doctorLng = coords!.lng!;
      doc.doctorLocationAt = now;
      await this.ensureDestinationGeocoded(doc);
      if (doc.destinationLat != null && doc.destinationLng != null) {
        await this.syncDrivingRoute(doc);
      }
    }
    await doc.save();
    const doctorName = await this.doctorName(doc.assignedDoctorUserId);
    this.notifications.statusUpdated(doc, doctorName, previous);
    return {
      id: doc.id,
      status: doc.status,
    };
  }

  async verifyArrivalForDoctor(auth: AuthContext, requestId: string, rawCode: string) {
    const code = normalizeHomeVisitArrivalCode(rawCode);
    if (!code) {
      throw new BadRequestException(
        apiError('INVALID_ARRIVAL_CODE', 'Enter the 6-digit code from the patient’s visit page.'),
      );
    }
    const doc = await this.requests.findById(requestId).exec();
    if (!doc || doc.assignedDoctorUserId?.toString() !== auth.userId) {
      throw notFound();
    }
    if (doc.status !== 'en_route') {
      throw new ConflictException(
        apiError(
          'INVALID_STATUS',
          'You can verify arrival only after marking en route.',
        ),
      );
    }
    if (doc.arrivalVerifiedAt) {
      return { id: doc.id, status: doc.status as HomeVisitRequestStatus };
    }
    await this.ensureArrivalVerificationCode(doc);
    if (!doc.arrivalVerificationCode) {
      throw new ConflictException(
        apiError('ARRIVAL_CODE_NOT_READY', 'Arrival code is not ready yet. Ask the patient to refresh their visit page.'),
      );
    }
    if (!homeVisitArrivalCodesMatch(doc.arrivalVerificationCode, code)) {
      throw new BadRequestException(
        apiError('INVALID_ARRIVAL_CODE', 'That code does not match. Ask the patient to read the code on their visit page.'),
      );
    }
    const previous = doc.status;
    const now = new Date();
    doc.status = 'arrived';
    doc.arrivedAt = now;
    doc.arrivalVerifiedAt = now;
    await doc.save();
    const doctorName = await this.doctorName(doc.assignedDoctorUserId);
    this.notifications.statusUpdated(doc, doctorName, previous);
    return { id: doc.id, status: doc.status };
  }

  async updateDoctorLocation(
    auth: AuthContext,
    requestId: string,
    coords: { lat: number; lng: number },
  ) {
    const doc = await this.requests.findById(requestId).exec();
    if (!doc || doc.assignedDoctorUserId?.toString() !== auth.userId) {
      throw notFound();
    }
    if (doc.status !== 'en_route') {
      throw new ConflictException(
        apiError('INVALID_STATUS', 'Location updates are only allowed while en route.'),
      );
    }
    const now = new Date();
    doc.doctorLat = coords.lat;
    doc.doctorLng = coords.lng;
    doc.doctorLocationAt = now;
    await doc.save();
    return { id: doc.id, updatedAt: now.toISOString() };
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
    const filter: Record<string, unknown> = {};
    if (query.status) {
      filter.status = query.status as HomeVisitRequestStatus;
    } else {
      filter.status = { $ne: 'pending_payment' };
    }
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

  async listDispatchDoctors(query: { q?: string; pin?: string; all?: boolean }) {
    const q = query.q?.trim() ?? '';
    const filter: Record<string, unknown> = { registrationCheckedAt: { $ne: null } };
    const pinRaw = query.pin?.trim();
    if (pinRaw && !query.all) {
      const pin = normalizeIndiaPin(pinRaw);
      if (!pin) {
        throw new BadRequestException(
          apiError('VALIDATION_FAILED', 'pin must be a valid 6-digit India PIN.'),
        );
      }
      filter.homeVisitServicePinCode = pin;
    }
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      const or: Record<string, unknown>[] = [{ displayName: rx }, { slug: rx }];
      if (Types.ObjectId.isValid(q)) or.push({ userId: new Types.ObjectId(q) });
      filter.$or = or;
    }
    const rows = await this.profiles
      .find(filter)
      .sort({ displayName: 1 })
      .limit(25)
      .select({ userId: 1, displayName: 1, specialty: 1, city: 1, homeVisitServicePinCode: 1 })
      .lean()
      .exec();
    return {
      items: rows.map((row) => ({
        userId: row.userId.toString(),
        displayName: row.displayName as string,
        specialty: row.specialty as string,
        city: (row.city as string | null | undefined) ?? null,
        homeVisitServicePinCode: (row.homeVisitServicePinCode as string | null | undefined) ?? null,
      })),
    };
  }

  async reassign(requestId: string, body: ReassignHomeVisitDto, actorUserId: string) {
    const request = await this.requests.findById(requestId).exec();
    if (!request) {
      throw notFound();
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
    const doctorProfile = await this.profiles
      .findOne({ userId: doctorId })
      .select({ homeVisitServicePinCode: 1 })
      .lean()
      .exec();
    const requestPin = normalizeIndiaPin(request.pinCode);
    const doctorPin = doctorProfile?.homeVisitServicePinCode
      ? normalizeIndiaPin(doctorProfile.homeVisitServicePinCode)
      : null;
    if (requestPin && doctorPin && doctorPin !== requestPin) {
      throw new BadRequestException(
        apiError(
          'PIN_MISMATCH',
          'This doctor’s home visit service PIN does not match the patient’s request PIN.',
        ),
      );
    }
    if (requestPin && !doctorPin) {
      throw new BadRequestException(
        apiError(
          'DOCTOR_PIN_REQUIRED',
          'This doctor has not set a home visit service PIN on their profile.',
        ),
      );
    }

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

    const previous = request.status;
    request.assignedDoctorUserId = doctorId;
    request.status = 'offered';
    await request.save();

    this.notifications.dispatchOffer(body.doctorUserId, request);
    this.notifications.statusUpdated(request, await this.doctorName(doctorId), previous);

    return {
      request: await this.toPatientDto(request),
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
      throw notFound();
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
    const request = await this.requests.findById(offer.homeVisitRequestId).exec();
    if (!request || request.status !== 'offered') {
      throw new ConflictException(
        apiError('OFFER_NOT_AVAILABLE', 'This dispatch offer is no longer available.'),
      );
    }
    const previous = request.status;
    const paymentDue =
      this.gateway.available &&
      request.payment.amountPaise > 0 &&
      request.payment.status !== 'paid' &&
      request.payment.status !== 'not_required';

    if (paymentDue) {
      request.status = 'pending_payment';
      request.assignedDoctorUserId = offer.doctorUserId;
      request.paymentHoldExpiresAt = homeVisitPaymentHoldExpires(now);
      await request.save();
      const withOrder = await this.ensureOrder(request);
      this.notifications.paymentRequired(withOrder);
      this.notifications.statusUpdated(withOrder, await this.doctorName(offer.doctorUserId), previous);
    } else {
      request.status = 'accepted';
      request.assignedDoctorUserId = offer.doctorUserId;
      this.assignArrivalVerificationCode(request);
      await request.save();
      if (request.arrivalVerificationCode) {
        this.notifications.arrivalCodeReady(request, request.arrivalVerificationCode);
      }
      this.notifications.statusUpdated(request, await this.doctorName(offer.doctorUserId), previous);
    }
    return {
      id: updated.id,
      homeVisitRequestId: updated.homeVisitRequestId.toString(),
      status: updated.status,
      expiresAt: updated.expiresAt.toISOString(),
    };
  }

  private async ensureOrder(doc: HomeVisitRequestDocument): Promise<HomeVisitRequestDocument> {
    if (doc.payment.orderId) return doc;
    let orderId: string;
    try {
      const order = await this.gateway.createOrder({
        amountPaise: doc.payment.amountPaise,
        receipt: doc.id,
        notes: { homeVisitRequestId: doc.id },
      });
      if (order.amountPaise !== doc.payment.amountPaise || order.currency !== 'INR') {
        this.logger.error(`Payment order for home visit ${doc.id} has the wrong amount`);
        throw paymentsUnavailable();
      }
      orderId = order.orderId;
    } catch (error) {
      doc.status = 'cancelled';
      doc.paymentHoldExpiresAt = null;
      await doc.save();
      throw error;
    }
    const updated = await this.requests
      .findOneAndUpdate(
        { _id: doc._id, 'payment.orderId': null },
        { $set: { 'payment.orderId': orderId } },
        { returnDocument: 'after' },
      )
      .exec();
    return updated ?? (doc as HomeVisitRequestDocument);
  }

  private async feePaiseForDoctor(doctorUserId: string, pin: string): Promise<number> {
    const doctor = await this.users.findById(doctorUserId).select({ roles: 1 }).lean().exec();
    if (!doctor?.roles.includes('doctor')) {
      throw new BadRequestException(
        apiError('VALIDATION_FAILED', 'doctorUserId must belong to a doctor account.'),
      );
    }
    const profile = await this.profiles
      .findOne({ userId: new Types.ObjectId(doctorUserId) })
      .select({ registrationCheckedAt: 1, homeVisitServicePinCode: 1, homeVisitFeeInr: 1, availabilityStatus: 1 })
      .lean()
      .exec();
    if (!profile?.registrationCheckedAt) {
      throw new BadRequestException(
        apiError('DOCTOR_NOT_VERIFIED', 'This doctor is not verified for home visits.'),
      );
    }
    const doctorPin = profile.homeVisitServicePinCode
      ? normalizeIndiaPin(profile.homeVisitServicePinCode)
      : null;
    if (!doctorPin || doctorPin !== pin) {
      throw new BadRequestException(
        apiError(
          'PIN_MISMATCH',
          'This doctor is not available for home visits in your PIN area.',
        ),
      );
    }
    if (profile.homeVisitFeeInr === null || profile.homeVisitFeeInr === undefined) {
      throw new BadRequestException(
        apiError('DOCTOR_HOME_VISIT_FEE_REQUIRED', 'This doctor has not set a home visit fee yet.'),
      );
    }
    if (!acceptsNewBookings(profile.availabilityStatus)) {
      throw new ConflictException(
        apiError('DOCTOR_NOT_AVAILABLE', 'This doctor is not taking home visits right now.'),
      );
    }
    return profile.homeVisitFeeInr * 100;
  }

  private async sendDispatchOffer(
    request: HomeVisitRequestDocument,
    doctorUserId: string,
  ): Promise<HomeVisitRequestDocument> {
    const doctorId = new Types.ObjectId(doctorUserId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DISPATCH_OFFER_TTL_MINUTES * 60 * 1000);
    await this.offers.updateMany(
      { homeVisitRequestId: request._id, status: 'offered' },
      { $set: { status: 'withdrawn', respondedAt: now } },
    );
    await this.offers.create({
      homeVisitRequestId: request._id,
      doctorUserId: doctorId,
      status: 'offered',
      expiresAt,
      respondedAt: null,
    });
    request.assignedDoctorUserId = doctorId;
    request.status = 'offered';
    await request.save();
    this.notifications.dispatchOffer(doctorUserId, request);
    return request;
  }

  private assignArrivalVerificationCode(doc: HomeVisitRequestDocument): void {
    if (doc.arrivalVerifiedAt) return;
    if (doc.arrivalVerificationCode) return;
    doc.arrivalVerificationCode = generateHomeVisitArrivalCode();
    doc.arrivalCodeIssuedAt = new Date();
  }

  private async ensureArrivalVerificationCode(doc: HomeVisitRequestDocument): Promise<void> {
    if (doc.arrivalVerifiedAt) return;
    if (doc.status !== 'accepted' && doc.status !== 'en_route') return;
    if (doc.arrivalVerificationCode) return;
    this.assignArrivalVerificationCode(doc);
    await doc.save();
    if (doc.arrivalVerificationCode) {
      this.notifications.arrivalCodeReady(doc, doc.arrivalVerificationCode);
    }
  }

  private async findOwned(auth: AuthContext, requestId: string): Promise<HomeVisitRequestDocument> {
    const doc = await this.requests.findById(requestId).exec();
    if (!doc || doc.patientUserId.toString() !== auth.userId) {
      throw notFound();
    }
    return doc;
  }

  private async doctorName(doctorUserId: Types.ObjectId | null | undefined): Promise<string | null> {
    if (!doctorUserId) return null;
    const doctor = await this.users.findById(doctorUserId).select({ fullName: 1 }).lean().exec();
    return (doctor?.fullName as string | undefined) ?? null;
  }

  private async toPatientDto(doc: HomeVisitRequestDocument) {
    const now = new Date();
    if (
      doc.status === 'en_route' ||
      doc.status === 'arrived' ||
      doc.status === 'accepted'
    ) {
      await this.ensureDestinationGeocoded(doc);
    }
    if (doc.status === 'accepted' || doc.status === 'en_route') {
      await this.ensureArrivalVerificationCode(doc);
    }
    let assignedDoctorName: string | null = null;
    if (doc.assignedDoctorUserId) {
      assignedDoctorName = await this.doctorName(doc.assignedDoctorUserId);
    }
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
      assignedDoctorName,
      fee: { amountMinor: doc.quotedFeeMinor, currency: doc.currency },
      paymentStatus: doc.payment?.status ?? 'not_required',
      checkout: doc.payment ? homeVisitCheckout(doc, this.gateway, now) : null,
      paymentHoldExpiresAt: doc.paymentHoldExpiresAt?.toISOString() ?? null,
      tracking: await buildHomeVisitLiveTracking(doc, this.maps),
      arrivalVerificationCode:
        (doc.status === 'accepted' || doc.status === 'en_route') && !doc.arrivalVerifiedAt
          ? doc.arrivalVerificationCode
          : null,
      arrivalVerifiedAt: doc.arrivalVerifiedAt?.toISOString() ?? null,
      createdAt: (doc.get('createdAt') as Date).toISOString(),
      updatedAt: (doc.get('updatedAt') as Date).toISOString(),
    };
  }
}
