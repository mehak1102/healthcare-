import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AccountRecoveryService } from './account-recovery.service';
import { AccountToken, AccountTokenSchema } from './account-token.schema';
import { AccountTokensService } from './account-tokens.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CsrfGuard } from './guards/csrf.guard';
import { MfaController } from './mfa/mfa.controller';
import { MfaService } from './mfa/mfa.service';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { PasswordService } from './password.service';
import { Session, SessionSchema } from './session.schema';
import { SessionsService } from './sessions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Session.name, schema: SessionSchema },
      { name: AccountToken.name, schema: AccountTokenSchema },
    ]),
    UsersModule,
    AuditModule,
    MailModule,
  ],
  controllers: [AuthController, MfaController],
  providers: [
    AuthService,
    MfaService,
    AccountRecoveryService,
    AccountTokensService,
    SessionsService,
    PasswordService,
    SessionAuthGuard,
    CsrfGuard,
  ],
  exports: [
    SessionsService,
    PasswordService,
    MfaService,
    AccountTokensService,
    SessionAuthGuard,
    CsrfGuard,
  ],
})
export class AuthModule {}
