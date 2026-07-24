#!/bin/bash
set -e

# ── Check required env ───────────────────────────────────────────
# Accept either BACKEND_URL or EXPO_PUBLIC_API_URL as the source of truth
API_URL="${BACKEND_URL:-$EXPO_PUBLIC_API_URL}"

if [ -z "$API_URL" ]; then
  echo "⚠️  WARNING: Neither BACKEND_URL nor EXPO_PUBLIC_API_URL is set in Replit Secrets."
  echo "👉  Add BACKEND_URL (or EXPO_PUBLIC_API_URL) to connect the app to a real backend."
  printf 'EXPO_PUBLIC_API_URL=\n' > .env
else
  printf 'EXPO_PUBLIC_API_URL=%s\n' "$API_URL" > .env
  echo "=== API URL set: $API_URL ==="
fi

# ── Install deps ─────────────────────────────────────────────────
echo "=== Installing dependencies ==="
pnpm install

echo "=== Starting Metro Bundler (Android & iOS only) ==="

# ── Kill leftover Metro / ngrok processes ────────────────────────
pkill -9 -f "expo start" 2>/dev/null || true
pkill -9 -f "metro"      2>/dev/null || true
pkill -9 -f "ngrok"      2>/dev/null || true
fuser -k 8081/tcp 2>/dev/null || true
fuser -k 8082/tcp 2>/dev/null || true
sleep 3

# ── Expo settings ────────────────────────────────────────────────
export EXPO_NO_TELEMETRY=1
export NODE_OPTIONS=--max-old-space-size=4096

# ── Start Metro on LAN (tunnel disabled — ngrok unavailable) ──────
# Use yes to auto-accept any port-conflict prompts
exec yes | pnpm exec expo start --lan --port 8081