#!/usr/bin/env sh
# Refuse to start a second API on :3000 (common when root `npm run dev` is already running).
set -eu
PORT=3000
if lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
  pid="$(lsof -iTCP:"$PORT" -sTCP:LISTEN -t | head -1)"
  echo ""
  echo "Port ${PORT} is already in use (PID ${pid})."
  echo "API is already up: http://localhost:${PORT}"
  echo ""
  echo "  Stop it:           npm run dev:stop"
  echo "  Frontend only:     npm run dev:frontend   (from repo root)"
  echo "  Full stack:        npm run dev            (from repo root)"
  echo ""
  echo "Nothing else to start here — use the frontend terminal or open http://localhost:5173"
  echo ""
  exit 0
fi
exec nodemon
