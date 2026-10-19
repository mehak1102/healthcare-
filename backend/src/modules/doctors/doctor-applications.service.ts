import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { type ClientSession, type Connection, Model, mongo, Types } from 'mongoose';
import { InjectConfig } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';
import { apiError } from '../../common/http/api-error';
import type { RequestMeta } from '../../common/http/app-request';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import { InjectMailTransport, type MailTransport } from '../mail/mail-transport';
import { effectiveDoctorVerification } from '../users/doctor-verification';
import { UsersService } from '../users/users.service';
import {
  DoctorApplication,
  type DoctorApplicationDocument,
  type DoctorApplicationStatus,
} from './doctor-application.schema';
import { DoctorProfilesService } from './doctor-profiles.service';
import type {
  ApproveDoctorApplicationDto,
  RejectDoctorApplicationDto,
  SubmitDoctorApplicationDto,
} from './dto/doctor-applications.dto';

/** Case, spacing and punctuation differences must not let one registration be claimed twice. */
export const registrationKey = (council: string, number: string): string => {
  const normalise = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return `${normalise(council)}:${normalise(number)}`;
};

const notFound = () =>
  new NotFoundException(apiError('NOT_FOUND', 'This application does not exist.'));

const alreadyReviewed = () =>
  new ConflictException(
    apiError('APPLICATION_ALREADY_REVIEWED', 'This application has already been reviewed.'),
  );

@Injectable()
export class DoctorApplicationsService {
  private readonly logger = new Logger(DoctorApplicationsService.name);

  constructor(
    @InjectModel(DoctorApplication.name)
    private readonly applications: Model<DoctorApplication>,
    @InjectConnection() private readonly connection: Connection,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly profiles: DoctorProfilesService,
    @InjectMailTransport() private readonly mail: MailTransport,
    @InjectConfig() private readonly config: Env,
  ) {}

  /** Part of account deletion; removes the applications and the public profile. */
  async deleteForUser(
    userId: Types.ObjectId,
    session: ClientSession,
  ): Promise<{ applications: number; profiles: number }> {
    const result = await this.applications.deleteMany({ userId }, { session }).exec();
    return {
      applications: result.deletedCount,
      profiles: await this.profiles.deleteForUser(userId, session),
    };
  }

  async submit(
    auth: AuthContext,
    input: SubmitDoctorApplicationDto,
    meta: RequestMeta,
  ): Promise<DoctorApplicationDocument> {
    if (input.registrationYear > new Date().getFullYear()) {
      throw new BadRequestException(
        apiError('VALIDATION_FAILED', 'The request is invalid.', [
          'registrationYear cannot be in the future',
        ]),
      );
    }
    await this.assertMaySubmitCredentials(auth);

    let application: DoctorApplicationDocument;
    try {
      application = await this.applications.create({
        userId: new Types.ObjectId(auth.userId),
        registrationNumber: input.registrationNumber,
        registrationCouncil: input.registrationCouncil,
        registrationYear: input.registrationYear,
        qualification: input.qualification,
        specialty: input.specialty,
        registrationKey: registrationKey(input.registrationCouncil, input.registrationNumber),
      });
    } catch (error) {
      if (error instanceof mongo.MongoServerError && error.code === 11000) {
        throw this.duplicateError(error);
      }
      throw error;
    }

    await this.audit.record({
      action: 'doctor_application.submit',
      outcome: 'success',
      actorUserId: auth.userId,
      targetType: 'doctor_application',
      targetId: application.id,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
    });
    await this.syncDraftIfDoctor(auth.userId, application);
    return application;
  }

  /** Updates the open application. Cannot change its status or verify the doctor. */
  async updatePending(
    auth: AuthContext,
    input: SubmitDoctorApplicationDto,
    meta: RequestMeta,
  ): Promise<DoctorApplicationDocument> {
    await this.assertMaySubmitCredentials(auth);
    if (input.registrationYear > new Date().getFullYear()) {
      throw new BadRequestException(
        apiError('VALIDATION_FAILED', 'The request is invalid.', [
          'registrationYear cannot be in the future',
        ]),
      );
    }
    const current = await this.findLatestForUser(auth.userId);
    if (!current || current.status !== 'pending') {
      throw new ConflictException(
        apiError(
          'APPLICATION_NOT_PENDING',
          'There is no application waiting for review to update.',
        ),
      );
    }
    if (current.userId.toString() !== auth.userId) throw notFound();

    try {
      current.set({
        registrationNumber: input.registrationNumber,
        registrationCouncil: input.registrationCouncil,
        registrationYear: input.registrationYear,
        qualification: input.qualification,
        specialty: input.specialty,
        registrationKey: registrationKey(input.registrationCouncil, input.registrationNumber),
      });
      await current.save();
    } catch (error) {
      if (error instanceof mongo.MongoServerError && error.code === 11000) {
        throw this.duplicateError(error);
      }
      throw error;
    }

    await this.audit.record({
      action: 'doctor_application.update',
      outcome: 'success',
      actorUserId: auth.userId,
      targetType: 'doctor_application',
      targetId: current.id,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
    });
    await this.syncDraftIfDoctor(auth.userId, current);
    return current;
  }

  findLatestForUser(userId: string): Promise<DoctorApplicationDocument | null> {
    return this.applications
      .findOne({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async list(query: { status: DoctorApplicationStatus; page: number; limit: number }) {
    const filter = { status: query.status };
    // Pending: oldest first so nobody waits indefinitely. Reviewed: most recent first.
    const sort: Record<string, 1 | -1> =
      query.status === 'pending' ? { createdAt: 1 } : { reviewedAt: -1 };
    const [items, total] = await Promise.all([
      this.applications
        .find(filter)
        .sort(sort)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.applications.countDocuments(filter).exec(),
    ]);
    const applicants = await this.users.findByIds(items.map((item) => item.userId));
    return { items, total, applicants: new Map(applicants.map((user) => [user.id, user])) };
  }

  /**
   * Status change, role grant and audit event commit together: an approved application always
   * means the applicant has the doctor role, and vice versa.
   */
  async approve(
    auth: AuthContext,
    id: string,
    input: ApproveDoctorApplicationDto,
    meta: RequestMeta,
  ): Promise<DoctorApplicationDocument> {
    const application = await this.findReviewable(auth, id, meta);

    const approved = await this.connection.transaction(async (session) => {
      const updated = await this.applications
        .findOneAndUpdate(
          { _id: application._id, status: 'pending' },
          {
            $set: {
              status: 'approved',
              reviewedBy: new Types.ObjectId(auth.userId),
              reviewedAt: new Date(),
              reviewNote: input.note || null,
            },
          },
          { returnDocument: 'after', session },
        )
        .exec();
      if (!updated) throw alreadyReviewed();

      await this.users.addRole(updated.userId, 'doctor', session);
      await this.users.setDoctorVerification(updated.userId, 'verified', session, null);
      const applicant = await this.users.findById(updated.userId.toString());
      if (!applicant) throw notFound();
      await this.profiles.createFromApproval(updated, applicant.fullName, session);
      await this.audit.record(
        {
          action: 'doctor_application.approve',
          outcome: 'success',
          actorUserId: auth.userId,
          targetType: 'doctor_application',
          targetId: updated.id,
          requestId: meta.requestId,
          ipAddress: meta.ipAddress,
          metadata: { registerChecked: true, applicantUserId: updated.userId.toString() },
        },
        session,
      );
      return updated;
    });

    this.notify(approved, 'approved');
    return approved;
  }

  async reject(
    auth: AuthContext,
    id: string,
    input: RejectDoctorApplicationDto,
    meta: RequestMeta,
  ): Promise<DoctorApplicationDocument> {
    const application = await this.findReviewable(auth, id, meta);

    const rejected = await this.connection.transaction(async (session) => {
      const updated = await this.applications
        .findOneAndUpdate(
          { _id: application._id, status: 'pending' },
          {
            $set: {
              status: 'rejected',
              claimsRegistration: false,
              reviewedBy: new Types.ObjectId(auth.userId),
              reviewedAt: new Date(),
              rejectionReason: input.reason,
            },
          },
          { returnDocument: 'after', session },
        )
        .exec();
      if (!updated) throw alreadyReviewed();

      const applicant = await this.users.findById(updated.userId.toString());
      if (applicant?.roles.includes('doctor')) {
        await this.users.setDoctorVerification(updated.userId, 'rejected', session, null);
        await this.profiles.withdrawFromDirectory(updated.userId, session);
      }

      await this.audit.record(
        {
          action: 'doctor_application.reject',
          outcome: 'success',
          actorUserId: auth.userId,
          targetType: 'doctor_application',
          targetId: updated.id,
          requestId: meta.requestId,
          ipAddress: meta.ipAddress,
          metadata: { applicantUserId: updated.userId.toString() },
        },
        session,
      );
      return updated;
    });

    this.notify(rejected, 'rejected');
    return rejected;
  }

  private async assertMaySubmitCredentials(auth: AuthContext): Promise<void> {
    const user = await this.users.findById(auth.userId);
    const verification = effectiveDoctorVerification(auth.roles, user?.doctorVerification);
    if (verification === 'verified') {
      throw new ConflictException(
        apiError('ALREADY_A_DOCTOR', 'This account is already a verified doctor.'),
      );
    }
    if (verification === 'suspended') {
      throw new ForbiddenException(
        apiError(
          'DOCTOR_SUSPENDED',
          'This doctor account is suspended, so registration details cannot be changed.',
        ),
      );
    }
  }

  private async syncDraftIfDoctor(
    userId: string,
    application: DoctorApplicationDocument,
  ): Promise<void> {
    const owner = await this.users.findById(userId);
    if (!owner?.roles.includes('doctor')) return;
    await this.profiles.syncDraftFromApplication(application, owner.fullName);
  }

  private async findReviewable(
    auth: AuthContext,
    id: string,
    meta: RequestMeta,
  ): Promise<DoctorApplicationDocument> {
    if (!Types.ObjectId.isValid(id)) throw notFound();
    const application = await this.applications.findById(id).exec();
    if (!application) throw notFound();

    if (application.userId.toString() === auth.userId) {
      await this.audit.record({
        action: 'doctor_application.review',
        outcome: 'denied',
        actorUserId: auth.userId,
        targetType: 'doctor_application',
        targetId: application.id,
        requestId: meta.requestId,
        ipAddress: meta.ipAddress,
        metadata: { reason: 'self_review' },
      });
      throw new ForbiddenException(
        apiError('SELF_REVIEW_FORBIDDEN', 'You cannot review your own application.'),
      );
    }
    if (application.status !== 'pending') throw alreadyReviewed();
    return application;
  }

  private duplicateError(error: mongo.MongoServerError): ConflictException {
    const index = String((error.errorResponse as { errmsg?: string }).errmsg ?? '');
    if (index.includes('one_pending_per_user')) {
      return new ConflictException(
        apiError('APPLICATION_PENDING', 'You already have an application waiting for review.'),
      );
    }
    return new ConflictException(
      apiError(
        'REGISTRATION_IN_USE',
        'This registration number is already linked to an application. Contact support if it is yours.',
      ),
    );
  }

  /** Outcome emails are a courtesy; the decision stands even if delivery fails. */
  private notify(application: DoctorApplicationDocument, outcome: 'approved' | 'rejected'): void {
    if (!this.mail.available) return;
    const send = async () => {
      const user = await this.users.findById(application.userId.toString());
      if (!user) return;
      const greeting = `Hello ${user.fullName.split(' ')[0] ?? user.fullName},`;
      const text =
        outcome === 'approved'
          ? [
              greeting,
              '',
              'Your application to join Sukoon Health as a doctor has been approved.',
              'Fill in your profile and publish it so patients can find you:',
              `${this.config.APP_BASE_URL}/doctor/profile`,
            ]
          : [
              greeting,
              '',
              'We could not approve your application to join Sukoon Health as a doctor.',
              `Reason: ${application.rejectionReason ?? 'not given'}`,
              '',
              `You can correct your details and apply again: ${this.config.APP_BASE_URL}/doctors/join`,
            ];
      await this.mail.send({
        to: user.email,
        subject:
          outcome === 'approved'
            ? 'Your Sukoon Health doctor application is approved'
            : 'Update on your Sukoon Health doctor application',
        text: text.join('\n'),
      });
    };
    send().catch((error: unknown) => {
      this.logger.error(
        `Failed to send doctor application email: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    });
  }
}
