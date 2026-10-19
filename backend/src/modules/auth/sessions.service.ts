import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type ClientSession, Model, Types } from 'mongoose';
import { InjectConfig } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';
import type { RequestMeta } from '../../common/http/app-request';
import { Session, type SessionDocument } from './session.schema';
import { generateSessionToken, hashSessionToken, isWellFormedSessionToken } from './session-tokens';

/** `lastSeenAt` is refreshed at most this often, to avoid a database write on every request. */
const TOUCH_INTERVAL_MS = 5 * 60_000;
const MAX_LISTED_SESSIONS = 50;

/** How long a password-only session may wait for its second step. */
export const MFA_PENDING_TTL_MS = 5 * 60_000;

/**
 * `pending`: password accepted, second step outstanding. `verified`: passed two-step
 * verification. `none`: the account has no second step.
 */
export type SessionMfaState = 'none' | 'pending' | 'verified';

export interface IssuedSession {
  sessionId: string;
  token: string;
  tokenHash: string;
  expiresAt: Date;
  mfaState: SessionMfaState;
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session.name) private readonly sessions: Model<Session>,
    @InjectConfig() private readonly config: Env,
  ) {}

  get ttlMs(): number {
    return this.config.SESSION_TTL_HOURS * 3_600_000;
  }

  private get idleMs(): number {
    return this.config.SESSION_IDLE_MINUTES * 60_000;
  }

  async issue(
    userId: Types.ObjectId,
    meta: RequestMeta,
    mfaState: SessionMfaState = 'none',
  ): Promise<IssuedSession> {
    const now = Date.now();
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(now + (mfaState === 'pending' ? MFA_PENDING_TTL_MS : this.ttlMs));
    const session = await this.sessions.create({
      userId,
      tokenHash,
      expiresAt,
      idleExpiresAt: new Date(Math.min(now + this.idleMs, expiresAt.getTime())),
      lastSeenAt: new Date(now),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      mfaPending: mfaState === 'pending',
      mfaVerifiedAt: mfaState === 'verified' ? new Date(now) : null,
    });
    return { sessionId: session.id, token, tokenHash, expiresAt, mfaState };
  }

  async markMfaVerified(sessionId: string): Promise<void> {
    await this.sessions
      .updateOne(
        { _id: new Types.ObjectId(sessionId), mfaPending: { $ne: true } },
        { $set: { mfaVerifiedAt: new Date() } },
      )
      .exec();
  }

  /** Returns the live session for a cookie token, extending its idle window when due. */
  async resolve(token: unknown): Promise<SessionDocument | null> {
    if (!isWellFormedSessionToken(token)) return null;
    const now = new Date();
    const session = await this.sessions
      .findOne({
        tokenHash: hashSessionToken(token),
        revokedAt: null,
        expiresAt: { $gt: now },
        idleExpiresAt: { $gt: now },
      })
      .exec();
    if (!session) return null;

    if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      const idleExpiresAt = new Date(
        Math.min(now.getTime() + this.idleMs, session.expiresAt.getTime()),
      );
      await this.sessions
        .updateOne({ _id: session._id }, { $set: { lastSeenAt: now, idleExpiresAt } })
        .exec();
    }
    return session;
  }

  listActive(userId: string): Promise<SessionDocument[]> {
    const now = new Date();
    return this.sessions
      .find({
        userId: new Types.ObjectId(userId),
        revokedAt: null,
        mfaPending: { $ne: true },
        expiresAt: { $gt: now },
        idleExpiresAt: { $gt: now },
      })
      .sort({ lastSeenAt: -1 })
      .limit(MAX_LISTED_SESSIONS)
      .exec();
  }

  /**
   * Revokes one session, but only if it belongs to `userId` (resource-level authorization).
   * Revoked sessions expire immediately so the TTL index removes them.
   */
  async revoke(sessionId: string, userId: string): Promise<boolean> {
    const now = new Date();
    const result = await this.sessions
      .updateOne(
        { _id: new Types.ObjectId(sessionId), userId: new Types.ObjectId(userId), revokedAt: null },
        { $set: { revokedAt: now, expiresAt: now } },
      )
      .exec();
    return result.modifiedCount === 1;
  }

  /** Part of account deletion; runs inside its transaction. */
  async deleteAllForUser(userId: Types.ObjectId, session: ClientSession): Promise<number> {
    const result = await this.sessions.deleteMany({ userId }, { session }).exec();
    return result.deletedCount;
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<number> {
    const now = new Date();
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId), revokedAt: null };
    if (exceptSessionId) filter._id = { $ne: new Types.ObjectId(exceptSessionId) };
    const result = await this.sessions
      .updateMany(filter, { $set: { revokedAt: now, expiresAt: now } })
      .exec();
    return result.modifiedCount;
  }
}
