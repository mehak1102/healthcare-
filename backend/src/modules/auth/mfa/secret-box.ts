import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import type { Env } from '../../../config/env.schema';

const VERSION = 'v1';
const IV_BYTES = 12;

/**
 * The key that encrypts authenticator secrets at rest. Production requires a dedicated
 * MFA_ENCRYPTION_KEY (enforced by env validation); elsewhere one is derived from SESSION_SECRET
 * so local setups keep working without another variable.
 */
export function mfaEncryptionKey(env: Env): Buffer {
  if (env.MFA_ENCRYPTION_KEY) return Buffer.from(env.MFA_ENCRYPTION_KEY, 'base64url');
  return Buffer.from(
    hkdfSync('sha256', env.SESSION_SECRET, 'sukoon', 'mfa-secret-encryption:v1', 32),
  );
}

/**
 * AES-256-GCM. `context` is bound as associated data (for example the user ID), so a ciphertext
 * copied onto another account fails to decrypt.
 */
export function sealSecret(key: Buffer, plaintext: string, context: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), ciphertext]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.');
}

export function openSecret(key: Buffer, sealed: string, context: string): string {
  const [version, iv, tag, ciphertext] = sealed.split('.');
  if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
    throw new Error('unrecognised sealed secret format');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
