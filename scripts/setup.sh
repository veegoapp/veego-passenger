#!/bin/bash
set -e

# ── Check required env ───────────────────────────────────────────
if [ -z "$BACKEND_URL" ]; then
  echo "⚠️  WARNING: BACKEND_URL is not set in Replit Secrets."
  echo "👉  Add BACKEND_URL to connect the app to a real backend."
  echo "    The app will start but API calls will not work until it is set."
  printf 'EXPO_PUBLIC_API_URL=\n' > .env
else
  # ── Create env file safely ─────────────────────────────────────
  printf 'EXPO_PUBLIC_API_URL=%s\n' "$BACKEND_URL" > .env
  echo "=== API URL set: $BACKEND_URL ==="
fi

# ── Install deps ─────────────────────────────────────────────────
echo "=== Installing dependencies ==="
pnpm install

echo "=== Starting Expo Web ==="

# ── Kill anything on port 5000 first ─────────────────────────────
fuser -k 5000/tcp 2>/dev/null || true
pkill -9 -f "expo start" 2>/dev/null || true
pkill -9 -f "metro" 2>/dev/null || true
sleep 2

# ── Expo settings ────────────────────────────────────────────────
export EXPO_NO_TELEMETRY=1
export NODE_OPTIONS=--max-old-space-size=4096

# ── Replit proxy vars ─────────────────────────────────────────────
export EXPO_PACKAGER_PROXY_URL="https://$REPLIT_DEV_DOMAIN"
export REACT_NATIVE_PACKAGER_HOSTNAME="$REPLIT_DEV_DOMAIN"
export EXPO_PUBLIC_DOMAIN="$REPLIT_DEV_DOMAIN"
export EXPO_PUBLIC_REPL_ID="$REPL_ID"

# ── Start Expo web on port 5000 ──────────────────────────────────
exec pnpm exec expo start --web --port 5000 --non-interactive
