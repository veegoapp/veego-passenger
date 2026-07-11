# VeeGo Passenger App — Production Readiness Audit

**Scope:** `veego-passenger` (React Native / Expo Router). Backend (`veeGoBackEnd/artifacts/api-server`) inspected **read-only** to verify REST contracts, socket events, and data flow.
**Method:** Static analysis of every screen, hook, context, and API module in the Passenger App, cross-checked against the backend route handlers and the shared socket-event contract (`lib/socket-events.ts`).
**Audit date:** 2026-07-11
**Rule applied:** No file was modified. Every issue below is backed by concrete code evidence. Items that looked suspicious but are actually correct are documented in §5.

---

## 1. Critical Issues

### C-1. Car ride request always fails — empty `pickupAddress` violates backend validation
- **Severity:** Critical
- **Area:** Ride booking (car / scooter / delivery)
- **File:** `components/car/CarServiceScreen.tsx:209-214`, `src/hooks/car/useRide.ts:489-500`
- **Evidence (app):**
  ```ts
  // CarServiceScreen.handleConfirmRide — the ONLY working car entry point (rendered by index.tsx)
  const result = await requestRide({
    type: 'car',
    pickup:  { ...pickup,  address: '' },          // ← always empty
    dropoff: { ...dropoff, address: destination ?? '' },
    notes: selectedRide,
  });
  // useRide.requestRide → POST /rides/request
  pickupAddress: payload.pickup.address ?? '',     // → ''
  ```
- **Evidence (backend):** `routes/rides.ts` — `POST /rides/request` delegates to `rideRequestCore`, which validates with `RequestRideBody`:
  ```ts
  const RequestRideBody = z.object({
    pickupAddress: z.string().min(1),   // rejects ""
    dropoffAddress: z.string().min(1),
    ...
  });
  ```
- **Why it is a problem:** The primary car-booking flow (`index.tsx` → `CarServiceScreen`) hard-codes `pickup.address: ''`. The backend rejects an empty `pickupAddress` with `400 INVALID_REQUEST`, so **every car/scooter ride request from the main screen fails**. `useRide.requestRide` catches the error and flips the ride into a `cancelled` state, surfacing a generic failure. The alternate tab screen `app/(tabs)/car.tsx` is also non-functional because its `WG_PLACES`/`WG_COORDS` lookup tables are empty (`car.tsx:39-41`), so it never resolves coordinates.
- **Recommended fix:** Send a real pickup address — reverse-geocode `userCoords` (Expo `Location.reverseGeocodeAsync`) before requesting, or send the map-derived label. As a minimum, pass a non-empty placeholder. Note that the sibling endpoint `POST /rides` accepts `pickup.address` optional and defaults to `""`, so switching `useRide` to `POST /rides` would also resolve it.
- **Backend change required:** No (app can send a valid address). Optionally relax `RequestRideBody.pickupAddress` to `.optional()` for parity with `POST /rides`.

### C-2. In-ride chat is wired to the wrong backend resource (broken + cross-trip data exposure)
- **Severity:** Critical
- **Area:** Car ride messaging / user safety / data isolation
- **File:** `src/hooks/car/useRideChat.ts:33,81`, consumed by `components/car/ChatModal.tsx` (used with `tripId={rideState.rideId}` in `app/(tabs)/car.tsx:861` and `components/car/DriverAssignedCard.tsx:169`)
- **Evidence (app):**
  ```ts
  // useRideChat — tripId is actually a RIDE id for car rides
  api.get(`/trips/${tripId}/chat`)                 // GET shuttle-trip chat
  api.post(`/trips/${tripId}/chat`, { message })   // POST shuttle-trip chat
  socket.on('trip:chat:message', handler)          // shuttle-trip event
  ```
- **Evidence (backend):** Car rides have a **dedicated** chat resource; shuttle trips have a **separate** one, backed by different tables (`ridesTable`/`rideMessagesTable` vs `tripsTable`/`chatMessagesTable`):
  ```ts
  // routes/rides.ts — correct car endpoints (ownership-checked, emit ride:message:new)
  router.get("/rides/:id/messages", ...)   // verifies ride.passengerId === userId
  router.post("/rides/:id/messages", ...)  // emits SOCKET_EVENTS.RIDE_MESSAGE_NEW to passenger:{id}/driver:{id}
  // routes/chat.ts — the endpoint the app actually calls
  router.get("/trips/:id/chat", authenticate, ...)   // NO ownership check; looks up tripsTable by id
  router.post("/trips/:id/chat", ...)                // requires trip to exist in tripsTable; emits trip:chat:message to trip:{id}
  ```
- **Why it is a problem:** For a car ride, `rideState.rideId` is a `rides` row id, but it is sent to `/trips/:id/chat`, which resolves against the **`trips`** table (shuttle trips):
  1. **Chat never works for car rides** — the real-time listener waits for `trip:chat:message`, but ride chat emits `ride:message:new` to the `passenger:{id}` room, so no message is ever delivered live.
  2. **Cross-trip exposure** — `GET /trips/:id/chat` performs **no ownership check** (`routes/chat.ts:60`). If a shuttle trip happens to share the numeric id of the user's ride, `GET` returns that stranger's shuttle chat history, and `POST` injects the passenger's message into that shuttle trip's room (`trip:{id}`), broadcasting private text to unrelated passengers/drivers.
- **Recommended fix (app):** Point car chat at `GET/POST /rides/:id/messages` and listen for `ride:message:new`; keep `/trips/:id/chat` only for shuttle trips. Map the ride message shape (`text`, `senderRole`, `sentAt`) accordingly.
- **Backend change required:** Partial. The app fix is sufficient to restore car chat. Separately, the backend should add an ownership/authorization check to `GET /trips/:id/chat` regardless (see §6).

---

## 2. Medium Issues

### M-1. Multi-seat shuttle booking is offered in the UI but always rejected by the backend
- **Severity:** Medium
- **Area:** Shuttle booking / user feedback
- **File:** `components/shuttle/TripSheet.tsx:848-873` (seat selector 1..available), `context/BookingContext.tsx:255-273` (allows 1..10)
- **Evidence (app):**
  ```ts
  // TripSheet allows increasing seatCount up to selectedTripSeats
  onPress={() => setSeatCount(Math.min(selectedTripSeats, seatCount + 1))}
  // BookingContext.handleConfirm passes it straight through
  const body = { tripId, seatCount, paymentMethod: 'cash' };
  const { data } = await api.post('/bookings', body);
  ```
- **Evidence (backend):** `routes/bookings.ts:102-105`
  ```ts
  if (seatCount !== 1) {
    res.status(400).json({ error: "Shuttle bookings allow exactly 1 seat per booking.", code: "BOOKING_SEAT_COUNT_EXCEEDED" });
    return;
  }
  ```
- **Why it is a problem:** The seat stepper lets a passenger choose 2+ seats and shows a multiplied price (`total = pricePerSeat * seatCount`), but any `seatCount > 1` is rejected with a generic “Booking Failed” alert (the `409` special-casing in `BookingContext` doesn’t cover this `400`). The user sees a price they can never actually pay.
- **Recommended fix:** Lock the shuttle seat selector to 1 (the `CreateBookingBody` type in `src/api/shuttleService.ts:16` already declares `seatCount: 1`), or map `BOOKING_SEAT_COUNT_EXCEEDED` to a clear message.
- **Backend change required:** No.

### M-2. Debt banner shows “undefined” for the amount owed (field-name mismatch)
- **Severity:** Medium
- **Area:** Wallet / payments messaging
- **File:** `app/(tabs)/wallet.tsx:224`, `src/hooks/shared/useMyDebt.ts:25`, type in `constants/data.ts:41-45`
- **Evidence (app):**
  ```ts
  // wallet.tsx
  {t('debt_owe_msg').replace('{amount}', String(debt.amount))}   // debt.amount
  // constants/data.ts — DebtInfo has debtAmount, NOT amount
  export interface DebtInfo { hasDebt: boolean; debtAmount: number; offenceCount: number; }
  ```
- **Evidence (backend):** `routes/shuttle.ts:1289,1294`
  ```ts
  res.json({ hasDebt: true, debtAmount: Math.abs(balance), offenceCount });
  ```
- **Why it is a problem:** `getMyDebt` returns the raw backend object (`{ hasDebt, debtAmount, offenceCount }`). `wallet.tsx` reads `debt.amount`, which does not exist → `String(undefined)` renders **“You owe undefined EGP.”** A user in debt is shown a broken financial message. (`offenceCount` is read correctly.)
- **Recommended fix:** Read `debt.debtAmount` in `wallet.tsx`.
- **Backend change required:** No.

### M-3. Passenger location tracking silently fails for every snapshot (schema rejects `null`/string ids)
- **Severity:** Medium
- **Area:** Location tracking / offline behavior / user-safety data
- **File:** `src/hooks/shared/usePassengerTracking.ts:127-141`, `src/hooks/shared/backgroundLocationTask.ts:19-30`
- **Evidence (app):** Every snapshot explicitly includes `null` ids, and car rides pass a **string** `rideId`:
  ```ts
  const snapshot: LocationSnapshot = {
    entityType: 'passenger',
    ...
    tripId: tripIdRef.current ?? null,   // shuttle: number; car: null
    rideId: rideIdRef.current ?? null,   // car: string; shuttle: null
    isOfflineSync: false,
  };
  await api.post('/tracking/location', snapshot);
  ```
- **Evidence (backend):** `routes/tripTracking.ts:12-21`
  ```ts
  const LocationBody = z.object({
    entityType: z.enum(["driver", "passenger"]),
    tripId: z.number().int().positive().optional(),   // .optional() allows undefined, NOT null
    rideId: z.number().int().positive().optional(),   // expects a number, app sends string
    ...
  });
  ```
- **Why it is a problem:** `z.number().optional()` accepts `undefined` but rejects an explicit `null`, so the shuttle snapshot (`rideId: null`) fails validation; the car snapshot additionally sends `rideId` as a string. Both produce `400`, and the hook treats non-network 4xx as “silently dropped” (`usePassengerTracking.ts:160`) and even purges the offline queue on 4xx (`flushOfflineSnapshots`, lines 66-70). Net effect: **passenger location history is never recorded** — a feature that also matters for incident/SOS investigation.
- **Recommended fix:** Omit `tripId`/`rideId` when they are null (don’t send the key), and send `rideId` as a number. Alternatively coordinate a backend schema of `z.coerce.number().nullish()`.
- **Backend change required:** Preferably yes for robustness, but the app can fix it alone by omitting null keys and coercing `rideId` to a number.

### M-4. Home-screen destination search sends user queries to a third-party (Nominatim) with no key/User-Agent
- **Severity:** Medium
- **Area:** External URLs / reliability / privacy
- **File:** `app/(tabs)/index.tsx:219-239`
- **Evidence:**
  ```ts
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(typedText)}&limit=8&addressdetails=1`,
    { signal: controller.signal, headers: { 'Accept-Language': ... } }
  );
  ```
- **Why it is a problem:** (a) OpenStreetMap’s Nominatim usage policy requires an identifying `User-Agent`/`Referer` and rate-limits anonymous callers; production traffic can be throttled or blocked, silently breaking address search (the `catch {}` swallows failures). (b) Every keystroke of a user’s intended destination is sent to a third party, bypassing the app’s own `/directions` proxy pattern used elsewhere.
- **Recommended fix:** Proxy geocoding through the backend (consistent with the `/api/directions` proxy already in use per `src/constants/config.ts`), or set a compliant `User-Agent` and debounce/caching. Surface a visible “search unavailable” state instead of silently returning no results.
- **Backend change required:** Yes if geocoding is proxied (new endpoint); otherwise app-only mitigations.

### M-5. `trip-detail` cancel sends a **tripId** to an endpoint that expects a **bookingId**
- **Severity:** Medium
- **Area:** Shuttle cancellation
- **File:** `app/trip-detail.tsx:481-506` + navigation source `app/(tabs)/trips.tsx:423`
- **Evidence (app):** Trip cards navigate with the **trip** id, and `mapApiToDetail` stores `id = trip.id`:
  ```ts
  // trips.tsx
  router.push(`/trip-detail?id=${trip.tripId}` as any);
  // trip-detail.doCancel — id here is the route param (a tripId)
  const result = await cancelBooking(id);   // → DELETE /shuttle/bookings/:id
  ```
- **Evidence (backend):** `routes/shuttle.ts:1153-1170` looks up by **booking** id:
  ```ts
  const bookingId = parseInt(req.params.id as string);
  const [booking] = await db.select({...}).from(bookingsTable).where(eq(bookingsTable.id, bookingId));
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
  ```
- **Why it is a problem:** `trip-detail` is reached with a `tripId` (from the trips list and from deep links), but `DELETE /shuttle/bookings/:id` matches on `bookingsTable.id`. The user’s real `bookingId` is available in the fetched booking object but is discarded (`mapApiToDetail` keeps only `trip.id`). Cancelling from the detail screen therefore hits a wrong/nonexistent booking id → typically `404 Booking not found`, or, if a booking with that numeric id exists, could act on the wrong record. (The trips-list cancel path is correct — it uses `trip.bookingId` with the legacy `PATCH /bookings/:id/cancel`.)
- **Recommended fix:** Capture the booking id in `mapApiToDetail` (e.g. `bookingId: b.id`) and pass it to `cancelBooking`.
- **Backend change required:** No.

### M-6. Wallet balance is never fetched — booking wallet gate and balance display are dead
- **Severity:** Medium (low functional impact today, because bookings are cash-only)
- **Area:** State management / user feedback
- **File:** `context/BookingContext.tsx:95-102,133,358`
- **Evidence:** `fetchWalletBalance` and `setWalletBalance` are defined but **never called**:
  ```ts
  async function fetchWalletBalance(): Promise<number | null> { ... }   // defined
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  // ...provided in context value, but no call site invokes fetchWalletBalance/setWalletBalance
  ```
- **Why it is a problem:** In `TripSheet`, `walletBalance` is always `null`, so `walletLow` is always `false` (the “Insufficient Balance” CTA state never appears) and the wallet row is stuck on `t('wallet_loading')` (`TripSheet.tsx:892-899`). Harmless while bookings are `paymentMethod: 'cash'` (server ignores balance), but the UI is misleading and the gate is inert should wallet payments be enabled.
- **Recommended fix:** Call `fetchWalletBalance()` when the confirm/trip sheet opens and set the state, or remove the dead wallet-gate code.
- **Backend change required:** No.

---

## 3. Low Priority Cleanup

- **L-1. Dead/non-functional legacy car screen.** `app/(tabs)/car.tsx` (1,367 lines) drives its pickers from `WG_PLACES: string[] = []` and `WG_COORDS = {}` (lines 39-41), so it can never resolve a location. It is not registered in the tab bar (`app/(tabs)/_layout.tsx:207-211`). The live car flow is `components/car/CarServiceScreen.tsx`. Remove or wire up the legacy screen to avoid confusion and dead maintenance surface.
- **L-2. Session blob written to SecureStore but deleted from AsyncStorage.** `app/auth.tsx:22` and `app/verify-phone.tsx:93` write `@veego_session_v1` via `SecureStore.setItemAsync`, but logout and startup delete it via `AsyncStorage.removeItem` (`profile.tsx:1195`, `index.tsx:55,79`). The two are different stores, so the session record (containing the user’s email/phone identifier) is never actually cleared. Nothing reads it today → pure dead/leaky code. Standardize on one store.
- **L-3. Duplicate driver-status/ETA normalization.** `useRide` re-implements the same driver-mapping block three times (socket `ride:driver_assigned`, poll, and reconnect handlers — `useRide.ts:184-197,257-268,455-464`). Extract one `mapDriver()` helper.
- **L-4. Console logging of raw error payloads.** `components/shuttle/RequestTripSheet.tsx:160-162` logs `JSON.stringify(e?.response?.data)`; `context/PaymentConfigContext.tsx`, `ServiceControlContext.tsx`, and several hooks log connection/auth details. Fine for dev, noisy for production — gate behind `__DEV__`.
- **L-5. Deprecated cancel endpoint still used.** `app/(tabs)/trips.tsx:272` uses `PATCH /bookings/:id/cancel` while the rest of the app uses `DELETE /shuttle/bookings/:id` (the documented preferred path per `shuttleService.ts:99-112`). Consolidate.
- **L-6. `useWalletRecharge` references admin-only endpoint in a comment only.** Comment at `useWalletRecharge.ts:57-63` correctly documents avoiding `POST /wallet/topup` (admin/MFA-gated in `routes/wallet.ts:63`) — no action needed, but worth keeping the guardrail note.
- **L-7. Static placeholder tables.** `constants/data.ts:163-164,185` (`stations`, `routes`, `TIMES`) are unused placeholders kept “for backwards compat.” Remove if no longer referenced.

---

## 4. Backend Dependency Review

Issues that **cannot be fully fixed from the Passenger App alone**:

| # | What is missing / needed from backend | Endpoint / socket / DB behavior | Why a backend change is needed |
|---|---|---|---|
| B-1 | Authorization on trip chat read | `GET /trips/:id/chat` (`routes/chat.ts:60`) | The handler returns any trip’s chat by id with **no ownership check**. Even after the app moves car chat to `/rides/:id/messages` (C-2), this endpoint remains an IDOR for shuttle chat. Backend must verify the caller is a party to the trip. |
| B-2 | Location snapshot schema tolerance | `POST /tracking/location`, `POST /tracking/locations/batch` (`routes/tripTracking.ts:12-21`) | `tripId`/`rideId` are `z.number().optional()` (rejects `null`). Robust cross-platform behavior benefits from `z.coerce.number().nullish()` so mobile clients can send explicit nulls. The app can also work around it (M-3), but a lenient contract prevents silent data loss. |
| B-3 | (Optional) Address optionality parity | `POST /rides/request` → `RequestRideBody.pickupAddress: z.string().min(1)` | C-1 is app-fixable, but `POST /rides` and `POST /rides/request` disagree on whether address is required. Aligning them removes a class of 400s. |
| B-4 | (Optional) Geocoding proxy | none today | M-4 (Nominatim) is best solved by a backend geocoding proxy so no third-party key/policy is embedded in the client. |

Everything else in §1–§2 is fixable entirely within the Passenger App.

---

## 5. False Positives (look like bugs, are actually correct)

- **FP-1. Paymob “success” is never trusted as a wallet credit.** `PaymobCheckoutModal.parseOutcomeFromUrl` only uses the redirect to decide when to close the WebView; the actual credit is confirmed by polling `GET /wallet` for a balance increase (`useWalletRecharge.ts:77-99`), and the “Recharged!” alert fires **only** from the `confirmed` branch (`wallet.tsx:111-118`). This matches the HMAC-verified async webhook model (`routes/paymob.ts:171`). Correct and defensive.
- **FP-2. Paymob merchant-order matching prevents cross-order redirects.** `parseOutcomeFromUrl` ignores a redirect whose `merchant_order_id` differs from the one issued (`PaymobCheckoutModal.tsx:47-51`), and `resolveOnce` guarantees a single outcome per session. No duplicate-credit path from the client.
- **FP-3. Ride socket handlers validate payloads and scope by `rideId`.** Every `useRide` socket handler `safeParse`s with a Zod schema and drops events whose `rideId` doesn’t match the active ride (`useRide.ts:252-444`). Malformed/mis-targeted events cannot corrupt ride state.
- **FP-4. Ride status normalization is centralized.** All raw backend statuses pass through `normalizeRideStatus` (`src/api/socket.ts:84-97`), which mirrors the backend `rideStatusEnum`. `requested/searching → searching`, `driver_arrived → arrived`, `active → started` are intentional and consistent.
- **FP-5. `trip-detail` and `trip-tracking` enforce ownership before showing ride/booking data.** Both decode the JWT `sub`/`userId` and redirect away if the record’s owner differs (`trip-detail.tsx:216-238`, `trip-tracking.tsx:80-92`). Not a data leak.
- **FP-6. Auth refresh is single-flight with a queued retry.** The 401 interceptor serializes refresh and replays queued requests with the new token (`client.ts:83-126`), reconnecting the socket after refresh. Correct concurrency handling; account-suspended (403) short-circuits to `/suspended`.
- **FP-7. Booking confirm is idempotent client-side and re-checks service availability.** `confirmingRef` guards double submits, and service control is re-validated at confirm time (`BookingContext.tsx:229-242`). Server also enforces via `idempotencyMiddleware("/bookings")`.
- **FP-8. `service:control` fails **closed**.** `handleServiceTap` blocks a service tap when there is no backend record or an unknown `displayMode` (`ServiceControlContext.tsx:271-297`). Conservative and correct.
- **FP-9. Cairo-timezone formatting is deliberate.** Trip times are rendered via `Intl.DateTimeFormat(..., { timeZone: 'Africa/Cairo' })` with a UTC fallback (`constants/data.ts:261-284`, `TripSheet.tsx:66-96`). Matches §21.9 of the integration spec.
- **FP-10. Both `passenger:join:trip` (bare number) and `join:trip` ({tripId}) are valid.** The backend registers handlers for each form and both join the same `trip:{id}` room after verifying an active booking (`socket.ts:544-598`). The app’s mixed usage is intentional and supported.

---

## 6. Security Review

- **Token handling — GOOD.** Access/refresh tokens are stored in `expo-secure-store` (`src/api/client.ts:21-44`), attached via request interceptor, refreshed single-flight, and cleared on logout (`profile.tsx:1195`). Tokens are never logged.
- **Credential storage — GOOD, with one hygiene gap.** No passwords are persisted. However, the `@veego_session_v1` blob (email/phone identifier) is written to SecureStore but “deleted” from AsyncStorage (see L-2), so it lingers after logout. Low-risk PII residue.
- **Sensitive data in logs — MINOR.** `RequestTripSheet.tsx:160-162` logs full error response bodies; several contexts log socket/auth diagnostics. Gate behind `__DEV__` (L-4). No tokens or passwords are logged.
- **IDOR via trip chat — SEE C-2 / B-1.** `GET /trips/:id/chat` has no ownership check; the app both relies on it and (for car rides) points it at the wrong id space. This is the most significant security item.
- **Exposed user data — GOOD.** Ride/trip detail screens verify JWT ownership before rendering (FP-5). SOS posts include location only with permission (`SafetySheet.tsx:82-99`).
- **Permissions — REASONABLE.** Location (foreground + background), camera, notifications, media library are all requested with rationale strings (`app.json:33-46`). Background location is used for trip tracking with a foreground-service notification (`usePassengerTracking.ts:196-201`).
- **Payment security — GOOD.** No card data is handled in-app; Paymob runs in a hosted WebView; credit is confirmed server-side (FP-1/FP-2). No client secret/API key for payments.
- **Deep links — GOOD.** `handleNotificationDeepLink` (`app/_layout.tsx:44-115`) routes `veego://ride/{id}`, `veego://shuttle/trip/{id}`, `veego://promo/{code}` to screens that themselves enforce ownership (FP-5). IDs are string-split and not eval’d.
- **External URLs — MIXED.** `tel:122`, `tel:123`, `whatsapp://`, `https://wa.me`, `https://maps.google.com/?q=` in `SafetySheet.tsx` are safe. `https://nominatim.openstreetmap.org` (`index.tsx:224`) leaks destination queries to a third party (M-4).
- **Maps API keys — GOOD.** Google Maps keys are injected at build time via env (`app.config.ts`), and Directions calls are proxied through the backend so no runtime key ships in JS (`src/constants/config.ts`, `src/utils/googleDirections.ts:45-78`).

---

## 7. Payment Review

- **Wallet top-up (Paymob) — CORRECT.** `useWalletRecharge` → `POST /payments/paymob/initiate` with `{ amountEGP, type: 'wallet_topup' }`; opens the hosted checkout; confirms via balance polling (`GET /wallet`). States are well modeled (`initiating → checkout → confirming → confirmed/timeout/failed/cancelled`). Backend credits via the HMAC-verified webhook (`routes/paymob.ts:171`). No client-trusted credit path.
- **Failed / cancelled payments — CORRECT.** `handleCheckoutClose` distinguishes cancel vs error vs success/pending, and even on a user-initiated cancel it does one real balance check before declaring “cancelled” (covers 3-D Secure returns) — `useWalletRecharge.ts:132-171`. User messaging is explicit per outcome (`wallet.tsx:111-138`).
- **Duplicate transactions — GUARDED.** `resolvedRef`/`resolveOnce` in the checkout modal fire the outcome exactly once (`PaymobCheckoutModal.tsx:75-98`); merchant-order-id matching rejects foreign redirects (FP-2). Recharge polling compares against a **fresh** baseline read taken right before session creation (`useWalletRecharge.ts:107-111`).
- **Payment method — CASH-ONLY today.** Ride requests and bookings send `paymentMethod: 'cash'`; the receipt (`app/receipt.tsx`) and completed-ride cards message “pay driver cash.” Consistent.
- **Debt handling — PARTIALLY BROKEN.** Debt banners appear on home and wallet, but the wallet banner renders the amount as `undefined` (M-2). Server blocks new bookings when `walletBalance < 0`; the app surfaces the debt proactively (correct intent, broken display).
- **Wallet balance in booking — INERT.** `walletBalance` is never fetched (M-6); wallet-low gating is dead. Acceptable only because bookings are cash.

---

## 8. Ride / Shuttle Flow Review

**Car / on-demand ride**
- **Booking — BROKEN (C-1):** empty `pickupAddress` → `400` on the live flow.
- **Chat — BROKEN + risky (C-2):** wrong endpoint/id space.
- **Driver assignment, status, location — CORRECT:** socket handlers validate and scope by `rideId`; poll (`GET /rides/:id` every 5s) and reconnect re-sync as fallbacks (`useRide.ts:171-212,447-472`). Terminal statuses stop polling and clean up listeners.
- **Cancellation — CORRECT:** `PATCH /rides/:id/cancel`, state reset, listeners torn down (`useRide.ts:515-530`).
- **Live tracking / receipt — CORRECT:** `PassengerTrackingMap` animates driver marker, follows camera, computes ETA; `/receipt` re-checks `passengerRating` server-side before offering to rate.
- **Waiting charges / surge / deviation — CORRECT:** dedicated socket events update banners; deviation auto-dismisses after 30s (`car.tsx:451-455`).

**Shuttle**
- **Routes/trips load — CORRECT:** `GET /shuttle/lines`, `GET /shuttle/lines/:id`; tolerant field mapping; live seat availability via `GET /shuttle/trips/:id/availability`.
- **Booking — CORRECT for 1 seat, BROKEN for >1 (M-1).** Idempotent, service re-checked, 409 duplicate/seat-taken handled distinctly.
- **Ticket / boarding — CORRECT:** joins `trip:{id}` room; listens for `booking:boarded`, `shuttle:driver:location`, `trip:activated`; re-joins on reconnect (`ticket.tsx:271-333`).
- **Cancellation — CORRECT from list, BROKEN from detail (M-5).**
- **Real-time trip status — CORRECT:** `trips.tsx` and `trip-detail.tsx` patch cards from `shuttle:trip:status`, auto-navigate on first `shuttle:driver:location`, and fall back to polling (60s / 120s).
- **Location tracking — BROKEN (M-3):** every passenger snapshot 400s.
- **Notifications / deep links — CORRECT:** push token registered (`usePushToken`), deep links routed with ownership checks, in-app notifications appended from socket events.

---

## 9. Recommended Fix Order

| Priority | Issue | Reason | App only or Backend required |
|---|---|---|---|
| P0 | **C-1** Car ride request always 400s (empty `pickupAddress`) | Core product function (on-demand rides) is unusable in the primary flow | **App only** (send real address) |
| P0 | **C-2** Car chat hits `/trips/:id/chat` — broken + cross-trip exposure | Broken feature **and** potential private-message leak/misdelivery | **App** (switch to `/rides/:id/messages`) + **Backend** for IDOR hardening (B-1) |
| P1 | **B-1** `GET /trips/:id/chat` missing ownership check | IDOR on shuttle chat, independent of C-2 | **Backend** |
| P1 | **M-5** `trip-detail` cancel uses tripId vs bookingId | Users can’t cancel from the detail screen (or hit wrong record) | **App only** |
| P1 | **M-2** Debt amount shows “undefined” | Incorrect financial messaging to indebted users | **App only** |
| P2 | **M-1** Multi-seat shuttle booking always fails | Misleading price/UX; guaranteed failure path | **App only** |
| P2 | **M-3** Passenger location tracking silently dead | Lost tracking/safety data; offline queue purged on 4xx | **App** (omit null keys, numeric id) + optional **Backend** (B-2) |
| P3 | **M-4** Nominatim geocoding (no key/UA, third-party leak) | Search can be throttled in prod; destination privacy | **App** mitigations or **Backend** proxy (B-4) |
| P3 | **M-6** Wallet balance never fetched (dead gate) | Misleading “loading” + inert insufficient-balance gate | **App only** |
| P4 | **L-1…L-7** Dead code / logging / storage inconsistencies | Maintainability, log hygiene, PII residue | **App only** |

---

## 10. Final Summary

- **Total confirmed issues:** 15 → 2 Critical (C-1, C-2), 6 Medium (M-1…M-6), 7 Low (L-1…L-7).
- **Backend-dependent issues:** 4 (B-1 required for full C-2 remediation; B-2/B-3/B-4 optional/parity). Only **1** issue (B-1, the chat IDOR) strictly *requires* a backend change; the rest of §1–§2 are app-fixable.
- **False positives documented:** 10 (FP-1…FP-10).
- **Files involved in findings (22):**
  `src/hooks/car/useRide.ts`, `src/hooks/car/useRideChat.ts`, `components/car/ChatModal.tsx`, `components/car/CarServiceScreen.tsx`, `components/car/DriverAssignedCard.tsx`, `app/(tabs)/car.tsx`, `context/BookingContext.tsx`, `components/shuttle/TripSheet.tsx`, `components/shuttle/RequestTripSheet.tsx`, `app/trip-detail.tsx`, `app/(tabs)/trips.tsx`, `src/api/shuttleService.ts`, `src/hooks/shared/useMyDebt.ts`, `app/(tabs)/wallet.tsx`, `src/hooks/shared/usePassengerTracking.ts`, `src/hooks/shared/backgroundLocationTask.ts`, `app/(tabs)/index.tsx`, `app/auth.tsx`, `app/verify-phone.tsx`, `constants/data.ts`, `src/api/client.ts`, `components/wallet/PaymobCheckoutModal.tsx`.

**Production readiness verdict:** **Not ready.** Two Critical issues block or endanger core flows — on-demand ride booking fails end-to-end in the primary screen (C-1), and in-ride chat is both non-functional and a cross-trip data-exposure risk (C-2). These, plus the shuttle-cancel id mismatch (M-5) and the debt-amount display bug (M-2), should be resolved and re-verified before release. The payment/Paymob layer, auth/refresh, ownership checks, and socket-event contracts are otherwise well-built.
