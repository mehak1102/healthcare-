import { videoUnavailable, type VideoGateway, type VideoJoin } from './video-gateway';

/** Used until a provider is configured, so video and online booking fail closed. */
export class DisabledVideoGateway implements VideoGateway {
  readonly available = false;

  issueJoin(): Promise<VideoJoin> {
    return Promise.reject(videoUnavailable());
  }
}
