import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { VideoModule } from '../video/video.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PaymentsModule, VideoModule],
  controllers: [HealthController],
})
export class HealthModule {}
