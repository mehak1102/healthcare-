import { createHmac } from 'node:crypto';
import type {
  GatewayOrder,
  GatewayPayment,
  GatewayRefund,
  PaymentGateway,
} from '../src/modules/payments/payment-gateway';
import { paymentsUnavailable } from '../src/modules/payments/payment-gateway';
import {
  checkoutSignatureMatches,
  webhookSignatureMatches,
} from '../src/modules/payments/signatures';

/**
 * In-memory stand-in for Razorpay, used only by automated tests. It signs checkout results and
 * webhooks the same way Razorpay does, so the real verification code is exercised.
 */
export class FakePaymentGateway implements PaymentGateway {
  available = true;
  readonly publicKey = 'rzp_test_FakeGatewayKey';
  readonly webhooksEnabled = true;
  readonly keySecret = 'fake-gateway-key-secret';
  readonly webhookSecret = 'fake-gateway-webhook-secret';
  failNextOrder = false;
  readonly orders = new Map<string, GatewayOrder>();
  readonly payments = new Map<string, GatewayPayment>();
  readonly refunds: { paymentId: string; amountPaise: number; refundId: string }[] = [];
  private counter = 0;

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}_Fake${String(this.counter).padStart(8, '0')}`;
  }

  createOrder(input: { amountPaise: number }): Promise<GatewayOrder> {
    if (!this.available) throw paymentsUnavailable();
    if (this.failNextOrder) {
      this.failNextOrder = false;
      return Promise.reject(paymentsUnavailable());
    }
    const order: GatewayOrder = {
      orderId: this.nextId('order'),
      amountPaise: input.amountPaise,
      currency: 'INR',
    };
    this.orders.set(order.orderId, order);
    return Promise.resolve(order);
  }

  /** Simulates the patient completing Checkout; returns what the browser would receive. */
  pay(orderId: string, options: { amountPaise?: number; status?: string } = {}) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Unknown order ${orderId}`);
    const payment: GatewayPayment = {
      paymentId: this.nextId('pay'),
      orderId,
      amountPaise: options.amountPaise ?? order.amountPaise,
      currency: 'INR',
      status: options.status ?? 'captured',
    };
    this.payments.set(payment.paymentId, payment);
    return {
      payment,
      body: {
        razorpayOrderId: orderId,
        razorpayPaymentId: payment.paymentId,
        razorpaySignature: createHmac('sha256', this.keySecret)
          .update(`${orderId}|${payment.paymentId}`)
          .digest('hex'),
      },
    };
  }

  signWebhook(raw: string): string {
    return createHmac('sha256', this.webhookSecret).update(raw).digest('hex');
  }

  fetchPayment(paymentId: string): Promise<GatewayPayment> {
    const payment = this.payments.get(paymentId);
    if (!payment) return Promise.reject(paymentsUnavailable());
    return Promise.resolve({ ...payment });
  }

  capture(paymentId: string): Promise<GatewayPayment> {
    const payment = this.payments.get(paymentId);
    if (!payment) return Promise.reject(paymentsUnavailable());
    payment.status = 'captured';
    return Promise.resolve({ ...payment });
  }

  refund(paymentId: string, amountPaise: number): Promise<GatewayRefund> {
    const refundId = this.nextId('rfnd');
    this.refunds.push({ paymentId, amountPaise, refundId });
    return Promise.resolve({ refundId, status: 'processed' });
  }

  verifyCheckout(confirmation: { orderId: string; paymentId: string; signature: string }): boolean {
    return checkoutSignatureMatches(
      this.keySecret,
      confirmation.orderId,
      confirmation.paymentId,
      confirmation.signature,
    );
  }

  verifyWebhook(rawBody: Buffer, signature: string | undefined): boolean {
    return webhookSignatureMatches(this.webhookSecret, rawBody, signature);
  }
}
