import { TokenVerifier } from 'livekit-server-sdk';
import { validateEnv } from '../../config/env.schema';
import { LiveKitGateway } from './livekit.gateway';

const API_KEY = 'APItestkey';
const API_SECRET = 'synthetic-test-secret-'.padEnd(40, 'x');

const gateway = new LiveKitGateway(
  validateEnv({
    MONGODB_URI: 'mongodb://localhost:27017',
    SESSION_SECRET: 'x'.repeat(40),
    VIDEO_PROVIDER: 'livekit',
    LIVEKIT_URL: 'wss://example.livekit.cloud',
    LIVEKIT_API_KEY: API_KEY,
    LIVEKIT_API_SECRET: API_SECRET,
  }),
);

describe('LiveKitGateway', () => {
  it('issues a signed pass for one room that expires when the appointment ends', async () => {
    const joinUntil = new Date(Date.now() + 20 * 60_000);
    const join = await gateway.issueJoin({
      room: 'appt_abc123',
      identity: 'patient',
      displayName: 'Patient',
      joinUntil,
    });
    expect(join.url).toBe('wss://example.livekit.cloud');
    expect(join.token).not.toContain(API_SECRET);

    const claims = await new TokenVerifier(API_KEY, API_SECRET).verify(join.token);
    expect(claims.sub).toBe('patient');
    expect(claims.name).toBe('Patient');
    expect(Math.abs(claims.exp! - joinUntil.getTime() / 1000)).toBeLessThanOrEqual(2);
    expect(claims.video).toMatchObject({
      room: 'appt_abc123',
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      roomCreate: false,
      roomAdmin: false,
      roomList: false,
      roomRecord: false,
    });
    expect(claims.roomConfig?.maxParticipants).toBe(2);
  });

  it('is rejected by a verifier holding a different secret', async () => {
    const join = await gateway.issueJoin({
      room: 'appt_abc123',
      identity: 'doctor',
      displayName: 'Dr Test',
      joinUntil: new Date(Date.now() + 60_000),
    });
    await expect(
      new TokenVerifier(API_KEY, 'another-secret-'.padEnd(40, 'y')).verify(join.token),
    ).rejects.toThrow(/signature/i);
  });
});
