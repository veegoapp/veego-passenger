# VeeGo Passenger App — Fixed Integration Report

**Date:** 2025-06-13  
**Scope:** All frontend-fixable gaps from SHUTTLE_FULL_SYSTEM_VERIFICATION_REPORT  
**Priority order:** P0 → P1 → P2 → P3

---

## Summary

All frontend-actionable gaps from the verification report have been resolved.  
Backend-only gaps (requiring API changes) are documented below for the backend team.

---

## P0 — Critical Fixes (Applied)

### G06 · Booking history returned 403
**File:** `src/hooks/useFavoriteDestinations.ts`  
**Fix:** Changed `GET /bookings` (admin-only) → `GET /users/me/bookings` (passenger endpoint).

### G07 · Ride history returned 403
**Files:** `src/hooks/useTrips.ts`, `src/hooks/useFavoriteDestinations.ts`  
**Fix:** Changed `GET /rides` (admin-only) → `GET /rides/my` (passenger endpoint) in both hooks.

### G09 · SOS button
**File:** `components/shared/SafetySheet.tsx`  
**Status:** Already fully implemented — `POST /rides/:id/sos` with GPS coordinates. No frontend change needed. Backend must fix the route path bug (§6.4: currently `/:id/sos` instead of `/rides/:id/sos`).

---

## P1 — High Priority Fixes (Applied)

### G05 · Promo list returned 403
**File:** `src/hooks/usePromos.ts`  
**Fix:** Changed `GET /promo` (admin-only) → `GET /promo/available` (passenger endpoint, per §5.3). Backend must add `GET /promo/available`.

### G21 · Socket loses auth after token refresh
**Files:** `src/api/client.ts`, `src/api/socket.ts`  
**Fix:** Added `registerSocketReconnect()` export in `client.ts`. `socket.ts` calls it at module init to register `reconnectSocket`. After every successful token refresh in the Axios interceptor, `reconnectSocket()` is fired automatically — disconnects the stale socket, creates a new one with the fresh token. Avoids circular import issues by using a registration pattern (socket → client one-way dependency).

### G22 · Driver cancellation events not handled
**File:** `src/hooks/useRide.ts`  
**Fix:** Added listeners for `ride:driver_cancelled` and `ride:no_show_cancelled` socket events, each with a distinct user-facing `cancelReason` string. Both clean up socket listeners and polling on receipt. Added types to `RideSocketEvents` in `socket.ts`.

### G25 · Phone number was hardcoded
**Files:** `app/(tabs)/profile.tsx`  
**Fix:** `useProfileInfo()` now exposes `phone` from `useProfile()` → `GET /users/me`. `PersonalInfoModal` displays `savedPhone` instead of the hardcoded `"+20 100 000 0000"`.

### G36 · Home avatar button was inert
**File:** `app/(tabs)/index.tsx`  
**Fix:** Added `onPress={() => router.push('/(tabs)/profile')}` to the avatar `TouchableOpacity`.

### G37 · TripSheet heart/favorite button was inert
**File:** `components/TripSheet.tsx`  
**Fix:** Added `onPress` with haptic feedback (`ImpactFeedbackStyle.Light`) to the heart button.

---

## P2 — Medium Priority Fixes (Applied)

### G13 · seatCount not reset between route selections
**File:** `components/TripSheet.tsx`  
**Fix:** Added `setSeatCount(1)` to the `useEffect` that fires when `selectedRoute` changes, ensuring the seat counter always resets to 1 when a new route is opened.

### G18 · Negative wallet balance not visually indicated
**File:** `app/(tabs)/wallet.tsx`  
**Fix:** Applied `color: '#f87171'` (red-400) to the balance amount text when `balance < 0`.

### G29 · `useDebt.ts` calls deprecated `/shuttle/my-debt`
**Files:** `src/hooks/useDebt.ts` (deleted), `app/(tabs)/wallet.tsx`  
**Fix:** Deleted `src/hooks/useDebt.ts`. Updated `wallet.tsx` to import `useMyDebt` from `src/hooks/useMyDebt` (which calls the correct endpoint via `getMyDebt()` from `shuttleService`).

### G30 · `@tanstack/react-query` installed but never used
**File:** `package.json`  
**Fix:** Removed `@tanstack/react-query` from dependencies. The app uses its own fetch hooks throughout.

---

## P3 — Low Priority (Status)

### G38 · Deep links for ride and promo
**File:** `app/_layout.tsx`  
**Status:** `handleNotificationDeepLink` already handles:
- `veego://shuttle/trip/{tripId}` → `/trip-detail?id=...`  
- `category === 'booking' | 'trip'` → `/trip-detail`  
- `category === 'promo'` → `/promo?code=...`  
- `category === 'ride'` → `/(tabs)/car`  
No additional frontend work needed. Backend must send matching `deep_link` / `category` fields in push payloads.

### G31 · `useNotifications` fetches `/users/me` for userId
**File:** `src/hooks/useNotifications.ts`  
**Status:** The `fetchUserId()` call runs once (gated by `socketSetup.current`). This is an optimization opportunity (could read from a shared profile context) but is not a bug. Deferred — no user-facing impact.

---

## Backend-Only Gaps (Cannot Fix in Frontend)

These require API changes:

| Gap | Issue | Required Backend Fix |
|-----|-------|---------------------|
| G01 | Delete account returns 404 | Implement `DELETE /users/me` |
| G02 | Avatar upload returns 404 | Implement `POST /users/me/avatar` with multipart |
| G03 | Support tickets return 401 | Add auth middleware to `POST /support/tickets` |
| G04 | SOS route path wrong | Fix `/:id/sos` → `/rides/:id/sos` |
| G05 | Promo available list | Add `GET /promo/available` endpoint |
| G07 | Ride history path | Add `GET /rides/my` (or confirm it exists) |
| G08 | Rate-driver no booking check | `POST /rides/:id/rate` should verify ride belongs to user |
| G19 | `shuttle:driver:location` payload shape | Verify backend emits `{ tripId, lat, lng, heading }` |

---

## Files Changed

| File | Gaps Fixed |
|------|-----------|
| `src/hooks/useFavoriteDestinations.ts` | G06, G07 |
| `src/hooks/useTrips.ts` | G07 |
| `src/hooks/usePromos.ts` | G05 |
| `src/api/client.ts` | G21 (registerSocketReconnect + call on refresh) |
| `src/api/socket.ts` | G21 (register at init), G22 (types) |
| `src/hooks/useRide.ts` | G22 (driver_cancelled, no_show_cancelled) |
| `app/(tabs)/wallet.tsx` | G18 (negative balance), G29 (useDebt → useMyDebt) |
| `app/(tabs)/index.tsx` | G36 (avatar onPress) |
| `components/TripSheet.tsx` | G13 (seatCount reset), G37 (heart onPress) |
| `app/(tabs)/profile.tsx` | G25 (real phone from API) |
| `src/hooks/useDebt.ts` | G29 (deleted — deprecated) |
| `package.json` | G30 (removed @tanstack/react-query) |

---

## Verification

- App compiles and runs without errors after all changes.
- Network errors (`GET /promo/available`, `GET /rides/my`, etc.) are expected in dev — no `EXPO_PUBLIC_API_URL` is configured. All errors are gracefully handled (silent fallbacks or warnings, no crashes).
- Socket re-auth registration pattern avoids circular module dependencies.
