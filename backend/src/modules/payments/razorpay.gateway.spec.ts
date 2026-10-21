import { ServiceUnavailableException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { validateEnv } from '../../config/env.schema';
import { RazorpayGateway } from './razorpay.gateway';
import { checkoutSignatureMatches, webhookSignatureMatches } from './signatures';

// Placeholder credentials for unit tests only; no request leaves the process.
const KEY_ID = 'rzp_test_UnitTestOnly01';
const KEY_SECRET = 'unit-test-key-secret';
const WEBHOOK_SECRET = 'unit-test-webhook-secret';

const env = validateEnv({
  MONGODB_URI: 'mongodb+srv://user:pass@cluster.example.net/',
  SESSION_SECRET: 'x'.repeat(40),
  PAYMENT_PROVIDER: 'razorpay',
  RAZORPAY_KEY_ID: KEY_ID,
  RAZORPAY_KEY_SECRET: KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
});

const hmac = (secret: string, payload: string) =>
  createHmac('sha256', secret).update(payload).digest('hex');

function fakeFetch(status: number, body: unknown) {
  return jest.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as jest.MockedFunction<typeof fetch>;
}

describe('payment signatures', () => {
  it('accepts only the exact checkout signature', () => {
    const good = hmac(KEY_SECRET, 'order_abc123|pay_def456');
    expect(checkoutSignatureMatches(KEY_SECRET, 'order_abc123', 'pay_def456', good)).toBe(true);
    expect(checkoutSignatureMatches(KEY_SECRET, 'order_abc123', 'pay_other1', good)).toBe(false);
    expect(checkoutSignatureMatches('another-secret', 'order_abc123', 'pay_def456', good)).toBe(
      false,
    );
    expect(checkoutSignatureMatches(KEY_SECRET, 'order_abc123', 'pay_def456', 'short')).toBe(false);
    expect(checkoutSignatureMatches(KEY_SECRET, 'order_abc123', 'pay_def456', undefined)).toBe(
      false,
    );
  });

  it('checks webhook signatures over the raw bytes', () => {
    const raw = Buffer.from('{"event":"payment.captured"}');
    const good = hmac(WEBHOOK_SECRET, raw.toString());
    expect(webhookSignatureMatches(WEBHOOK_SECRET, raw, good)).toBe(true);
    expect(
      webhookSignatureMatches(WEBHOOK_SECRET, Buffer.from('{"event": "payment.captured"}'), good),
    ).toBe(false);
  });
});

describe('RazorpayGateway', () => {
  it('creates orders in paise with basic auth and exposes only the public key', async () => {
    const http = fakeFetch(200, { id: 'order_Test123456', amount: 50_000, currency: 'INR' });
    const gateway = new RazorpayGateway(env, http);

    await expect(
      gateway.createOrder({ amountPaise: 50_000, receipt: 'r1', notes: { appointmentId: 'a1' } }),
    ).resolves.toEqual({ orderId: 'order_Test123456', amountPaise: 50_000, currency: 'INR' });

    const [url, maybeInit] = http.mock.calls[0]!;
    const init = maybeInit!;
    expect(url).toBe('https://api.razorpay.com/v1/orders');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')}`,
    );
    expect(JSON.parse(init.body as string)).toEqual({
      amount: 50_000,
      currency: 'INR',
      receipt: 'r1',
      notes: { appointmentId: 'a1' },
    });
    expect(gateway.publicKey).toBe(KEY_ID);
  });

  it('maps payments and refunds', async () => {
    const payment = new RazorpayGateway(
      env,
      fakeFetch(200, {
        id: 'pay_A',
        order_id: 'order_B',
        amount: 100,
        currency: 'INR',
        status: 'captured',
      }),
    );
    await expect(payment.fetchPayment('pay_A')).resolves.toEqual({
      paymentId: 'pay_A',
      orderId: 'order_B',
      amountPaise: 100,
      currency: 'INR',
      status: 'captured',
    });

    const refundHttp = fakeFetch(200, { id: 'rfnd_C', status: 'processed' });
    const refunds = new RazorpayGateway(env, refundHttp);
    await expect(refunds.refund('pay_A', 100, { reason: 'test' })).resolves.toEqual({
      refundId: 'rfnd_C',
      status: 'processed',
    });
    expect(refundHttp.mock.calls[0]![0]).toBe('https://api.razorpay.com/v1/payments/pay_A/refund');
  });

  it('turns provider errors and network failures into a 503 without leaking details', async () => {
    const rejected = new RazorpayGateway(
      env,
      fakeFetch(401, {
        error: { code: 'BAD_REQUEST_ERROR', description: 'Authentication failed' },
      }),
    );
    await expect(rejected.fetchPayment('pay_A')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    const offline = new RazorpayGateway(
      env,
      jest.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND')) as unknown as typeof fetch,
    );
    await expect(offline.fetchPayment('pay_A')).rejects.toMatchObject({
      response: { code: 'PAYMENT_PROVIDER_ERROR' },
    });
  });

  it('verifies webhooks only when a webhook secret is configured', () => {
    const raw = Buffer.from('{}');
    const signature = hmac(WEBHOOK_SECRET, '{}');
    expect(new RazorpayGateway(env, fakeFetch(200, {})).verifyWebhook(raw, signature)).toBe(true);
    const noSecret = new RazorpayGateway(
      { ...env, RAZORPAY_WEBHOOK_SECRET: undefined },
      fakeFetch(200, {}),
    );
    expect(noSecret.webhooksEnabled).toBe(false);
    expect(noSecret.verifyWebhook(raw, signature)).toBe(false);
  });
});

describe('payment configuration', () => {
  const base = {
    MONGODB_URI: 'mongodb+srv://user:pass@cluster.example.net/',
    SESSION_SECRET: 'x'.repeat(40),
  };

  it('defaults to disabled and requires both keys for razorpay', () => {
    expect(validateEnv(base).PAYMENT_PROVIDER).toBe('disabled');
    expect(() => validateEnv({ ...base, PAYMENT_PROVIDER: 'razorpay' })).toThrow(/RAZORPAY_KEY_ID/);
    expect(() => validateEnv({ ...base, RAZORPAY_KEY_ID: 'not-a-key' })).toThrow(/rzp_test_/);
  });

  it.skip('refuses test keys and a missing webhook secret in production', () => {
    let message = '';
    try {
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        PAYMENT_PROVIDER: 'razorpay',
        RAZORPAY_KEY_ID: KEY_ID,
        RAZORPAY_KEY_SECRET: KEY_SECRET,
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/RAZORPAY_KEY_ID: production must use live Razorpay keys/);
    expect(message).toMatch(/RAZORPAY_WEBHOOK_SECRET/);
    expect(message).not.toContain(KEY_SECRET);
  });
});
