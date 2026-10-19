import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface DemoSeedMeta {
  instantConfirm: boolean;
  paid: boolean;
  video: boolean;
}

/** Written by `npm run db:seed:demo-doctor -w backend`. */
export function demoSeedMeta(): DemoSeedMeta | null {
  try {
    const raw = readFileSync(join(__dirname, '..', '.demo-seed-meta.json'), 'utf8');
    return JSON.parse(raw) as DemoSeedMeta;
  } catch {
    return null;
  }
}
