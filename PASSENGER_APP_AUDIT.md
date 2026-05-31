# VeeGo Passenger App — Complete Integration Audit

**Audit Date:** 2026-05-31  
**App Version:** 1.0.0  
**Stack:** Expo SDK 54 · expo-router v6 · React Native 0.81 · React 19.1.0 · Axios · Socket.IO-client 4.8 · pnpm  
**Backend Secret:** `EXPO_PUBLIC_API_URL` (Replit secret — no `.env` file)  
**Test Credentials:** `alice@example.com` / `Alice@123` (Passenger role)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [API Client & Auth Layer](#2-api-client--auth-layer)
3. [Socket.IO Integration](#3-socketio-integration)
4. [Auth Screens](#4-auth-screens)
5. [Home Screen](#5-home-screen)
6. [Shuttle Booking Flow](#6-shuttle-booking-flow)
7. [Ride (Car / Bike) Flow](#7-ride-car--bike-flow)
8. [Trips Screen](#8-trips-screen)
9. [Wallet Screen](#9-wallet-screen)
10. [Notifications Screen](#10-notifications-screen)
11. [Promo Screen](#11-promo-screen)
12. [Stations Screen](#12-stations-screen)
13. [Profile Screen](#13-profile-screen)
14. [Ticket Screen](#14-ticket-screen)
15. [Trip-Tracking Screen](#15-trip-tracking-screen)
16. [Push Notifications](#16-push-notifications)
17. [Complete API Endpoint Inventory](#17-complete-api-endpoint-inventory)
18. [Complete Socket Event Inventory](#18-complete-socket-event-inventory)
19. [Data Type Contracts](#19-data-type-contracts)
20. [Bugs & Gaps](#20-bugs--gaps)
21. [Security Notes](#21-security-notes)
22. [Dependency Inventory](#22-dependency-inventory)

---

## 1. Architecture Overview

```
app/                        ← Expo Router file-based routes
  _layout.tsx               ← Root layout (providers, fonts, assets, push)
  index.tsx                 ← Splash/redirect (not inspected — tiny)
  auth.tsx                  ← Sign-in / Sign-up / Forgot-password
  onboarding.tsx            ← First-run onboarding
  lang-select.tsx           ← Language selector
  ticket.tsx                ← Booking confirmation + QR code
  trip-tracking.tsx         ← Live car/bike ride tracking map
  notifications.tsx         ← In-app notification list
  stations.tsx              ← Station browser (⚠ static data)
  promo.tsx                 ← Promo code entry + listing
  support.tsx               ← Support screen
  (tabs)/
    _layout.tsx             ← Tab bar (Home, Trips, Favorites, Wallet, Profile)
    index.tsx               ← Home: shuttle routes, car/bike entry, quick actions
    trips.tsx               ← My bookings (upcoming + past)
    favorites.tsx           ← Favorite routes (local-only)
    wallet.tsx              ← Balance + transactions + top-up
    profile.tsx             ← User settings (⚠ partial API use)
    car.tsx                 ← Car service (hidden tab, embedded in Home)
    routes.tsx              ← Routes tab (hidden)

context/
  BookingContext.tsx        ← Shuttle booking lifecycle state machine
  ThemeContext.tsx          ← Dark mode, language (AR/EN), translations
  FavoritesContext.tsx      ← Favorites (local AsyncStorage only)
  TabBarContext.tsx          ← Tab bar visibility control

src/
  api/
    client.ts               ← Axios singleton, token injection, 401→refresh
    socket.ts               ← Socket.IO singleton, reconnection config
  hooks/
    useRide.ts              ← Car/bike ride request, polling, socket events
    useTrips.ts             ← Fetch user bookings list
    useProfile.ts           ← Fetch + update user profile
    useWallet.ts            ← Balance, transactions, top-up
    useRoutes.ts            ← Shuttle lines + next departure enrichment
    usePromos.ts            ← Promo list + code validation
    useNotifications.ts     ← Notifications + real-time socket push
    usePushToken.ts         ← Expo push token registration
  constants/
    socketEvents.ts         ← Typed socket event name constants

constants/
  data.ts                   ← TypeScript types + static fallback data
  colors.ts                 ← Theme color palettes
```

**Provider tree (root → leaf):**
```
SafeAreaProvider
  ThemeProvider
    TabBarProvider
      BookingProvider
        FavoritesProvider
          AppShell  (usePushToken, notification deep-link listeners)
            Stack Navigator
              TripSheet  (global bottom sheet, rendered over stack)
              ConfirmSheet
```

---

## 2. API Client & Auth Layer

**File:** `src/api/client.ts`

### Configuration

| Property | Value |
|---|---|
| Base URL source | `EXPO_PUBLIC_API_URL` env secret |
| URL normalization | Strips `KEY=VALUE` format; prepends `https://` if missing |
| Timeout | 12 000 ms |
| Default headers | `Content-Type: application/json` |
| Token storage (native) | `expo-secure-store` (keys: `veego_access_token`, `veego_refresh_token`) |
| Token storage (web) | `localStorage` (same key names) |

### Request Interceptor

1. Reads `veego_access_token` from store.
2. Injects `Authorization: Bearer <token>` if present.
3. Logs `[API] --> METHOD URL` and redacted payload to console.

### Response Interceptor (401 handling)

1. On first 401, sets `_retry` flag, checks refresh token.
2. Calls `POST /auth/refresh` via raw `axios` (not the api instance) to avoid loop.
3. Accepts `accessToken | access_token | token` from response.
4. Queues concurrent requests during refresh (correct pattern).
5. Clears both tokens and rejects on refresh failure — app must detect logged-out state and redirect to `/auth`.

> **Gap:** There is no automatic redirect to `/auth` when token refresh fails. The error propagates to the calling hook which shows a generic error message. The user remains on the screen but all subsequent API calls will fail until they manually log out.

---

## 3. Socket.IO Integration

**File:** `src/api/socket.ts`

### Connection Config

| Property | Value |
|---|---|
| URL | `EXPO_PUBLIC_API_URL` with `/api` suffix stripped |
| Path | `/api/socket.io` |
| Transports (native) | `['websocket']` |
| Transports (web) | `['websocket', 'polling']` |
| Auth | `{ token: <access_token> }` |
| Reconnection | enabled, max 10 attempts, delay 1500 ms, timeout 10 000 ms |

### Singleton Management

`getSocket()` returns the existing socket if connected; otherwise disconnects the old instance and creates a fresh one. This means if the auth token changes (login/refresh), the socket must be explicitly disconnected and recreated. There is no automatic token rotation on the socket after a token refresh.

> **Bug:** `socket.ts` URL normalization does **not** apply the same `KEY=VALUE` stripping that `client.ts` does. If `EXPO_PUBLIC_API_URL` contains an `=` sign (the historical bug pattern), `client.ts` corrects it but `socket.ts` does not — the socket would connect to a malformed URL. The fix: apply the same normalization in `socket.ts`.

> **Bug:** `SOCKET_EVENTS` is imported in `socket.ts` but never used. The socket event strings inside `socket.ts` are raw string literals. This is harmless but means the constants provide no compile-time safety for the socket module itself.

---

## 4. Auth Screens

**File:** `app/auth.tsx`

### Sign-In

| Item | Detail |
|---|---|
| Endpoint | `POST /auth/login` |
| Request payload | `{ credential: string, password: string }` |
| Response consumed | `accessToken \| access_token \| token`, `refreshToken \| refresh_token`, `user.name` |
| On success | Tokens persisted → session saved to AsyncStorage → `router.replace('/(tabs)')` |
| On 403 | Alert: "account blocked" message |
| On other error | Alert with server `error \| message` |

### Sign-Up

| Item | Detail |
|---|---|
| Endpoint | `POST /auth/register` |
| Request payload | `{ name, phone, email, password }` |
| Client validation | All fields required; password ≥ 8 chars |
| On success | Same token persist + session save flow as sign-in |

### Forgot Password

| Item | Detail |
|---|---|
| Endpoint | `POST /auth/forgot-password` |
| Request payload | `{ phone: string }` |
| Error handling | Always shows success UI (prevents phone enumeration) |
| OTP/reset flow | Not implemented client-side — screen returns to sign-in after success display |

> **Gap:** Forgot-password only accepts a phone number. The UI label says "Phone" but sign-in accepts `credential` (email or phone). There is no OTP entry or password-reset flow implemented in the app — the flow ends at the confirmation screen.

### Session Persistence

`AsyncStorage` key `@veego_session_v1` stores `{ identifier, name, loggedInAt }`. This is display-only meta; actual auth is from SecureStore tokens.

---

## 5. Home Screen

**File:** `app/(tabs)/index.tsx`

### Data Sources

| Section | Source |
|---|---|
| Shuttle routes list | `useRoutes()` → `GET /shuttle/lines` + `GET /trips?status=scheduled&limit=200` |
| Upcoming trips hero | `useTrips()` → `GET /users/me/bookings` |
| Active booking card | `BookingContext.activeBooking` (in-memory, set at booking time) |
| Featured offers | `FeaturedOffers` component (static/mock data — no API call observed) |
| User greeting name | Hardcoded: "VeeGo" (not fetched from profile API) |

### Service Modes

| Mode | Behavior |
|---|---|
| `shuttle` | Shows route list, filter chips, quick actions |
| `car` | Mounts `<CarServiceScreen embedded>`, hides tab bar |
| `bike` | Mounts `<BikeServiceScreen embedded>`, hides tab bar |
| `delivery` | Shows "Coming Soon" toast (no navigation) |

### Route Filter Chips

Hardcoded filter values: `['all_lines', 'L01', 'L02', 'L03', 'L04']`

> **Gap:** Filter chips are hardcoded to codes L01–L04. Real backend routes with different codes will not match any filter chip (all routes appear under "All Lines" only). Filter chips should be derived from the fetched route list.

---

## 6. Shuttle Booking Flow

**Files:** `context/BookingContext.tsx`, `components/TripSheet.tsx`, `components/ConfirmSheet.tsx`

### State Machine

```
[Route pressed] → openRoute(route)
  → GET /shuttle/lines/:id        (load stations + activeTrips)
  → TripSheet opens (user selects from/to station, passengers, date)

[Book pressed] → handleBook(booking)
  → TripSheet closes → ConfirmSheet opens (280ms delay)

[Confirm pressed] → handleConfirm()
  → ConfirmSheet closes
  → Find tripId from cached activeTrips (seat availability match)
    OR fallback: GET /trips?routeId=&status=scheduled&limit=5
  → POST /bookings { tripId, seatCount }
  → setConfirmedBookingId(bookingId)
  → setTimeout 260ms → router.push('/ticket')
```

### API Calls in Booking Flow

| Step | Method | Endpoint | Payload |
|---|---|---|---|
| Load route detail | GET | `/shuttle/lines/:id` | — |
| Fallback trip lookup | GET | `/trips` | `{ routeId, status: 'scheduled', limit: 5 }` |
| Create booking | POST | `/bookings` | `{ tripId: number, seatCount: number }` |

### Response Field Aliases Handled

`GET /shuttle/lines/:id` response:
- Route detail: `data.data ?? data`
- Stations: `full.stations` (sorted by `order`)
- Active trips: `full.activeTrips`

`POST /bookings` response:
- Booking ID: `data.bookingId ?? data.id ?? data._id`

> **Bug:** `router.push('/ticket')` is called unconditionally after 260ms regardless of whether the `POST /bookings` call succeeded. If the booking fails, the ticket screen opens showing `confirmedBookingId = null` (empty), displaying "No booking" fallback UI. The user is not alerted that the booking failed before being redirected.

> **Gap:** `scheduledTrips` field exposed on `BookingContext` is the `routeActiveTrips` array from `GET /shuttle/lines/:id`. Named "scheduled" but sourced from `activeTrips` — potential semantic confusion.

---

## 7. Ride (Car / Bike) Flow

**File:** `src/hooks/useRide.ts`

### Request Ride

| Item | Detail |
|---|---|
| Endpoint | `POST /rides/request` |
| Request payload | `{ vehicleType, pickupLatitude, pickupLongitude, pickupAddress, dropoffLatitude, dropoffLongitude, dropoffAddress, notes }` |
| Response ride ID | `data.data.id ?? data.rideId ?? data.id ?? data._id ?? Date.now()` |
| After success | Sets up socket listeners + starts 5s polling |

### Polling

`GET /rides/:rideId` every 5 000 ms while ride is non-terminal. Stops automatically on `completed | cancelled | timeout`. Silent failure (no error state on poll failure — socket events remain primary source).

Fields consumed from poll response:
- `status | rideStatus`
- `driver.name | phone | vehicle | rating`
- `eta | driver.eta`
- `driverLocation | driver_location`

### Cancel Ride

`PATCH /rides/:rideId/cancel` — fire and forget (errors silently swallowed). Local state set to cancelled regardless.

### Socket Events Consumed (ride-specific)

| Event | Action |
|---|---|
| `ride:driver_assigned` | Updates driver info, status → `driver_assigned` |
| `ride:driver_location` | Updates driverLocation |
| `ride:arrived` | Status → `arrived` |
| `ride:started` | Status → `started` |
| `ride:completed` | Status → `completed`, stores fare, cleanup |
| `ride:cancelled` | Status → `cancelled`, stores reason, cleanup |
| `ride:timeout` | Status → `timeout`, cleanup |

### Terminal States

`completed | cancelled | timeout` — polling stops, socket listeners removed.

> **Gap:** `setupSocketListeners` guards with `socketListening.current` ref so it only runs once per hook instance. If the component unmounts and remounts (e.g., navigation), the ref resets and listeners are re-attached, but any in-progress ride ID from a previous session is lost. No ride state persistence across app restarts.

---

## 8. Trips Screen

**File:** `app/(tabs)/trips.tsx` (uses `useTrips`)  
**Hook:** `src/hooks/useTrips.ts`

### Data Fetch

Two parallel requests via `Promise.allSettled`:

| Request | Endpoint | Purpose |
|---|---|---|
| Primary | `GET /users/me/bookings` | User booking list |
| Secondary | `GET /shuttle/lines` | Route name resolution map |

Routes request failure is non-fatal (bookings still render with fallback route display).

### Booking → Trip Mapping

| Source field | Mapped to | Fallback chain |
|---|---|---|
| Status | `upcoming / completed / cancelled` | booking.status → trip.status |
| Trip type | `shuttle / car / bike` | `route.type ?? b.type ?? 'shuttle'` |
| Route name | `routeName` | `trip.route.name ?? routeMap[routeId].name ?? 'Route #N'` |
| Departure time | formatted `date` / `time` | `trip.departureTime ?? trip.departure_time` |
| Price | `price` | `b.totalPrice ?? b.total_price ?? trip.price ?? b.price` |
| Seat | `seat` | `b.seatNumber ?? b.seat_number ?? b.seat` |

### Status Classification

- `cancelled` if either booking or trip status = 'cancelled'
- `completed` if either booking or trip status = 'completed'
- Otherwise: `upcoming`

Date/time formatted using `ar-EG` locale.

---

## 9. Wallet Screen

**File:** `app/(tabs)/wallet.tsx` (uses `useWallet`)  
**Hook:** `src/hooks/useWallet.ts`

### Data Fetch

Two parallel requests via `Promise.allSettled`:

| Request | Endpoint | Purpose |
|---|---|---|
| Balance | `GET /wallet` | Balance + spent stats |
| Transactions | `GET /wallet/transactions` | Transaction history |

### Field Aliases Handled

Balance response: `balance ?? walletBalance ?? wallet_balance ?? amount`  
Spent response: `spent ?? monthlySpent ?? spentThisMonth ?? total_spent`  
Transaction list: `Array | .transactions | .data | .items`

### Top-Up

| Item | Detail |
|---|---|
| Endpoint | `POST /wallet/topup` |
| Payload | `{ amount: number }` |
| On success | Calls `fetchWallet()` to sync server state |
| UI options | 50 / 100 / 200 / 500 EGP preset buttons |

> **Gap:** No payment gateway integration. Top-up is a direct backend call with no card input, payment provider, or 3DS. Suitable only for test/admin-credited wallets.

### Transaction Icon Mapping

Transaction type string matched against: `shuttle, car, bike, recharge, top_up, topup, refund, transfer, promo, booking, ride`. Default: `PlusCircle` (credit) or `CreditCard` (debit).

---

## 10. Notifications Screen

**File:** `app/notifications.tsx` (uses `useNotifications`)  
**Hook:** `src/hooks/useNotifications.ts`

### Data Fetch

`GET /notifications` on mount. Response aliases: `Array | .notifications | .data | .items`

### Real-Time

Socket event `notification:new` prepends new notification to list (with `unread: true`). Socket listener set up once via `socketSetup.current` ref.

### Mark All Read

`PATCH /notifications/read-all` — optimistic local update (all `unread → false`), then fire-and-forget. No rollback on server error.

### Notification Type Classification

`category: 'trip' | 'promo' | 'system'` — any unrecognised category defaults to `'system'`.

---

## 11. Promo Screen

**File:** `app/promo.tsx` (uses `usePromos`)  
**Hook:** `src/hooks/usePromos.ts`

### Promo List

`GET /promo` on mount. Response aliases: `Array | .promos | .codes | .data | .items`

### Validate Code

| Item | Detail |
|---|---|
| Endpoint | `POST /promo/validate` |
| Payload | `{ code: string }` |
| Valid response fields | `valid ?? isValid ?? is_valid ?? success`, `discountValue`, `discountType`, `message` |
| 400/404/422 | Returns `{ valid: false, message }` |
| Network error | Returns `{ valid: false, message: 'Could not validate...' }` |

### Deep-Link Support

`app/promo.tsx` reads `?code=` query param via `useLocalSearchParams` and auto-populates the input field on mount. Push notification with `{ category: 'promo', code: 'XYZ' }` routes here.

---

## 12. Stations Screen

**File:** `app/stations.tsx`

> **Critical Gap:** The stations screen does **not** call any API. It imports `stations` directly from `constants/data.ts` — a static array of 6 hardcoded Arabic-named stations in the New Valley (الوادي الجديد) region. Real stations from the backend are never fetched or displayed here.

The backend has a stations concept (referenced via `/shuttle/lines/:id` station sub-objects) but there is no `GET /stations` endpoint call anywhere in the app.

---

## 13. Profile Screen

**File:** `app/(tabs)/profile.tsx`

> **Critical Gap:** The profile screen does **not** use `useProfile`. User name and email shown in the hero card are loaded from `AsyncStorage` session key `@veego_session_v1` (set at login), not from `GET /users/me`. Changes to user data on the server are not reflected unless the user logs out and back in.

The `useProfile` hook (`src/hooks/useProfile.ts`) exists and is fully implemented (`GET /users/me`, `PATCH /users/me`) but is **not mounted** anywhere in the current app.

### Settings Implemented (UI only or partial)

| Setting | Backend integration |
|---|---|
| Language (AR/EN) | Local ThemeContext — no API call |
| Dark Mode | Local ThemeContext — no API call |
| Notification preferences | UI toggle only — no `PATCH /users/me/notifications` |
| Push notifications toggle | UI toggle only — does not revoke push token |
| Payment methods | UI stub — no API call |
| Security / biometrics | UI stub — no API call |
| Privacy settings | UI stub — no API call |
| Help / FAQ | UI stub — no API call |
| Contact support | Navigates to `/support` |
| Log out | Clears AsyncStorage session + SecureStore tokens → `router.replace('/auth')` |

---

## 14. Ticket Screen

**File:** `app/ticket.tsx`

### Data Sources

| Data | Source |
|---|---|
| Booking details | `BookingContext.activeBooking` (in-memory) |
| Booking ID | `BookingContext.confirmedBookingId` (set after POST /bookings) |
| Boarded status | Socket event `booking:boarded` |

### QR Code

Value: `JSON.stringify({ bookingId, app: 'veego', v: 1 })`

On web: renders `QrCode` lucide icon as a visual placeholder (not a real scannable QR).  
On native: uses `react-native-qrcode-svg` with actual booking ID.

> **Bug:** Web `QRDisplay` references `QrCode` component that is **not imported** in `app/ticket.tsx`. The import list includes `X, Share2, Check, CheckCircle, ArrowRight, Ticket` from lucide but not `QrCode`. This will throw a ReferenceError on web when the booking page loads.

### Socket: `booking:boarded`

When the driver app scans the QR, backend emits `booking:boarded` with `{ bookingId, passengerId?, timestamp }`. Ticket screen listens, shows a green "You've been boarded!" banner with haptic success feedback.

ID matching: `data.bookingId === id` where `id = bookingId.replace(/^#/, '')` — handles IDs that may or may not have a `#` prefix.

### Share Button

Present in UI but `onPress` only triggers haptic feedback — no actual share sheet implemented.

---

## 15. Trip-Tracking Screen

**File:** `app/trip-tracking.tsx`

### Entry

Navigation params:
```
rideId, pickupLat, pickupLng, dropoffLat, dropoffLng,
driverLat?, driverLng?, driverName?, driverVehicle?, driverRating?, driverPhone?
```

All coordinates parsed with `parseFloat`. Driver location initialised from params if present.

### Map Component

`<PassengerTrackingMap pickup dropoff driverLocation />` — separate component (not read in this audit). Likely uses `react-native-maps` or `maplibre-gl`.

### Socket Events Consumed

| Event | Action |
|---|---|
| `ride:driver_location` | Updates `driverLocation` state |
| `ride:arrived` | Status → `arrived` |
| `ride:started` | Status → `started` |
| `ride:completed` | Status → `completed`, auto-navigate back after 3s |
| `ride:cancelled` | Status → `cancelled`, auto-navigate back after 3s |

> **Bug:** Socket cleanup in the `useEffect` return function calls `socket.off('ride:driver_location')` without passing the specific handler reference. This removes **all** listeners for that event name globally, which could interfere with other components (e.g., `useRide` hook) listening to the same event simultaneously. Each `socket.on` call should capture the handler in a variable and pass it to `socket.off`.

### Phone Call Button

Rendered when `params.driverPhone` is truthy but `onPress` is not implemented (no `Linking.openURL('tel:...')`).

---

## 16. Push Notifications

**File:** `src/hooks/usePushToken.ts`  
**Mounted in:** `app/_layout.tsx` (`AppShell`)

### Registration Flow

1. Check `expo-notifications` permission — request if not granted.
2. Call `Notifications.getExpoPushTokenAsync()` — returns Expo push token.
3. `POST /users/me/push-token { token, platform: Platform.OS }`.
4. One-time per app session (guarded by `registered` ref).

> **Gap:** No Android notification channel setup (`Notifications.setNotificationChannelAsync`). On Android 8+, notifications without a channel are silently dropped.

> **Gap:** `usePushToken` does not handle the case where permission was previously denied. After a denial, `finalStatus !== 'granted'` returns `null` — no user prompt to open Settings.

### Foreground Handling

`Notifications.setNotificationHandler` configured globally (top of module, outside hook) — shows alert, plays sound, sets badge for all foreground notifications.

### Deep-Link Routing (from `app/_layout.tsx`)

| Notification `category` | Route |
|---|---|
| `promo` (with `data.code`) | `/promo?code=<code>` |
| `booking` or `trip` | `/(tabs)/trips` |
| `ride` | `/(tabs)/car` |
| anything else | (no navigation) |

Works for both background tap (`addNotificationResponseReceivedListener`) and cold-start (`getLastNotificationResponseAsync`).

---

## 17. Complete API Endpoint Inventory

| # | Method | Endpoint | Used In | Notes |
|---|---|---|---|---|
| 1 | POST | `/auth/login` | `app/auth.tsx` SignInForm | `credential` + `password` |
| 2 | POST | `/auth/register` | `app/auth.tsx` SignUpForm | `name, phone, email, password` |
| 3 | POST | `/auth/forgot-password` | `app/auth.tsx` ForgotForm | `{ phone }` |
| 4 | POST | `/auth/refresh` | `src/api/client.ts` (interceptor) | `{ refreshToken }` → `accessToken` |
| 5 | GET | `/users/me` | `src/hooks/useProfile.ts` | Profile fetch (**hook unused in UI**) |
| 6 | PATCH | `/users/me` | `src/hooks/useProfile.ts` | Profile update (**hook unused in UI**) |
| 7 | POST | `/users/me/push-token` | `src/hooks/usePushToken.ts` | `{ token, platform }` |
| 8 | GET | `/users/me/bookings` | `src/hooks/useTrips.ts` | User booking history |
| 9 | GET | `/shuttle/lines` | `src/hooks/useRoutes.ts`, `src/hooks/useTrips.ts` | Route list |
| 10 | GET | `/shuttle/lines/:id` | `context/BookingContext.tsx` | Route detail with stations + activeTrips |
| 11 | GET | `/trips` | `src/hooks/useRoutes.ts` | `?status=scheduled&limit=200` for departure/seat data |
| 12 | GET | `/trips` | `context/BookingContext.tsx` (fallback) | `?routeId=&status=scheduled&limit=5` |
| 13 | POST | `/bookings` | `context/BookingContext.tsx` | `{ tripId, seatCount }` |
| 14 | GET | `/wallet` | `src/hooks/useWallet.ts` | Balance + spent |
| 15 | GET | `/wallet/transactions` | `src/hooks/useWallet.ts` | Transaction list |
| 16 | POST | `/wallet/topup` | `src/hooks/useWallet.ts` | `{ amount: number }` |
| 17 | GET | `/notifications` | `src/hooks/useNotifications.ts` | Notification list |
| 18 | PATCH | `/notifications/read-all` | `src/hooks/useNotifications.ts` | Mark all read |
| 19 | GET | `/promo` | `src/hooks/usePromos.ts` | Promo code list |
| 20 | POST | `/promo/validate` | `src/hooks/usePromos.ts` | `{ code: string }` |
| 21 | POST | `/rides/request` | `src/hooks/useRide.ts` | Request car/bike ride |
| 22 | GET | `/rides/:id` | `src/hooks/useRide.ts` | Poll ride status (every 5s) |
| 23 | PATCH | `/rides/:id/cancel` | `src/hooks/useRide.ts` | Cancel active ride |

**Total: 23 endpoint calls across 8 files**

---

## 18. Complete Socket Event Inventory

### Server → Client (Passenger receives)

| Event | Payload | Consumer | Action |
|---|---|---|---|
| `ride:driver_assigned` | `{ rideId, driver: { name, phone, vehicle, rating }, eta }` | `useRide` | Updates driver info, status |
| `ride:driver_location` | `{ rideId, location: { latitude, longitude, heading? } }` | `useRide`, `trip-tracking.tsx` | Updates driver map position |
| `ride:arrived` | `{ rideId }` | `useRide`, `trip-tracking.tsx` | Status → arrived |
| `ride:started` | `{ rideId }` | `useRide`, `trip-tracking.tsx` | Status → started |
| `ride:completed` | `{ rideId, fare }` | `useRide`, `trip-tracking.tsx` | Status → completed, store fare |
| `ride:cancelled` | `{ rideId, reason }` | `useRide`, `trip-tracking.tsx` | Status → cancelled, store reason |
| `ride:timeout` | `{ rideId }` | `useRide` | Status → timeout |
| `notification:new` | `{ id, category, title, body, time }` | `useNotifications` | Prepends to notification list |
| `booking:boarded` | `{ bookingId, passengerId?, timestamp }` | `ticket.tsx` | Shows boarded banner |

### Client → Server (Passenger sends)

| Event | Defined In | Sent From | Notes |
|---|---|---|---|
| `join` | `socketEvents.ts` | Not observed in client code | Likely sent by server SDK automatically |
| `passenger:join:trip` | `socketEvents.ts` | Not observed in client code | Defined but not emitted anywhere |

> **Note:** The constants `SOCKET_EVENTS.JOIN` and `SOCKET_EVENTS.PASSENGER_JOIN_TRIP` are defined in `src/constants/socketEvents.ts` but are **never emitted** by any client code. If the server requires the passenger to join a room before receiving ride events, this could cause missed events.

### Discrepancy: `ride:driver_arrived` vs `ride:arrived`

`socketEvents.ts` defines `RIDE_DRIVER_ARRIVED = "ride:driver_arrived"` but all listeners in the app use `"ride:arrived"`. These are two different event names. If the server emits `ride:driver_arrived`, the app will not handle it.

---

## 19. Data Type Contracts

### `Route` (from `constants/data.ts`)

```typescript
type Route = {
  id: string;
  code: string;        // e.g. "L01"
  name: string;
  from: string;
  to: string;
  stations: number;    // station count
  duration: string;    // e.g. "28 دقيقة"
  seatsLeft: number;
  totalSeats: number;
  price: number;       // base price in EGP
  nextDeparture: string;
  color: string;       // hex background
  path: Station[];     // ordered station list
};
```

### `Station`

```typescript
type Station = {
  id: string;
  name: string;
  area: string;
  distance: string;    // e.g. "240 م"
  eta: string;         // e.g. "3 دقائق"
  latitude?: number;
  longitude?: number;
};
```

### `Booking` (in-memory, BookingContext)

```typescript
type Booking = {
  route: Route;
  fromIdx: number;    // index into route.path
  toIdx: number;
  passengers: number;
  date: string;
  time: string;
  price: number;
};
```

### `Trip` (from API, useTrips)

```typescript
type Trip = {
  id: string;
  type: 'shuttle' | 'car' | 'bike';
  routeCode: string;
  routeName: string;
  from: string;
  to: string;
  date: string;       // formatted ar-EG
  time: string;       // formatted ar-EG
  seat: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  price: number;
};
```

### `Notification`

```typescript
type Notification = {
  id: string;
  category: 'trip' | 'promo' | 'system';
  title: string;
  body: string;
  time: string;
  unread?: boolean;
};
```

### `UserProfile` (useProfile — currently unused in UI)

```typescript
interface UserProfile {
  name: string;
  email: string;
  dob: string;
  phone: string;
}
```

---

## 20. Bugs & Gaps

### Critical Bugs

| # | Severity | Location | Description |
|---|---|---|---|
| B1 | 🔴 Critical | `app/ticket.tsx` | `QrCode` used in web `QRDisplay` but not imported → ReferenceError on web |
| B2 | 🔴 Critical | `context/BookingContext.tsx` | `router.push('/ticket')` fires unconditionally 260ms after confirm regardless of booking POST success/failure |
| B3 | 🟠 High | `src/api/socket.ts` | URL normalization missing `KEY=VALUE` strip — socket connects to malformed URL if secret has `=` in value |
| B4 | 🟠 High | `app/trip-tracking.tsx` | `socket.off('ride:driver_location')` without handler reference removes ALL listeners globally |
| B5 | 🟠 High | `src/api/client.ts` | No auto-redirect to `/auth` on token refresh failure — app silently breaks |

### Functional Gaps

| # | Priority | Location | Description |
|---|---|---|---|
| G1 | 🟠 High | `app/(tabs)/profile.tsx` | Does not use `useProfile` — profile data shown from login session cache only |
| G2 | 🟠 High | `app/stations.tsx` | Shows 6 hardcoded stations from `constants/data.ts` — no API call |
| G3 | 🟠 High | `src/hooks/usePushToken.ts` | No Android notification channel setup — notifications silently dropped on Android 8+ |
| G4 | 🟡 Medium | `app/(tabs)/index.tsx` | Greeting name shows "VeeGo" hardcoded, not the logged-in user's name |
| G5 | 🟡 Medium | `app/(tabs)/index.tsx` | Route filter chips hardcoded to L01–L04, won't adapt to real route codes |
| G6 | 🟡 Medium | `src/constants/socketEvents.ts` | `passenger:join:trip` and `join` events defined but never emitted — server may require room join |
| G7 | 🟡 Medium | `src/constants/socketEvents.ts` | `ride:driver_arrived` event defined but app listens on `ride:arrived` — discrepancy |
| G8 | 🟡 Medium | `app/ticket.tsx` | Share button shows haptic only — no actual share sheet |
| G9 | 🟡 Medium | `app/trip-tracking.tsx` | Phone call button rendered but `onPress` missing `Linking.openURL('tel:...')` |
| G10 | 🟡 Medium | `src/api/socket.ts` | Socket token not refreshed after 401 token refresh — stale auth on long sessions |
| G11 | 🟢 Low | `context/FavoritesContext.tsx` | Favorites stored in AsyncStorage only — not synced to backend |
| G12 | 🟢 Low | `src/hooks/useNotifications.ts` | `markAllRead` optimistic update has no rollback on server error |
| G13 | 🟢 Low | `app/auth.tsx` ForgotForm | No OTP entry or password-reset UI — flow ends at confirmation screen |
| G14 | 🟢 Low | `src/hooks/usePushToken.ts` | No "Open Settings" prompt when push permission is denied |
| G15 | 🟢 Low | `app/(tabs)/wallet.tsx` | No real payment gateway — top-up is direct backend call only |

---

## 21. Security Notes

| Item | Status | Detail |
|---|---|---|
| Token storage (native) | ✅ Good | `expo-secure-store` (hardware-backed keychain) |
| Token storage (web) | ⚠️ Acceptable | `localStorage` — vulnerable to XSS but standard for SPAs |
| Password masking in logs | ✅ Good | `client.ts` redacts `password` field in console output |
| Token refresh loop protection | ✅ Good | `_retry` flag + raw axios for refresh call |
| Forgot-password enumeration | ✅ Good | Always shows success UI regardless of server response |
| Access token in socket auth | ✅ Good | Sent as `{ token }` in Socket.IO auth object, not in URL |
| `EXPO_PUBLIC_` prefix | ⚠️ Note | Any variable prefixed `EXPO_PUBLIC_` is bundled into the JS bundle and readable by any user of the app. Do not put sensitive values there. The backend URL is acceptable to expose; secrets/API keys must not use this prefix. |
| QR value exposure | ✅ Acceptable | QR encodes `{ bookingId, app, v }` — no tokens or PII |

---

## 22. Dependency Inventory

| Package | Version | Role |
|---|---|---|
| `expo` | ~54.0.0 | Core SDK |
| `expo-router` | ~6.0.23 | File-based navigation |
| `react` | ^19.1.0 | UI framework |
| `react-native` | ^0.81.5 | Native renderer |
| `react-dom` | ^19.1.0 | Web renderer |
| `react-native-web` | ^0.21.2 | RN → web bridge |
| `axios` | ^1.16.1 | HTTP client |
| `socket.io-client` | ^4.8.3 | WebSocket/real-time |
| `@tanstack/react-query` | ^5.100.14 | Installed but **not used** (all hooks use manual state) |
| `expo-secure-store` | ~15.0.8 | Token storage (native) |
| `@react-native-async-storage/async-storage` | ^2.2.0 | Session meta + favorites |
| `expo-notifications` | ^0.32.17 | Push + local notifications |
| `expo-location` | ~19.0.8 | GPS (car/bike pickup) |
| `expo-camera` | ^17.0.10 | Camera (QR scan?) |
| `react-native-maps` | ^1.20.1 | Native map rendering |
| `maplibre-gl` | ^5.24.0 | Web map rendering |
| `react-native-qrcode-svg` | ^6.3.21 | QR code display (native) |
| `react-native-svg` | ^15.12.1 | SVG support (QR dependency) |
| `react-native-reanimated` | ~4.1.1 | Animations |
| `expo-linear-gradient` | ~15.0.8 | Gradient backgrounds |
| `expo-haptics` | ~15.0.8 | Haptic feedback |
| `lucide-react-native` | ^1.17.0 | Icon library |
| `@expo-google-fonts/inter` | ^0.2.3 | Inter font family |
| `expo-splash-screen` | ~31.0.13 | Splash screen control |

> **Note:** `@tanstack/react-query` is installed and listed as a dependency but is not used anywhere in the codebase. All data fetching is done with manual `useState + useEffect + axios`. Either the dependency should be removed, or hooks should be migrated to use it for built-in caching, refetch, and loading state management.

---

*End of Audit — VeeGo Passenger App Integration Audit v1.0 — 2026-05-31*
