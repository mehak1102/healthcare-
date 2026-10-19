import { existsSync } from 'node:fs';
import { validateEnv, type Env } from './env.schema';

/**
 * Reads `.env` (development convenience only; production gets real environment variables from
 * the host) and validates the result. Throws with a readable list of problems.
 */
export function loadEnv(): Env {
  if (process.env.NODE_ENV !== 'production' && existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  return validateEnv(process.env);
}
