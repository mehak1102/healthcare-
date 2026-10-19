import dns from 'node:dns';
import { existsSync } from 'node:fs';
import { validateEnv, type Env } from './env.schema';

let windowsDnsPatched = false;

/**
 * Node 24.13+ on Windows can fail mongodb+srv SRV lookups with querySrv ECONNREFUSED
 * even when system DNS works (nodejs/node#62326). Public resolvers bypass that.
 */
function ensureWindowsDnsForMongoSrv(): void {
  if (process.platform !== 'win32' || windowsDnsPatched) return;
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  windowsDnsPatched = true;
}

/**
 * Reads `.env` (development convenience only; production gets real environment variables from
 * the host) and validates the result. Throws with a readable list of problems.
 */
export function loadEnv(): Env {
  ensureWindowsDnsForMongoSrv();
  if (process.env.NODE_ENV !== 'production' && existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  return validateEnv(process.env);
}
