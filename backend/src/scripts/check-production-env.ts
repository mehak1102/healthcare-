import { existsSync } from 'node:fs';
import { validateEnv } from '../config/env.schema';

/**
 * Dry-run: load backend/.env (if present), force NODE_ENV=production, and run the same Zod rules
 * the API uses at boot. Does not connect to MongoDB or start the server.
 */
function main(): void {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  process.env.NODE_ENV = 'production';
  validateEnv(process.env);
  console.log('Production environment validation passed (NODE_ENV=production rules).');
}

main();
