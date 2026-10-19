import { PasswordService, passwordPolicyViolations } from './password.service';

describe('passwordPolicyViolations', () => {
  it('accepts a long passphrase', () => {
    expect(passwordPolicyViolations('quiet river morning tea', 'asha@example.test')).toEqual([]);
  });

  it('rejects passwords containing the email local part', () => {
    expect(passwordPolicyViolations('Asha-is-the-best-2026', 'asha@example.test')).toHaveLength(1);
  });

  it('rejects a single repeated character', () => {
    expect(passwordPolicyViolations('aaaaaaaaaaaaaa', 'x@example.test')).toHaveLength(1);
  });
});

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with Argon2id and verifies', async () => {
    const hash = await service.hash('correct horse battery');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('correct horse battery');
    await expect(service.verify(hash, 'correct horse battery')).resolves.toBe(true);
    await expect(service.verify(hash, 'wrong horse battery')).resolves.toBe(false);
    expect(service.needsRehash(hash)).toBe(false);
  });

  it('treats a malformed hash as a failed verification', async () => {
    await expect(service.verify('not-a-hash', 'anything')).resolves.toBe(false);
  });
});
