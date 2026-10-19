import { Inject, ServiceUnavailableException } from '@nestjs/common';
import { apiError } from '../../common/http/api-error';

export interface VideoJoinRequest {
  /** Opaque room name; never contains names or health information. */
  room: string;
  /** Stable, opaque participant id. */
  identity: string;
  /** Label shown on the video tile. */
  displayName: string;
  /** Last moment a new join is allowed. */
  joinUntil: Date;
}

export interface VideoJoin {
  /** WebSocket URL of the video service the browser connects to. */
  url: string;
  /** Short-lived, room-scoped access token. */
  token: string;
}

/**
 * Port for the video provider. Media goes through the provider's servers; this is transport
 * encryption, not end-to-end encryption.
 */
export interface VideoGateway {
  readonly available: boolean;
  issueJoin(request: VideoJoinRequest): Promise<VideoJoin>;
}

export const VIDEO_GATEWAY = Symbol('VIDEO_GATEWAY');
export const InjectVideoGateway = () => Inject(VIDEO_GATEWAY);

export const videoUnavailable = () =>
  new ServiceUnavailableException(
    apiError(
      'VIDEO_UNAVAILABLE',
      'Video consultations are not available right now. Please try again later.',
    ),
  );
