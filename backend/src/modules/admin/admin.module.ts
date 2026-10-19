import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { AdminUsersController } from './admin-users.controller';

@Module({
  imports: [UsersModule, AuditModule],
  controllers: [AdminUsersController],
})
export class AdminModule {}
