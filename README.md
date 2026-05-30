# VeeGo — Passenger App

Expo React Native passenger app for the VeeGo / ShuttleOps platform.

---

## Secrets to add before pressing Run

Go to **Tools → Secrets** and add:

| Secret | Required | Example value |
|--------|----------|---------------|
| `BACKEND_URL` | ✅ Yes | `https://shuttleops-backend.replit.app/api` |

> `BACKEND_URL` is the full API URL of the **deployed backend** (backend.zip project).
> Get it from that project's Deployments tab → copy the `.replit.app` URL and append `/api`.

---

## How to run

1. Deploy the backend project first, copy its `.replit.app` URL
2. Add `BACKEND_URL` = `https://<your-backend>.replit.app/api` to Secrets
3. Press the **Run** button

**What happens on first run (automatic):**
1. Writes `EXPO_PUBLIC_API_URL` to `.env` from your `BACKEND_URL` secret
2. `pnpm install` — installs all dependencies
3. Expo starts in web mode on port 8081

Subsequent runs refresh the `.env` and start Expo directly.

---

## Notes

- Opens in web mode — works in Replit browser preview
- For native iOS/Android testing: scan the QR code with Expo Go
- No URL is ever hardcoded — `BACKEND_URL` secret is the single source of truth
- Socket.IO connects to the same host (strips `/api` suffix automatically)
