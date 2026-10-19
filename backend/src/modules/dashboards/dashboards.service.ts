import { Injectable, NotFoundException } from '@nestjs/common';
import type { AppointmentDocument } from '../appointments/appointment.schema';
import { AppointmentsService } from '../appointments/appointments.service';
import { SchedulesService } from '../appointments/schedules.service';
import type { AuthContext } from '../auth/auth-context';
import { DoctorApplicationsService } from '../doctors/doctor-applications.service';
import { doctorNextSteps, profileCompletionOf } from '../doctors/doctor-next-steps';
import {
  acceptsNewBookings,
  shownAvailability,
  type AvailabilityStatus,
} from '../doctors/doctor-profile.schema';
import { videoOpensAt } from '../appointments/booking-rules';
import { DoctorProfilesService, missingForPublish } from '../doctors/doctor-profiles.service';
import { effectiveDoctorVerification } from '../users/doctor-verification';
import type { DoctorVerificationStatus } from '../users/doctor-verification';
import { UsersService } from '../users/users.service';
import { InjectVideoGateway, type VideoGateway } from '../video/video-gateway';
import { InjectConfig } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';
import {
  homeVisitBookingClosedMessage,
  isHomeVisitBookingOpen,
} from '../home-visits/home-visit-booking';
import { HomeVisitRequestsService } from '../home-visits/home-visit-requests.service';

const RECORDS_MESSAGE =
  'Prescriptions and uploaded medical records are not available yet. Nothing here is a clinical record.';
const INVOICE_MESSAGE =
  'These are payments recorded on your appointments. Formal GST invoices are not issued yet.';

function appointmentPreview(item: AppointmentDocument) {
  return {
    id: item.id,
    startsAt: item.startsAt.toISOString(),
    endsAt: item.endsAt.toISOString(),
    mode: item.mode,
    status: item.status,
    feeInr: item.feeInr,
    paymentStatus: item.payment.status,
    doctorName: item.doctor.displayName,
    specialty: item.doctor.specialty,
  };
}

@Injectable()
export class DashboardsService {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly schedules: SchedulesService,
    private readonly profiles: DoctorProfilesService,
    private readonly applications: DoctorApplicationsService,
    private readonly users: UsersService,
    @InjectVideoGateway() private readonly video: VideoGateway,
    private readonly homeVisitRequests: HomeVisitRequestsService,
    @InjectConfig() private readonly env: Env,
  ) {}

  async patient(auth: AuthContext) {
    const data = await this.appointments.patientDashboard(auth);
    const totalFor = (status: string) =>
      data.paymentTotals.find((row) => row._id === status)?.total ?? 0;
    const paidInr = totalFor('paid');
    const pendingInr = totalFor('pending');
    const refundedInr = totalFor('refunded');
    const homeBookingOpen = isHomeVisitBookingOpen(this.env);
    const homeVisitCount = await this.homeVisitRequests.countActiveForPatient(auth.userId);
    return {
      upcomingCount: data.upcomingCount,
      previousCount: data.previousCount,
      upcoming: data.upcoming.map(appointmentPreview),
      previous: data.previous.map(appointmentPreview),
      onlineConsultations: {
        count: data.onlineCount,
        items: [...data.upcoming, ...data.previous]
          .filter((item) => item.mode === 'online')
          .map(appointmentPreview),
      },
      homeVisits: {
        available: homeBookingOpen,
        count: homeVisitCount,
        message: homeBookingOpen
          ? 'Track open doctor-at-home requests from this dashboard.'
          : homeVisitBookingClosedMessage(),
      },
      records: { available: false as const, message: RECORDS_MESSAGE },
      payments: {
        currency: 'INR' as const,
        paidInr,
        pendingInr,
        refundedInr,
        message: INVOICE_MESSAGE,
        items: data.payments.map((item) => ({
          appointmentId: item.id,
          status: item.payment.status,
          amountInr: item.feeInr,
          paidAt: item.payment.paidAt?.toISOString() ?? null,
          doctorName: item.doctor.displayName,
        })),
      },
    };
  }

  async doctor(auth: AuthContext) {
    const user = await this.users.findById(auth.userId);
    if (!user) throw new NotFoundException();
    const verification = effectiveDoctorVerification(user.roles, user.doctorVerification);
    const standing: DoctorVerificationStatus = verification ?? 'pending';
    const application = await this.applications.findLatestForUser(auth.userId);
    let profile: Awaited<ReturnType<DoctorProfilesService['findMine']>> | null = null;
    try {
      profile = await this.profiles.findMine(auth.userId);
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }
    const schedule = await this.schedules.findMine(auth.userId);
    const missing = profile ? missingForPublish(profile) : ['your medical registration'];
    const completion = profileCompletionOf(profile ? missing : ['your medical registration']);
    const availability: AvailabilityStatus | null = profile
      ? shownAvailability(profile.availabilityStatus)
      : null;
    const care = await this.appointments.doctorDashboard(auth);
    const nextAvailableDate =
      profile && profile.published && acceptsNewBookings(profile.availabilityStatus)
        ? await this.schedules.nextAvailableDateForDirectory(profile)
        : null;
    return {
      verificationStatus: standing,
      availabilityStatus: availability,
      profileCompletion: completion,
      suspensionNote: standing === 'suspended' ? user.doctorStatusNote : null,
      nextSteps: doctorNextSteps({
        verification: standing,
        availability,
        profileCompletion: completion,
        published: profile?.published ?? false,
        hasApplication: application !== null,
        hasHours: (schedule?.rules.length ?? 0) > 0,
        hasOnlineHours: schedule?.rules.some((rule) => rule.mode === 'online') ?? false,
        videoPlatformReady: this.video.available,
        offersVideoOnProfile: profile?.consultationModes.includes('online') ?? false,
        rejectionReason: application?.status === 'rejected' ? application.rejectionReason : null,
        pendingBookingApprovals: care.pendingApprovalCount,
      }),
      application: application
        ? {
            id: application.id,
            status: application.status,
            registrationNumber: application.registrationNumber,
            registrationCouncil: application.registrationCouncil,
            registrationYear: application.registrationYear,
            qualification: application.qualification,
            specialty: application.specialty,
            rejectionReason: application.rejectionReason,
          }
        : null,
      profile: profile
        ? {
            slug: profile.slug,
            displayName: profile.displayName,
            specialty: profile.specialty,
            qualification: profile.qualification,
            consultationModes: [...profile.consultationModes],
            consultationFeeInr: profile.consultationFeeInr,
            published: profile.published,
            missing,
            nextAvailableDate,
          }
        : null,
      schedule: {
        blocks: schedule?.rules.length ?? 0,
        daysOff: schedule?.daysOff.length ?? 0,
        onlineBlocks: schedule?.rules.filter((rule) => rule.mode === 'online').length ?? 0,
      },
      video: {
        offeredOnProfile: profile?.consultationModes.includes('online') ?? false,
        platformReady: this.video.available,
        patientBookingOpen:
          this.video.available && (profile?.consultationModes.includes('online') ?? false),
      },
      appointments: {
        upcomingCount: care.upcomingCount,
        pastCount: care.pastCount,
        pendingApprovalCount: care.pendingApprovalCount,
        upcoming: care.upcoming.map((item) => ({
          id: item.id,
          patientName: item.patientName,
          startsAt: item.startsAt.toISOString(),
          endsAt: item.endsAt.toISOString(),
          mode: item.mode,
          status: item.status,
          videoOpensAt:
            item.mode === 'online' && item.status === 'confirmed'
              ? videoOpensAt(item.startsAt).toISOString()
              : null,
        })),
      },
    };
  }
}
