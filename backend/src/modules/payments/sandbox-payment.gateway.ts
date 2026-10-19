import { createHmac } from 'node:crypto';
import type { Env } from '../../config/env.schema';
import type {
  CheckoutConfirmation,
  GatewayOrder,
  GatewayPayment,
  GatewayRefund,
  PaymentGateway,
} from './payment-gateway';
import { checkoutSignatureMatches } from './signatures';

/** Public key returned to the browser; must match `rzp_test_…` so env validation stays consistent. */
export const SANDBOX_RAZORPAY_KEY_ID = 'rzp_test_SukoonSandbox';

/**
 * In-memory Razorpay stand-in for local development only. No money moves; signatures use
 * SESSION_SECRET so checkout confirmation still goes through the real verify path.
 */
export class SandboxPaymentGateway implements PaymentGateway {
  readonly available = true;
  readonly publicKey = SANDBOX_RAZORPAY_KEY_ID;
  readonly webhooksEnabled = false;
  private readonly secret: string;
  private readonly orders = new Map<string, GatewayOrder>();
  private readonly payments = new Map<string, GatewayPayment>();
  private counter = 0;

  constructor(env: Env) {
    this.secret = `sandbox-${env.SESSION_SECRET}`;
  }

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}_Sandbox${String(this.counter).padStart(8, '0')}`;
  }

  createOrder(input: {
    amountPaise: number;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<GatewayOrder> {
    const order: GatewayOrder = {
      orderId: this.nextId('order'),
      amountPaise: input.amountPaise,
      currency: 'INR',
    };
    this.orders.set(order.orderId, order);
    return Promise.resolve(order);
  }

  /** Simulates the patient completing Checkout; only used from the sandbox payment endpoint. */
  completeOrder(orderId: string): CheckoutConfirmation {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Unknown sandbox order ${orderId}`);
    const paymentId = this.nextId('pay');
    const payment: GatewayPayment = {
      paymentId,
      orderId,
      amountPaise: order.amountPaise,
      currency: 'INR',
      status: 'captured',
    };
    this.payments.set(paymentId, payment);
    const signature = createHmac('sha256', this.secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return { orderId, paymentId, signature };
  }

  fetchPayment(paymentId: string): Promise<GatewayPayment> {
    const payment = this.payments.get(paymentId);
    if (!payment) return Promise.reject(new Error(`Unknown sandbox payment ${paymentId}`));
    return Promise.resolve({ ...payment });
  }

  capture(paymentId: string): Promise<GatewayPayment> {
    return this.fetchPayment(paymentId);
  }

  refund(_paymentId: string, _amountPaise: number): Promise<GatewayRefund> {
    return Promise.resolve({ refundId: this.nextId('rfnd'), status: 'processed' });
  }

  verifyCheckout(confirmation: CheckoutConfirmation): boolean {
    return checkoutSignatureMatches(
      this.secret,
      confirmation.orderId,
      confirmation.paymentId,
      confirmation.signature,
    );
  }

  verifyWebhook(): boolean {
    return false;
  }
}
