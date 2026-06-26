#!/bin/bash
set -e

# ── Check required env ───────────────────────────────────────────
if [ -z "$BACKEND_URL" ]; then
  echo "⚠️  WARNING: BACKEND_URL is not set in Replit Secrets."
  echo "👉  Add BACKEND_URL to connect the app to a real backend."
  printf 'EXPO_PUBLIC_API_URL=\n' > .env
else
  printf 'EXPO_PUBLIC_API_URL=%s\n' "$BACKEND_URL" > .env
  echo "=== API URL set: $BACKEND_URL ==="
fi

# ── Install deps ─────────────────────────────────────────────────
echo "=== Installing dependencies ==="
pnpm install

echo "=== Starting Metro Bundler (Android & iOS only) ==="

# ── Kill leftover Metro processes ────────────────────────────────
pkill -9 -f "expo start" 2>/dev/null || true
pkill -9 -f "metro"      2>/dev/null || true
sleep 1

# ── Expo settings ────────────────────────────────────────────────
export EXPO_NO_TELEMETRY=1
export NODE_OPTIONS=--max-old-space-size=4096

# ── Start Metro (mobile only — no web) ──────────────────────────
exec pnpm exec expo start --port 8081
