#!/usr/bin/env bash
# Exposes the local API so Razorpay can POST payment webhooks (Razorpay cannot reach localhost).
set -euo pipefail

PORT="${WEBHOOK_TUNNEL_PORT:-3000}"
WEBHOOK_PATH="/api/v1/webhooks/razorpay"

echo "Local webhook URL path: http://localhost:${PORT}${WEBHOOK_PATH}"
echo ""
echo "After the tunnel starts, copy the public https URL and register in Razorpay Dashboard → Webhooks:"
echo "  <public-host>${WEBHOOK_PATH}"
echo "Use the same secret in backend/.env as RAZORPAY_WEBHOOK_SECRET, then restart the API (type rs)."
echo ""

if command -v cloudflared >/dev/null 2>&1; then
  exec cloudflared tunnel --url "http://localhost:${PORT}"
fi

if command -v ngrok >/dev/null 2>&1; then
  exec ngrok http "${PORT}"
fi

echo "Install a tunnel tool first:"
echo "  cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
echo "  ngrok:       https://ngrok.com/download"
exit 1
