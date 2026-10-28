import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { type ClientSession, Model, type PipelineStage, Types } from 'mongoose';
import { apiError } from '../../common/http/api-error';
import type { RequestMeta } from '../../common/http/app-request';
import { escapeRegex } from '../../common/validation/escape-regex';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import { effectiveDoctorVerification, LISTED_DOCTOR_MATCH } from '../users/doctor-verification';
import { UsersService } from '../users/users.service';
import type { DoctorApplicationDocument } from './doctor-application.schema';
import {
  DoctorProfile,
  type AvailabilityStatus,
  type DoctorProfileDocument,
} from './doctor-profile.schema';
import { directorySortStages } from './directory-sort';
import { consultationFeeMatch } from './fee-bands';
import type { DoctorDirectoryQueryDto, UpdateDoctorProfileDto } from './dto/doctor-profiles.dto';

export const BIO_MIN_TO_PUBLISH = 50;
/** Cap when filtering the directory by open slots (early-access scale). */
export const DIRECTORY_OPEN_SLOTS_SCAN_LIMIT = 500;
const USERS_COLLECTION = 'users';

const keyOf = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

export function slugFor(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^dr\.?\s+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return `dr-${base || 'doctor'}-${randomBytes(3).toString('hex')}`;
}

/** Everything a profile still needs before it may be listed publicly. */
export function missingForPublish(profile: {
  bio: string;
  languages: readonly string[];
  consultationModes: readonly string[];
  consultationFeeInr: number | null;
  clinicName: string | null;
  city: string | null;
}): string[] {
  const missing: string[] = [];
  if (profile.bio.trim().length < BIO_MIN_TO_PUBLISH) {
    missing.push(`an "about" section of at least ${BIO_MIN_TO_PUBLISH} characters`);
  }
  if (profile.languages.length === 0) missing.push('at least one language');
  if (profile.consultationModes.length === 0) missing.push('at least one consultation type');
  if (profile.consultationFeeInr === null) missing.push('a consultation fee');
  if (profile.consultationModes.includes('clinic')) {
    if (!profile.clinicName) missing.push('the clinic name');
    if (!profile.city) missing.push('the clinic city');
  }
  return missing;
}

const notFound = () =>
  new NotFoundException(apiError('NOT_FOUND', 'This doctor profile does not exist.'));

@Injectable()
export class DoctorProfilesService {
  constructor(
    @InjectModel(DoctorProfile.name) private readonly profiles: Model<DoctorProfile>,
    private readonly audit: AuditService,
    private readonly users: UsersService,
  ) {}

  /** Called inside the approval transaction. Reviewed fields always follow the latest approval. */
  async createFromApproval(
    application: DoctorApplicationDocument,
    displayName: string,
    session: ClientSession,
  ): Promise<void> {
    await this.profiles
      .updateOne(
        { userId: application.userId },
        {
          $set: {
            applicationId: application._id,
            displayName,
            specialty: application.specialty,
            specialtyKey: keyOf(application.specialty),
            qualification: application.qualification,
            registrationNumber: application.registrationNumber,
            registrationCouncil: application.registrationCouncil,
            registrationYear: application.registrationYear,
            registrationCheckedAt: application.reviewedAt ?? new Date(),
          },
          $setOnInsert: { slug: slugFor(displayName), availabilityStatus: 'unavailable' },
        },
        { upsert: true, session },
      )
      .exec();
  }

  findByUserId(
    userId: Types.ObjectId | string,
    session?: ClientSession,
  ): Promise<DoctorProfileDocument | null> {
    const id = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    let query = this.profiles.findOne({ userId: id });
    if (session) query = query.session(session);
    return query.exec();
  }

  /** Part of account deletion; runs inside its transaction. */
  async deleteForUser(userId: Types.ObjectId, session: ClientSession): Promise<number> {
    const result = await this.profiles.deleteMany({ userId }, { session }).exec();
    return result.deletedCount;
  }

  async saveNextAvailableCache(
    userId: Types.ObjectId | string,
    nextAvailableDate: string | null,
  ): Promise<void> {
    const id = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    await this.profiles
      .updateOne({ userId: id }, { $set: { nextAvailableDate, nextAvailableDateAt: new Date() } })
      .exec();
  }

  async findMine(userId: string): Promise<DoctorProfileDocument> {
    const profile = await this.profiles.findOne({ userId: new Types.ObjectId(userId) }).exec();
    if (!profile) {
      throw new NotFoundException(
        apiError(
          'PROFILE_NOT_FOUND',
          'Add your medical registration on your doctor dashboard to create your profile.',
        ),
      );
    }
    return profile;
  }

  async updateMine(
    auth: AuthContext,
    input: UpdateDoctorProfileDto,
    meta: RequestMeta,
  ): Promise<DoctorProfileDocument> {
    const profile = await this.findMine(auth.userId);
    const next = {
      bio: input.bio,
      languages: input.languages,
      consultationModes: input.consultationModes,
      consultationFeeInr: input.consultationFeeInr ?? null,
      clinicName: input.clinicName ?? null,
      city: input.city ?? null,
      cityKey: input.city ? keyOf(input.city) : null,
      locality: input.locality ?? null,
      ...(input.homeVisitServicePinCode !== undefined
        ? { homeVisitServicePinCode: input.homeVisitServicePinCode ?? null }
        : {}),
      ...(input.homeVisitFeeInr !== undefined
        ? { homeVisitFeeInr: input.homeVisitFeeInr ?? null }
        : {}),
      ...(input.requiresBookingApproval === undefined
        ? {}
        : { requiresBookingApproval: input.requiresBookingApproval }),
    };
    if (input.published) {
      const verification = await this.verificationOf(auth.userId);
      if (verification !== 'verified') {
        throw new ForbiddenException(
          apiError(
            'DOCTOR_NOT_VERIFIED',
            'Only a verified doctor can publish a profile. An administrator has to verify your registration first.',
          ),
        );
      }
      const missing = missingForPublish(next);
      if (missing.length > 0) {
        throw new BadRequestException(
          apiError(
            'PROFILE_INCOMPLETE',
            'Complete your profile before showing it to patients.',
            missing,
          ),
        );
      }
    }

    profile.set({
      ...next,
      published: input.published,
      publishedAt: input.published ? (profile.publishedAt ?? new Date()) : null,
    });
    await profile.save();
    await this.audit.record({
      action: 'doctor_profile.update',
      outcome: 'success',
      actorUserId: auth.userId,
      targetType: 'doctor_profile',
      targetId: profile.id,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      metadata: { published: input.published },
    });
    return profile;
  }

  /**
   * A doctor may say they are available only after an administrator has verified them.
   * Busy, on leave and unavailable never open new bookings.
   */
  async setAvailability(
    auth: AuthContext,
    availabilityStatus: AvailabilityStatus,
    meta: RequestMeta,
  ): Promise<DoctorProfileDocument> {
    const verification = await this.verificationOf(auth.userId);
    if (availabilityStatus === 'available' && verification !== 'verified') {
      throw new ForbiddenException(
        apiError(
          'DOCTOR_NOT_VERIFIED',
          'Only a verified doctor can turn on availability. An administrator has to verify your registration first.',
        ),
      );
    }
    const profile = await this.findMine(auth.userId);
    if (availabilityStatus === 'available') {
      const missing = missingForPublish(profile);
      if (missing.length > 0) {
        throw new BadRequestException(
          apiError(
            'PROFILE_INCOMPLETE',
            'Complete your profile before accepting bookings.',
            missing,
          ),
        );
      }
    }
    profile.availabilityStatus = availabilityStatus;
    await profile.save();
    await this.audit.record({
      action: 'doctor_profile.availability',
      outcome: 'success',
      actorUserId: auth.userId,
      targetType: 'doctor_profile',
      targetId: profile.id,
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      metadata: { availabilityStatus },
    });
    return profile;
  }

  /** Copies registration claims onto an unpublished draft. Does not verify the doctor. */
  async syncDraftFromApplication(
    application: DoctorApplicationDocument,
    displayName: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.profiles
      .updateOne(
        { userId: application.userId },
        {
          $set: {
            applicationId: application._id,
            displayName,
            specialty: application.specialty,
            specialtyKey: keyOf(application.specialty),
            qualification: application.qualification,
            registrationNumber: application.registrationNumber,
            registrationCouncil: application.registrationCouncil,
            registrationYear: application.registrationYear,
            published: false,
            publishedAt: null,
            availabilityStatus: 'unavailable',
          },
          $setOnInsert: {
            slug: slugFor(displayName),
            registrationCheckedAt: null,
            bio: '',
            languages: [],
            consultationModes: [],
            consultationFeeInr: null,
          },
        },
        { upsert: true, session },
      )
      .exec();
  }

  /** Takes a doctor off the directory and stops new bookings. */
  async withdrawFromDirectory(userId: Types.ObjectId, session?: ClientSession): Promise<void> {
    await this.profiles
      .updateOne(
        { userId },
        { $set: { published: false, publishedAt: null, availabilityStatus: 'unavailable' } },
        { session },
      )
      .exec();
  }

  private directoryMatch(query: DoctorDirectoryQueryDto): Record<string, unknown> {
    const match: Record<string, unknown> = { published: true };
    if (query.specialty) match.specialtyKey = keyOf(query.specialty);
    if (query.city) match.cityKey = keyOf(query.city);
    if (query.mode) match.consultationModes = query.mode;
    if (query.language) match.languages = query.language;
    if (query.q) match.displayName = { $regex: escapeRegex(query.q), $options: 'i' };
    if (query.takingBookings) match.availabilityStatus = 'available';
    if (query.feeBand) Object.assign(match, consultationFeeMatch(query.feeBand));
    return match;
  }

  async listPublic(query: DoctorDirectoryQueryDto) {
    const match = this.directoryMatch(query);

    const [result] = await this.profiles
      .aggregate<{ items: DoctorProfile[]; total: { count: number }[] }>([
        ...this.listedPipeline(match),
        {
          $facet: {
            items: [
              ...directorySortStages(query.sort),
              { $skip: (query.page - 1) * query.limit },
              { $limit: query.limit },
            ],
            total: [{ $count: 'count' }],
          },
        } as PipelineStage,
      ])
      .exec();
    return {
      items: (result?.items ?? []).map((item) => this.profiles.hydrate(item)),
      total: result?.total[0]?.count ?? 0,
    };
  }

  /** Listed doctors matching directory filters, for slot-based filtering (bounded scan). */
  async listAllMatchingPublic(
    query: DoctorDirectoryQueryDto,
    limit = DIRECTORY_OPEN_SLOTS_SCAN_LIMIT,
  ): Promise<DoctorProfileDocument[]> {
    const match = this.directoryMatch(query);
    const rows = await this.profiles
      .aggregate<DoctorProfile>([
        ...this.listedPipeline(match),
        ...directorySortStages(query.sort),
        { $limit: limit },
      ])
      .exec();
    return rows.map((item) => this.profiles.hydrate(item));
  }

  async filters(): Promise<{ specialties: string[]; cities: string[] }> {
    const [result] = await this.profiles
      .aggregate<{ specialties: string[]; cities: (string | null)[] }>([
        ...this.listedPipeline({ published: true }),
        {
          $group: {
            _id: null,
            specialties: { $addToSet: '$specialty' },
            cities: { $addToSet: '$city' },
          },
        },
      ])
      .exec();
    const unique = (values: (string | null)[]) =>
      [...new Map(values.filter((v): v is string => !!v).map((v) => [keyOf(v), v])).values()].sort(
        (a, b) => a.localeCompare(b, 'en-IN'),
      );
    return {
      specialties: unique(result?.specialties ?? []),
      cities: unique(result?.cities ?? []),
    };
  }

  async findPublicBySlug(slug: string): Promise<DoctorProfileDocument> {
    if (!/^[a-z0-9-]{3,64}$/.test(slug)) throw notFound();
    const [profile] = await this.profiles
      .aggregate<DoctorProfile>([...this.listedPipeline({ published: true, slug }), { $limit: 1 }])
      .exec();
    if (!profile) throw notFound();
    return this.profiles.hydrate(profile);
  }

  private async verificationOf(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) return null;
    return effectiveDoctorVerification(user.roles, user.doctorVerification);
  }

  /**
   * A profile is listed only for an active, verified doctor. Pending, rejected and suspended
   * doctors stay off the directory even if a published flag was set another way.
   */
  private listedPipeline(match: Record<string, unknown>): PipelineStage[] {
    return [
      { $match: match },
      {
        $lookup: {
          from: USERS_COLLECTION,
          localField: 'userId',
          foreignField: '_id',
          pipeline: [{ $match: LISTED_DOCTOR_MATCH }, { $project: { _id: 1 } }],
          as: 'owner',
        },
      },
      { $match: { 'owner.0': { $exists: true } } },
      { $project: { owner: 0 } },
    ];
  }
}
