import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { DoctorsModule } from '../doctors/doctors.module';
import { MailModule } from '../mail/mail.module';
import { PaymentsModule } from '../payments/payments.module';
import { UsersModule } from '../users/users.module';
import { VideoModule } from '../video/video.module';
import { AppointmentEvent, AppointmentEventSchema } from './appointment-event.schema';
import { AppointmentNotifications } from './appointment-notifications';
import { Appointment, AppointmentSchema } from './appointment.schema';
import { AppointmentsController, DoctorAppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { DoctorScheduleController, DoctorSlotsController } from './doctor-schedule.controller';
import { DoctorSchedule, DoctorScheduleSchema } from './doctor-schedule.schema';
import { PaymentWebhookEvent, PaymentWebhookEventSchema } from './payment-webhook-event.schema';
import { RazorpayWebhookController } from './razorpay-webhook.controller';
import { SchedulesService } from './schedules.service';
import { SlotReservation, SlotReservationSchema } from './slot-reservation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DoctorSchedule.name, schema: DoctorScheduleSchema },
      { name: SlotReservation.name, schema: SlotReservationSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      { name: AppointmentEvent.name, schema: AppointmentEventSchema },
      { name: PaymentWebhookEvent.name, schema: PaymentWebhookEventSchema },
    ]),
    forwardRef(() => DoctorsModule),
    PaymentsModule,
    UsersModule,
    AuditModule,
    MailModule,
    VideoModule,
  ],
  controllers: [
    DoctorScheduleController,
    DoctorSlotsController,
    AppointmentsController,
    DoctorAppointmentsController,
    RazorpayWebhookController,
  ],
  providers: [SchedulesService, AppointmentsService, AppointmentNotifications],
  exports: [AppointmentsService, SchedulesService],
})
export class AppointmentsModule {}
