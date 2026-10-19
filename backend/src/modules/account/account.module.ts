import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DoctorsModule } from '../doctors/doctors.module';
import { UsersModule } from '../users/users.module';
import { AccountDeletionService } from './account-deletion.service';
import { AccountController } from './account.controller';

@Module({
  imports: [AuthModule, UsersModule, DoctorsModule, AppointmentsModule, AuditModule],
  controllers: [AccountController],
  providers: [AccountDeletionService],
})
export class AccountModule {}
