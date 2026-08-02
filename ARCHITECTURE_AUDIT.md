# VeeGo Passenger App — Architecture Audit
## Map, Tracking & Ride Flow — Full Technical Investigation

---

## 1. Camera Ownership

### MapView Ownership

There are **two separate `MapView` instances** in the codebase, each in a distinct lifecycle context:

| Component | File | Used By | Camera Scope |
|---|---|---|---|
| `CarMap` | `components/car/CarMap.tsx` | `CarServiceScreen` | Pre-booking through in-ride (tabs flow) |
| `PassengerTrackingMap` | `components/shared/PassengerTrackingMap.native.tsx` | `trip-tracking.tsx`, shuttle ticket/detail screens | Dedicated tracking screen (deep-link / banner navigation) |

Both components are wrapped in `React.memo`. Neither shares state or refs with the other.

---

### Camera APIs in Use

**`CarMap.tsx`:**
- `animateToRegion` — called on initial GPS fix, on recenter button tap, and when `searching=true`
- `fitToCoordinates` — called when dest + user + driver positions are set
- `animatedDriverCoord.timing()` — `AnimatedRegion` 800ms glide for the driver marker
- All camera calls except the GPS-fix one are wrapped in `setTimeout(..., 400)` — a timing workaround for map readiness

**`PassengerTrackingMap.native.tsx`:**
- `animateToRegion` — called each GPS tick to follow the driver (smooth follow when already fitted)
- `fitToCoordinates` — called only on phase change (new destination target) or target station change
- `animatedCoord.timing()` — `AnimatedRegion` 800ms glide for the driver marker

No `setCamera` or `animateCamera` API is used anywhere in the codebase.

---

### Components That Can Trigger Camera Changes

**In `CarMap`:**
1. `CarMap` itself (location fetch on mount, camera effect on state change, recenter button)

**In `PassengerTrackingMap`:**
1. `PassengerTrackingMap` itself — the camera effect fires on every driver location update when `isUserPanning=false`

**In `CarServiceScreen`:** No direct camera access — all camera control delegated to `CarMap`.

**In `trip-tracking.tsx`:** No direct camera access — all delegated to `PassengerTrackingMap`.

---

### Camera Conflict Analysis

**Between `CarMap` and `PassengerTrackingMap`:** No conflict. These are separate `MapView` instances on separate screens. They are never simultaneously mounted in the same React tree.

**Within `CarMap`:** Potential conflict between the location-fetch camera (`animateToRegion` on GPS fix) and the state-change camera effect (`fitToCoordinates` when `destCoords/showDriverMarker/userLocation/searching` change). Both use `setTimeout(400)` offsets. If the location fix arrives within 400ms of a state change (e.g., user selects a destination while GPS is still locking), two competing `setTimeout` callbacks fire in sequence on the same `mapRef`. The second one wins, but the 400ms gap means a visible camera snap between the two positions.

**`CarMap` camera effect missing `driverLocation` dependency:** The camera effect (`useEffect` at line 107, deps `[destCoords, showDriverMarker, userLocation, searching]`) does NOT include `driverLocation`. This is deliberate — the camera in `CarMap` is not designed to follow the driver tick-by-tick. The live-following role belongs to `PassengerTrackingMap`. However, if a user stays on the home tab during an active ride rather than opening `trip-tracking.tsx`, the driver marker glides (via `AnimatedRegion`) but the camera never re-centres to the driver's new position. This is a real UX gap: the driver can move off-screen with no auto-follow.

**`PassengerTrackingMap` user-panning guard:** `isUserPanning` state is set on `onPanDrag` and cleared only on recenter button press. This is clean. There is no auto-timeout (e.g. "resume auto-follow after 10 seconds of no panning"), so once panning, the user must manually re-centre — intentional but a common friction point in ride apps.

**Phase-fitted guard (`fittedPhaseRef`):** Prevents re-fitting the map on every GPS tick. Only re-fits when `tripPhase` changes (`driver_arriving` → `trip_started`). This is correct — avoids constant re-zooming.

---

### Cases Where Camera Can Jump, Reset, or Become Stuck

1. **`CarMap` `setTimeout(400)` race:** Rapid consecutive state changes (e.g., `searching` flips to `false` while destination is simultaneously set) produce two queued `setTimeout` callbacks. The earlier one fires first, moves the camera; the later one fires and overrides it. Net result: visible two-step camera snap.

2. **`PassengerTrackingMap` stuck on initial center:** If `driverLocation` arrives as `null` on first render (socket not yet connected), the map centers on `pickup` or `DEFAULT_CENTER` (Cairo: 30.0444, 31.2357). The camera effect guard `if (!driverLocation) return` means the map stays on that default until the first driver location arrives. On a cold-start recovery where `activeRideSnapshot.driverLocation` is stale from the last REST snapshot, the camera will center on the driver's last-known position, not their current one.

3. **`trip-tracking.tsx` opened via deep link:** `trip-tracking.tsx` opened via deep-link (`params.id`) fires a `getRide()` REST call and simultaneously receives `activeRideSnapshot` via the `ActiveSessionContext` effect. Both write to `pickup`, `dropoff`, `driverLocation`, and `status` in quick succession. `PassengerTrackingMap` receives multiple rapid prop changes — the camera effect fires multiple times in the same render cycle before `fittedPhaseRef` can guard it. This can produce a visible re-fit flash.

---

## 2. GPS and Location Flow

### All Location Sources

| Source | API | Accuracy | Consumer | Interval | Cleanup |
|---|---|---|---|---|---|
| Initial map center | `getCurrentPositionAsync` | High | `CarMap.tsx` | Once on mount | N/A (one-shot) |
| Pickup reverse-geocode label | `reverseGeocodeAsync` | N/A | `CarServiceScreen` | On `userCoords` change | Cancellation flag |
| Destination geocode | `geocodeAsync` | N/A | `CarServiceScreen` | On destination select | Try/catch silent |
| Passenger tracking — foreground | `getCurrentPositionAsync` | Balanced | `usePassengerTracking` | 15 seconds (`setInterval`) | `clearInterval` on `isActive=false` |
| Passenger tracking — background | `startLocationUpdatesAsync` | Balanced | `usePassengerTracking` (background task) | 15s / 200m | `stopLocationUpdatesAsync` in effect cleanup |

**No `watchPositionAsync` subscriptions exist anywhere in the codebase.** Location data is entirely poll-based.

---

### GPS Consumer Count and Duplication

**Before a ride:** One consumer — `CarMap`'s single `getCurrentPositionAsync` on mount.

**During an active trip (`status === 'started'`):** Two concurrent consumers:
1. Foreground `setInterval` (15s) in `usePassengerTracking` — calls `getCurrentPositionAsync(Balanced)` then POSTs to `/tracking/location`
2. Background `startLocationUpdatesAsync` (15s interval, 200m distance filter) — writes coordinates to `AsyncStorage` under `veego_offline_location_snapshots`

The foreground tick also calls `flushOfflineSnapshots()` before its own snapshot, draining whatever the background task wrote. So both paths ultimately reach the backend, but the foreground tick sends the current position directly while also draining background-accumulated ones. If both fire at close intervals, the server receives two location snapshots within seconds of each other. This is a mild battery and bandwidth waste, not a correctness issue.

**Comment discrepancy in `usePassengerTracking.ts` line 224:**
```
// Fire immediately on activation, then every 5 minutes (foreground coverage)
```
The constant `TRACKING_INTERVAL_MS = 15 * 1000` is **15 seconds, not 5 minutes**. The comment is wrong.

---

### Subscription Cleanup

- `CarMap` GPS fetch: one-shot, no cleanup needed.
- `usePassengerTracking` foreground interval: cleared on `isActive=false` and on effect cleanup. Clean.
- `usePassengerTracking` background task: stopped via `Location.stopLocationUpdatesAsync(PASSENGER_LOCATION_TASK)` in the effect's return function. The stop is wrapped in a `.catch(() => {})` — if it fails silently, the background task continues running after the component unmounts, leaking battery use.
- `CarServiceScreen` reverse-geocode: guarded with `cancelled` flag — clean.

---

### Location State Movement Through the App

```
CarMap (mount) ─── getCurrentPositionAsync ──→ userLocation state
                                              ↓
                        CarServiceScreen ← onUserLocation callback
                         userCoords state / userCoordsRef
                                              ↓
                         fetchEstimate(pickup, dest)
                         requestRide({ pickup: userCoordsRef.current })
                                              ↓
                         usePassengerTracking (isActive=started)
                           getCurrentPositionAsync every 15s
                             → POST /tracking/location
```

No centralized GPS context exists. Each component fetches its own position independently.

---

## 3. Driver Tracking Flow

### Socket Event Names — Complete List from `useRide.ts`

| Event | Direction | Handler Action |
|---|---|---|
| `ride:driver_assigned` | Server→App | Sets `status='driver_assigned'`, populates `driver` |
| `ride:driver_location` | Server→App | Updates `driverLocation` coordinates |
| `ride:driver_arrived` (`SOCKET_EVENTS.RIDE_DRIVER_ARRIVED`) | Server→App | Sets `status='arrived'` |
| `ride:started` | Server→App | Sets `status='started'` |
| `ride:completed` | Server→App | Sets `status='completed'`, records fare, cleans up |
| `ride:cancelled` | Server→App | Sets `status='cancelled'`, records reason, cleans up |
| `ride:driver_cancelled` | Server→App | Sets `terminationReason='driver'`, cleans up |
| `ride:no_show_cancelled` | Server→App | Sets `terminationReason='no_show'`, records refund, cleans up |
| `ride:timeout` | Server→App | Sets `status='timeout'`, cleans up |
| `ride:status_update` | Server→App | Generic status update (normalized) |
| `ride:status:changed` | Server→App | Rich status update with `meta` (driver info, fare, cancel reason) |
| `ride:waiting:charge:started` | Server→App | Sets `waitingChargeStatus='active'` |
| `ride:waiting:charge:updated` | Server→App | Updates `waitingCharge` amount |
| `ride:waiting:charge:capped` | Server→App | Sets `waitingChargeStatus='capped'` |
| `surge:updated` | Server→App | Updates `surgeMultiplier` |
| `ride:deviation:warning` | Server→App | Sets `deviationWarning=true` |
| `ride:eta_update` | Server→App | Updates `driver.eta` |
| `session:snapshot` | Server→App | Handled by `ActiveSessionContext`, propagates via context |

**`trip-tracking.tsx` independently listens on:**
- `ride:driver_location`
- `ride:arrived` ← hardcoded string literal
- `ride:started`
- `ride:completed`
- `ride:cancelled`

---

### Critical Event Name Mismatch

`useRide.ts` line 279 subscribes to **`"ride:driver_arrived"`** (`SOCKET_EVENTS.RIDE_DRIVER_ARRIVED`).

`trip-tracking.tsx` line 276 subscribes to **`"ride:arrived"`** (hardcoded string literal).

`SOCKET_EVENTS` defines both:
- `RIDE_DRIVER_ARRIVED: "ride:driver_arrived"` (line 9)
- `RIDE_ARRIVED: "ride:arrived"` (line 11)

The `RideSocketEvents` interface in `socket.ts` documents the event as `'ride:arrived'` (line 134).

**Effect:** One of these two subscriber patterns will miss the "driver arrived" event entirely, depending on which name the backend actually emits. If the backend emits `"ride:driver_arrived"`, `trip-tracking.tsx` never transitions its local `status` to `'arrived'`. If the backend emits `"ride:arrived"`, `useRide.ts` never transitions. The `ride:status:changed` handler in `useRide.ts` can recover this if the backend also emits that event — but that is a silent failover, not intentional design.

---

### Where the Passenger Subscribes

**`useRide.ts`:** `setupSocketListeners(rideId)` is called in `requestRide()` and `resumeActiveRide()`. The `socketListening` ref prevents double-attachment within this hook.

**`trip-tracking.tsx`:** Socket listeners are attached in a `useEffect` with `params.rideId` in deps. The `socketListening` ref (local to the screen) prevents double-attachment within this screen.

**`ActiveSessionContext`:** Subscribes to `session:snapshot` only. Called in `attachSocket()`.

There is **no cross-hook coordination** of socket listeners. When `trip-tracking.tsx` is active simultaneously with `CarServiceScreen` (e.g., opened via the `ActiveRideBanner`), both `useRide.ts` and `trip-tracking.tsx` have independent listeners on the same socket instance for `ride:driver_location`, `ride:started`, `ride:completed`, and `ride:cancelled`. Both process each event independently and update separate state trees.

---

### How Driver Coordinates Are Stored

**In `useRide.ts`:** `rideState.driverLocation: DriverLocation | null` — `{ latitude, longitude, heading? }`. Updated by `ride:driver_location` socket event, `ride:status:changed` (for reconnect recovery), and `activeRideSnapshot` sync effect.

**In `trip-tracking.tsx`:** `driverLocation: DriverLocation | null` — local `useState`, updated by both the screen's own socket listener and the `activeRideSnapshot` effect.

**In `ActiveSessionContext`:** `session.driver.location: PassengerRideLocation | null` — `{ lat, lng, heading, updatedAt }`. Updated by `session:snapshot` events only (REST + socket). This is the stale snapshot — not the real-time position.

The **real-time driver position** flows: `ride:driver_location` socket event → `useRide.ts` `rideState.driverLocation` → props to `CarMap` or `PassengerTrackingMap`. The `ActiveSessionContext` snapshot provides the last-known position at session load time only.

---

### Update Frequency and Conflict

Update frequency depends entirely on the backend's driver-location broadcast rate. The client has no throttle on the `ride:driver_location` handler — every event triggers an immediate `setRideState` call. If the backend emits at a high rate (e.g., every 2s), the React render cycle processes each update, `AnimatedRegion.timing()` is called each time, and queued animations can pile up (each 800ms). If two driver-location events arrive within 800ms of each other, the second animation starts while the first is still running. `AnimatedRegion.timing()` calls `.start()` on the existing animation — this interrupts the prior animation and starts a new one from whatever intermediate position the marker was at, causing non-linear marker movement ("skipping").

---

### Stale Driver Position Risk

On cold-start recovery: `ActiveSessionContext` initializes via REST (`fetchPassengerActiveSession`). The `session.driver.location` in the REST response reflects the driver's position at the time of the REST call — potentially seconds to minutes stale. `selectActiveRide` uses this for `driverLocation` in the `ActiveRideSnapshot`. This stale position seeds `trip-tracking.tsx`'s initial `driverLocation` state and the map's `initialRegion`. The first `ride:driver_location` socket event corrects it, but there is a visible window where the driver marker is at an incorrect position.

---

## 4. Route and Directions Flow

### Route Generation

Routes are fetched via `fetchGoogleRoute()` in `src/utils/googleDirections.ts`, which proxies through the backend at `/api/directions`. The Google Maps API key never enters the app bundle.

`fetchGoogleRoute(origin, waypoints)` accepts an origin and ordered waypoint array. The last waypoint is the destination; any middle points are passed as `waypoints=` query params.

---

### Route Refresh Triggers

Both `CarMap` and `PassengerTrackingMap` implement their own independent throttle:

```
ROUTE_REFRESH_INTERVAL_MS = 75,000 ms (75 seconds)
SIGNIFICANT_MOVE_METERS   = 300 m
```

A fetch triggers when: driver has moved ≥ 300m since last fetch **OR** 75 seconds have elapsed since last fetch **OR** (in `PassengerTrackingMap`) the trip phase changed.

These constants are **duplicated independently** in both files. A change to one does not affect the other.

---

### Polyline State

**`CarMap`:** `routeCoords: Coords[]` — single polyline. Source: passenger location → destination (pre-booking) or driver location → destination (in-ride). Straight-line fallback if fetch fails.

**`PassengerTrackingMap`:** `routeCoords: LatLng[]` (Google road-snapped) + `completedCoords` (green completed stations) + `upcomingCoords` (straight-line shuttle fallback) + `fallbackCoords` (straight-line car fallback before route loads). Four separate polylines rendered with different logic.

---

### Race Condition: Route Fetch After Phase Change

In `PassengerTrackingMap`, the car-route effect (lines 295–341):

```ts
fetchGoogleRoute(driverLocation, [routeTarget]).then((result) => {
  if (result?.coords?.length) {
    setRouteCoords(result.coords);
    if (result.durationSeconds !== null) setRouteDurationSeconds(result.durationSeconds);
  }
});
```

There is **no cancellation guard**. If the phase changes (`driver_arriving` → `trip_started`) while a previous fetch is in flight (e.g., slow network, 3–8 second API latency), the response arrives and calls `setRouteCoords` with the route to the **pickup** even though the active phase is now routing to **dropoff**. The user sees a brief wrong route. `prevTripPhaseRef` prevents initiating a new fetch for the old phase, but does not cancel the already-in-flight request.

`CarMap.tsx` handles this correctly with a `cancelled` ref:

```ts
let cancelled = false;
fetchGoogleRoute(...).then((result) => {
  if (cancelled) return;
  ...
});
return () => { cancelled = true; };
```

`PassengerTrackingMap` does not use this pattern.

---

### ETA Calculation

ETA follows a two-tier fallback:
1. **Primary:** `routeDurationSeconds` from the Google Directions response (accurate, traffic-aware)
2. **Fallback:** `estimateEtaMinutes(driverLocation, target)` — haversine distance at a hardcoded **25 km/h**

The 25 km/h constant (`src/utils/geoHelpers.ts` line 22) is labeled "Assumes 25 km/h average urban speed for shuttle" but is used for car rides too (via `PassengerTrackingMap`'s ETA fallback for car phase). A car on an expressway traveling at 80 km/h will show an ETA 3× too long until the Directions API responds.

ETA from `activeRideSelectors.ts` defaults to `5` minutes hardcoded (`eta: 5`) since the ActiveSession snapshot has no ETA field. This is the value shown until the first `ride:eta_update` or `ride:driver_assigned` socket event provides a real value.

---

## 5. Rendering Performance

### Memoization

| Component | Memo | Notes |
|---|---|---|
| `CarMap` | `React.memo` ✓ | Prevents re-render on non-map state changes in `CarServiceScreen` |
| `PassengerTrackingMap` | `React.memo` ✓ | Prevents re-render on status bar / card changes in `trip-tracking.tsx` |
| `CarServiceScreen` styles | `useMemo` | Recomputed only on theme/inset/height change |
| `tripPhase` in `trip-tracking.tsx` | `useMemo` | Derived from `status` — correct |
| `activeRideSnapshot` | `useMemo(selectActiveRide, [session])` | Recomputed on every `session:snapshot` — correct |

---

### Map Re-render Triggers

**`CarMap`:**
Re-renders when: `driverLocation`, `destCoords`, `showDriverMarker`, `nearbyDrivers`, `searching`, or `darkMode` props change. Each driver location socket tick causes a prop change, but `React.memo` prevents a re-render unless the actual values differ. The `animatedDriverCoord.timing()` in the `useEffect` runs without causing a re-render (it's a ref operation).

**`PassengerTrackingMap`:**
`driverLocation` prop changes on every socket tick → the memo wrapping means the component only re-renders when props shallowly change. `driverLocation` is an object reference — a new object `{ latitude, longitude }` is created in `setRideState` on every socket event, so the memo boundary is crossed on every tick. This means `PassengerTrackingMap` fully re-renders on every driver location update.

**Root cause of PassengerTrackingMap re-renders:** `useRide.ts` line 328:
```ts
setRideState((prev) => ({ ...prev, driverLocation: parsed.data.location }));
```
`parsed.data.location` is a new object reference every time, even if coordinates haven't changed. `React.memo` compares props by reference. A new `driverLocation` object reference always breaks the memo boundary regardless of whether coordinates changed.

---

### Marker Re-renders

**`SearchingPulse` marker in `CarMap`:** Uses `tracksViewChanges={true}` on the `<Marker>`. This forces the native map to re-measure the marker's view hierarchy on every React render frame. During the searching phase, if `CarServiceScreen` re-renders frequently (e.g., on place autocomplete results), this marker triggers expensive native layout passes. This is a known performance pitfall in `react-native-maps`.

**`MarkerAnimated` (driver):** Uses `AnimatedRegion` — animation runs on the native thread. Does not cause JavaScript re-renders between GPS ticks. This is the correct approach.

---

### Expensive Calculations

- `haversineMeters` — called on every driver location tick inside the route throttle check. Trigonometry on every GPS event, but cheap (< 0.1ms).
- `useMemo` computations in `PassengerTrackingMap` (`sorted`, `visibleStations`, `waypointsToTarget`, `fallbackCoords`, `etaMinutes`) — all have tight, specific dep arrays. Re-compute only when relevant inputs change.
- `decodePolyline` in `googleDirections.ts` — runs on API response, not on every render. Not a performance issue.

---

## 6. State Management

### State Architecture Overview

| Concern | Source of Truth | Secondary Holders |
|---|---|---|
| Active session (REST) | `ActiveSessionContext.session` | Derived by `selectActiveRide` |
| Ride status (live) | `useRide.ts` `rideState.status` | `trip-tracking.tsx` `status` state |
| Driver location (live) | `useRide.ts` `rideState.driverLocation` | `trip-tracking.tsx` `driverLocation` state |
| Driver info | `useRide.ts` `rideState.driver` | `trip-tracking.tsx` `driverInfo` state |
| Socket connection | `socket.ts` module-level `connectionState` | `useSocketConnectionState` hook |
| Wallet balance | `BookingContext.walletBalance` | — |
| Wallet feature flags | `PaymentConfigContext.walletFeature` | — |
| Service availability | `ServiceControlContext.services` | — |
| Ride phase (UI) | `CarServiceScreen` `phase` state | Derived from `rideState.status` |

---

### Duplicated State

**`trip-tracking.tsx` duplicates `useRide.ts` ride state:**
- `status: TripStatus` in `trip-tracking.tsx` ↔ `rideState.status` in `useRide.ts`
- `driverLocation` in `trip-tracking.tsx` ↔ `rideState.driverLocation` in `useRide.ts`
- `driverInfo` in `trip-tracking.tsx` ↔ `rideState.driver` in `useRide.ts`

These are completely separate state machines fed by separate socket listeners and separate effects. They can diverge. For example: `ride:driver_location` arrives → `useRide.ts` updates its `driverLocation` → `rideState` flows to `CarServiceScreen` → `CarMap` moves driver marker. Simultaneously, `trip-tracking.tsx`'s own listener fires → its local `driverLocation` updates → `PassengerTrackingMap` moves its marker. Both update correctly but independently, with no guarantee of synchronization order across the React reconciler.

**Status mapping duplicated:**
- `normalizeRideStatus()` in `src/api/socket.ts` — maps backend status strings to `RideStatus`
- `mapActiveSessionStatus()` in `src/session/activeRideSelectors.ts` — maps `PassengerRideStatus` to `RideStatus`

Both implement the same logical mapping. They are currently in sync, but must be maintained manually.

**Wallet schema fragility:** `WalletBalanceSchema` in `src/api/schemas.ts` lists six alternative field names for the balance value: `balance`, `walletBalance`, `amount`, `walletAmount`, `availableBalance`, `wallet_balance`. This documents at least three backend API shapes for the same value.

---

### Conflicting Sources of Truth

**`trip-tracking.tsx` — three simultaneous sources writing the same state variables:**

1. `activeRideSnapshot` effect (lines 111–153) — writes `status`, `driverInfo`, `driverLocation`, `pickup`, `dropoff` from the REST/snapshot data
2. REST `getRide(rideId)` call (lines 239–263) — writes `driverInfo`, `driverLocation`, `pickup`, `dropoff` from a direct API call
3. Socket listeners (lines 265–312) — writes `driverLocation`, `status`

All three fire on mount (the first two immediately, the socket after `getSocket()` resolves). The REST call and the `activeRideSnapshot` effect are likely to write to the same state variables within milliseconds of each other with potentially different data (snapshot may be stale, REST may be fresh).

---

### Race Conditions

**1. `trip-tracking.tsx` mount:** `activeRideSnapshot` effect and `getRide()` REST call fire simultaneously. If the REST response arrives before the snapshot is applied, `driverInfo` is set from REST; if the snapshot arrives first, it's overwritten by REST. The last writer wins. Order is non-deterministic.

**2. `useRide.ts` reset race:** `resetRide()` sets `rideState` to `DEFAULT_STATE` and `activeRideIdRef.current = null`. If a `session:snapshot` arrives between these two operations (context update propagation is async), the sync effect could briefly apply the stale terminal snapshot to the just-reset state. The terminal-status guard (`TERMINAL_STATUSES.includes(prev.status)`) catches most cases, but requires the current `prev.status` to be terminal — which it is after `setRideState(DEFAULT_STATE)` sets it to `'searching'`. The guard `TERMINAL_STATUSES.includes('searching')` is `false`, so the sync would apply. The rideId guard (`activeRideIdRef.current !== null`) catches it only if `activeRideIdRef.current` is still non-null — it's set to null inside `resetRide()`, so `null !== snapRideId` is `true`, meaning it would NOT apply. The terminal-status guard at line 701 also requires `prev.rideId !== null` — after reset, `prev.rideId = null`, so this guard also does not fire. **Net effect:** A snapshot arriving after `resetRide()` can re-apply the old rideId to the reset state, re-entering the ride flow. This is mitigated in practice by the ActiveSession server clearing the session on terminal states, but the client-side window exists.

---

## 7. Ride Lifecycle Transitions

### Before Requesting a Ride (idle phase)

**Map control:** `CarMap`. Camera: `getCurrentPositionAsync(High)` on mount → `animateToRegion` to user position. If destination is set in the search bar, `fitToCoordinates([user, dest])` via the state-change effect (400ms delay).

**Location data:** One-shot GPS fix from `CarMap`. Nearby drivers polled every 12s.

**Socket:** None. `useRide` initialized but not listening.

---

### Searching for Driver (searching phase)

**Map control:** `CarMap`. Camera: `searching=true` prop → `animateToRegion` to tight zoom on user location (latDelta 0.01, 400ms delay). Nearby driver polling stops.

**Socket:** `setupSocketListeners(rideId)` called in `requestRide()`. Poll interval (5s) starts.

**Tracking:** `usePassengerTracking` not yet active (`isActive = rideState.status === 'started'`).

**Instability:** The `setTimeout(400)` camera change can race with other simultaneous state transitions (e.g., socket event arriving while animation is mid-flight).

---

### Driver Accepted (driver_assigned phase)

**Map control:** `CarMap`. `showDriverMarker=true` prop change → camera effect fires → `fitToCoordinates([user, driverLocation, dest], paddings)` with 400ms delay. Driver marker animates via `AnimatedRegion`.

**Socket:** `ride:driver_assigned` event updates `rideState.driver`, sets status.

**Source of driver info:** Socket event payload (name, vehicle, eta) or `activeRideSnapshot` sync.

**ETA displayed:** Socket `ride:eta_update` or `driver_assigned.eta` field, defaulting to 5 if neither present.

---

### Driver Approaching Pickup (driver_assigned → approaching)

**Map control in `CarServiceScreen`:** `CarMap` receives `driverLocation` prop updates from `rideState` on every socket tick. Camera does NOT auto-follow the driver (the camera effect only fires on `showDriverMarker/destCoords/userLocation/searching` changes, not on `driverLocation` changes). Driver marker glides via `AnimatedRegion`.

**Map control in `trip-tracking.tsx`** (if opened via `ActiveRideBanner`): `PassengerTrackingMap` with `tripPhase='driver_arriving'`. Camera follows driver every tick + fits driver+pickup on phase set. Route: driver → pickup. ETA to pickup.

**Instability:** In the home-tab flow (`CarServiceScreen`), the driver can move completely off-screen with no auto-follow, because `CarMap` was not designed for real-time driver following.

---

### Driver Arrived (arrived phase)

**Triggered by:** `SOCKET_EVENTS.RIDE_DRIVER_ARRIVED` (`"ride:driver_arrived"`) in `useRide.ts` — or `"ride:arrived"` in `trip-tracking.tsx`. These are different event names. One of the two screens may miss this transition.

**Map state:** No phase change in the map — same as `driver_assigned` from the camera's perspective.

**Waiting charge:** If backend emits `ride:waiting:charge:started`, `waitingChargeStatus` becomes `'active'`.

---

### Trip Started (started phase)

**Map control:**
- `CarServiceScreen`/`CarMap`: Camera still doesn't follow driver. Route now drawn from driver → destination. `DriverAssignedCard` shown.
- `trip-tracking.tsx`/`PassengerTrackingMap`: `tripPhase='trip_started'`. Camera re-fits to driver + dropoff (once). Then follows driver smoothly on subsequent ticks. Route: driver → dropoff.

**Tracking:** `usePassengerTracking` activates (`isActive=true`). Background location task starts. Foreground 15s interval starts. Both send to backend.

**Waiting charge cleared:** `waitingChargeStatus` reset to `'none'`.

---

### Trip In Progress (started, ongoing)

**Map control:** `PassengerTrackingMap` follows driver. Route refreshes every 300m of movement or 75s. ETA from Directions API, falling back to haversine/25km.

**Socket:** All ride events still active. `ride:deviation:warning` can fire if driver deviates from route.

**Passenger tracking:** Both foreground and background paths sending location to backend every 15s.

---

### Trip Completed (completed phase)

**Triggered by:** `ride:completed` socket event. `useRide` receives fare, calls `cleanup()` (removes all socket listeners, stops polling). `setRideState` with `status='completed'`.

**In `trip-tracking.tsx`:** After 3 seconds (`setTimeout(() => router.back(), 3000)`), screen navigates back.

**Tracking:** `usePassengerTracking` deactivates (`isActive=false`). Background task stopped. Offline snapshots flushed.

**Instability:** `trip-tracking.tsx` uses a hard-coded 3-second `setTimeout` to navigate away on completion. If the user manually navigates back within those 3 seconds, the `setTimeout` fires on an unmounted component. No cancellation of this timeout exists in the cleanup.

---

## 8. Technical Debt

### Duplicated Logic
- `normalizeRideStatus()` and `mapActiveSessionStatus()` — same mapping defined twice, manually kept in sync
- `ROUTE_REFRESH_INTERVAL_MS = 75_000` and `SIGNIFICANT_MOVE_METERS = 300` — identical constants in both `CarMap.tsx` and `PassengerTrackingMap.native.tsx`

### Hardcoded Values / Workarounds
- `setTimeout(400)` in `CarMap` for camera timing — explicitly a workaround for map readiness
- `DEFAULT_CENTER` = Cairo (`30.0444, 31.2357`) hardcoded in both `CarMap` and `PassengerTrackingMap` — will default to Cairo for any other city
- `eta: 5` hardcoded default in `activeRideSelectors.ts`
- `25 km/h` hardcoded urban speed for ETA fallback — also labeled "for shuttle" but used for cars
- 3-second `setTimeout` for navigation on trip completion in `trip-tracking.tsx` — no cancellation on unmount

### Hacks
- `as any` cast on `AnimatedRegion.timing()` in both `CarMap` and `PassengerTrackingMap` — type workaround for `react-native-maps` type mismatch
- `@ts-expect-error` on `compassEnabled` prop in `CarMap` — API exists at runtime but not in types
- `atob(tok.split('.')[1])` JWT decode in `trip-tracking.tsx` for ownership check — bare-metal JWT parsing, no validation of signature or expiry, just a UI guard

### Dead Code / Fragile Areas
- `SOCKET_EVENTS.RIDE_ARRIVED = "ride:arrived"` defined in constants but never used in `useRide.ts` — only `trip-tracking.tsx` uses it via hardcoded string
- `WalletBalanceSchema` with 6 possible balance keys — suggests unmigrated backend versions still in use
- `RideSocketEvents` interface in `socket.ts` — comment notes it "does not constrain any `socket.on`/`socket.off` call site today" — effectively dead documentation
- `SOCKET_EVENTS.WALLET_FEATURE_CHANGED = "wallet:feature:changed"` vs usage of `"wallet:feature_changed"` (underscore) in some contexts — potential missed event

### Conflicting Implementations
- `ride:driver_arrived` (`useRide.ts`) vs `ride:arrived` (`trip-tracking.tsx`) — same lifecycle event, different event names
- `trip-tracking.tsx` three simultaneous state writers on mount (snapshot effect + REST call + socket) writing to the same local state

### Risky Dependencies
- `react-native-maps` `AnimatedRegion.timing()` type mismatch — `as any` cast means any API breakage is invisible at compile time
- `expo-task-manager` background location — `stopLocationUpdatesAsync` failure is silently caught, leaking the background task

---

## 9. Root Causes of Unstable Map/Tracking Behavior

### 🔴 Critical

**C1: Dual independent socket listener sets for the same ride**

`useRide.ts` and `trip-tracking.tsx` both attach socket listeners for `ride:driver_location`, `ride:started`, `ride:completed`, `ride:cancelled`. When both screens are simultaneously active (home tab + `trip-tracking.tsx` opened via `ActiveRideBanner`), both process each socket event independently. The state machines are separate — no conflict in terms of correctness — but any slow event handler or React scheduling delay in one tree causes the two visible screens to show different states for a moment. More critically, terminal event handling (completion/cancellation) triggers cleanup in `useRide.ts` independently of `trip-tracking.tsx`'s cleanup. The 3-second `setTimeout` for auto-navigation on completion is not coordinated with `useRide`'s `cleanup()`.

**C2: Arrived event name mismatch (`"ride:driver_arrived"` vs `"ride:arrived"`)**

One of the two consuming components misses the driver-arrived transition depending on which name the backend emits. If `trip-tracking.tsx` misses it, the status pill in the tracking screen never shows "Driver Arrived" — the screen is stuck on "Driver On the Way" until the driver starts the trip.

---

### 🟠 High

**H1: `CarMap` has no driver-follow mode**

The camera effect in `CarMap` does not include `driverLocation` in its dependency array. During an active ride viewed from the home tab, the driver can move out of frame with no auto-follow. The only auto-follow available is in `PassengerTrackingMap` via the dedicated `trip-tracking.tsx` screen. Passengers who don't know to open that screen see a static map after ride assignment.

**H2: `PassengerTrackingMap` route fetch not cancelled on phase change**

A `fetchGoogleRoute` in flight when `tripPhase` changes from `driver_arriving` to `trip_started` will complete and overwrite the correct new-phase route with the old-phase route. The overwrite is visible: the polyline briefly shows driver → pickup instead of driver → dropoff.

**H3: `trip-tracking.tsx` three-way state write conflict on mount**

The `activeRideSnapshot` effect, the `getRide()` REST call, and socket listeners all write to `status`, `driverInfo`, `driverLocation` state variables on mount. The order of resolution is non-deterministic. The REST call can overwrite fresher socket data; the snapshot can overwrite fresher REST data.

**H4: `driverLocation` prop always creates a new object reference**

`setRideState(prev => ({ ...prev, driverLocation: parsed.data.location }))` allocates a new object on every socket tick. `PassengerTrackingMap` is wrapped in `React.memo` but receives a new object reference every tick — the memo boundary is broken on every driver location event, causing full re-renders of the tracking map component at socket frequency.

---

### 🟡 Medium

**M1: Background + foreground tracking running concurrently**

`usePassengerTracking` starts both `startLocationUpdatesAsync` (background) and a `setInterval` (foreground). Both paths eventually send location data to the backend. The foreground tick flushes background-accumulated snapshots then sends its own — resulting in potential double-sends within the same interval window. Battery and bandwidth waste.

**M2: `setTimeout(400)` camera hack in `CarMap`**

Camera updates are deferred by 400ms. Rapid state transitions (destination set, `searching` flag changes, driver assignment) queue multiple deferred camera calls. The 400ms gaps between them produce a visible step-camera effect rather than smooth transitions.

**M3: ETA defaults to 5 minutes until first socket event**

The `activeRideSnapshot` seeds `eta: 5`. If the socket `ride:driver_assigned` event arrives before `ride:eta_update`, the displayed ETA remains 5 minutes until the next update — even if the driver is 1 minute away.

**M4: `SearchingPulse` `tracksViewChanges={true}` marker**

Forces expensive native view re-measurement on every React render during the searching phase. If `CarServiceScreen` re-renders frequently (autocomplete results, location updates), this marker is re-measured every time.

---

### 🔵 Low

**L1: Incorrect comment in `usePassengerTracking.ts`**

Comment says "every 5 minutes" but interval is 15 seconds. Can mislead future engineers about tracking frequency.

**L2: `SOCKET_EVENTS.WALLET_FEATURE_CHANGED` vs `"wallet:feature_changed"` mismatch**

The constant uses colon notation (`wallet:feature:changed`); the usage in some context files uses underscore notation. Requires verification against the actual backend event name.

**L3: Hardcoded Cairo default coordinates**

`DEFAULT_CENTER = { latitude: 30.0444, longitude: 31.2357 }` in both map components. Any non-Cairo market sees the map flash to Cairo before GPS resolves.

**L4: `WalletBalanceSchema` with 6 keys**

Documents backend API inconsistency. Not a runtime bug but indicates unresolved schema drift.

---

## 10. Rebuild Assessment

### A. Can the current passenger map/tracking architecture be cleaned and stabilized?

**YES.**

---

### B. Estimate of Effort and What Should Be Redesigned

**Effort: Medium — estimated 2–3 focused engineering sprints.**

The architecture is structurally sound. The problems are specific, localized, and addressable without touching the full system.

**What should be redesigned (not rebuilt):**

**1. Resolve the arrived event name ambiguity.**
Coordinate with the backend to confirm the canonical event name. Update all clients to a single constant. Eliminate the split between `SOCKET_EVENTS.RIDE_ARRIVED` and `SOCKET_EVENTS.RIDE_DRIVER_ARRIVED` — use only one.

**2. Eliminate `trip-tracking.tsx`'s independent ride state.**
This screen should consume `useRide`'s `rideState` (or an equivalent context) instead of maintaining its own `status`, `driverLocation`, and `driverInfo` state fed by its own socket listeners. This removes the three-way state write conflict, the duplicate socket listeners, and the event name divergence.

**3. Add driver-follow mode to `CarMap`.**
The camera effect should include `driverLocation` in its deps when a driver is assigned (`showDriverMarker=true`), moving camera to frame driver + destination instead of remaining static.

**4. Add route fetch cancellation to `PassengerTrackingMap`.**
Mirror `CarMap`'s `cancelled` ref pattern in the car-route effect.

**5. Fix `driverLocation` prop object stability.**
In `useRide.ts`, only create a new `driverLocation` object if the coordinates actually changed:
```ts
const newLoc = parsed.data.location;
if (
  prev.driverLocation?.latitude === newLoc.latitude &&
  prev.driverLocation?.longitude === newLoc.longitude
) return prev;
return { ...prev, driverLocation: newLoc };
```
This restores `React.memo` effectiveness for `PassengerTrackingMap`.

**6. Replace `setTimeout(400)` in `CarMap` with the existing `mapReadyRef` pattern.**
`mapReadyRef` + `pendingLocationRef` is already implemented for the initial case. Extend this pattern to subsequent camera calls.

**7. Consolidate the two status-mapping functions** into a single export from `src/api/socket.ts` consumed by both `activeRideSelectors.ts` and anywhere else it's needed.

**8. Cancel the 3-second `setTimeout` in `trip-tracking.tsx`** on component cleanup.

---

### C. Not applicable (answer is YES).

---

### D. Lead Engineer's Recommendation

**Refactor the current system. Do not rebuild.**

The architecture demonstrates deliberate defensive design throughout: `socketListening` refs preventing double-attach, terminal-status guards preventing race conditions, `activeRideIdRef` scoping listeners to the correct ride, `fittedPhaseRef` preventing camera thrash, `React.memo` boundaries on both map components, and the `cancelRide` flow that re-syncs state from the backend on API failure. These are not the patterns of a codebase that needs to be discarded.

The bugs are surgical: one event-name mismatch, one missing cancellation flag, one unnecessary parallel state machine in `trip-tracking.tsx`, one missing dependency in a camera effect, one object-reference allocation in a hot path. All are fixable in isolation without touching the surrounding architecture.

A full rebuild of the map/tracking module would re-expose all the same edge cases (cold-start recovery, socket reconnect, phase transitions, user panning vs auto-follow) and would take longer to stabilize than the existing codebase — because the existing codebase has already found and handled most of those edges. The remaining problems are specific failures at specific seams, not evidence of an architectural dead end.

---

*Report generated from full static analysis of the VeeGo Passenger App codebase.*
*Audit date: 2026-08-02*
*No code was modified during this audit.*
