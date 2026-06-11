# Passenger App Fixes — Backend Impact Check

## Summary

All 8 fixes have been implemented. Below is a complete backend impact analysis.

---

## New Backend Calls Added

| # | Method | Endpoint | When Called |
|---|--------|----------|-------------|
| 1 | `GET` | `/shuttle/my-debt` | On `WalletScreen` mount and on refresh |
| 2 | `GET` | `/shuttle/trips/:id` | On `TripDetailScreen` mount (primary fetch attempt) |
| 3 | `EMIT` | socket `join:trip` `{ tripId }` | On `TripDetailScreen` mount |
| 4 | `EMIT` | socket `leave:trip` `{ tripId }` | On `TripDetailScreen` unmount |

---

## Changed Backend Calls

| # | Screen / Hook | Old (Wrong) | New (Correct) |
|---|---------------|-------------|---------------|
| 1 | `src/hooks/useTrips.ts` — `fetchTrips()` | `GET /bookings` | `GET /shuttle/my-trips?page=1&limit=10` |
| 2 | `src/hooks/useWallet.ts` — `fetchWallet()` | `GET /wallet/balance` | `GET /wallet` |

---

## Socket Events Added

| # | Direction | Event Name | Payload Shape | When |
|---|-----------|------------|---------------|------|
| 1 | **Listen** | `shuttle:driver:location` | `{ tripId, driverId, lat, lng, heading? }` | While `TripDetailScreen` is mounted, when trip status is `driver_assigned` or `scheduled` and departure is within 20 minutes |
| 2 | **Emit** | `join:trip` | `{ tripId }` | On `TripDetailScreen` mount |
| 3 | **Emit** | `leave:trip` | `{ tripId }` | On `TripDetailScreen` unmount |

---

## No Backend Changes Needed

| Fix | Reason |
|-----|--------|
| **Fix 1 — Trip Status Labels** | Pure frontend change. Labels (Arabic/English) are derived client-side from the backend status strings which are now mapped correctly. No new API call needed. |
| **Fix 6 — Booking Notification Deep Link** | Pure frontend change. The notification payload already includes `tripId` from the backend. Only the client-side handler in `_layout.tsx` was updated to navigate to `/trip-detail?id={tripId}` instead of going to the trips tab. |
| **Fix 7 — Invite Friends Deep Link** | Pure frontend change. The `deep_link` field (`veego://shuttle/trip/{tripId}`) is already sent by the backend in the notification payload. The client now reads it, handles navigation, and opens the native Share sheet — no new backend endpoint needed. |
| **Fix 8 — Suspended Account Screen** | Pure frontend change. The backend already returns `HTTP 403` with `reason: "account_suspended"`. The Axios interceptor in `client.ts` was updated to catch this response and redirect to the new `SuspendedScreen`. |

---

## Files Changed

| File | Fix(es) | Change Type |
|------|---------|-------------|
| `constants/data.ts` | 1 | Extended `Trip.status` type to include all backend statuses; added `shuttleStatusLabel()` and `isShuttleTripUpcoming()` helpers |
| `src/hooks/useTrips.ts` | 1, 2 | Replaced `GET /bookings` with `GET /shuttle/my-trips`; added full status mapping; added pagination (`loadMore`, `hasMore`) |
| `src/hooks/useWallet.ts` | 3 | Replaced `GET /wallet/balance` with `GET /wallet` |
| `src/hooks/useDebt.ts` | 5 | **New file** — `useDebt` hook calling `GET /shuttle/my-debt` |
| `app/(tabs)/wallet.tsx` | 5 | Added cash debt banner using `useDebt` hook |
| `app/(tabs)/trips.tsx` | 1 | Updated status labels to Arabic/English via `shuttleStatusLabel()`; updated status dot colors; added `loadMore` button; trips now navigate to `/trip-detail` |
| `app/trip-detail.tsx` | 4, 6, 7 | **New screen** — trip detail with driver location map, socket join/leave, share button for under-booked trips |
| `app/_layout.tsx` | 6, 7 | Updated `handleNotificationDeepLink()` to route to `/trip-detail?id={tripId}` for booking/trip notifications and `veego://shuttle/trip/{tripId}` deep links |
| `src/api/client.ts` | 8 | Added 403 + `reason: "account_suspended"` interceptor redirecting to `/suspended` |
| `app/suspended.tsx` | 8 | **New screen** — blocks all navigation, shows Arabic suspension message, "Contact Support" button |

---

## Fix-by-Fix Detail

### Fix 1 — Trip Status Values
- **Files:** `constants/data.ts`, `src/hooks/useTrips.ts`, `app/(tabs)/trips.tsx`
- Status mapping function `mapBackendStatus()` converts `open` → `scheduled`, and all other raw backend values to their correct type.
- `shuttleStatusLabel()` returns the correct Arabic or English label for each status.
- Status dot colors updated: amber for `waiting_driver`/`scheduled`, blue for `driver_assigned`, green for `active`/`boarding`/`upcoming`, grey for `completed`, red for `cancelled`.

### Fix 2 — Trip History Endpoint
- **File:** `src/hooks/useTrips.ts`
- Primary call changed from `GET /bookings` to `GET /shuttle/my-trips?page=1&limit=10`.
- Response parsed from `{ trips, total, page, limit }` shape.
- `loadMore()` increments the page parameter and appends results.
- `hasMore` is true when `loaded < total`.

### Fix 3 — Wallet Endpoint
- **File:** `src/hooks/useWallet.ts`
- `GET /wallet/balance` → `GET /wallet`.
- The `balance` field is read from the same `data.balance` key as before.

### Fix 4 — Driver Location Map
- **File:** `app/trip-detail.tsx`
- `PassengerTrackingMap` (existing component) is shown when `trip.status` is `driver_assigned` or `scheduled` AND departure time is within 20 minutes (or driver location is already received).
- Map is hidden when status changes to `boarding`, `completed`, or `cancelled`.
- Socket room is joined via `join:trip { tripId }` on mount and left via `leave:trip { tripId }` on unmount.
- `shuttle:driver:location` payload `{ tripId, lat, lng, heading }` updates the driver marker in real time.

### Fix 5 — Cash Debt Banner
- **Files:** `src/hooks/useDebt.ts`, `app/(tabs)/wallet.tsx`
- `useDebt` fetches `GET /shuttle/my-debt` and exposes `{ hasDebt, amount, offenceCount }`.
- On `WalletScreen`, if `hasDebt` is true, a yellow banner is shown with the Arabic text: _"عليك مبلغ X جنيه، ادفعه للسائق في رحلتك القادمة."_
- If `offenceCount > 1`, an additional line shows: _"لديك N مخالفات غياب."_

### Fix 6 — Booking Notification Deep Link
- **File:** `app/_layout.tsx`
- `handleNotificationDeepLink()` now extracts `tripId` (or `bookingId`) from the notification `data` payload.
- Navigates to `/trip-detail?id={tripId}` instead of the generic trips tab.
- Works for both background taps and cold-start (via `getLastNotificationResponseAsync`).

### Fix 7 — Invite Friends Deep Link
- **File:** `app/_layout.tsx`, `app/trip-detail.tsx`
- Notification handler checks `data.deep_link` for the pattern `veego://shuttle/trip/{tripId}` and navigates to `/trip-detail?id={tripId}`.
- On `TripDetailScreen`, when `passengerCount < minPassengers`, a share card is shown.
- The share button calls `Share.share()` with the native share sheet, passing the deep link `veego://shuttle/trip/{tripId}`.

### Fix 8 — Suspended Account Screen
- **Files:** `src/api/client.ts`, `app/suspended.tsx`, `app/_layout.tsx`
- Axios response interceptor catches `HTTP 403` with `reason === "account_suspended"` on **every API call**.
- Redirects immediately to `/suspended` (the screen has `gestureEnabled: false` to block back navigation).
- Screen shows Arabic and English suspension messages plus a "Contact Support" button that opens WhatsApp/support.
