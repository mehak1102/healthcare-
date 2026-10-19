import { validateEnv } from './env.schema';

const base = {
  MONGODB_URI: 'mongodb+srv://user:pass@cluster.example.net/',
  SESSION_SECRET: 'x'.repeat(40),
};

describe('validateEnv', () => {
  it('applies safe defaults for development', () => {
    const env = validateEnv(base);
    expect(env.NODE_ENV).toBe('development');
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'http://127.0.0.1:5173']);
    expect(env.AUTH_RATE_LIMIT_PER_MINUTE).toBe(10);
  });

  it('rejects a missing database URI and short secret without echoing values', () => {
    expect(() => validateEnv({ SESSION_SECRET: 'short-secret-value' })).toThrow(/MONGODB_URI/);
    expect(() => validateEnv({ ...base, SESSION_SECRET: 'short-secret-value' })).toThrow(
      /SESSION_SECRET/,
    );
    expect(() => validateEnv({ ...base, SESSION_SECRET: 'short-secret-value' })).not.toThrow(
      /short-secret-value/,
    );
  });

  it('rejects malformed CORS origins', () => {
    expect(() => validateEnv({ ...base, CORS_ORIGINS: 'http://localhost:5173/' })).toThrow(
      /CORS_ORIGINS/,
    );
  });

  it('fails closed on unsafe production configuration', () => {
    const message = (() => {
      try {
        validateEnv({
          ...base,
          NODE_ENV: 'production',
          CORS_ORIGINS: 'http://app.example.in',
          SESSION_SECRET: 'replace-me-with-a-long-random-value-0000',
        });
        return '';
      } catch (error) {
        return (error as Error).message;
      }
    })();
    expect(message).toContain('production origins must use https://');
    expect(message).toContain('placeholder');
    expect(message).toContain('development or test database name');
    expect(message).toContain('production links must use https://');
    expect(message).toContain('MAIL_TRANSPORT');
    expect(message).toContain('MFA_ENCRYPTION_KEY');
  });

  it('rejects a malformed MFA encryption key without echoing it', () => {
    const run = () => validateEnv({ ...base, MFA_ENCRYPTION_KEY: 'too-short-key' });
    expect(run).toThrow(/MFA_ENCRYPTION_KEY/);
    expect(run).not.toThrow(/too-short-key/);
  });

  it('allows a blank LiveKit secret when video is disabled', () => {
    expect(
      validateEnv({
        ...base,
        VIDEO_PROVIDER: 'disabled',
        LIVEKIT_URL: 'wss://example.livekit.cloud',
        LIVEKIT_API_KEY: 'APIexample',
        LIVEKIT_API_SECRET: '',
      }).VIDEO_PROVIDER,
    ).toBe('disabled');
  });

  it('keeps video switched off unless LiveKit is fully configured', () => {
    expect(validateEnv(base).VIDEO_PROVIDER).toBe('disabled');
    const run = () =>
      validateEnv({ ...base, VIDEO_PROVIDER: 'livekit', LIVEKIT_API_SECRET: 's'.repeat(32) });
    expect(run).toThrow(/LIVEKIT_URL: required when VIDEO_PROVIDER=livekit/);
    expect(run).toThrow(/LIVEKIT_API_KEY/);
    expect(run).not.toThrow(/s{32}/);
    expect(() =>
      validateEnv({ ...base, VIDEO_PROVIDER: 'livekit', LIVEKIT_URL: 'https://x.livekit.cloud' }),
    ).toThrow(/wss:\/\//);
  });

  it('requires encrypted video connections in production', () => {
    const run = () =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://app.sukoon.in',
        APP_BASE_URL: 'https://app.sukoon.in',
        MAIL_TRANSPORT: 'disabled',
        MFA_ENCRYPTION_KEY: 'k'.repeat(43),
        MONGODB_DB_NAME: 'sukoon_prod',
        VIDEO_PROVIDER: 'livekit',
        LIVEKIT_URL: 'ws://localhost:7880',
        LIVEKIT_API_KEY: 'APIexample',
        LIVEKIT_API_SECRET: 's'.repeat(32),
      });
    expect(run).toThrow(/production video must use an encrypted wss:\/\/ connection/);
  });

  it('rejects sandbox payments in production', () => {
    const run = () =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        CORS_ORIGINS: 'https://app.sukoon.in',
        APP_BASE_URL: 'https://app.sukoon.in',
        MAIL_TRANSPORT: 'disabled',
        MFA_ENCRYPTION_KEY: 'k'.repeat(43),
        MONGODB_DB_NAME: 'sukoon_prod',
        PAYMENT_PROVIDER: 'sandbox',
      });
    expect(run).toThrow(/sandbox payments are only for development and test/);
  });

  it('accepts a well-formed production configuration', () => {
    const env = validateEnv({
      ...base,
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://app.sukoon.in',
      APP_BASE_URL: 'https://app.sukoon.in',
      MAIL_TRANSPORT: 'disabled',
      MFA_ENCRYPTION_KEY: 'k'.repeat(43),
      MONGODB_DB_NAME: 'sukoon_prod',
    });
    expect(env.NODE_ENV).toBe('production');
  });
});
