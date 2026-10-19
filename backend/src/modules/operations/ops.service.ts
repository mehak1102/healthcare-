import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { InjectConfig } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';
import { Appointment } from '../appointments/appointment.schema';
import { addDays, istDate, istInstant } from '../appointments/ist-time';
import { DoctorApplication } from '../doctors/doctor-application.schema';
import { DoctorProfile } from '../doctors/doctor-profile.schema';
import { isHomeVisitBookingOpen } from '../home-visits/home-visit-booking';
import { HomeVisitRequestsService } from '../home-visits/home-visit-requests.service';
import { ServiceArea } from '../home-visits/service-area.schema';
import { InjectPaymentGateway, type PaymentGateway } from '../payments/payment-gateway';
import { InjectVideoGateway, type VideoGateway } from '../video/video-gateway';
import type { OpsSummaryDto } from './dto/ops-summary.dto';

@Injectable()
export class OpsService {
  constructor(
    @InjectModel(Appointment.name) private readonly appointments: Model<Appointment>,
    @InjectModel(DoctorApplication.name) private readonly applications: Model<DoctorApplication>,
    @InjectModel(DoctorProfile.name) private readonly profiles: Model<DoctorProfile>,
    @InjectModel(ServiceArea.name) private readonly serviceAreas: Model<ServiceArea>,
    @InjectVideoGateway() private readonly video: VideoGateway,
    @InjectPaymentGateway() private readonly payments: PaymentGateway,
    private readonly homeVisits: HomeVisitRequestsService,
    @InjectConfig() private readonly env: Env,
  ) {}

  async summary(now = new Date()): Promise<OpsSummaryDto> {
    const today = istDate(now);
    const startToday = istInstant(today, 0);
    const endToday = istInstant(addDays(today, 1), 0);
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [
      pendingApplications,
      pendingDoctorApproval,
      confirmedToday,
      startingNext24Hours,
      publishedDoctors,
      takingBookings,
      pilotPinCount,
      openHomeVisitRequests,
    ] = await Promise.all([
      this.applications.countDocuments({ status: 'pending' }).exec(),
      this.appointments
        .countDocuments({ status: 'pending_doctor', endsAt: { $gt: now } })
        .exec(),
      this.appointments
        .countDocuments({
          status: 'confirmed',
          startsAt: { $gte: startToday, $lt: endToday },
        })
        .exec(),
      this.appointments
        .countDocuments({
          status: 'confirmed',
          startsAt: { $gte: now, $lte: next24h },
        })
        .exec(),
      this.profiles.countDocuments({ published: true }).exec(),
      this.profiles
        .countDocuments({ published: true, availabilityStatus: 'available' })
        .exec(),
      this.serviceAreas.countDocuments({ active: true }).exec(),
      this.homeVisits.countActive(),
    ]);

    return {
      generatedAt: now.toISOString(),
      timezone: 'Asia/Kolkata',
      doctorApplications: { pending: pendingApplications },
      appointments: {
        pendingDoctorApproval,
        confirmedToday,
        startingNext24Hours,
      },
      directory: { publishedDoctors, takingBookings },
      homeVisits: {
        pilotPinCount,
        bookingOpen: isHomeVisitBookingOpen(this.env),
        openRequests: openHomeVisitRequests,
      },
      integrations: {
        videoCalls: this.video.available,
        paymentWebhooks: this.payments.webhooksEnabled,
      },
    };
  }
}
