import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PermissionsGuard } from './permissions.guard';

@Module({
  imports: [AuditModule],
  providers: [PermissionsGuard],
  exports: [PermissionsGuard],
})
export class AccessControlModule {}
