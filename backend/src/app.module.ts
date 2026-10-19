import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { buildLoggerParams } from './common/logging/logger-params';
import { AppConfigModule } from './config/app-config.module';
import type { Env } from './config/env.schema';
import { DatabaseModule } from './database/database.module';
import { AccessControlModule } from './modules/access-control/access-control.module';
import { AccountModule } from './modules/account/account.module';
import { PermissionsGuard } from './modules/access-control/permissions.guard';
import { AdminModule } from './modules/admin/admin.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { isAuthRateLimited } from './modules/auth/decorators';
import { CsrfGuard } from './modules/auth/guards/csrf.guard';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { DoctorsModule } from './modules/doctors/doctors.module';
import { SessionAuthGuard } from './modules/auth/guards/session-auth.guard';
import { CalendarModule } from './modules/calendar/calendar.module';
import { HealthModule } from './modules/health/health.module';
import { HomeVisitsModule } from './modules/home-visits/home-visits.module';
import { OperationsModule } from './modules/operations/operations.module';
import { UsersModule } from './modules/users/users.module';

@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        AppConfigModule.forRoot(env),
        LoggerModule.forRoot(buildLoggerParams(env)),
        ThrottlerModule.forRoot({
          throttlers: [
            { name: 'default', ttl: 60_000, limit: env.RATE_LIMIT_PER_MINUTE },
            {
              name: 'auth',
              ttl: 60_000,
              limit: env.AUTH_RATE_LIMIT_PER_MINUTE,
              skipIf: (context) => !isAuthRateLimited(context),
            },
          ],
        }),
        DatabaseModule.forRoot(env),
        AuditModule,
        UsersModule,
        AccessControlModule,
        AuthModule,
        AdminModule,
        DoctorsModule,
        AppointmentsModule,
        CalendarModule,
        DashboardsModule,
        AccountModule,
        HealthModule,
        HomeVisitsModule,
        OperationsModule,
      ],
      // Global guards run in this order: rate limit → session → CSRF → permissions.
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useExisting: SessionAuthGuard },
        { provide: APP_GUARD, useExisting: CsrfGuard },
        { provide: APP_GUARD, useExisting: PermissionsGuard },
      ],
    };
  }
}
