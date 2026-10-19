import { Inject, ServiceUnavailableException } from '@nestjs/common';
import { apiError } from '../../common/http/api-error';

export interface GatewayOrder {
  orderId: string;
  amountPaise: number;
  currency: 'INR';
}

export interface GatewayPayment {
  paymentId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  /** Razorpay states: created, authorized, captured, refunded, failed. */
  status: string;
}

export interface GatewayRefund {
  refundId: string;
  /** `processed` once money has moved; `pending` while the bank works on it. */
  status: string;
}

export interface CheckoutConfirmation {
  orderId: string;
  paymentId: string;
  signature: string;
}

/**
 * Port for the payment provider. Amounts are always computed on the server, in paise. Callers
 * must treat anything the browser reports as unverified until `verifyCheckout` and
 * `fetchPayment` agree.
 */
export interface PaymentGateway {
  readonly available: boolean;
  /** Public key the browser checkout needs; never the secret. */
  readonly publicKey: string | null;
  readonly webhooksEnabled: boolean;
  createOrder(input: {
    amountPaise: number;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<GatewayOrder>;
  fetchPayment(paymentId: string): Promise<GatewayPayment>;
  capture(paymentId: string, amountPaise: number): Promise<GatewayPayment>;
  refund(
    paymentId: string,
    amountPaise: number,
    notes: Record<string, string>,
  ): Promise<GatewayRefund>;
  verifyCheckout(confirmation: CheckoutConfirmation): boolean;
  verifyWebhook(rawBody: Buffer, signature: string | undefined): boolean;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
export const InjectPaymentGateway = () => Inject(PAYMENT_GATEWAY);

export const paymentsUnavailable = () =>
  new ServiceUnavailableException(
    apiError(
      'PAYMENTS_UNAVAILABLE',
      'Online payments are not available right now, so paid appointments cannot be booked. Please try again later.',
    ),
  );
