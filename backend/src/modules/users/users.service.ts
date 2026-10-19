import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type ClientSession, Model, mongo, Types } from 'mongoose';
import { apiError } from '../../common/http/api-error';
import { escapeRegex } from '../../common/validation/escape-regex';
import type { Role } from '../access-control/roles';
import type { DoctorVerificationStatus } from './doctor-verification';
import { User, type UserDocument } from './user.schema';

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

export interface CreateUserInput {
  email: string;
  fullName: string;
  passwordHash: string;
  roles: Role[];
  termsAcceptedVersion: string;
  privacyNoticeAcceptedVersion: string;
  doctorVerification?: DoctorVerificationStatus | null;
}

export interface UserListQuery {
  page: number;
  limit: number;
  search?: string;
  role?: Role;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}

  async create(input: CreateUserInput): Promise<UserDocument> {
    const now = new Date();
    try {
      return await this.users.create({
        ...input,
        email: normalizeEmail(input.email),
        passwordChangedAt: now,
        termsAcceptedAt: now,
      });
    } catch (error) {
      if (error instanceof mongo.MongoServerError && error.code === 11000) {
        throw new ConflictException(
          apiError('EMAIL_TAKEN', 'An account with this email already exists. Try signing in.'),
        );
      }
      throw error;
    }
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.users.findById(id).exec();
  }

  findByIdWithPassword(id: string): Promise<UserDocument | null> {
    return this.users.findById(id).select('+passwordHash').exec();
  }

  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.users
      .findOne({ email: normalizeEmail(email) })
      .select('+passwordHash')
      .exec();
  }

  /** Atomically counts a failure; locks the account once the threshold is reached. */
  async recordFailedLogin(userId: Types.ObjectId): Promise<void> {
    const updated = await this.users
      .findOneAndUpdate(
        { _id: userId },
        { $inc: { failedLoginCount: 1 } },
        { returnDocument: 'after', projection: { failedLoginCount: 1 } },
      )
      .exec();
    if (updated && updated.failedLoginCount >= MAX_FAILED_LOGINS) {
      await this.users
        .updateOne(
          { _id: userId },
          {
            $set: {
              lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000),
              failedLoginCount: 0,
            },
          },
        )
        .exec();
    }
  }

  async recordSuccessfulLogin(userId: Types.ObjectId): Promise<void> {
    await this.users
      .updateOne(
        { _id: userId },
        { $set: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } },
      )
      .exec();
  }

  async updatePasswordHash(
    userId: Types.ObjectId,
    passwordHash: string,
    changed: boolean,
  ): Promise<void> {
    const set: Partial<User> = { passwordHash };
    if (changed) set.passwordChangedAt = new Date();
    await this.users.updateOne({ _id: userId }, { $set: set }).exec();
  }

  /** Sets a new password after account recovery and lifts any lockout. */
  async resetPassword(userId: Types.ObjectId, passwordHash: string): Promise<void> {
    await this.users
      .updateOne(
        { _id: userId },
        {
          $set: {
            passwordHash,
            passwordChangedAt: new Date(),
            failedLoginCount: 0,
            lockedUntil: null,
          },
        },
      )
      .exec();
  }

  /** Only verifies if the account still uses the address the link was sent to. */
  async markEmailVerified(userId: Types.ObjectId, email: string): Promise<boolean> {
    const result = await this.users
      .updateOne(
        { _id: userId, email: normalizeEmail(email), emailVerifiedAt: null },
        { $set: { emailVerifiedAt: new Date() } },
      )
      .exec();
    return result.modifiedCount === 1;
  }

  findByIdWithMfa(id: string): Promise<UserDocument | null> {
    return this.users
      .findById(id)
      .select('+passwordHash +mfaSecret +mfaPendingSecret +mfaRecoveryCodeHashes')
      .exec();
  }

  async setPendingMfaSecret(userId: Types.ObjectId, sealed: string, expiresAt: Date) {
    await this.users
      .updateOne(
        { _id: userId, mfaEnrolledAt: null },
        { $set: { mfaPendingSecret: sealed, mfaPendingExpiresAt: expiresAt } },
      )
      .exec();
  }

  /** Promotes the pending secret, only if it is still the one the user just proved. */
  async activateMfa(
    userId: Types.ObjectId,
    pendingSecret: string,
    usedStep: number,
    recoveryCodeHashes: string[],
  ): Promise<boolean> {
    const result = await this.users
      .updateOne(
        { _id: userId, mfaEnrolledAt: null, mfaPendingSecret: pendingSecret },
        {
          $set: {
            mfaSecret: pendingSecret,
            mfaEnrolledAt: new Date(),
            mfaLastUsedStep: usedStep,
            mfaRecoveryCodeHashes: recoveryCodeHashes,
            mfaPendingSecret: null,
            mfaPendingExpiresAt: null,
          },
        },
      )
      .exec();
    return result.modifiedCount === 1;
  }

  /** Atomically records a TOTP step; false if it (or a later one) was already used. */
  async claimTotpStep(userId: Types.ObjectId, step: number): Promise<boolean> {
    const result = await this.users
      .updateOne(
        { _id: userId, $or: [{ mfaLastUsedStep: null }, { mfaLastUsedStep: { $lt: step } }] },
        { $set: { mfaLastUsedStep: step } },
      )
      .exec();
    return result.modifiedCount === 1;
  }

  async consumeRecoveryCode(userId: Types.ObjectId, codeHash: string): Promise<boolean> {
    const result = await this.users
      .updateOne(
        { _id: userId, mfaRecoveryCodeHashes: codeHash },
        { $pull: { mfaRecoveryCodeHashes: codeHash } },
      )
      .exec();
    return result.modifiedCount === 1;
  }

  async replaceRecoveryCodes(userId: Types.ObjectId, codeHashes: string[]): Promise<void> {
    await this.users
      .updateOne({ _id: userId }, { $set: { mfaRecoveryCodeHashes: codeHashes } })
      .exec();
  }

  async disableMfa(userId: Types.ObjectId): Promise<void> {
    await this.users
      .updateOne(
        { _id: userId },
        {
          $set: {
            mfaEnrolledAt: null,
            mfaSecret: null,
            mfaPendingSecret: null,
            mfaPendingExpiresAt: null,
            mfaLastUsedStep: null,
            mfaRecoveryCodeHashes: [],
          },
        },
      )
      .exec();
  }

  /** Active accounts other than `exceptUserId` holding any of `roles`. */
  countOthersWithRole(roles: readonly Role[], exceptUserId: Types.ObjectId): Promise<number> {
    return this.users
      .countDocuments({ _id: { $ne: exceptUserId }, status: 'active', roles: { $in: roles } })
      .exec();
  }

  async deleteById(userId: Types.ObjectId, session: ClientSession): Promise<boolean> {
    const result = await this.users.deleteOne({ _id: userId }, { session }).exec();
    return result.deletedCount === 1;
  }

  async updateFullName(userId: Types.ObjectId, fullName: string): Promise<void> {
    await this.users.updateOne({ _id: userId }, { $set: { fullName } }).exec();
  }

  async addRole(userId: Types.ObjectId, role: Role, session?: ClientSession): Promise<void> {
    await this.users.updateOne({ _id: userId }, { $addToSet: { roles: role } }, { session }).exec();
  }

  async setDoctorVerification(
    userId: Types.ObjectId,
    status: DoctorVerificationStatus,
    session?: ClientSession,
    note?: string | null,
  ): Promise<void> {
    const update: {
      doctorVerification: DoctorVerificationStatus;
      doctorStatusNote?: string | null;
    } = { doctorVerification: status };
    if (note !== undefined) update.doctorStatusNote = note;
    await this.users.updateOne({ _id: userId }, { $set: update }, { session }).exec();
  }

  findByIds(ids: Types.ObjectId[]): Promise<UserDocument[]> {
    return this.users.find({ _id: { $in: ids } }).exec();
  }

  async list(query: UserListQuery): Promise<{ items: UserDocument[]; total: number }> {
    const filter: Record<string, unknown> = {};
    if (query.search) filter.email = { $regex: `^${escapeRegex(normalizeEmail(query.search))}` };
    if (query.role) filter.roles = query.role;

    const [items, total] = await Promise.all([
      this.users
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.users.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}
