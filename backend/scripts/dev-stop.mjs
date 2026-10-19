#!/usr/bin/env node
/**
 * Cross-platform: stop whatever is listening on TCP :3000.
 * Replaces the lsof/xargs shell one-liner so it works on Windows.
 */
import { execFileSync } from 'node:child_process';

const PORT = 3000;

function pidsListeningOnPort(port) {
  if (process.platform === 'win32') {
    let out = '';
    try {
      out = execFileSync('cmd.exe', ['/c', `netstat -ano | findstr :${port}`], {
        encoding: 'utf8',
      });
    } catch {
      return [];
    }
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!/LISTENING/i.test(line)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (/^\d+$/.test(pid) && pid !== '0') pids.add(pid);
    }
    return [...pids];
  }

  try {
    const out = execFileSync(
      'lsof',
      [`-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
      { encoding: 'utf8' },
    );
    return out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function killPid(pid) {
  if (process.platform === 'win32') {
    execFileSync('taskkill', ['/PID', pid, '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(Number(pid), 'SIGTERM');
  } catch {
    // already gone
  }
}

const pids = pidsListeningOnPort(PORT);
for (const pid of pids) {
  try {
    killPid(pid);
  } catch {
    // best-effort
  }
}
