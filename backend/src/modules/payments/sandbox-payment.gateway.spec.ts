import { validateEnv } from '../../config/env.schema';
import { SANDBOX_RAZORPAY_KEY_ID, SandboxPaymentGateway } from './sandbox-payment.gateway';

const env = validateEnv({
  MONGODB_URI: 'mongodb://localhost:27017',
  SESSION_SECRET: 'x'.repeat(40),
});

describe('SandboxPaymentGateway', () => {
  it('issues orders and verifiable checkout confirmations like Razorpay', async () => {
    const gateway = new SandboxPaymentGateway(env);
    expect(gateway.publicKey).toBe(SANDBOX_RAZORPAY_KEY_ID);
    const order = await gateway.createOrder({
      amountPaise: 50_000,
      receipt: 'appt_test',
      notes: {},
    });
    const confirmation = gateway.completeOrder(order.orderId);
    expect(gateway.verifyCheckout(confirmation)).toBe(true);
    const payment = await gateway.fetchPayment(confirmation.paymentId);
    expect(payment).toMatchObject({
      orderId: order.orderId,
      amountPaise: 50_000,
      status: 'captured',
    });
  });
});
