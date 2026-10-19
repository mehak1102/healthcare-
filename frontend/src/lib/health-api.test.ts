import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchHealthReady } from './health-api';

afterEach(() => vi.unstubAllGlobals());

describe('fetchHealthReady', () => {
  it('parses integrations from the ready endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              status: 'ok',
              integrations: {
                payments: 'razorpay',
                paymentWebhooks: true,
                video: 'livekit',
                videoCalls: true,
              },
            }),
          ),
        ),
      ),
    );
    const health = await fetchHealthReady();
    expect(health.integrations.videoCalls).toBe(true);
  });
});
