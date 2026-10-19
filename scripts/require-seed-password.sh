#!/usr/bin/env bash
set -euo pipefail

if [ -z "${SEED_USER_PASSWORD:-}" ]; then
  echo "Set SEED_USER_PASSWORD (at least 12 characters) before running setup:demo."
  echo "Example: SEED_USER_PASSWORD='your-demo-password' npm run setup:demo"
  exit 1
fi

if [ "${#SEED_USER_PASSWORD}" -lt 12 ]; then
  echo "SEED_USER_PASSWORD must be at least 12 characters."
  exit 1
fi
