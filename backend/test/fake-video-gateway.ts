import {
  type VideoGateway,
  type VideoJoin,
  type VideoJoinRequest,
  videoUnavailable,
} from '../src/modules/video/video-gateway';

/** In-memory stand-in for the video provider, used only by automated tests. */
export class FakeVideoGateway implements VideoGateway {
  available = true;
  readonly joins: VideoJoinRequest[] = [];

  issueJoin(request: VideoJoinRequest): Promise<VideoJoin> {
    if (!this.available) return Promise.reject(videoUnavailable());
    this.joins.push(request);
    return Promise.resolve({
      url: 'wss://video.test.invalid',
      token: `fake-token-${this.joins.length}`,
    });
  }
}
