# Runtime Reliability Audit — VeeGo Passenger App (Shuttle Focus)

> **Scope:** Socket lifecycle · Memory leaks · Background/foreground transitions · Offline recovery · Race conditions  
> **Date:** 2026-06-20  
> **Mode:** READ-ONLY analysis. No code was modified.  
> **Methodology:** Full static analysis of all shuttle-related screens, hooks, contexts, and the socket layer.

---

## Table of Contents

1. [Socket Lifecycle Audit](#1-socket-lifecycle-audit)
2. [React Query Audit](#2-react-query-audit)
3. [Background / Foreground Behavior](#3-background--foreground-behavior)
4. [Offline / Reconnect Recovery](#4-offline--reconnect-recovery)
5. [Memory Leak Audit](#5-memory-leak-audit)
6. [Race Conditions](#6-race-conditions)
7. [Production Readiness Score](#7-production-readiness-score)

---

## 1. Socket Lifecycle Audit

### Socket Infrastructure — `src/api/socket.ts`

The app uses a **singleton socket pattern**: `getSocket()` creates or reuses a single Socket.IO instance. Token injection happens via `auth: { token }` on connect. `reconnectSocket()` calls `disconnectSocket()` then `getSocket()`, which is correct — but read on for risks.

```
Lines 43–53: Three lifecycle listeners registered — connect, connect_error, disconnect
```

**Critical finding:** These three internal listeners (`connect`, `connect_error`, `disconnect`) are registered inside `getSocket()` on the socket instance but **are never cleaned up**. If `reconnectSocket()` is called (e.g. after token refresh), a new socket is created and new lifecycle listeners are attached to it. The old socket is destroyed, so the old listeners die with it — this is safe. However, if `getSocket()` is called multiple times before `disconnectSocket()`, the check `if (socket) return socket` at the top prevents re-registration. **Assessment: LOW RISK** for lifecycle listeners specifically, but the pattern is fragile.

---

### Listener-by-Listener Inventory

#### `src/hooks/shared/useNotifications.ts`

| Event | Line | Cleanup Line | Cleanup Guaranteed? | Handler Ref? | Duplicate Risk |
|---|---|---|---|---|---|
| `notification:new` | ~84 | ~133 | ❌ NO | Named | HIGH |
| `booking:boarded` | ~89 | ~134 | ❌ NO | Named | HIGH |
| `trip:activated` | ~102 | ~135 | ❌ NO | Named | HIGH |

**Evidence — cleanup block:**
```typescript
return () => {
  getSocket().then((socket) => {
    socket.off('notification:new');
    socket.off('booking:boarded');
    socket.off('trip:activated');
  }).catch(() => {});   // ← silent catch: if getSocket() rejects, listeners are NEVER removed
};
```

**Risk:** `getSocket()` is async. If the socket is unavailable at cleanup time (network down, token expired), the `catch(() => {})` silently swallows the error and **all three listeners remain attached**. On the next mount, three more listeners are added. Notifications, boarding events, and trip activations will fire the handler **N times** where N = number of mounts since last successful cleanup.

**No fallback polling** exists for notifications — if socket is unavailable and cleanup fails, the user sees stale notification state indefinitely.

**Verdict: ⚠️ FAIL**

---

#### `app/(tabs)/trips.tsx`

| Event | Line | Cleanup Line | Cleanup Guaranteed? | Handler Ref? | Duplicate Risk |
|---|---|---|---|---|---|
| `shuttle:trip:status` | ~219 | ~223 | ⚠️ PARTIAL | Named | MODERATE |
| `shuttle:driver:location` | ~220 | ~224 | ⚠️ PARTIAL | Named | MODERATE |

**Evidence:**
```typescript
let cleanupFns: (() => void)[] = [];

getSocket().then((socket) => {
  socket.on('shuttle:trip:status', statusHandler);
  socket.on('shuttle:driver:location', locationHandler);
  cleanupFns = [
    () => socket.off('shuttle:trip:status', statusHandler),
    () => socket.off('shuttle:driver:location', locationHandler),
    () => tripIds.forEach((tid) => socket.emit('leave:trip', { tripId: tid })),
  ];
}).catch(() => {});

return () => { cleanupFns.forEach(fn => fn()); };
```

**Risk:** `cleanupFns` is initialized inside the `.then()` callback. If `getSocket()` fails or is still pending when the component unmounts, `cleanupFns` remains `[]` and **cleanup is a no-op**. Listeners are orphaned.

A `cleanedUp` flag is present to guard against late-resolving promises (good), but this doesn't help if the listeners were already attached and cleanup can't reach them.

**Fallback polling** (60 s `setInterval` at lines 235–239) does clean up correctly:
```typescript
return () => clearInterval(interval);  // ✅ correct
```

**Verdict: ⚠️ WARNING**

---

#### `app/trip-detail.tsx`

| Event | Line | Cleanup Line | Cleanup Guaranteed? | Handler Ref? | Duplicate Risk |
|---|---|---|---|---|---|
| `shuttle:driver:location` | ~343 | ~348 | ⚠️ PARTIAL | Named | LOW |
| `shuttle:trip:status` | ~344 | ~349 | ⚠️ PARTIAL | Named | LOW |
| `booking:boarded` | ~345 | ~350 | ⚠️ PARTIAL | Named | LOW |

**Evidence:**
```typescript
const handlers: (() => void)[] = [];
getSocket().then((socket) => {
  socket.on('shuttle:driver:location', locationHandler);
  socket.on('shuttle:trip:status', statusHandler);
  socket.on('booking:boarded', boardedHandler);
  handlers.push(
    () => socket.off('shuttle:driver:location', locationHandler),
    () => socket.off('shuttle:trip:status', statusHandler),
    () => socket.off('booking:boarded', boardedHandler),
  );
}).catch(() => {});

return () => { handlers.forEach(fn => fn()); };
```

Same async cleanup gap as `trips.tsx`. However, named handler refs are used correctly — if cleanup does run, it removes only the specific handler, not all listeners for that event.

**Two polling intervals** are present and correctly cleaned up:
- `setInterval(() => fetchStations(trip.id!), 30_000)` → `clearInterval(interval)` ✅  
- `setInterval(() => fetchTrip(), 2 * 60_000)` → `clearInterval(id)` ✅

**Verdict: ⚠️ WARNING**

---

#### `app/ticket.tsx`

| Event | Line | Cleanup Line | Cleanup Guaranteed? | Handler Ref? | Duplicate Risk |
|---|---|---|---|---|---|
| `booking:boarded` | ~316 | ~322 | ⚠️ PARTIAL | Named | MODERATE |
| `passenger:trip:tracking` | ~317 | ~323 | ⚠️ PARTIAL | Named | MODERATE |
| `shuttle:driver:location` | ~318 | ~324 | ⚠️ PARTIAL | Named | MODERATE |
| `trip:activated` | ~319 | ~325 | ⚠️ PARTIAL | Named | MODERATE |

**Critical finding #1 — Unknown event name:**
```typescript
socket.on('passenger:trip:tracking', trackingHandler);
```
The event `passenger:trip:tracking` does **not appear** in the backend socket emission analysis or in `socket.ts` type definitions. This listener will never fire. The tracking update UI in `ticket.tsx` that depends on `latestTracking` state will never update via socket.

**Critical finding #2 — bookingId comparison:**
```typescript
const boardedHandler = (data: { bookingId: string | number; ... }) => {
  const id = bookingId.replace(/^#/, '');          // strips "#" prefix → "42"
  if (String(data.bookingId) === id               // "42" === "42" ✅
      || String(data.bookingId) === bookingId) {   // "42" === "#42" ❌ (redundant, always false)
    setBoarded(true);
  }
};
```
The second condition `String(data.bookingId) === bookingId` (with `#` prefix) will never be true because `String(42) = "42"` but `bookingId` starts with `"#"`. The logic still works via the first condition, but it is misleading and fragile.

**Critical finding #3 — Stale closure on `bookingId`:**
`bookingId` is a `const` from `useBooking()`. If `confirmedBookingId` changes while this component is mounted (e.g. user books again from a different screen), the handler closure captures the old value and will never match the new booking.

**Verdict: ❌ FAIL**

---

#### `app/trip-tracking.tsx`

| Event | Line | Cleanup Line | Cleanup Guaranteed? | Handler Ref? | Duplicate Risk |
|---|---|---|---|---|---|
| `ride:driver_location` | ~137 | ~170 | ✅ YES | Named | NONE |
| `ride:arrived` | ~141 | ~171 | ✅ YES | Named | NONE |
| `ride:started` | ~145 | ~172 | ✅ YES | Named | NONE |
| `ride:completed` | ~149 | ~173 | ✅ YES | Named | NONE |
| `ride:cancelled` | ~154 | ~174 | ✅ YES | Named | NONE |

This is the **best socket cleanup pattern in the codebase**. Named handler constants are defined before the `getSocket().then()`, a `socketListening` ref guards against duplicate registration, and all five handlers are removed in the cleanup return. The `catch(() => {})` on cleanup is acceptable here because a failing cleanup only risks a brief ghost listener for car-ride events (not shuttle).

**Verdict: ✅ PASS**

---

#### `src/hooks/car/useRide.ts`

| Event | Line | Cleanup Called? | Risk |
|---|---|---|---|
| `ride:driver_assigned` | ~146 | ❌ NOT from useEffect | CRITICAL |
| `ride:driver_location` | ~152 | ❌ NOT from useEffect | CRITICAL |
| `ride:arrived` | ~165 | ❌ NOT from useEffect | CRITICAL |
| `ride:started` | ~178 | ❌ NOT from useEffect | CRITICAL |
| `ride:completed` | ~190 | ❌ NOT from useEffect | CRITICAL |
| `ride:cancelled` | ~205 | ❌ NOT from useEffect | CRITICAL |
| `ride:driver_cancelled` | ~218 | ❌ NOT from useEffect | CRITICAL |
| `ride:no_show_cancelled` | ~228 | ❌ NOT from useEffect | CRITICAL |
| `ride:timeout` | ~238 | ❌ NOT from useEffect | CRITICAL |
| `ride:status_update` | ~248 | ❌ NOT from useEffect | CRITICAL |
| `ride:status:changed` | ~258 | ❌ NOT from useEffect | CRITICAL |
| `surge:updated` | ~278 | ❌ NOT from useEffect | CRITICAL |
| `ride:deviation_warning` | ~288 | ❌ NOT from useEffect | CRITICAL |

**Evidence — the fatal gap:**
```typescript
const setupSocketListeners = useCallback(async (rideId: string) => {
  if (socketListening.current) return;
  socketListening.current = true;
  // ... 13 socket.on() calls ...
  // cleanup() function defined here but:
}, [stopPolling]);

// The useEffect that runs cleanup:
useEffect(() => {
  return () => { stopPolling(); };  // ← only stops polling, NEVER calls socket cleanup
}, [stopPolling]);
```

A `cleanup()` function IS defined inside `setupSocketListeners`, but it is only invoked when terminal socket events fire (completed, cancelled, timeout). If the user navigates away while a ride is in `searching` or `driver_assigned` state, the `useEffect` cleanup runs `stopPolling()` but **never unregisters the 13 socket listeners**. They remain attached to the singleton socket indefinitely.

Since this is a hook (not a screen), if the car screen remounts, `socketListening.current` prevents re-registration — but if the component fully unmounts and the ref is destroyed, the flag is reset and all 13 listeners get registered again on the orphaned socket.

**Verdict: ❌ FAIL** (Car ride scope, but uses the same singleton socket as shuttle features)

---

#### `src/hooks/car/useRideChat.ts`

| Event | Line | Cleanup Line | Cleanup Guaranteed? | Handler Ref? |
|---|---|---|---|---|
| `trip:chat:message` | ~60 | ~68 | ✅ YES | Named + listenerRef |

**Verdict: ✅ PASS**

---

#### `context/ServiceControlContext.tsx`

| Event | Line | Cleanup Line | Cleanup Guaranteed? | Handler Ref? |
|---|---|---|---|---|
| `service:control:changed` | ~110 | ~120 | ✅ YES | Named + detachSocket() |

Uses `socketListenerAttached` flag to prevent duplicate registration. Explicit `detachSocket()` cleanup function. Best-practice pattern.

**Verdict: ✅ PASS**

---

#### `context/PaymentConfigContext.tsx`

| Event | Line | Cleanup Line | Cleanup Guaranteed? | Handler Ref? | Risk |
|---|---|---|---|---|---|
| `WALLET_FEATURE_CHANGED` | ~109 | ~131 | ✅ YES | ❌ NO REF | MODERATE |
| `PAYMENT_METHODS_CHANGED` | ~118 | ~132 | ✅ YES | ❌ NO REF | MODERATE |

**Evidence:**
```typescript
sock.off(SOCKET_EVENTS.WALLET_FEATURE_CHANGED);    // removes ALL listeners for this event
sock.off(SOCKET_EVENTS.PAYMENT_METHODS_CHANGED);   // removes ALL listeners for this event
```

Calling `.off(eventName)` without a handler reference removes **every** listener registered for that event across the entire app. If any other component registers a handler for `WALLET_FEATURE_CHANGED`, this cleanup will silently kill it. Currently no other component does this, so it is safe — but it is a fragile pattern.

**Verdict: ⚠️ WARNING**

---

### Shuttle-Specific Event Coverage Summary

| Event | Present | Handled Correctly | Notes |
|---|---|---|---|
| `shuttle:driver:location` | ✅ trips.tsx, trip-detail.tsx, ticket.tsx | ⚠️ Partial | Cleanup async gap in all three |
| `shuttle:trip:status` | ✅ trips.tsx, trip-detail.tsx | ⚠️ Partial | Cleanup async gap |
| `booking:boarded` | ✅ useNotifications.ts, trip-detail.tsx, ticket.tsx | ⚠️ Partial | ticket.tsx has stale closure risk |
| `trip:activated` | ✅ useNotifications.ts, ticket.tsx | ⚠️ Partial | Registered in both; handled correctly in useNotifications |
| `notification:new` | ✅ useNotifications.ts | ⚠️ Warning | Cleanup async gap |
| `passenger:trip:tracking` | ⚠️ ticket.tsx only | ❌ Unknown event | Not found in backend event definitions — handler never fires |
| `SLOT_TAKEN` | ❌ NOT FOUND | — | No real-time seat-taken notification to passengers |
| `SLOT_RELEASED` | ❌ NOT FOUND | — | No real-time seat-released notification |
| `SHUTTLE_BOOKING_CANCELLED` | ❌ NOT FOUND | — | Passengers not notified in real time if booking cancelled server-side |
| `booking:passenger_updated` | ❌ NOT FOUND | — | No handler for booking metadata updates |
| `slot_released` | ❌ NOT FOUND | — | Missing (lowercase variant) |
| `service:control:changed` | ✅ ServiceControlContext.tsx | ✅ PASS | Excellent pattern |

---

## 2. React Query Audit

### Finding: React Query is NOT used in this codebase

The app does **not** use TanStack Query (React Query), SWR, or any equivalent data-fetching library. All server state is managed via:

- `useState` + `useEffect` with manual `api.get()` / `api.post()` calls
- Manual loading/error state tracking
- No automatic cache management
- No automatic background refetch
- No stale-while-revalidate
- No query deduplication

**Consequence matrix:**

| React Query Feature | App Equivalent | Gap |
|---|---|---|
| Automatic retry on failure | None — errors are final | Transient network errors show error UI permanently |
| Background refetch on window focus | Only in ServiceControlContext via AppState | All other screens show stale data after backgrounding |
| Stale-while-revalidate | None | Users see spinners on every navigation |
| Query deduplication | None | Same endpoint called simultaneously by multiple hooks |
| Cache invalidation | None | After booking, trips list not automatically refreshed in all screens |
| Optimistic updates | None | Cancellation UI reflects real state only after API round-trip |

**Specific duplication found:**

- `GET /users/me` called independently by `useProfile.ts` AND `useNotifications.ts` — two network requests for the same data
- `GET /users/me/bookings` called by 4 different hooks/screens with no shared cache
- `GET /rides/my` called by both `useTrips.ts` and `useFavoriteDestinations.ts` simultaneously

**Verdict: ⚠️ WARNING** — The app functions but lacks resilience, efficiency, and UX quality that a cache layer would provide.

---

## 3. Background / Foreground Behavior

### AppState Handling — `context/ServiceControlContext.tsx`

```typescript
// Lines 224–250
const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
  if (next === 'active' && appState.current !== 'active') {
    refetchServiceControl();   // ← refetches /services/control
  }
  appState.current = next;
});
return () => { sub.remove(); };   // ✅ correct cleanup
```

This is the **only** AppState handler in the entire codebase.

### Screen-by-Screen Background Behavior

#### `app/(tabs)/trips.tsx`
- **Background → foreground:** No automatic refresh. The 60-second polling interval pauses when the app is backgrounded (JS timer behavior in React Native), resumes when foregrounded. Next refresh occurs at whatever remaining interval is left.
- **Socket events during background:** Socket.IO will attempt to maintain the connection but on mobile the OS may kill the TCP connection. On return, socket reconnects but no explicit "re-subscribe to trip rooms" logic runs.
- **Stale data risk:** If a trip is cancelled while app is backgrounded for >60 s, the trip appears as active until the next poll fires.

#### `app/trip-detail.tsx`
- **Background → foreground:** No AppState handler. 30 s station poll and 2-minute trip poll will resume from wherever they left off.
- **Socket reconnect:** No logic to re-emit `passenger:join:trip` after socket reconnects. If the socket disconnects and reconnects in the background, the passenger is no longer in the trip room and will miss `shuttle:driver:location` and `shuttle:trip:status` events.
- **Stale data risk: HIGH** — driver location shown on map can be minutes stale after resume.

#### `app/ticket.tsx`
- **Background → foreground:** No AppState handler. No polling. Entirely socket-driven.
- **Socket reconnect:** Same room re-subscription gap as trip-detail.
- **Stale data risk: CRITICAL** — if the socket was down when `booking:boarded` fired, the passenger never sees the boarded banner.

#### `src/hooks/shared/usePassengerTracking.ts`
- Continues tracking in background via Expo Location's background task.
- Uses `AsyncStorage` to queue snapshots when offline.
- Flushes on reconnect with `/api/tracking/locations/batch`.
- **Assessment: PASS** — this is the most robust hook in the codebase for offline scenarios.

### Countdown / Renewal Timers
No countdown timers or renewal banners found in the shuttle flow.

### Verdict: ❌ FAIL
Only one screen (ServiceControl) handles foreground resume. All shuttle screens — trips, trip-detail, ticket — show potentially stale data after backgrounding. Socket room subscriptions are not re-established after socket reconnect.

---

## 4. Offline / Reconnect Recovery

### Scenario A: User loses internet for 5 minutes

| Screen | Behavior | Risk |
|---|---|---|
| trips.tsx | 60 s polling fails silently. `setTripsLoading` not re-set on error in all paths. Trips list freezes. | HIGH |
| trip-detail.tsx | Station poll fails silently. Trip status poll fails silently. Map shows last known driver location. | HIGH |
| ticket.tsx | No polling — entirely socket-driven. Socket disconnects. Boarded banner will never appear if event fires during outage. | CRITICAL |
| usePassengerTracking | Snapshots queued in AsyncStorage. Flushed on reconnect. | ✅ HANDLED |
| useNotifications | Socket disconnects. Notifications not received during outage. No polling fallback. | HIGH |

### Scenario B: Socket disconnects and reconnects

Socket.IO has built-in reconnection (default: exponential backoff). The singleton socket will reconnect automatically. However:

1. **Room re-subscription:** After reconnect, the passenger is NOT automatically re-joined to trip rooms. The app only emits `passenger:join:trip` once — in `BookingContext.handleConfirm()` after booking. A socket reconnect during an active trip does not re-emit this.

2. **Listener deduplication:** Named handler refs + `socketListening` flags in most components prevent double-registration after reconnect. However, in `useNotifications.ts`, the `getSocket()` promise resolves to the new socket instance, so listeners will be re-registered correctly — **but only if the component is still mounted and re-runs its useEffect**. If the socket reconnects without a component remount, listeners from the old socket instance are now pointing at a destroyed socket.

3. **Missing events during disconnect:** No mechanism to fetch missed events on reconnect. After a socket reconnect, the trip's current status must be learned from a REST poll — but only `trip-detail.tsx` polls (every 2 min). `ticket.tsx` has no polling.

### Scenario C: App opened after several hours offline

- Auth token may be expired. `client.ts` should handle token refresh via interceptor.
- Service control config is stale — will be refreshed via AppState handler when app becomes active.
- Trip list is stale — no automatic refresh on mount for `trips.tsx` beyond what `useFocusEffect` (if present) triggers.
- No evidence of `useFocusEffect` in shuttle screens — navigating back to trips tab does NOT refresh the list.

### Scenario D: Passenger count changes while disconnected

- `booking:passenger_updated` event is not handled anywhere.
- Passenger count on `trip-detail.tsx` is fetched via `/driver/trips/:id/stations` poll (30 s) which shows passenger count per station.
- After reconnect, count will update at next poll cycle (up to 30 s delay).
- No immediate reconciliation on reconnect.

### Reconnection Strategy Assessment

| Feature | Present | Notes |
|---|---|---|
| Socket auto-reconnect | ✅ Socket.IO built-in | No custom configuration found |
| Trip room re-subscription on reconnect | ❌ Missing | Only emitted once at booking time |
| REST fallback polling | ⚠️ Partial | Only in trip-detail.tsx and trips.tsx |
| Missed event replay | ❌ Missing | No REST call to catch up on missed socket events |
| Token refresh on reconnect | ✅ Via axios interceptor | Handled in client.ts |
| Location tracking offline queue | ✅ usePassengerTracking | Correct implementation |

**Verdict: ❌ FAIL**

---

## 5. Memory Leak Audit

### `setInterval` / `setTimeout`

| File | Line | Type | Cleanup | Risk |
|---|---|---|---|---|
| `src/hooks/shared/usePassengerTracking.ts` | ~162 | setInterval (5 min) | ✅ clearInterval in stopTracking() | SAFE |
| `src/hooks/car/useRide.ts` | ~82 | setInterval (5 s polling) | ✅ stopPolling() in useEffect return | SAFE |
| `app/(tabs)/trips.tsx` | ~237 | setInterval (60 s) | ✅ clearInterval in useEffect return | SAFE |
| `app/trip-detail.tsx` | ~275 | setInterval (30 s stations) | ✅ clearInterval in useEffect return | SAFE |
| `app/trip-detail.tsx` | ~378 | setInterval (2 min trip) | ✅ clearInterval in useEffect return | SAFE |
| `context/BookingContext.tsx` | ~243 | setTimeout (280 ms, sheet delay) | ⚠️ No cleanup | LOW RISK (one-shot, short) |
| `context/BookingContext.tsx` | ~333 | setTimeout (260 ms, navigate) | ⚠️ No cleanup | LOW RISK (one-shot, short) |
| `context/ThemeContext.tsx` | ~164 | setTimeout (750 ms, lang overlay) | ✅ switchTimerRef cleared before re-set | SAFE |
| `app/trip-tracking.tsx` | ~152 | setTimeout (3 s, navigate back on complete) | ⚠️ No cleanup | LOW RISK (one-shot) |
| `app/trip-tracking.tsx` | ~157 | setTimeout (3 s, navigate back on cancel) | ⚠️ No cleanup | LOW RISK (one-shot) |

The two `setTimeout` calls in `trip-tracking.tsx` (lines ~152, ~157) schedule navigation 3 seconds after terminal status. If the component unmounts before the timeout fires (user manually navigates away), the timeout fires and calls `router.back()` on an already-unmounted screen — this can cause a navigation stack corruption.

### AppState Listeners

| File | Line | Cleanup | Risk |
|---|---|---|---|
| `context/ServiceControlContext.tsx` | ~224 | ✅ `sub.remove()` | SAFE |

### Socket Listeners — Memory Leak Summary

| File | Listeners | Guaranteed Cleanup | Leak Risk |
|---|---|---|---|
| `useNotifications.ts` | 3 | ❌ | **CRITICAL** |
| `trips.tsx` | 2 | ❌ (async gap) | HIGH |
| `trip-detail.tsx` | 3 | ❌ (async gap) | HIGH |
| `ticket.tsx` | 4 | ❌ (async gap) | HIGH |
| `trip-tracking.tsx` | 5 | ✅ | SAFE |
| `useRide.ts` | 13 | ❌ (never from useEffect) | **CRITICAL** |
| `useRideChat.ts` | 1 | ✅ | SAFE |
| `ServiceControlContext.tsx` | 1 | ✅ | SAFE |
| `PaymentConfigContext.tsx` | 2 | ⚠️ (no handler ref) | MODERATE |

### Navigation Listeners

No explicit navigation listeners (`navigation.addListener`) found in shuttle screens. Expo Router's `useRouter` does not require manual cleanup.

### Verdict: ❌ FAIL
Two critical memory leak sources: `useNotifications.ts` (silent cleanup failure) and `useRide.ts` (cleanup never called from useEffect). Multiple moderate leaks from async cleanup gap pattern used consistently across shuttle screens.

---

## 6. Race Conditions

### `BookingContext.handleConfirm()` — Double-Submission

```typescript
// context/BookingContext.tsx
const handleConfirm = useCallback(async (promoCode?: string) => {
  setConfirmSheetOpen(false);
  if (!pendingBooking) return;
  // ... no in-flight guard ...
  const { data } = await api.post('/bookings', body);
}, [pendingBooking, refreshLineTrips]);
```

No `isSubmitting` flag or request deduplication. If the user taps "Confirm" twice in rapid succession (or the sheet close animation delays the disable), **two POST /bookings requests fire**. The server returns `409` on the second, but the UI receives the error and sets `activeBooking(null)`, even though the first request succeeded. The user sees a booking error despite being booked.

**Risk: MODERATE** — server-side duplicate protection exists (409) but client UX is broken for this case.

### `trip-detail.tsx` — Socket vs. Poll State Divergence

```
Socket fires: shuttle:trip:status → status = "boarding"
2-minute poll fires: GET /bookings/:id → status = "active"  (stale server cache)
```

If the REST endpoint returns a stale status (server-side cache or read replica lag), `setEffectiveStatus('active')` overwrites the correct `'boarding'` state received from the socket. The UI regresses. No version/timestamp comparison exists.

**Risk: MODERATE**

### `ticket.tsx` — Stale Closure on `confirmedTripId`

```typescript
const tripActivatedHandler = (data: { tripId: number | string; activatedAt?: string }) => {
  if (!confirmedTripId || String(data.tripId) === String(confirmedTripId)) {
    setLiveStatus('active');
  }
};
```

`confirmedTripId` is captured from `useBooking()` context at handler creation time. If the context value changes (edge case: user books again), the handler compares against the stale value. **Low likelihood** given booking flow, but structurally unsound.

**Risk: LOW**

### `useRide.ts` — Poll/Socket Interleaving

Car ride polling (5 s) and socket events can interleave:

1. Socket fires `ride:started` → `setStatus('started')`
2. 5 s poll returns old status `driver_assigned` (server-side cache) → `setStatus('driver_assigned')`
3. UI reverts

Same issue as shuttle but worse frequency (5 s vs 2 min).

**Risk: HIGH** (car rides) / **LOW** (shuttle — only 2-min poll, lower frequency)

### `trips.tsx` — Duplicate Auto-Navigation

```typescript
// trips.tsx socket handler for shuttle:driver:location
if (isWithin20Min && !autoNavigated.current) {
  autoNavigated.current = true;
  router.push(`/trip-detail?id=${...}`);
}
```

`autoNavigated` is a `useRef` — it persists across renders but resets if the component fully unmounts. If the user navigates to trip-detail and back, `autoNavigated.current` resets to `false`. The next `shuttle:driver:location` event triggers navigation again. The user is thrown to trip-detail automatically on every location update after returning to the trips tab.

**Risk: HIGH**

### Verdict: ⚠️ WARNING
No single catastrophic race condition, but multiple scenarios where UI state diverges from backend state. The auto-navigation regression loop in `trips.tsx` is the most user-visible.

---

## 7. Production Readiness Score

### Scores

| Category | Score | Rationale |
|---|---|---|
| **Reliability** | 52 / 100 | Silent failures, no retry, no error boundaries visible in shuttle flow |
| **Realtime Behavior** | 48 / 100 | Socket events work on happy path; missing events (SLOT_TAKEN, SHUTTLE_BOOKING_CANCELLED), ghost listener risk, no room re-subscription on reconnect |
| **Offline Resilience** | 35 / 100 | Location tracking is excellent; everything else is fragile. No missed-event recovery, no aggressive polling on resume |
| **Memory Safety** | 40 / 100 | Two critical leaks (useRide.ts, useNotifications.ts), consistent async cleanup gap across shuttle screens |
| **Query Architecture** | 30 / 100 | No cache layer. Manual state management. Duplicate requests. No background refetch. No deduplication |

### **Overall: 41 / 100**

---

### Issue Register

#### 🔴 Critical Issues

| # | Issue | File | Evidence |
|---|---|---|---|
| C1 | `useRide.ts` — 13 socket listeners never cleaned up from useEffect | `src/hooks/car/useRide.ts` | cleanup() only called on terminal events, not on unmount |
| C2 | `useNotifications.ts` — async cleanup swallows errors silently; listeners accumulate on remounts | `src/hooks/shared/useNotifications.ts` | `catch(() => {})` in cleanup |
| C3 | `ticket.tsx` — `passenger:trip:tracking` is an unknown event; boarded banner relies on correct bookingId match with stale closure risk | `app/ticket.tsx` | Event not in socket.ts definitions; closure captures stale context value |
| C4 | No socket room re-subscription after socket reconnect | `app/trip-detail.tsx`, `app/ticket.tsx` | `passenger:join:trip` only emitted once at booking time |

#### 🟠 High Priority Issues

| # | Issue | File |
|---|---|---|
| H1 | Auto-navigation loop: returning to trips tab re-triggers navigation to trip-detail on next socket event | `app/(tabs)/trips.tsx` |
| H2 | `trip-detail.tsx` — REST poll can overwrite correct socket-delivered status (state regression) | `app/trip-detail.tsx` |
| H3 | `SLOT_TAKEN`, `SLOT_RELEASED`, `SHUTTLE_BOOKING_CANCELLED` socket events not handled — passengers not notified in real time | All shuttle screens |
| H4 | No AppState handler in trip-detail or ticket — stale driver location shown after resume | `app/trip-detail.tsx`, `app/ticket.tsx` |
| H5 | Consistent async cleanup gap: all shuttle screens use `getSocket().then()` in cleanup but never handle the rejection case | trips.tsx, trip-detail.tsx, ticket.tsx |

#### 🟡 Medium Priority Issues

| # | Issue | File |
|---|---|---|
| M1 | `BookingContext.handleConfirm()` — no in-flight guard; double submission possible | `context/BookingContext.tsx` |
| M2 | `PaymentConfigContext` — `sock.off(eventName)` without handler ref removes ALL listeners for that event | `context/PaymentConfigContext.tsx` |
| M3 | `trip-tracking.tsx` — timeout-based navigation (`router.back()`) not cancelled if user navigates away first; can corrupt navigation stack | `app/trip-tracking.tsx` |
| M4 | No fallback polling for notifications when socket is unavailable | `src/hooks/shared/useNotifications.ts` |
| M5 | `GET /driver/trips/:id/stations` called from passenger screen — role boundary risk under strict server enforcement | `app/trip-detail.tsx` |
| M6 | `useRide.ts` polling (5 s) and socket events interleave — status can regress on stale REST response | `src/hooks/car/useRide.ts` |

#### 🔵 Low Priority Issues

| # | Issue | File |
|---|---|---|
| L1 | One-shot `setTimeout` calls not cleared if component unmounts (260–280 ms delay) | `context/BookingContext.tsx` |
| L2 | `socket.ts` lifecycle listeners never cleaned up (acceptable given singleton, but fragile) | `src/api/socket.ts` |
| L3 | `GET /users/me` called twice simultaneously by `useProfile.ts` and `useNotifications.ts` — duplicate network request | Multiple hooks |
| L4 | `staleTime` and `gcTime` not applicable (no React Query), but manual state never expires — data can be arbitrarily stale without user knowing | All hooks |
| L5 | `GET /users/me/bookings` called by 4 different call sites with no shared state | Multiple files |

---

### Risk Heat Map

```
                    LIKELIHOOD
                 Low    Medium    High
              ┌───────┬────────┬────────┐
IMPACT  High  │  H3   │  H1,H4 │ C1,C4  │
        Med   │  M2   │ M1,M3  │ C2,C3  │
        Low   │L1,L2  │  L3    │  H5    │
              └───────┴────────┴────────┘
```

---

*Report generated via static analysis of /home/user/veego-passenger. No code was modified.*  
*Reviewer: Claude (static analysis) — 2026-06-20*
