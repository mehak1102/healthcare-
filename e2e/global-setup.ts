const apiURL = process.env.E2E_API_URL ?? 'http://localhost:3000';

export default async function globalSetup(): Promise<void> {
  const live = `${apiURL}/api/v1/health/live`;
  const ready = `${apiURL}/api/v1/health/ready`;
  try {
    const [liveRes, readyRes] = await Promise.all([fetch(live), fetch(ready)]);
    if (!liveRes.ok || !readyRes.ok) {
      throw new Error(`HTTP ${liveRes.status} / ${readyRes.status}`);
    }
  } catch {
    throw new Error(
      `Browser tests need the API at ${apiURL}. Start both apps: npm run dev (or npm run dev:backend in one terminal and npm run dev:frontend in another).`,
    );
  }

  const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
  try {
    const web = await fetch(baseURL);
    if (!web.ok) throw new Error(String(web.status));
  } catch {
    throw new Error(
      `Browser tests need the website at ${baseURL}. Start the frontend (npm run dev:frontend or npm run dev).`,
    );
  }
}
