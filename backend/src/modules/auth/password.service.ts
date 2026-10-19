import { BadRequestException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { apiError } from '../../common/http/api-error';

/** OWASP minimum recommendation for Argon2id: 19 MiB memory, 2 iterations, 1 lane. */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** Checks beyond length (enforced by DTOs). No composition rules, per NIST SP 800-63B. */
export function passwordPolicyViolations(password: string, email: string): string[] {
  const violations: string[] = [];
  const localPart = email.split('@')[0]?.toLowerCase() ?? '';
  if (localPart.length >= 3 && password.toLowerCase().includes(localPart)) {
    violations.push('password must not contain your email address');
  }
  if (/^(.)\1+$/.test(password)) {
    violations.push('password must not be a single repeated character');
  }
  return violations;
}

export function assertPasswordPolicy(password: string, email: string): void {
  const violations = passwordPolicyViolations(password, email);
  if (violations.length > 0) {
    throw new BadRequestException(
      apiError('VALIDATION_FAILED', 'Request validation failed', violations),
    );
  }
}

@Injectable()
export class PasswordService {
  /** Used to spend equal time on unknown accounts so timing does not reveal which emails exist. */
  private readonly dummyHash = argon2.hash(randomBytes(16).toString('hex'), ARGON2_OPTIONS);

  hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  async verifyAgainstDummy(password: string): Promise<void> {
    await this.verify(await this.dummyHash, password);
  }

  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, ARGON2_OPTIONS);
  }
}
