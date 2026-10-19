import { test, expect } from '@playwright/test';
import { apiIntegrations } from './helpers/integrations';

test.describe('API integrations (optional)', () => {
  test('health ready reports integration flags when API is up', async () => {
    const integrations = await apiIntegrations();
    test.skip(!integrations, 'API not reachable at E2E_API_URL (start npm run dev)');
    expect(['disabled', 'sandbox', 'razorpay']).toContain(integrations!.payments);
    expect(['disabled', 'livekit']).toContain(integrations!.video);
    expect(typeof integrations!.videoCalls).toBe('boolean');
  });
});
