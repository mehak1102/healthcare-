import { randomBytes } from 'node:crypto';
import { validateEnv } from '../../../config/env.schema';
import { mfaEncryptionKey, openSecret, sealSecret } from './secret-box';

describe('secret box', () => {
  const key = randomBytes(32);

  it('round-trips without exposing the plaintext', () => {
    const sealed = sealSecret(key, 'JBSWY3DPEHPK3PXP', 'mfa:user-1');
    expect(sealed).not.toContain('JBSWY3DPEHPK3PXP');
    expect(sealed.startsWith('v1.')).toBe(true);
    expect(openSecret(key, sealed, 'mfa:user-1')).toBe('JBSWY3DPEHPK3PXP');
  });

  it('uses a fresh IV every time', () => {
    expect(sealSecret(key, 'same', 'ctx')).not.toBe(sealSecret(key, 'same', 'ctx'));
  });

  it('refuses another context, another key, or tampered data', () => {
    const authFailure = /unable to authenticate data/;
    const sealed = sealSecret(key, 'secret', 'mfa:user-1');
    expect(() => openSecret(key, sealed, 'mfa:user-2')).toThrow(authFailure);
    expect(() => openSecret(randomBytes(32), sealed, 'mfa:user-1')).toThrow(authFailure);
    const parts = sealed.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => openSecret(key, parts.join('.'), 'mfa:user-1')).toThrow(authFailure);
    expect(() => openSecret(key, 'v0.a.b.c', 'mfa:user-1')).toThrow(/unrecognised/);
  });
});

describe('mfaEncryptionKey', () => {
  const base = { MONGODB_URI: 'mongodb://localhost/', SESSION_SECRET: 'x'.repeat(40) };

  it('uses MFA_ENCRYPTION_KEY when set', () => {
    const configured = randomBytes(32);
    const env = validateEnv({ ...base, MFA_ENCRYPTION_KEY: configured.toString('base64url') });
    expect(mfaEncryptionKey(env).equals(configured)).toBe(true);
  });

  it('derives a stable 32-byte key from SESSION_SECRET otherwise', () => {
    const first = mfaEncryptionKey(validateEnv(base));
    expect(first).toHaveLength(32);
    expect(first.equals(mfaEncryptionKey(validateEnv(base)))).toBe(true);
    const other = mfaEncryptionKey(validateEnv({ ...base, SESSION_SECRET: 'y'.repeat(40) }));
    expect(first.equals(other)).toBe(false);
  });
});
