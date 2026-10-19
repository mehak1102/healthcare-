#!/usr/bin/env node
/**
 * Cross-platform backend dev entry: refuse a second listener on :3000, then run nodemon.
 * Replaces scripts/dev.sh so `npm run dev` works on Windows without sh/lsof.
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });
}

async function main() {
  if (await portInUse(PORT)) {
    console.log('');
    console.log(`Port ${PORT} is already in use.`);
    console.log(`API is already up: http://localhost:${PORT}`);
    console.log('');
    console.log('  Stop it:           npm run dev:stop');
    console.log('  Frontend only:     npm run dev:frontend   (from repo root)');
    console.log('  Full stack:        npm run dev            (from repo root)');
    console.log('');
    console.log('Nothing else to start here — use the frontend terminal or open http://localhost:5173');
    console.log('');
    process.exit(0);
  }

  const require = createRequire(import.meta.url);
  const nodemonBin = require.resolve('nodemon/bin/nodemon.js');
  const child = spawn(process.execPath, [nodemonBin], {
    cwd: backendRoot,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main();
