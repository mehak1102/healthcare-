import { randomBytes } from 'node:crypto';
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  RECOVERY_CODE_COUNT,
} from './recovery-codes';

describe('recovery codes', () => {
  it('generates distinct, readable codes', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    for (const code of codes) expect(code).toMatch(/^[a-z2-7]{5}-[a-z2-7]{5}$/);
  });

  it('normalises what people type and rejects anything else', () => {
    expect(normalizeRecoveryCode('abcde-fgh23')).toBe('ABCDEFGH23');
    expect(normalizeRecoveryCode(' ABCDE FGH23 ')).toBe('ABCDEFGH23');
    expect(normalizeRecoveryCode('abcde-fgh2')).toBeNull();
    expect(normalizeRecoveryCode('abcde-fgh01')).toBeNull();
    expect(normalizeRecoveryCode('123456')).toBeNull();
  });

  it('hashes with the server key and binds the hash to one user', () => {
    const key = randomBytes(32);
    const hash = hashRecoveryCode(key, 'user-1', 'ABCDEFGH23');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('ABCDEFGH23');
    expect(hashRecoveryCode(key, 'user-1', 'ABCDEFGH23')).toBe(hash);
    expect(hashRecoveryCode(key, 'user-2', 'ABCDEFGH23')).not.toBe(hash);
    expect(hashRecoveryCode(randomBytes(32), 'user-1', 'ABCDEFGH23')).not.toBe(hash);
  });
});
