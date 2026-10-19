import { Module } from '@nestjs/common';
import { APP_CONFIG } from '../../config/app-config.module';
import type { Env } from '../../config/env.schema';
import { DisabledVideoGateway } from './disabled-video.gateway';
import { LiveKitGateway } from './livekit.gateway';
import { VIDEO_GATEWAY, type VideoGateway } from './video-gateway';

function createVideoGateway(env: Env): VideoGateway {
  switch (env.VIDEO_PROVIDER) {
    case 'livekit':
      return new LiveKitGateway(env);
    case 'disabled':
      return new DisabledVideoGateway();
  }
}

@Module({
  providers: [{ provide: VIDEO_GATEWAY, inject: [APP_CONFIG], useFactory: createVideoGateway }],
  exports: [VIDEO_GATEWAY],
})
export class VideoModule {}
