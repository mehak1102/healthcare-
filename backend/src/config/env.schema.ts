import { z } from 'zod';

const originList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .pipe(
    z.array(
      z.string().refine((origin) => {
        try {
          return new URL(origin).origin === origin;
        } catch {
          return false;
        }
      }, 'each origin must look like https://app.example.in (scheme + host, no path or trailing slash)'),
    ),
  );

const booleanString = z
  .enum(['true', 'false'], { error: 'must be true or false' })
  .transform((value) => value === 'true');

/** Treat blank .env values as unset (dotenv often leaves `KEY=` as an empty string). */
const optionalTrimmedString = (min: number, max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().min(min).max(max).optional(),
  );

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    MONGODB_URI: z
      .string({ error: 'MONGODB_URI is required (see backend/.env.example)' })
      .regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://'),
    MONGODB_DB_NAME: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,38}$/, 'letters, digits, _ and - only (max 38 characters)')
      .default('sukoon_dev'),

    SESSION_SECRET: z
      .string({ error: 'SESSION_SECRET is required (see backend/.env.example)' })
      .min(32, 'must be at least 32 characters; generate one with the command in .env.example'),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
    SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),

    CORS_ORIGINS: originList.default(['http://localhost:5173', 'http://127.0.0.1:5173']),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),

    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(100),
    AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(10),

    APP_BASE_URL: z
      .string()
      .refine((url) => {
        try {
          return new URL(url).origin === url;
        } catch {
          return false;
        }
      }, 'must look like https://app.example.in (scheme + host, no path or trailing slash)')
      .default('http://localhost:5173'),
    MAIL_TRANSPORT: z.enum(['console', 'smtp', 'disabled']).default('console'),
    MAIL_FROM: z.string().trim().min(3).max(200).optional(),
    SMTP_HOST: z.string().trim().min(1).max(255).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    /** `true` = TLS from the first byte (usually port 465); otherwise STARTTLS is used. */
    SMTP_SECURE: booleanString.optional(),
    /** Refuse to send unless the connection is encrypted. Only a local test server may turn it off. */
    SMTP_REQUIRE_TLS: booleanString.default(true),
    SMTP_USER: z.string().min(1).max(255).optional(),
    SMTP_PASSWORD: z.string().min(1).max(512).optional(),

    MFA_ENCRYPTION_KEY: z
      .string()
      .regex(
        /^[A-Za-z0-9_-]{43}$/,
        'must be 32 random bytes, base64url encoded (43 characters); generate one with the command in .env.example',
      )
      .optional(),

    /** Paid bookings answer "payments unavailable" until a gateway is configured. */
    /** `sandbox` simulates Razorpay locally (development/test only). Use `razorpay` with test keys for real Checkout. */
    PAYMENT_PROVIDER: z.enum(['razorpay', 'disabled', 'sandbox']).default('disabled'),
    RAZORPAY_KEY_ID: z
      .string()
      .trim()
      .regex(/^rzp_(test|live)_[A-Za-z0-9]{6,40}$/, 'must look like rzp_test_… or rzp_live_…')
      .optional(),
    RAZORPAY_KEY_SECRET: z.string().trim().min(10).max(100).optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().min(8).max(200).optional(),

    /** Video consultations (and online booking) stay off until a provider is configured. */
    VIDEO_PROVIDER: z.enum(['livekit', 'disabled']).default('disabled'),
    LIVEKIT_URL: z
      .string()
      .trim()
      .regex(/^wss?:\/\/[^\s/]+(\/[^\s]*)?$/, 'must look like wss://your-project.livekit.cloud')
      .optional(),
    LIVEKIT_API_KEY: optionalTrimmedString(3, 100),
    LIVEKIT_API_SECRET: optionalTrimmedString(20, 200),

    /** Development only: allow video join any time after acceptance (until slot ends). */
    VIDEO_JOIN_ANYTIME: booleanString.default(false),
    VIDEO_JOIN_EARLY_MINUTES: z.coerce.number().int().min(0).max(7 * 24 * 60).default(5),

    /** When true, patients may POST /home-visits (development / controlled pilots only). */
    HOME_VISIT_BOOKING_OPEN: booleanString.default(false),
  })
  .superRefine((env, ctx) => {
    if (env.VIDEO_PROVIDER === 'livekit') {
      for (const key of ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'required when VIDEO_PROVIDER=livekit',
          });
        }
      }
    }
    if (env.PAYMENT_PROVIDER === 'razorpay') {
      for (const key of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'required when PAYMENT_PROVIDER=razorpay',
          });
        }
      }
    }
    if (env.MAIL_TRANSPORT === 'smtp') {
      for (const key of ['SMTP_HOST', 'MAIL_FROM'] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'required when MAIL_TRANSPORT=smtp',
          });
        }
      }
      if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)) {
        ctx.addIssue({
          code: 'custom',
          path: ['SMTP_PASSWORD'],
          message: 'set both SMTP_USER and SMTP_PASSWORD, or neither',
        });
      }
    }

    if (env.NODE_ENV !== 'production') return;

    if (env.MAIL_TRANSPORT === 'smtp' && !env.SMTP_REQUIRE_TLS) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_REQUIRE_TLS'],
        message: 'production email must be sent over an encrypted connection',
      });
    }

    for (const origin of env.CORS_ORIGINS) {
      if (!origin.startsWith('https://')) {
        ctx.addIssue({
          code: 'custom',
          path: ['CORS_ORIGINS'],
          message: 'production origins must use https://',
        });
      }
    }
    if (/change[-_]?me|replace[-_]?me|example/i.test(env.SESSION_SECRET)) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_SECRET'],
        message: 'looks like a placeholder value',
      });
    }
    if (!env.APP_BASE_URL.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['APP_BASE_URL'],
        message: 'production links must use https://',
      });
    }
    if (env.MAIL_TRANSPORT === 'console') {
      ctx.addIssue({
        code: 'custom',
        path: ['MAIL_TRANSPORT'],
        message:
          'console would write reset links to logs; configure a real email provider (decision D5) or set disabled',
      });
    }
    if (!env.MFA_ENCRYPTION_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['MFA_ENCRYPTION_KEY'],
        message: 'production needs a dedicated key for authenticator secrets',
      });
    }
    if (env.PAYMENT_PROVIDER === 'sandbox') {
      ctx.addIssue({
        code: 'custom',
        path: ['PAYMENT_PROVIDER'],
        message: 'sandbox payments are only for development and test',
      });
    }
    if (env.PAYMENT_PROVIDER === 'razorpay') {
      if (env.RAZORPAY_KEY_ID?.startsWith('rzp_test_')) {
        ctx.addIssue({
          code: 'custom',
          path: ['RAZORPAY_KEY_ID'],
          message: 'production must use live Razorpay keys (rzp_live_…)',
        });
      }
      if (!env.RAZORPAY_WEBHOOK_SECRET) {
        ctx.addIssue({
          code: 'custom',
          path: ['RAZORPAY_WEBHOOK_SECRET'],
          message:
            'production needs the webhook secret so missed payment confirmations are recovered',
        });
      }
    }
    if (env.VIDEO_JOIN_ANYTIME) {
      ctx.addIssue({
        code: 'custom',
        path: ['VIDEO_JOIN_ANYTIME'],
        message: 'production must not allow joining video calls before the scheduled window',
      });
    }
    if (env.VIDEO_PROVIDER === 'livekit' && !env.LIVEKIT_URL?.startsWith('wss://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['LIVEKIT_URL'],
        message: 'production video must use an encrypted wss:// connection',
      });
    }
    if (/sukoon_dev|_test$/.test(env.MONGODB_DB_NAME)) {
      ctx.addIssue({
        code: 'custom',
        path: ['MONGODB_DB_NAME'],
        message: 'production must not use a development or test database name',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Validates configuration; the thrown message lists problems but never echoes secret values. */
export function validateEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}
