#!/usr/bin/env node
/**
 * Vite proxies /api → localhost:3000. Fail fast with a clear message if the API is down.
 * Skip when VITE_API_BASE_URL points at a remote API (no local proxy needed).
 */
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.join(scriptDir, '..');
const repoRoot = path.join(frontendDir, '..');

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    out[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
  }
  return out;
}

const env = {
  ...loadEnvFile(path.join(repoRoot, 'backend', '.env')),
  ...loadEnvFile(path.join(frontendDir, '.env.local')),
  ...loadEnvFile(path.join(frontendDir, '.env')),
  ...process.env,
};

const apiBase = (env.VITE_API_BASE_URL ?? '').trim();
if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
  process.exit(0);
}

const port = Number(env.PORT || 3000);

function probe() {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.setTimeout(800);
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

const up = await probe();
if (up) process.exit(0);

console.error(`
Sukoon API is not running on http://localhost:${port}.

Vite forwards /api to that port. Start the backend, then run the frontend again:

  cd ${repoRoot}
  npm run dev

Or use two terminals:

  npm run dev:backend
  npm run dev:frontend

Stop the API: npm run dev:stop
`);
process.exit(1);
