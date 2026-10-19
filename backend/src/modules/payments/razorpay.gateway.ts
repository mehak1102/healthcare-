import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { apiError } from '../../common/http/api-error';
import type { Env } from '../../config/env.schema';
import type {
  CheckoutConfirmation,
  GatewayOrder,
  GatewayPayment,
  GatewayRefund,
  PaymentGateway,
} from './payment-gateway';
import { checkoutSignatureMatches, webhookSignatureMatches } from './signatures';

const API = 'https://api.razorpay.com/v1';
const TIMEOUT_MS = 15_000;

interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
}

/** Talks to Razorpay's REST API directly; the key secret never leaves the server. */
export class RazorpayGateway implements PaymentGateway {
  readonly available = true;
  readonly publicKey: string;
  readonly webhooksEnabled: boolean;
  private readonly logger = new Logger('Payments');
  private readonly authHeader: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string | undefined;

  constructor(
    env: Env,
    private readonly http: typeof fetch = fetch,
  ) {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new Error('RazorpayGateway needs RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
    }
    this.publicKey = env.RAZORPAY_KEY_ID;
    this.keySecret = env.RAZORPAY_KEY_SECRET;
    this.webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
    this.webhooksEnabled = Boolean(env.RAZORPAY_WEBHOOK_SECRET);
    this.authHeader = `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`;
  }

  /** Returns the order only while it is still unpaid; null if missing, paid, or from another key. */
  async fetchOpenOrder(orderId: string): Promise<GatewayOrder | null> {
    try {
      const order = await this.call<{ id: string; amount: number; currency: 'INR'; status: string }>(
        'GET',
        `/orders/${encodeURIComponent(orderId)}`,
      );
      if (order.status !== 'created') return null;
      return { orderId: order.id, amountPaise: order.amount, currency: order.currency };
    } catch {
      return null;
    }
  }

  async createOrder(input: {
    amountPaise: number;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<GatewayOrder> {
    const order = await this.call<{ id: string; amount: number; currency: 'INR' }>(
      'POST',
      '/orders',
      {
        amount: input.amountPaise,
        currency: 'INR',
        receipt: input.receipt,
        notes: input.notes,
      },
    );
    return { orderId: order.id, amountPaise: order.amount, currency: order.currency };
  }

  async fetchPayment(paymentId: string): Promise<GatewayPayment> {
    return this.toPayment(
      await this.call<RazorpayPayment>('GET', `/payments/${encodeURIComponent(paymentId)}`),
    );
  }

  async capture(paymentId: string, amountPaise: number): Promise<GatewayPayment> {
    return this.toPayment(
      await this.call<RazorpayPayment>(
        'POST',
        `/payments/${encodeURIComponent(paymentId)}/capture`,
        {
          amount: amountPaise,
          currency: 'INR',
        },
      ),
    );
  }

  async refund(
    paymentId: string,
    amountPaise: number,
    notes: Record<string, string>,
  ): Promise<GatewayRefund> {
    const refund = await this.call<{ id: string; status: string }>(
      'POST',
      `/payments/${encodeURIComponent(paymentId)}/refund`,
      { amount: amountPaise, notes },
    );
    return { refundId: refund.id, status: refund.status };
  }

  verifyCheckout(confirmation: CheckoutConfirmation): boolean {
    return checkoutSignatureMatches(
      this.keySecret,
      confirmation.orderId,
      confirmation.paymentId,
      confirmation.signature,
    );
  }

  verifyWebhook(rawBody: Buffer, signature: string | undefined): boolean {
    if (!this.webhookSecret) return false;
    return webhookSignatureMatches(this.webhookSecret, rawBody, signature);
  }

  private toPayment(payment: RazorpayPayment): GatewayPayment {
    return {
      paymentId: payment.id,
      orderId: payment.order_id,
      amountPaise: payment.amount,
      currency: payment.currency,
      status: payment.status,
    };
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await this.http(`${API}${path}`, {
        method,
        headers: {
          Authorization: this.authHeader,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error(
        `Razorpay ${method} ${path.split('/')[1]} failed: ${error instanceof Error ? error.message : 'network error'}`,
      );
      throw this.unavailable();
    }
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as {
        error?: { code?: string; description?: string };
      } | null;
      // Razorpay error descriptions contain no card data; log them for operators only.
      this.logger.error(
        `Razorpay ${method} ${path.split('/')[1]} returned ${response.status}: ${detail?.error?.code ?? ''} ${detail?.error?.description ?? ''}`.trim(),
      );
      throw this.unavailable();
    }
    return (await response.json()) as T;
  }

  private unavailable() {
    return new ServiceUnavailableException(
      apiError(
        'PAYMENT_PROVIDER_ERROR',
        'The payment provider did not respond as expected. Nothing was charged by this step; please try again.',
      ),
    );
  }
}
