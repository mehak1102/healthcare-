import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AdminDoctorApplicationsController } from './admin-doctor-applications.controller';
import { DoctorApplication, DoctorApplicationSchema } from './doctor-application.schema';
import { DoctorApplicationsController } from './doctor-applications.controller';
import { DoctorApplicationsService } from './doctor-applications.service';
import { DoctorDirectoryController } from './doctor-directory.controller';
import { AdminDoctorStandingController } from './admin-doctor-standing.controller';
import { DoctorProfileController } from './doctor-profile.controller';
import { DoctorProfile, DoctorProfileSchema } from './doctor-profile.schema';
import { DoctorProfilesService } from './doctor-profiles.service';
import { DoctorStandingService } from './doctor-standing.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DoctorApplication.name, schema: DoctorApplicationSchema },
      { name: DoctorProfile.name, schema: DoctorProfileSchema },
    ]),
    UsersModule,
    AuditModule,
    MailModule,
    forwardRef(() => AppointmentsModule),
  ],
  controllers: [
    DoctorApplicationsController,
    AdminDoctorApplicationsController,
    DoctorProfileController,
    DoctorDirectoryController,
    AdminDoctorStandingController,
  ],
  providers: [DoctorApplicationsService, DoctorProfilesService, DoctorStandingService],
  exports: [DoctorProfilesService, DoctorApplicationsService],
})
export class DoctorsModule {}
