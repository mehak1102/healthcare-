import { paymentsUnavailable, type PaymentGateway } from './payment-gateway';

/** Fails closed: no paid booking can be created, and nothing is ever reported as paid. */
export class DisabledPaymentGateway implements PaymentGateway {
  readonly available = false;
  readonly publicKey = null;
  readonly webhooksEnabled = false;

  createOrder(): never {
    throw paymentsUnavailable();
  }
  fetchPayment(): never {
    throw paymentsUnavailable();
  }
  capture(): never {
    throw paymentsUnavailable();
  }
  refund(): never {
    throw paymentsUnavailable();
  }
  verifyCheckout(): boolean {
    return false;
  }
  verifyWebhook(): boolean {
    return false;
  }
}
