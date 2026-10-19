const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export interface HealthIntegrations {
  payments: string;
  paymentWebhooks: boolean;
  video: string;
  videoCalls: boolean;
}

export interface HealthReady {
  status: 'ok' | 'unavailable';
  integrations: HealthIntegrations;
}

export async function fetchHealthReady(signal?: AbortSignal): Promise<HealthReady> {
  const res = await fetch(`${API_BASE}/health/ready`, { signal, credentials: 'include' });
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return res.json() as Promise<HealthReady>;
}
