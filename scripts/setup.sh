#!/bin/bash
set -e

# ── Validate secrets ──────────────────────────────────────────────
if [ -z "$BACKEND_URL" ]; then
  echo "ERROR: BACKEND_URL secret is not set."
  exit 1
fi

# ── Env file ──────────────────────────────────────────────────────
printf 'EXPO_PUBLIC_API_URL=%s\n' "$BACKEND_URL" > .env
echo "=== API URL set: $BACKEND_URL ==="

# ── Install deps ──────────────────────────────────────────────────
echo "=== Installing dependencies ==="
pnpm install

echo "=== Starting Expo ==="

# ── Critical fixes for Replit + Expo ──────────────────────────────
export EXPO_NO_WATCH=1
export NODE_OPTIONS=--max-old-space-size=4096
export EXPO_NO_TELEMETRY=1
export CI=1

# ── Start Expo web on port 5000 ───────────────────────────────────
exec pnpm exec expo start --web --port 5000
