import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { type Connection, Types } from 'mongoose';
import { apiError } from '../../common/http/api-error';
import type { RequestMeta } from '../../common/http/app-request';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import { UsersService } from '../users/users.service';
import { DoctorProfilesService } from './doctor-profiles.service';

const notDoctor = () =>
  new NotFoundException(apiError('NOT_FOUND', 'This doctor account does not exist.'));

@Injectable()
export class DoctorStandingService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly users: UsersService,
    private readonly profiles: DoctorProfilesService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Suspension is an administrator action. A doctor cannot suspend, verify or reject themselves.
   */
  async suspend(
    auth: AuthContext,
    userId: string,
    reason: string,
    meta: RequestMeta,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(userId)) throw notDoctor();
    if (userId === auth.userId) {
      await this.audit.record({
        action: 'doctor.verification.suspend',
        outcome: 'denied',
        actorUserId: auth.userId,
        targetType: 'user',
        targetId: userId,
        requestId: meta.requestId,
        ipAddress: meta.ipAddress,
        metadata: { reason: 'self_review' },
      });
      throw new ForbiddenException(
        apiError('SELF_REVIEW_FORBIDDEN', 'You cannot change your own verification status.'),
      );
    }

    const doctor = await this.users.findById(userId);
    if (!doctor?.roles.includes('doctor')) throw notDoctor();

    await this.connection.transaction(async (session) => {
      await this.users.setDoctorVerification(doctor._id, 'suspended', session, reason);
      await this.profiles.withdrawFromDirectory(doctor._id, session);
      await this.audit.record(
        {
          action: 'doctor.verification.suspend',
          outcome: 'success',
          actorUserId: auth.userId,
          targetType: 'user',
          targetId: doctor.id,
          requestId: meta.requestId,
          ipAddress: meta.ipAddress,
          metadata: { reason: 'admin_suspend' },
        },
        session,
      );
    });
  }
}
