import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type ClientSession, Model, Types } from 'mongoose';
import {
  AccountToken,
  type AccountTokenDocument,
  type AccountTokenPurpose,
} from './account-token.schema';
import { generateSessionToken, hashSessionToken, isWellFormedSessionToken } from './session-tokens';

export const ACCOUNT_TOKEN_TTL_MINUTES: Record<AccountTokenPurpose, number> = {
  email_verification: 24 * 60,
  password_reset: 30,
};

@Injectable()
export class AccountTokensService {
  constructor(@InjectModel(AccountToken.name) private readonly tokens: Model<AccountToken>) {}

  /** Issues a new token and invalidates any earlier unused token for the same purpose. */
  async issue(
    userId: Types.ObjectId,
    purpose: AccountTokenPurpose,
    email: string,
  ): Promise<string> {
    await this.tokens.deleteMany({ userId, purpose, usedAt: null }).exec();
    const token = generateSessionToken();
    await this.tokens.create({
      userId,
      purpose,
      email,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + ACCOUNT_TOKEN_TTL_MINUTES[purpose] * 60_000),
    });
    return token;
  }

  /** Part of account deletion; runs inside its transaction. */
  async deleteAllForUser(userId: Types.ObjectId, session: ClientSession): Promise<number> {
    const result = await this.tokens.deleteMany({ userId }, { session }).exec();
    return result.deletedCount;
  }

  /** Looks up a usable token without consuming it, so a rejected form can be resubmitted. */
  findUsable(token: unknown, purpose: AccountTokenPurpose): Promise<AccountTokenDocument | null> {
    if (!isWellFormedSessionToken(token)) return Promise.resolve(null);
    return this.tokens
      .findOne({
        tokenHash: hashSessionToken(token),
        purpose,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      })
      .exec();
  }

  /** Atomically marks the token used. Returns null if it was already used or has expired. */
  consume(token: unknown, purpose: AccountTokenPurpose): Promise<AccountTokenDocument | null> {
    if (!isWellFormedSessionToken(token)) return Promise.resolve(null);
    const now = new Date();
    return this.tokens
      .findOneAndUpdate(
        { tokenHash: hashSessionToken(token), purpose, usedAt: null, expiresAt: { $gt: now } },
        { $set: { usedAt: now } },
        { returnDocument: 'after' },
      )
      .exec();
  }
}
