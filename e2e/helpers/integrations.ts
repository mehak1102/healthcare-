const apiURL = process.env.E2E_API_URL ?? 'http://localhost:3000';

export async function apiIntegrations(): Promise<{
  payments: string;
  paymentWebhooks: boolean;
  video: string;
  videoCalls: boolean;
} | null> {
  try {
    const res = await fetch(`${apiURL}/api/v1/health/ready`);
    if (!res.ok) return null;
    const body = (await res.json()) as { integrations?: Record<string, unknown> };
    const i = body.integrations;
    if (!i || typeof i.payments !== 'string' || typeof i.video !== 'string') return null;
    return {
      payments: i.payments,
      paymentWebhooks: Boolean(i.paymentWebhooks),
      video: i.video,
      videoCalls: Boolean(i.videoCalls),
    };
  } catch {
    return null;
  }
}
