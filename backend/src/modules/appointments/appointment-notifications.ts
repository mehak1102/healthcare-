import { Injectable, Logger } from '@nestjs/common';
import { InjectConfig } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';
import { InjectMailTransport, type MailTransport } from '../mail/mail-transport';
import { UsersService } from '../users/users.service';
import type { AppointmentDocument } from './appointment.schema';
import { IST_TIMEZONE } from './ist-time';

const when = (date: Date) =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date);

const doctorTitle = (name: string) => (/^dr\.?\s/i.test(name) ? name : `Dr. ${name}`);

/**
 * Appointment emails are a courtesy: the booking stands even if delivery fails. They never
 * contain the patient's note, which is health information.
 */
@Injectable()
export class AppointmentNotifications {
  private readonly logger = new Logger(AppointmentNotifications.name);

  constructor(
    @InjectMailTransport() private readonly mail: MailTransport,
    private readonly users: UsersService,
    @InjectConfig() private readonly config: Env,
  ) {}

  pendingDoctorApproval(appointment: AppointmentDocument): void {
    const doctor = doctorTitle(appointment.doctor.displayName);
    const place = this.place(appointment);
    this.toPatient(appointment, `Booking request sent to ${doctor}`, [
      `Your request for an appointment with ${doctor} (${appointment.doctor.specialty}) is waiting for the doctor to accept.`,
      '',
      `Requested time: ${when(appointment.startsAt)} (India time)`,
      `Where: ${place}`,
      appointment.feeInr > 0 ? `Paid: ₹${appointment.feeInr} (refunded if declined)` : '',
      '',
      `Track status: ${this.config.APP_BASE_URL}/appointments/${appointment.id}`,
    ]);
    this.toDoctor(appointment, 'New booking request', [
      `${appointment.patientName} requested an appointment with you.`,
      '',
      `When: ${when(appointment.startsAt)} (India time)`,
      `Where: ${place}`,
      '',
      `Accept or decline: ${this.config.APP_BASE_URL}/doctor/appointments`,
    ]);
  }

  rejectedByDoctor(
    appointment: AppointmentDocument,
    reason: string | null,
    refunding: boolean,
  ): void {
    const doctor = doctorTitle(appointment.doctor.displayName);
    const refundLine = refunding
      ? `Your payment of ₹${appointment.feeInr} is being refunded in full.`
      : '';
    this.toPatient(appointment, `Appointment request declined by ${doctor}`, [
      `${doctor} could not take your appointment on ${when(appointment.startsAt)}.`,
      ...(reason ? [`Reason: ${reason}`] : []),
      ...(refundLine ? ['', refundLine] : []),
      '',
      `Book another time: ${this.config.APP_BASE_URL}/doctors/${appointment.doctor.slug}`,
    ]);
  }

  confirmed(appointment: AppointmentDocument): void {
    const doctor = doctorTitle(appointment.doctor.displayName);
    const place = this.place(appointment);
    this.toPatient(appointment, `Appointment confirmed with ${doctor}`, [
      `Your appointment with ${doctor} (${appointment.doctor.specialty}) is confirmed.`,
      '',
      `When: ${when(appointment.startsAt)} (India time)`,
      `Where: ${place}`,
      appointment.feeInr > 0 ? `Paid: ₹${appointment.feeInr}` : 'Fee: free consultation',
      '',
      `You can cancel any time before it starts for a full refund:`,
      `${this.config.APP_BASE_URL}/appointments/${appointment.id}`,
    ]);
    this.toDoctor(appointment, 'New appointment booked', [
      `${appointment.patientName} booked an appointment with you.`,
      '',
      `When: ${when(appointment.startsAt)} (India time)`,
      `Where: ${place}`,
      '',
      `${this.config.APP_BASE_URL}/doctor/appointments`,
    ]);
  }

  cancelled(appointment: AppointmentDocument, by: 'patient' | 'doctor', refunding: boolean): void {
    const doctor = doctorTitle(appointment.doctor.displayName);
    const refundLine = refunding
      ? `Your payment of ₹${appointment.feeInr} is being refunded in full to the original payment method. Banks usually take 5–7 working days.`
      : '';
    this.toPatient(appointment, `Appointment with ${doctor} cancelled`, [
      by === 'patient'
        ? `You cancelled your appointment with ${doctor} on ${when(appointment.startsAt)}.`
        : `${doctor} had to cancel your appointment on ${when(appointment.startsAt)}.`,
      ...(by === 'doctor' && appointment.cancelReason
        ? [`Reason: ${appointment.cancelReason}`]
        : []),
      ...(refundLine ? ['', refundLine] : []),
      '',
      `Book another time: ${this.config.APP_BASE_URL}/doctors/${appointment.doctor.slug}`,
    ]);
    this.toDoctor(appointment, 'Appointment cancelled', [
      by === 'patient'
        ? `${appointment.patientName} cancelled their appointment on ${when(appointment.startsAt)}.`
        : `You cancelled the appointment with ${appointment.patientName} on ${when(appointment.startsAt)}.`,
      '',
      'The time is free again for other patients.',
    ]);
  }

  rescheduled(appointment: AppointmentDocument, previousStartsAt: Date): void {
    const doctor = doctorTitle(appointment.doctor.displayName);
    const place = this.place(appointment);
    this.toPatient(appointment, `Appointment time changed with ${doctor}`, [
      `Your appointment with ${doctor} has been moved to a new time.`,
      '',
      `Previous: ${when(previousStartsAt)} (India time)`,
      `New: ${when(appointment.startsAt)} (India time)`,
      `Where: ${place}`,
      '',
      `${this.config.APP_BASE_URL}/appointments/${appointment.id}`,
    ]);
    this.toDoctor(appointment, 'Appointment rescheduled by patient', [
      `${appointment.patientName} moved their appointment to a new time.`,
      '',
      `Previous: ${when(previousStartsAt)} (India time)`,
      `New: ${when(appointment.startsAt)} (India time)`,
      '',
      `${this.config.APP_BASE_URL}/doctor/appointments`,
    ]);
  }

  latePaymentRefunded(appointment: AppointmentDocument): void {
    this.toPatient(appointment, 'Your payment is being refunded', [
      `Your payment for the appointment on ${when(appointment.startsAt)} arrived after the slot was released, so the booking could not be confirmed.`,
      '',
      `The full amount of ₹${appointment.feeInr} is being refunded to the original payment method. Banks usually take 5–7 working days.`,
      '',
      `Choose another time: ${this.config.APP_BASE_URL}/doctors/${appointment.doctor.slug}`,
    ]);
  }

  private place(appointment: AppointmentDocument): string {
    if (appointment.mode === 'online') return 'Video consultation on Sukoon Health';
    const { clinicName, locality, city } = appointment.doctor;
    return [clinicName, locality, city].filter(Boolean).join(', ') || 'In-clinic visit';
  }

  private toPatient(appointment: AppointmentDocument, subject: string, lines: string[]): void {
    this.send(appointment.patientId.toString(), subject, lines);
  }

  private toDoctor(appointment: AppointmentDocument, subject: string, lines: string[]): void {
    this.send(appointment.doctorUserId.toString(), subject, lines);
  }

  private send(userId: string, subject: string, lines: string[]): void {
    if (!this.mail.available) return;
    const run = async () => {
      const user = await this.users.findById(userId);
      if (!user) return;
      const greeting = `Hello ${user.fullName.split(' ')[0] ?? user.fullName},`;
      await this.mail.send({ to: user.email, subject, text: [greeting, '', ...lines].join('\n') });
    };
    run().catch((error: unknown) => {
      this.logger.error(
        `Failed to send appointment email: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    });
  }
}
