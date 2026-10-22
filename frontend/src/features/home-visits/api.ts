const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export interface HomeVisitStatus {
  available: false;
  message: string;
  pilot: {
    states: string[];
    pinCodeLookup: boolean;
    bookingOpen: false;
  };
}

export interface PinCoverage {
  pin: string | null;
  valid: boolean;
  inPilotArea: boolean;
  stateCode: string | null;
  areaLabel: string | null;
  bookingOpen: boolean;
  message: string;
}

export async function fetchHomeVisitStatus(signal?: AbortSignal): Promise<HomeVisitStatus> {
  const res = await fetch(`${API_BASE}/home-visits/status`, { signal });
  if (!res.ok) throw new Error(`Home visit status failed (${res.status})`);
  return res.json() as Promise<HomeVisitStatus>;
}

export async function fetchPinCoverage(pin: string, signal?: AbortSignal): Promise<PinCoverage> {
  const params = new URLSearchParams({ pin });
  const res = await fetch(`${API_BASE}/home-visits/pin-coverage?${params}`, { signal });
  if (!res.ok) throw new Error(`PIN coverage check failed (${res.status})`);
  return res.json() as Promise<PinCoverage>;
}
