import { ConflictException, HttpException, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { apiError, isApiErrorBody } from '../../common/http/api-error';
import type { RequestMeta } from '../../common/http/app-request';
import type { Role } from '../access-control/roles';
import { AppointmentsService } from '../appointments/appointments.service';
import { AuditService } from '../audit/audit.service';
import { AccountTokensService } from '../auth/account-tokens.service';
import type { AuthContext } from '../auth/auth-context';
import { MfaService } from '../auth/mfa/mfa.service';
import { SessionsService } from '../auth/sessions.service';
import { DoctorApplicationsService } from '../doctors/doctor-applications.service';
import { UsersService } from '../users/users.service';
import type { DeleteAccountDto } from './dto/delete-account.dto';

const ADMIN_ROLES: readonly Role[] = ['platform_admin', 'super_admin'];
const ACTION = 'account.delete';

/**
 * Self-service account deletion. Removes the account, its sign-ins, emailed links, doctor
 * application, public profile and timetable in one transaction. Past appointments (with their
 * name snapshots) and audit events are kept as medical, financial and security records.
 */
@Injectable()
export class AccountDeletionService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly mfa: MfaService,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly tokens: AccountTokensService,
    private readonly doctors: DoctorApplicationsService,
    private readonly appointments: AppointmentsService,
    private readonly audit: AuditService,
  ) {}

  async deleteOwnAccount(auth: AuthContext, dto: DeleteAccountDto, meta: RequestMeta) {
    const user = await this.mfa.confirmIdentity(auth.userId, dto.password, dto.code, ACTION, meta);
    const refuse = async (error: HttpException) => {
      const body = error.getResponse();
      await this.audit.record({
        action: ACTION,
        outcome: 'denied',
        actorUserId: user.id,
        requestId: meta.requestId,
        ipAddress: meta.ipAddress,
        metadata: { reason: isApiErrorBody(body) ? body.code : 'refused' },
      });
      return error;
    };

    if (
      user.roles.some((role) => ADMIN_ROLES.includes(role)) &&
      (await this.users.countOthersWithRole(ADMIN_ROLES, user._id)) === 0
    ) {
      throw await refuse(
        new ConflictException(
          apiError(
            'LAST_ADMIN',
            'You are the only admin. Make another account an admin before deleting this one.',
          ),
        ),
      );
    }

    try {
      await this.connection.transaction(async (session) => {
        await this.appointments.prepareAccountDeletion(user._id, session);
        const doctor = await this.doctors.deleteForUser(user._id, session);
        await this.tokens.deleteAllForUser(user._id, session);
        await this.sessions.deleteAllForUser(user._id, session);
        await this.users.deleteById(user._id, session);
        await this.audit.record(
          {
            action: ACTION,
            outcome: 'success',
            actorUserId: user.id,
            targetType: 'user',
            targetId: user.id,
            requestId: meta.requestId,
            ipAddress: meta.ipAddress,
            metadata: { roles: user.roles.join(','), doctorProfile: doctor.profiles > 0 },
          },
          session,
        );
      });
    } catch (error) {
      if (error instanceof ConflictException) throw await refuse(error);
      throw error;
    }
  }
}
