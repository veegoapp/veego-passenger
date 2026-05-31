#!/bin/bash
set -e

# ── Env file ──────────────────────────────────────────────────────
if [ -n "$BACKEND_URL" ]; then
  printf 'EXPO_PUBLIC_API_URL=%s\n' "$BACKEND_URL" > .env
  echo "=== API URL set: $BACKEND_URL ==="
else
  echo "=== WARNING: BACKEND_URL not set. App will start without a backend URL. ==="
  echo "=== Set BACKEND_URL in Replit Secrets to connect to your API server. ==="
  touch .env
fi

# ── Install deps ──────────────────────────────────────────────────
echo "=== Installing dependencies ==="
pnpm install

echo "=== Starting Expo ==="

# ── Critical fixes for Replit + Expo ──────────────────────────────
export EXPO_NO_TELEMETRY=1
export NODE_OPTIONS=--max-old-space-size=4096
export CI=1

# ── Start Expo web on port 5000 (offline skips version-check API) ──
exec pnpm exec expo start --web --port 5000 --offline
