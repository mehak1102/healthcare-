import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { Model } from 'mongoose';
import { apiError } from '../../common/http/api-error';
import type { AppRequest } from '../../common/http/app-request';
import { Public } from '../auth/decorators';
import {
  InjectPaymentGateway,
  type PaymentGateway,
  paymentsUnavailable,
} from '../payments/payment-gateway';
import { AppointmentsService } from './appointments.service';
import { PaymentWebhookEvent } from './payment-webhook-event.schema';

/**
 * Razorpay calls this server-to-server. It carries no session cookie or browser Origin, so the
 * CSRF guard lets it through; authenticity comes solely from the HMAC signature over the raw body.
 */
@ApiExcludeController()
@Controller('webhooks/razorpay')
export class RazorpayWebhookController {
  private readonly logger = new Logger('PaymentsWebhook');

  constructor(
    private readonly appointments: AppointmentsService,
    @InjectModel(PaymentWebhookEvent.name) private readonly seen: Model<PaymentWebhookEvent>,
    @InjectPaymentGateway() private readonly gateway: PaymentGateway,
  ) {}

  @Post()
  @Public()
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<AppRequest>): Promise<{ received: true }> {
    if (!this.gateway.webhooksEnabled) throw paymentsUnavailable();
    const raw = req.rawBody;
    const signature = req.headers['x-razorpay-signature'];
    if (
      !raw ||
      !this.gateway.verifyWebhook(raw, typeof signature === 'string' ? signature : undefined)
    ) {
      this.logger.warn('Rejected a payment webhook with a missing or invalid signature');
      throw new BadRequestException(
        apiError('WEBHOOK_SIGNATURE_INVALID', 'The webhook signature is not valid.'),
      );
    }

    const header = req.headers['x-razorpay-event-id'];
    const eventId =
      typeof header === 'string' && header.length > 0 && header.length <= 100
        ? header
        : createHash('sha256').update(raw).digest('hex');
    if (await this.seen.exists({ eventId })) return { received: true };

    const body = req.body as { event?: unknown; payload?: unknown };
    const event = typeof body.event === 'string' ? body.event : 'unknown';
    try {
      await this.appointments.handleGatewayEvent(event, body.payload);
    } catch (error) {
      // A 4xx outcome (e.g. amount mismatch) will never succeed on retry: record it and move on.
      if (error instanceof HttpException && error.getStatus() < HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.warn(`Payment webhook ${event} was not applied: ${error.message}`);
      } else {
        throw error;
      }
    }
    await this.seen.create({ eventId, event }).catch((error: unknown) => {
      if ((error as { code?: number }).code !== 11000) throw error;
    });
    return { received: true };
  }
}
