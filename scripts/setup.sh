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

# ── Install deps once ─────────────────────────────────────────────
if [ ! -f .setup_done ]; then
  echo "=== Installing dependencies ==="
  pnpm install
  touch .setup_done
fi

echo "=== Starting Expo ==="

# ── Critical fixes for Replit + Expo ──────────────────────────────
export EXPO_NO_WATCH=1
export NODE_OPTIONS=--max-old-space-size=4096

# ── Start Expo (stable mode first, tunnel fallback if needed) ────
npx expo start --web --port 5000 --clear || \
npx expo start --tunnel --port 5000 --clear