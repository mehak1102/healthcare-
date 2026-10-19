import { AccessToken, RoomConfiguration } from 'livekit-server-sdk';
import type { Env } from '../../config/env.schema';
import type { VideoGateway, VideoJoin, VideoJoinRequest } from './video-gateway';

/** Rooms hold the patient and the doctor only. */
const MAX_PARTICIPANTS = 2;
const MIN_TOKEN_SECONDS = 60;

/** Issues room-scoped LiveKit access tokens. The API secret never leaves the server. */
export class LiveKitGateway implements VideoGateway {
  readonly available = true;
  private readonly url: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(env: Env) {
    this.url = env.LIVEKIT_URL!;
    this.apiKey = env.LIVEKIT_API_KEY!;
    this.apiSecret = env.LIVEKIT_API_SECRET!;
  }

  async issueJoin(request: VideoJoinRequest): Promise<VideoJoin> {
    const seconds = Math.max(
      MIN_TOKEN_SECONDS,
      Math.ceil((request.joinUntil.getTime() - Date.now()) / 1000),
    );
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: request.identity,
      name: request.displayName,
      ttl: seconds,
    });
    token.addGrant({
      room: request.room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomCreate: false,
      roomAdmin: false,
      roomList: false,
      roomRecord: false,
    });
    token.roomConfig = new RoomConfiguration({ maxParticipants: MAX_PARTICIPANTS });
    return { url: this.url, token: await token.toJwt() };
  }
}
