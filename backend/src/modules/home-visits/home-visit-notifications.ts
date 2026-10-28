import { Injectable, Logger } from '@nestjs/common';
import { InjectConfig } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';
import { InjectMailTransport, type MailTransport } from '../mail/mail-transport';
import { UsersService } from '../users/users.service';
import type { HomeVisitRequestDocument } from './home-visit-request.schema';
import { homeVisitStatusLabelForEmail } from './home-visit-status-label';

const doctorTitle = (name: string) => (/^dr\.?\s/i.test(name) ? name : `Dr. ${name}`);

@Injectable()
export class HomeVisitNotifications {
  private readonly logger = new Logger(HomeVisitNotifications.name);

  constructor(
    @InjectMailTransport() private readonly mail: MailTransport,
    private readonly users: UsersService,
    @InjectConfig() private readonly config: Env,
  ) {}

  requestReceived(doc: HomeVisitRequestDocument): void {
    this.toPatient(doc, 'Home visit request sent', [
      `We sent your doctor-at-home request for PIN ${doc.pinCode} to the doctor you chose.`,
      'They must accept before you pay.',
      '',
      `Address: ${doc.addressLine1}${doc.locality ? `, ${doc.locality}` : ''}`,
      `Preferred window: ${doc.preferredWindow.replaceAll('_', ' ')}`,
      '',
      `Track status: ${this.config.APP_BASE_URL}/doctor-at-home/visits/${doc.id}`,
    ]);
  }

  paymentRequired(doc: HomeVisitRequestDocument): void {
    this.toPatient(doc, 'Your doctor accepted — complete payment', [
      `Your doctor accepted the home visit. Pay the visit fee to confirm the booking.`,
      '',
      `Amount: ₹${(doc.payment.amountPaise / 100).toFixed(0)}`,
      '',
      `Pay here: ${this.config.APP_BASE_URL}/doctor-at-home/visits/${doc.id}`,
    ]);
  }

  arrivalCodeReady(doc: HomeVisitRequestDocument, code: string): void {
    this.toPatient(doc, 'Your home visit arrival code', [
      'When your doctor arrives, share this 6-digit code so they can start the visit.',
      '',
      `Arrival code: ${code}`,
      '',
      `You can also see this on your visit page: ${this.config.APP_BASE_URL}/doctor-at-home/visits/${doc.id}`,
    ]);
  }

  statusUpdated(
    doc: HomeVisitRequestDocument,
    assignedDoctorName: string | null,
    previousStatus: string,
  ): void {
    const label = homeVisitStatusLabelForEmail(doc.status);
    const doctorLine =
      assignedDoctorName && doc.status !== 'cancelled'
        ? `${doctorTitle(assignedDoctorName)} is involved in this visit.`
        : '';
    this.toPatient(doc, `Home visit update: ${label}`, [
      `Your home visit status changed from ${homeVisitStatusLabelForEmail(previousStatus)} to ${label}.`,
      ...(doctorLine ? ['', doctorLine] : []),
      '',
      `Details: ${this.config.APP_BASE_URL}/doctor-at-home/visits/${doc.id}`,
    ]);
  }

  dispatchOffer(doctorUserId: string, doc: HomeVisitRequestDocument): void {
    this.toUser(doctorUserId, 'New home visit dispatch offer', [
      `Operations assigned you a home visit in PIN ${doc.pinCode}.`,
      '',
      `Address: ${doc.addressLine1}`,
      `Concern: ${doc.chiefComplaint.slice(0, 120)}${doc.chiefComplaint.length > 120 ? '…' : ''}`,
      '',
      `Accept or view: ${this.config.APP_BASE_URL}/doctor`,
    ]);
  }

  cancelledByPatient(doc: HomeVisitRequestDocument, refunding: boolean): void {
    const refundLine = refunding
      ? `Your payment of ₹${(doc.payment.amountPaise / 100).toFixed(0)} is being refunded to the original payment method.`
      : '';
    this.toPatient(doc, 'Home visit request cancelled', [
      'You cancelled your doctor-at-home request.',
      ...(refundLine ? ['', refundLine] : []),
      '',
      `Book again when ready: ${this.config.APP_BASE_URL}/doctor-at-home`,
    ]);
  }

  private toPatient(doc: HomeVisitRequestDocument, subject: string, lines: string[]): void {
    this.toUser(doc.patientUserId.toString(), subject, lines);
  }

  private toUser(userId: string, subject: string, lines: string[]): void {
    if (!this.mail.available) return;
    const run = async () => {
      const user = await this.users.findById(userId);
      if (!user) return;
      const greeting = `Hello ${user.fullName.split(' ')[0] ?? user.fullName},`;
      await this.mail.send({ to: user.email, subject, text: [greeting, '', ...lines].join('\n') });
    };
    run().catch((error: unknown) => {
      this.logger.error(
        `Failed to send home visit email: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    });
  }
}
