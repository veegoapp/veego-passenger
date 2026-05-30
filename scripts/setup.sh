#!/bin/bash
set -e

# ── Validate required secrets ──────────────────────────────────────────────
if [ -z "$BACKEND_URL" ]; then
  echo "ERROR: BACKEND_URL secret is not set."
  echo ""
  echo "  Go to Tools → Secrets in Replit and add:"
  echo "    BACKEND_URL = https://your-backend.replit.app/api"
  echo ""
  echo "  The value must be the deployed backend URL ending in /api"
  exit 1
fi

# ── Write EXPO_PUBLIC_API_URL to .env (always refresh) ────────────────────
printf 'EXPO_PUBLIC_API_URL=%s\n' "$BACKEND_URL" > .env
echo "=== API URL set: $BACKEND_URL ==="

# ── First-time dependency install ─────────────────────────────────────────
if [ ! -f .setup_done ]; then
  echo "=== Installing dependencies (first run only) ==="
  pnpm install
  touch .setup_done
  echo "=== Setup complete ==="
else
  echo "=== Dependencies already installed ==="
fi

# ── Start Expo ────────────────────────────────────────────────────────────
echo "=== Starting Passenger App on :8081 ==="
exec sh -c '
  EXPO_PACKAGER_PROXY_URL=https://$REPLIT_EXPO_DEV_DOMAIN \
  EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN \
  EXPO_PUBLIC_REPL_ID=$REPL_ID \
  REACT_NATIVE_PACKAGER_HOSTNAME=$REPLIT_DEV_DOMAIN \
  pnpm exec expo start --web --port 8081 --non-interactive
'
