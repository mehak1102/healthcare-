import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { Appointment, AppointmentSchema } from '../appointments/appointment.schema';
import { DoctorApplication, DoctorApplicationSchema } from '../doctors/doctor-application.schema';
import { DoctorProfile, DoctorProfileSchema } from '../doctors/doctor-profile.schema';
import { HomeVisitsModule } from '../home-visits/home-visits.module';
import { ServiceArea, ServiceAreaSchema } from '../home-visits/service-area.schema';
import { PaymentsModule } from '../payments/payments.module';
import { VideoModule } from '../video/video.module';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentSchema },
      { name: DoctorApplication.name, schema: DoctorApplicationSchema },
      { name: DoctorProfile.name, schema: DoctorProfileSchema },
      { name: ServiceArea.name, schema: ServiceAreaSchema },
    ]),
    AuditModule,
    HomeVisitsModule,
    VideoModule,
    PaymentsModule,
  ],
  controllers: [OpsController],
  providers: [OpsService],
})
export class OperationsModule {}
