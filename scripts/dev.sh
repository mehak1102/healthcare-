#!/usr/bin/env bash
# Start API + frontend. If the API is already on :3000, start frontend only (avoids EADDRINUSE).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

port_in_use() {
  lsof -iTCP:3000 -sTCP:LISTEN -t >/dev/null 2>&1
}

if port_in_use; then
  pid="$(lsof -iTCP:3000 -sTCP:LISTEN -t | head -1)"
  echo ""
  echo "API already running on http://localhost:3000 (PID ${pid})."
  echo "Starting frontend only. Stop API with: npm run dev:stop"
  echo ""
  npm run dev:frontend
else
  trap 'kill 0 2>/dev/null || true' EXIT INT TERM
  npm run dev:backend &
  npm run dev:frontend
  wait
fi
