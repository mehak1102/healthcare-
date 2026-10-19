import { Module } from '@nestjs/common';
import { APP_CONFIG } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';
import { DisabledPaymentGateway } from './disabled-payment.gateway';
import { PAYMENT_GATEWAY, type PaymentGateway } from './payment-gateway';
import { RazorpayGateway } from './razorpay.gateway';
import { SandboxPaymentGateway } from './sandbox-payment.gateway';

function createPaymentGateway(env: Env): PaymentGateway {
  switch (env.PAYMENT_PROVIDER) {
    case 'razorpay':
      return new RazorpayGateway(env);
    case 'sandbox':
      return new SandboxPaymentGateway(env);
    case 'disabled':
      return new DisabledPaymentGateway();
  }
}

@Module({
  providers: [{ provide: PAYMENT_GATEWAY, inject: [APP_CONFIG], useFactory: createPaymentGateway }],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentsModule {}
