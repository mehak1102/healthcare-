import { Controller, Get, Res } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { Connection } from 'mongoose';
import { InjectConfig } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';
import { Public } from '../auth/decorators';
import { InjectPaymentGateway, type PaymentGateway } from '../payments/payment-gateway';
import { InjectVideoGateway, type VideoGateway } from '../video/video-gateway';

const PING_TIMEOUT_MS = 2_000;

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectConfig() private readonly env: Env,
    @InjectPaymentGateway() private readonly payments: PaymentGateway,
    @InjectVideoGateway() private readonly video: VideoGateway,
  ) {}

  /** Liveness: the process is running. Does not touch dependencies. */
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness: the API can serve traffic (database reachable). */
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    const databaseUp = await this.pingDatabase();
    if (!databaseUp) res.status(503);
    return {
      status: databaseUp ? 'ok' : 'unavailable',
      checks: { database: databaseUp ? 'up' : 'down' },
      integrations: {
        payments: this.env.PAYMENT_PROVIDER,
        paymentWebhooks: this.payments.webhooksEnabled,
        video: this.env.VIDEO_PROVIDER,
        videoCalls: this.video.available,
      },
    };
  }

  private async pingDatabase(): Promise<boolean> {
    const db = this.connection.db;
    if (!db) return false;
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('ping timeout')), PING_TIMEOUT_MS);
      });
      await Promise.race([db.admin().ping(), timeout]);
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
