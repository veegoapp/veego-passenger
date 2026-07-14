# VeeGo Passenger App — Developer Onboarding

This document describes the **current state** of the repository as of this writing. It is a map, not a
design spec — if something here looks inconsistent with the code, trust the code and treat this doc as
stale for that detail.

Stack: Expo (React Native, Expo Router) + TypeScript, pnpm package manager, Axios for HTTP, Socket.IO
for realtime, React Context for app-wide state (no Redux/Zustand).

---

## 1. Repository Structure

```
app/                        Expo Router screens (file-based routing)
  _layout.tsx                Root layout — font/asset preload, provider tree, AppShell
  auth.tsx                   Sign in / sign up / forgot password (tabs, see components/auth)
  index.tsx                  Splash/redirect gate (session check → auth or tabs)
  verify-phone.tsx           OTP verification screen
  onboarding.tsx, lang-select.tsx, suspended.tsx, notifications.tsx, promo.tsx,
  receipt.tsx, review-confirm.tsx, stations.tsx, support.tsx, ticket.tsx,
  trip-detail.tsx, trip-tracking.tsx    Standalone (non-tab) screens
  (tabs)/                    Bottom-tab screens
    _layout.tsx               Tab bar config, reads TabBarContext for show/hide
    index.tsx                 Home (service picker: car/shuttle/scooter/delivery)
    routes.tsx                Shuttle route list
    trips.tsx                 Booking/ride history
    wallet.tsx                Wallet balance + recharge
    favorites.tsx             Saved destinations/routes
    profile.tsx                Profile screen (parent for components/profile/* modals)

components/                 UI components, grouped by domain
  car/                        Car (and shared car/scooter/delivery) ride flow UI
  shuttle/                    Shuttle booking flow UI
  shared/                     Cross-domain UI (maps, rating, cancel-reason, emergency contact, terms)
  profile/                    Profile screen's extracted modals + shared styles/hook
  auth/                       Auth screen's extracted forms + shared styles/helpers
  ui/                         Design-system primitives (AppLoader, VeeGoButton, VeeGoCard)
  wallet/                     Wallet-specific components (Paymob checkout modal)

src/api/                    All backend API access
  client.ts                   Axios instance, auth token attach/refresh, global error handling
  shuttleService.ts           Shuttle/booking REST calls (service-layer pattern)
  socket.ts                   Socket.IO connection lifecycle + ride status normalization
  session.ts                   Shared session/token persistence helpers (SESSION_KEY, saveSession, persistTokens)
  schemas.ts                   Dev-only zod "contract check" schemas for REST responses (diagnostic warnings, non-blocking)
  authEvents.ts                Lightweight pub/sub for auth:login / auth:logout
  normalizeApiUrl.ts           Sanitizes EXPO_PUBLIC_API_URL

src/hooks/                  Reusable stateful logic, grouped by domain
  car/                         useRide (ride lifecycle/socket), useRideChat
  shuttle/                     useRoutes, useShuttleSeatAvailability, useEnabledTripRequestRoutes
  shared/                      Cross-domain hooks (wallet, trips, notifications, tracking, profile, promos, push token, debt, favorites, background location)

src/utils/                  Small shared helpers
  errorMessages.ts, geoHelpers.ts, googleDirections.ts, imageCompression.ts

constants/                  Static config and design tokens
  colors.ts, typography.ts, spacing.ts, radius.ts, shadows.ts, animations.ts   Design tokens
  data.ts                      Shared TypeScript types (Route, Booking, ShuttleBookingMeta, DebtInfo, etc.)
  i18n.ts                      Thin barrel re-exporting translations from i18n/en.ts + i18n/ar.ts (t() lookup table)
  i18n/                        en.ts / ar.ts translation string tables
  socketEvents.ts              SOCKET_EVENTS name constants — mirrors the backend's socket-events file, keep in sync
  config.ts                    Map/API key notes (Directions API is proxied via backend)

context/                    App-wide React Context providers
  ThemeContext, TabBarContext, ServiceControlContext, PaymentConfigContext,
  BookingContext, FavoritesContext

lib/                        Does NOT exist in this repository.
  This item was requested for documentation but there is no lib/ directory —
  noted here explicitly so nobody goes looking for it.
```

---

## 2. Domain Map

VeeGo offers four services, surfaced from the same Home screen (`app/(tabs)/index.tsx`) and gated by
`ServiceControlContext` (`serviceType: 'car' | 'shuttle' | 'scooter' | 'delivery'`).

| Domain | Screens | Components | Hooks | API |
|---|---|---|---|---|
| **Car** | Reached via Home; ride flow rendered inline (no dedicated `app/` route) | `components/car/CarServiceScreen.tsx` (root flow), `CarMap`, `RideOptionsSheet`, `DriverSearching`, `DriverAssignedCard`, `ChatModal` | `src/hooks/car/useRide.ts`, `useRideChat.ts` | Ride endpoints via `src/api/client.ts` directly + realtime via `src/api/socket.ts` (`ride:*` events) |
| **Shuttle** | `app/(tabs)/routes.tsx`, `app/stations.tsx`, `app/trip-detail.tsx`, `app/ticket.tsx`, `app/trip-tracking.tsx` | `components/shuttle/RouteCard.tsx`, `TripSheet.tsx`, `ConfirmSheet.tsx`, `RequestTripSheet.tsx` | `src/hooks/shuttle/useRoutes.ts`, `useShuttleSeatAvailability.ts`, `useEnabledTripRequestRoutes.ts` | `src/api/shuttleService.ts` (dedicated service module — see §4) |
| **Scooter** | Reached via Home; rendered inline (no dedicated screen/component folder) | Handled inside `components/car/CarServiceScreen.tsx` via its `serviceType` prop | Reuses `src/hooks/car/useRide.ts` (see below) | Same ride endpoints as Car, via `client.ts`/`socket.ts` |
| **Delivery** | Reached via Home; rendered inline (no dedicated screen/component folder) | Handled inside `components/car/CarServiceScreen.tsx` via its `serviceType` prop (`'car' \| 'scooter' \| 'delivery'`) | Reuses `src/hooks/car/useRide.ts` | Same ride endpoints as Car/Scooter |

**Important:** Car, Scooter, and Delivery are **not three separate implementations** — they share one
flow (`CarServiceScreen` + `useRide`) parameterized by `serviceType`. Only Shuttle has its own dedicated
screen set, component folder, hook folder, and API service file. Keep this in mind before assuming
"scooter bug" or "delivery bug" lives in a scooter- or delivery-named file — it's almost always in
`CarServiceScreen.tsx` or `useRide.ts`.

---

## 3. Architecture

### Context responsibilities

Providers are nested in `app/_layout.tsx` in this order (outer → inner):

```
SafeAreaProvider
 └─ ThemeProvider            (colors, dark mode, language, RTL, t())
     └─ TabBarProvider       (bottom tab bar visibility toggle)
         └─ ServiceControlProvider   (per-service enabled/live/coming-soon flags, zone gating)
             └─ PaymentConfigProvider  (wallet feature flag, available payment methods)
                 └─ BookingProvider     (shuttle booking lifecycle — depends on ServiceControlProvider)
                     └─ FavoritesProvider  (favorited shuttle routes, AsyncStorage-backed)
                         └─ AppErrorBoundary
                             └─ AppShell   (renders the actual navigator)
```

Nesting order matters: `BookingProvider` reads `useServiceControl()` internally, so
`ServiceControlProvider` must be an ancestor (it is). `PaymentConfigProvider`/`BookingProvider`/
`FavoritesProvider` do not currently depend on each other but are nested in this fixed order.

- **ThemeContext** — theming (light/dark) + i18n (en/ar) + RTL mirroring. Used almost everywhere.
- **TabBarContext** — a single `visible`/`setVisible()` flag so full-screen sheets (e.g. `TripSheet`)
  can hide the bottom tab bar.
- **ServiceControlContext** — fetches `/services/control` on login (with retry/backoff), exposes
  per-service `{ isEnabled, displayMode, unavailableMessage, activeZoneIds }`, resolves the user's
  geo zone, and gates whether tapping a service on Home is allowed (`handleServiceTap`). Listens for
  `service:control:changed` over the socket for live admin updates.
- **PaymentConfigContext** — wallet/payment method availability, used by the wallet screen and
  shuttle booking confirmation.
- **BookingContext** — owns the entire shuttle booking UI state machine: `selectedRoute` →
  `tripSheetOpen` → `pendingBooking` → `confirmSheetOpen` → `activeBooking`/`confirmedBookingId`. See
  §4 for detail. Car/scooter/delivery rides do **not** use this context — their state lives in
  `useRide.ts` instead.
- **FavoritesContext** — favorited shuttle routes, persisted to `AsyncStorage`.

### Hook organization

`src/hooks/` is split by domain, mirroring `components/`:
- `car/` — ride-flow hooks shared by car, scooter, and delivery (`useRide`, `useRideChat`).
- `shuttle/` — shuttle-only data hooks (routes, seat availability, trip-request eligibility).
- `shared/` — anything used across 2+ domains (wallet, trip history, notifications, push tokens,
  passenger location tracking, profile data, promo codes, debt status, favorite destinations,
  background location task).

Convention: a hook talks to `src/api/*` (either the shared `client.ts` directly, or a dedicated
`*Service.ts` when one exists) and exposes plain state + callbacks — no direct screen/UI coupling.

### API service pattern

Two patterns currently coexist:
1. **Dedicated service module** (preferred, currently only `shuttleService.ts`): one file per domain,
   each exported `async function` wraps exactly one endpoint, unwraps the response envelope, and
   returns a typed/plain result. Hooks and contexts import named functions from it.
2. **Direct `api.*` calls** (car/scooter/delivery, most contexts): hooks and contexts call
   `api.get/post/delete` from `src/api/client.ts` inline, without an intermediate service file.

There is currently no `carService.ts`, `scooterService.ts`, or `deliveryService.ts` — those domains
call `client.ts` directly from `useRide.ts` and `CarServiceScreen.tsx`. This is a known inconsistency
(see §6), not a bug.

Additionally, `src/api/schemas.ts` provides dev-only zod "contract checks" for some REST responses
(auth tokens, profile, notifications, wallet, bookings): a failed `safeParse` logs a warning in dev
builds but never blocks or alters the response. This is diagnostic tooling, distinct from the
*enforcing* zod validation of socket events inside `useRide.ts`.

### Navigation structure

Expo Router, file-based:
- `app/_layout.tsx` is the root: font/asset preload → provider tree → `AppShell`.
- `app/(tabs)/_layout.tsx` defines the bottom-tab navigator (Home, Routes, Trips, Wallet, Favorites,
  Profile), reading `TabBarContext` to hide itself when a full-screen sheet is open.
- Everything outside `(tabs)/` (auth, verify-phone, ticket, trip-detail, trip-tracking, stations,
  receipt, review-confirm, promo, support, suspended, notifications, onboarding, lang-select) is a
  stacked screen pushed via `expo-router`'s `router.push/replace`.
- `app/index.tsx` is the entry redirect: checks stored session/token and routes to `/auth` or `/(tabs)`.

---

## 4. Important Files

### `context/BookingContext.tsx`
Owns the **shuttle** booking state machine end-to-end:
- `openRoute(route)` — fetches `/shuttle/lines/:id`, normalizes stations/trips, opens `TripSheet`.
- `handleBook(booking)` — closes `TripSheet`, stages `pendingBooking`, opens `ConfirmSheet` after a
  short delay (UX transition).
- `handleConfirm(promoCode?)` — re-checks `ServiceControlContext` at confirm-time (in case an admin
  disabled shuttle mid-flow), then `POST /bookings`, stores `confirmedBookingId`/`confirmedTripId`/
  `shuttleInfo`, joins the trip's socket room (`passenger:join:trip`), and navigates to `/ticket`.
  Handles 409 (duplicate booking vs. race-condition seat loss) with distinct user messaging.
- Also tracks `walletBalance` (refreshed each time a route is opened) and drives
  `usePassengerTracking` for the duration of a confirmed trip.
- This file is the source of truth for shuttle booking behavior — do not duplicate its logic
  elsewhere.

### `context/ServiceControlContext.tsx`
Central "is this service allowed right now, for this user" gate for all four domains:
- Fetches `/services/control` on `auth:login` (and on cold start if a token already exists), with
  exponential-backoff retry (up to 4 attempts) and a foreground-refresh listener via `AppState`.
- Resolves the user's zone via device location → `/zones/locate` (fails open — if location/zone
  resolution fails, `isServiceVisibleForZone` defaults to visible).
- `handleServiceTap(type, onAllow)` is the single chokepoint every "tap a service on Home" flow
  should call through — it fails closed (blocks) if there's no backend record for a service, and
  branches on `displayMode` (`live` / `coming_soon` / `unavailable` / `maintenance`).
- Subscribes to `service:control:changed` over the socket for live updates without polling.

### `src/api/client.ts`
The single Axios instance used by (almost) the whole app:
- Base URL from `EXPO_PUBLIC_API_URL` (normalized via `normalizeApiUrl.ts`).
- Request interceptor attaches `Authorization: Bearer <token>` from `expo-secure-store`.
- Response interceptor: on `401`, queues concurrent requests and attempts a single `/auth/refresh`
  call; on success, retries queued requests and triggers socket reconnection; on failure, clears
  tokens and redirects to `/auth` (or `/verify-phone` if OTP is required). On `403 account_suspended`,
  redirects to `/suspended`.
- This is the piece that makes token refresh "just work" for every screen — most feature code should
  never touch tokens directly.

### `src/api/shuttleService.ts`
The one domain with a fully realized service-layer pattern — a template for what other domains
*could* look like if extracted later (out of scope for this doc; see §6). Exposes: `getShuttleLines`,
`getShuttleLine`, `getTrip`, `getRouteStations`, `getMyBookings`, `getBooking`, `createBooking`,
`cancelBooking`, `getEnabledTripRequestRoutes`, `submitTripRequest`, `getMyDebt`,
`getTripAvailability`. Each function is a thin wrapper: call `client.ts`, unwrap the response
envelope, return.

### Major shuttle flow
Home → tap Shuttle → `app/(tabs)/routes.tsx` lists routes → tap a route calls
`BookingContext.openRoute()` → `TripSheet` (`components/shuttle/TripSheet.tsx`, the largest component
in the repo) renders trip times/seat picker, using `useShuttleSeatAvailability` for live seat counts
→ `handleBook()` → `ConfirmSheet` → `handleConfirm()` books and routes to `app/ticket.tsx`. Live trip
tracking after boarding is `app/trip-tracking.tsx` + `usePassengerTracking`.

### Major car flow
Home → tap Car (or Scooter/Delivery) → `CarServiceScreen` (with `serviceType` prop) handles
destination search/geocoding, ride estimate, `RideOptionsSheet` for economy/premium selection, then
`useRide.ts` drives the ride lifecycle over the socket (`ride:update`, driver assignment, waiting
charges, completion, cancellation — each payload validated with a `zod` schema before being applied
to state). `ChatModal`/`useRideChat` handle in-ride messaging.

---

## 5. Senior Engineer First-Week Guide

Recommended reading order:

1. **`app/_layout.tsx`** — see the provider tree and where the app actually starts.
2. **`context/ThemeContext.tsx`** — quick read; explains why every screen calls `useTheme()`.
3. **`src/api/client.ts`** — understand auth/token/refresh behavior before touching any API code.
4. **`context/ServiceControlContext.tsx`** — the gate that decides what a user can even tap into.
5. **Shuttle path** (most fully-formed domain, good template): `src/api/shuttleService.ts` →
   `context/BookingContext.tsx` → `components/shuttle/TripSheet.tsx` → `components/shuttle/ConfirmSheet.tsx`.
6. **Car/Scooter/Delivery path** (shared implementation): `components/car/CarServiceScreen.tsx` →
   `src/hooks/car/useRide.ts` → `src/api/socket.ts`.
7. **`app/auth.tsx`** + `components/auth/*` — login/signup/OTP/forgot-password flow (recently split
   into per-form components; `app/auth.tsx` is now just the tab-switching shell).
8. **`app/(tabs)/profile.tsx`** + `components/profile/*` — same split pattern applied to the profile
   screen's modals.
9. Skim **`constants/data.ts`** for the shared domain types (`Route`, `Booking`,
   `ShuttleBookingMeta`, `DebtInfo`) referenced throughout.

Don't start by reading the translation tables (`constants/i18n/en.ts` + `ar.ts`, ~686 lines each,
re-exported via the thin `constants/i18n.ts` barrel) top to bottom — they're the largest files in the
repo but they're just string tables, not logic.

---

## 6. Known Risks

**Large files** (may be worth splitting further in future work, not touched here):
- `constants/i18n/en.ts` + `constants/i18n/ar.ts` (~686 lines each) — flat English/Arabic string
  tables behind the `constants/i18n.ts` barrel; large but low-risk, purely data.
- `components/shuttle/TripSheet.tsx` (~959 lines) — the largest *logic* file in the repo; owns trip
  time selection, seat picking, pricing display, and the insufficient-balance gate. High-traffic file
  for shuttle bugs.
- `app/trip-detail.tsx` (~825 lines), `app/(tabs)/index.tsx` (~735 lines), `src/hooks/car/useRide.ts`
  (~609 lines), `app/review-confirm.tsx` (~590 lines), `app/ticket.tsx` (~564 lines).

**Duplicated / inconsistent areas:**
- **Service-layer pattern is inconsistent**: only `shuttleService.ts` exists as a dedicated service
  module. Car, scooter, delivery, wallet, and most contexts call `client.ts` directly inline. This is
  the single biggest structural inconsistency in the codebase — don't assume a `*Service.ts` file
  exists for a domain just because one exists for shuttle.
- **Session/token helpers are now unified** in `src/api/session.ts` (`SESSION_KEY`, `saveSession`,
  `persistTokens`) — the previous per-screen copies were consolidated there. Auth form components
  still import them via a compatibility re-export in `components/auth/shared.tsx`.
- **Car/Scooter/Delivery share one implementation** (`CarServiceScreen.tsx` + `useRide.ts`)
  parameterized by `serviceType` — this is intentional reuse, not accidental duplication, but it means
  a "scooter-only" bug report may require reading car-named files.
- A `lib/` directory does not exist despite sometimes being referenced in task/doc templates —
  utility code instead lives under `src/api/`, `src/hooks/`, or inline in components.

**Sensitive areas** (high blast-radius if changed carelessly):
- `src/api/client.ts` — token refresh/interceptor logic; a mistake here can silently break auth for
  the entire app.
- `context/ServiceControlContext.tsx` — the fail-open (zone) / fail-closed (missing service data)
  logic is deliberate; changing the default direction of either could make a bad rollout enable a
  service everywhere or disable it everywhere.
- `context/BookingContext.tsx#handleConfirm` — real money/wallet debit and seat allocation; the
  409 duplicate-vs-race-condition branching and the re-check of `ServiceControlContext` at confirm
  time are both deliberate safety checks, not incidental code.
- `src/api/socket.ts` and any `ride:*`/`service:control:changed`/`passenger:join:trip` socket event
  names — these are a live contract with the backend; renaming or restructuring payloads here is a
  cross-service change, not a local refactor. Event names are centralized as constants in
  `constants/socketEvents.ts`, which mirrors the backend's socket-events file and must be kept in
  sync with it.
- `src/hooks/car/useRide.ts` — ride state machine validated with `zod` schemas per socket event; this
  is the most complex single hook in the app and backs three of the four service domains.

---

*This document reflects the repository as of the time it was written. It was generated by reading the
current source directly and does not encode any planned or in-progress changes.*
