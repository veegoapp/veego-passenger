#!/bin/bash
set -e

# ── Check required env ───────────────────────────────────────────
if [ -z "$BACKEND_URL" ]; then
  echo "❌ ERROR: BACKEND_URL is not set in Replit Secrets."
  echo "👉 Please add BACKEND_URL to connect the app to backend."
  exit 1
fi

# ── Create env file safely ───────────────────────────────────────
printf 'EXPO_PUBLIC_API_URL=%s\n' "$BACKEND_URL" > .env
echo "=== API URL set: $BACKEND_URL ==="

# ── Install deps ────────────────────────────────────────────────
echo "=== Installing dependencies ==="
pnpm install

echo "=== Starting Expo (Tunnel Mode) ==="

# ── Kill any process on port 5000 ───────────────────────────────
fuser -k 5000/tcp || true
sleep 2

# ── Critical fixes for Replit + Expo ────────────────────────────
export EXPO_NO_TELEMETRY=1
export NODE_OPTIONS=--max-old-space-size=4096

# ── Start Expo (tunnel + clear cache) ───────────────────────────
exec pnpm exec expo start --web --port 5000 --tunnel --clear