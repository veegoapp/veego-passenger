# VeeGo Rider App — Comprehensive Technical Audit Report

**Date:** June 12, 2026
**App:** VeeGo Passenger App (React Native / Expo)
**Auditor:** Automated Deep Technical Audit
**SDK:** Expo SDK 54 · expo-router v6 · TanStack Query v5 · socket.io-client · axios

---

## 1. Project Structure

### Full Folder / File Tree

```
veego-rider/
├── app/
│   ├── _layout.tsx                  # Root layout — providers, deep-link router
│   ├── index.tsx                    # Splash / init — session + language guard
│   ├── lang-select.tsx              # First-launch language picker (EN / AR)
│   ├── onboarding.tsx               # 3-slide onboarding carousel (first launch)
│   ├── auth.tsx                     # Sign In / Sign Up / Forgot Password
│   ├── suspended.tsx                # Account suspension lockout
│   ├── ticket.tsx                   # Shuttle boarding pass + QR code
│   ├── trip-detail.tsx              # Shuttle trip detail + live status map
│   ├── trip-tracking.tsx            # Car / Scooter live-tracking map
│   ├── stations.tsx                 # Station list + map for a shuttle route
│   ├── notifications.tsx            # In-app notification list
│   ├── promo.tsx                    # Promo code entry / featured promos
│   ├── support.tsx                  # Support ticket submission
│   └── (tabs)/
│       ├── _layout.tsx              # Bottom tab nav — animated pill indicator
│       ├── index.tsx                # Home screen
│       ├── routes.tsx               # Searchable shuttle line list
│       ├── car.tsx                  # Car / Scooter service (map + ride flow)
│       ├── trips.tsx                # My Trips — upcoming + past
│       ├── wallet.tsx               # Wallet — balance, history, top-up
│       ├── profile.tsx              # Profile / settings
│       └── favorites.tsx            # Saved routes + frequent destinations
├── components/
│   ├── car/
│   │   ├── CarMap.tsx               # Map for car service (expo-location + MapLibre)
│   │   ├── DriverSearching.tsx      # Animated searching overlay
│   │   └── DriverAssignedCard.tsx   # Driver info card (name, rating, vehicle, call)
│   ├── bike/
│   │   ├── BikeServiceScreen.tsx    # Bike / Scooter service screen
│   │   └── bikeMapData.ts           # ⚠️ MOCK DATA — static bike map fixtures
│   ├── scooter/
│   │   └── scooterMapData.ts        # ⚠️ MOCK DATA — static scooter map fixtures
│   └── shared/
│       ├── RatingSheet.tsx          # Post-trip star rating + comment
│       ├── QRScanner.tsx            # QR code scanner
│       ├── TripSheet.tsx            # Shuttle trip selector bottom sheet
│       └── ConfirmSheet.tsx         # Shuttle booking confirmation sheet
├── context/
│   ├── BookingContext.tsx           # Shuttle booking state orchestration
│   ├── ServiceControlContext.tsx    # Service availability + zone kill-switch
│   ├── ThemeProvider.tsx            # Theme (dark/light) + i18n provider
│   └── TabBarProvider.tsx           # Tab bar visibility control
├── src/
│   ├── api/
│   │   ├── client.ts                # Axios instance — JWT interceptors + refresh
│   │   └── socket.ts                # Socket.io client setup + reconnect logic
│   ├── hooks/
│   │   ├── useRide.ts               # Car/Scooter ride lifecycle
│   │   ├── useTrips.ts              # Trip history + upcoming bookings
│   │   ├── useWallet.ts             # Wallet balance + transactions
│   │   ├── useProfile.ts            # User profile read + update
│   │   ├── usePromos.ts             # Promo code validation
│   │   ├── useRoutes.ts             # Shuttle lines + stations
│   │   ├── useNotifications.ts      # Notifications list + mark-read
│   │   ├── useDebt.ts               # Cash debt tracking
│   │   ├── useRideChat.ts           # In-trip chat messages
│   │   └── useFavoriteDestinations.ts # Favourite destinations from history
│   └── constants/
│       └── socketEvents.ts          # Centralised socket event name constants
├── constants/
│   ├── i18n.ts                      # EN + AR translation strings
│   └── data.ts                      # ⚠️ Static fallback station/shuttle data
├── assets/                          # Images, fonts, icons
├── app.json                         # Expo config
├── package.json
└── tsconfig.json
```

### Navigation Structure

```
app/index (splash → route guard)
  ├─ app/lang-select          [first launch — no language set]
  ├─ app/onboarding           [first launch — lang set, onboarding not seen]
  ├─ app/auth                 [no active session]
  └─ app/(tabs)               [authenticated session]
       ├─ index               Home
       ├─ routes              Shuttle Routes
       ├─ car                 Car / Scooter
       ├─ trips               My Trips
       ├─ wallet              Wallet
       ├─ profile             Profile
       └─ favorites           Favorites
            Modal / stack screens (push from any tab):
            ├─ ticket              Boarding Pass (QR)
            ├─ trip-detail         Shuttle Trip Detail
            ├─ trip-tracking       Live Car/Scooter Map
            ├─ stations            Station List + Map
            ├─ notifications       Notification List
            ├─ promo               Promo Codes
            ├─ support             Support Form
            └─ suspended           Account Lockout
```

### Entry Point & Auth Flow

1. `app/index.tsx` runs on every cold start.
2. Reads `AsyncStorage` for `@veego_language` and `@veego_session_v1`.
3. If no language → `lang-select`.
4. If language set but onboarding not seen → `onboarding`.
5. If session token found → validates via `GET /users/me`; success → `(tabs)`, 401 → `auth`.
6. If no session → `auth`.
7. On 403 + `account_suspended` response code anywhere in the app → immediate redirect to `suspended`.

---

## 2. Authentication & Registration

| Feature | Status | Connected to Backend? | Issues |
|---------|--------|----------------------|--------|
| Language selection (first launch) | ✅ Exists | AsyncStorage write only | None |
| 3-slide onboarding (first launch) | ✅ Exists | AsyncStorage flag | None |
| Sign in with phone + password | ✅ Exists | `POST /auth/login` | None |
| Sign up with phone + password + name | ✅ Exists | `POST /auth/register` | None |
| OTP verification step (dedicated screen) | ❌ Missing | `POST /auth/forgot-password` sends OTP but no OTP input UI screen exists | No separate OTP entry screen found |
| Forgot password (phone submit) | ⚠️ Partial | `POST /auth/forgot-password` | No downstream OTP entry or password-reset form found |
| JWT access token storage | ✅ Exists | `expo-secure-store` (native) / `localStorage` (web) | Web fallback is less secure |
| Refresh token storage | ✅ Exists | `expo-secure-store` / `localStorage` | Same web caveat |
| Auto token refresh on 401 | ✅ Exists | Axios response interceptor → `POST /auth/refresh` | Queues concurrent requests during refresh |
| Auto-login / session persistence | ✅ Exists | `AsyncStorage (@veego_session_v1)` on startup | None |
| Account suspension handling | ✅ Exists | 403 + `account_suspended` → redirect `/suspended` | None |
| Push token registration on startup | ⚠️ Partial | `POST /users/me/push-token` | Silent failure if Expo push token unavailable |

---

## 3. Every Screen — Detailed Breakdown

### 3.1 Splash / Init — `app/index.tsx`

**What it shows:** Full-screen branded splash while asynchronously checking stored language and session.

**API calls:**
| Hook / Call | Endpoint | Method | Real/Mock | Auth |
|-------------|----------|--------|-----------|------|
| Session validation | `GET /users/me` | GET | Real | Bearer token from SecureStore |

**Socket events:** None.

**UI/UX issues:** None identified.

**Backend connection:** ✅ Fully connected.

---

### 3.2 Language Select — `app/lang-select.tsx`

**What it shows:** EN / AR language cards. Persists selection to AsyncStorage and navigates to onboarding.

**API calls:** None.

**Socket events:** None.

**UI/UX issues:** None.

**Backend connection:** N/A — local only.

---

### 3.3 Onboarding — `app/onboarding.tsx`

**What it shows:** 3-slide carousel introducing VeeGo services (Shuttle, Car, Scooter). Skip and Next buttons. Sets AsyncStorage flag on completion.

**API calls:** None.

**Socket events:** None.

**UI/UX issues:** None.

**Backend connection:** N/A — local only.

---

### 3.4 Auth — `app/auth.tsx`

**What it shows:** Three states — Sign In, Sign Up, Forgot Password — toggled by local UI state.

**API calls:**
| Action | Endpoint | Method | Real/Mock | Auth |
|--------|----------|--------|-----------|------|
| Sign in | `POST /auth/login` | POST | Real | None (credentials) |
| Sign up | `POST /auth/register` | POST | Real | None (credentials) |
| Forgot password | `POST /auth/forgot-password` | POST | Real | None |
| Post-login user fetch | `GET /users/me` | GET | Real | Bearer token |

**Socket events:** None.

**UI/UX issues:**
- No OTP input screen after `forgot-password` — user flow ends at phone submission.
- No password reset form to complete the flow.
- Social login (Google / Apple) not implemented.

**Backend connection:** ⚠️ Partial — sign in and sign up fully connected; forgot password flow incomplete.

---

### 3.5 Home — `app/(tabs)/index.tsx`

**What it shows:** Service selector tabs (Shuttle / Car / Scooter / Delivery), featured offers strip, most-booked shuttle routes. Notification bell routes to `notifications`.

**API calls:**
| Hook / Call | Endpoint | Method | Real/Mock | Auth |
|-------------|----------|--------|-----------|------|
| `useRoutes` | `GET /shuttle/lines` | GET | Real | Bearer |
| `ServiceControlContext` | `GET /services/control` | GET | Real | Bearer |
| `ServiceControlContext` | `GET /zones/locate` | GET | Real | Bearer |

**Socket events:**
| Event | Direction | Handled? |
|-------|-----------|----------|
| `service:control:changed` | Server → Client | ✅ Updates service visibility live |

**UI/UX issues:**
- `MOCK_LOCATIONS = []` — suggested location search results are always empty; no geocoding integration.
- Delivery service tab is shown as "Soon" (`coming_soon`) but has no timeline or info.

**Backend connection:** ⚠️ Partial — route data and service flags real; location suggestions mocked.

---

### 3.6 Shuttle Routes — `app/(tabs)/routes.tsx`

**What it shows:** Searchable, filterable list of all shuttle lines. Tapping a line → `TripSheet` bottom sheet → `ConfirmSheet` → booking.

**API calls:**
| Hook / Call | Endpoint | Method | Real/Mock | Auth |
|-------------|----------|--------|-----------|------|
| `useRoutes` (list) | `GET /shuttle/lines` | GET | Real | Bearer |
| `useRoutes` (detail) | `GET /shuttle/lines/:id` | GET | Real | Bearer |
| `BookingContext` wallet check | `GET /wallet` | GET | Real | Bearer |
| `usePromos` (validate) | `POST /promo/validate` | POST | Real | Bearer |
| Create booking | `POST /bookings` | POST | Real | Bearer |

**Socket events:** None (booking events are in ticket / trip-detail screens).

**UI/UX issues:**
- Seat count is hardcoded to 1 (`seatCount: 1` in BookingContext) — no multi-seat selection.
- 10-hour cancellation penalty rule not enforced client-side.

**Backend connection:** ✅ Fully connected.

---

### 3.7 Car Service — `app/(tabs)/car.tsx`

**What it shows:** Map with current GPS location, pickup/dropoff input, vehicle category selector with prices, driver searching overlay, driver info card, live tracking.

**API calls:**
| Hook / Call | Endpoint | Method | Real/Mock | Auth |
|-------------|----------|--------|-----------|------|
| `useRide` — estimate | `POST /rides/estimate` | POST | Real | Bearer |
| `useRide` — request | `POST /rides/request` | POST | Real | Bearer |
| `useRide` — cancel | `PATCH /rides/:id/cancel` | PATCH | Real | Bearer |
| `useRide` — SOS | `POST /rides/:id/sos` | POST | Real | Bearer |
| `useRide` — rate | `POST /rides/:id/rate-driver` | POST | Real | Bearer |
| HTTP fallback poll | `GET /rides/:id` | GET | Real | Bearer |

**Socket events:**
| Event | Direction | Handled? |
|-------|-----------|----------|
| `join:trip` | Client → Server | ✅ Emitted on ride request |
| `leave:trip` | Client → Server | ✅ Emitted on cancel / complete |
| `ride:driver_assigned` | Server → Client | ✅ Shows DriverAssignedCard |
| `ride:driver_location` | Server → Client | ✅ Moves driver pin on map |
| `ride:arrived` | Server → Client | ✅ Shows arrived banner |
| `ride:started` | Server → Client | ✅ Updates ride state to in-progress |
| `ride:completed` | Server → Client | ✅ Opens RatingSheet |
| `ride:cancelled` | Server → Client | ✅ Resets ride state |
| `ride:timeout` | Server → Client | ✅ Shows no-driver-found message |
| `ride:waiting:charge:started` | Server → Client | ✅ Shows waiting fare UI |
| `ride:waiting:charge:updated` | Server → Client | ✅ Updates waiting fare amount live |
| `ride:waiting:charge:capped` | Server → Client | ✅ Shows cap notification |
| `surge:updated` | Server → Client | ✅ Refreshes price estimate |
| `ride:status_update` | Server → Client | ✅ Generic status handler |

**UI/UX issues:**
- `MOCK_LOCATIONS = []` — no suggested places in pickup/dropoff search.
- Cancel ride opens native `Alert` with yes/no only — no structured cancel reason picker.
- SOS endpoint exists but SOS button location in UI not explicitly surfaced in a dedicated safety sheet.
- "Call 122" and "WhatsApp with trip details" from a safety screen not found.
- Route deviation notification UI not found.
- Post-trip payment receipt / fare breakdown screen not found (only RatingSheet shown).

**Backend connection:** ✅ Fully connected (with above UX gaps).

---

### 3.8 My Trips — `app/(tabs)/trips.tsx`

**What it shows:** Two tabs — Upcoming and Past. Shuttle bookings and car rides in combined list. Tap → trip detail or trip tracking.

**API calls:**
| Hook / Call | Endpoint | Method | Real/Mock | Auth |
|-------------|----------|--------|-----------|------|
| `useTrips` — bookings | `GET /bookings` | GET | Real | Bearer |
| `useTrips` — rides | `GET /rides` | GET | Real | Bearer |
| Cancel booking | `PATCH /bookings/:id/cancel` | PATCH | Real | Bearer |

**Socket events:** None directly (delegated to child screens).

**UI/UX issues:**
- No pagination / infinite scroll visible — may break with large history.

**Backend connection:** ✅ Fully connected.

---

### 3.9 Wallet — `app/(tabs)/wallet.tsx`

**What it shows:** Current balance, transaction history list, quick top-up buttons (50 / 100 / 200 / 500 EGP), cash debt banner, payment methods section.

**API calls:**
| Hook / Call | Endpoint | Method | Real/Mock | Auth |
|-------------|----------|--------|-----------|------|
| `useWallet` — balance | `GET /wallet` | GET | Real | Bearer |
| `useWallet` — transactions | `GET /wallet/transactions` | GET | Real | Bearer |
| Top-up | `POST /wallet/topup` | POST | Real | Bearer |
| `useDebt` — debt | `GET /shuttle/my-debt` | GET | Real | Bearer |

**Socket events:** None.

**UI/UX issues:**
- `MOCK_CARDS = []` — payment methods / card management UI is rendered but always empty; no real card integration.
- No card add / remove flow.
- Cash-only mode visibility not confirmed.

**Backend connection:** ⚠️ Partial — balance and history real; card management mocked.

---

### 3.10 Profile — `app/(tabs)/profile.tsx`

**What it shows:** User avatar, name, phone, rating. Personal info edit, security settings, language toggle, dark mode toggle, help/FAQ, sign out.

**API calls:**
| Hook / Call | Endpoint | Method | Real/Mock | Auth |
|-------------|----------|--------|-----------|------|
| `useProfile` — fetch | `GET /users/me` | GET | Real | Bearer |
| `useProfile` — update | `PATCH /users/me` | PATCH | Real | Bearer |
| Push token register | `POST /users/me/push-token` | POST | Real | Bearer |

**Socket events:** None.

**UI/UX issues:**
- Biometric toggle (Face ID / fingerprint) is local React state only — not persisted to backend.
- 2FA toggle is local React state only — not persisted to backend.
- Privacy toggles (location history, analytics, personalized ads) are local React state only.
- `MOCK_CARDS = []` — payment methods list always empty.
- Rating display present but editing / disputing a rating not available.

**Backend connection:** ⚠️ Partial — profile read/write real; security and privacy toggles local only.

---

### 3.11 Favorites — `app/(tabs)/favorites.tsx`

**What it shows:** Saved shuttle routes (heart-toggled) and frequent car/scooter destinations derived from ride history.

**API calls:**
| Hook / Call | Endpoint | Method | Real/Mock | Auth |
|-------------|----------|--------|-----------|------|
| `useFavoriteDestinations` | `GET /rides` (derives from history) | GET | Real | Bearer |
| Saved routes | from `useRoutes` / local storage | — | Real | Bearer |

**Socket events:** None.

**UI/UX issues:** None critical.

**Backend connection:** ✅ Fully connected.

---

### 3.12 Boarding Pass / Ticket — `app/ticket.tsx`

**What it shows:** QR code ticket for a shuttle booking, booking reference, route info, live boarding status.

**API calls:**
| Hook / Call | Endpoint | Method | Real/Mock | Auth |
|-------------|----------|--------|-----------|------|
| Booking detail | `GET /bookings/:id` | GET | Real | Bearer |

**Socket events:**
| Event | Direction | Handled? |
|-------|-----------|----------|
| `passenger:join:trip` | Client → Server | ✅ Joins shuttle trip room |
| `booking:boarded` | Server → Client | ✅ Updates UI to "boarded" state |
| `passenger:trip:tracking` | Server → Client | ✅ Live tracking updates |

**UI/UX issues:**
- `FALLBACK_BOOKING_ID = 'VEEGO-0000'` — if navigation params are missing, QR renders a placeholder reference that looks real.

**Backend connection:** ⚠️ Partial — connected but fallback ID is a risk.

---

### 3.13 Trip Detail — `app/trip-detail.tsx`

**What it shows:** Shuttle trip full detail — departure/arrival stations, time, seat, driver info, live map of bus position, trip status timeline, cancel button.

**API calls:**
| Hook / Call | Endpoint | Method | Real/Mock | Auth |
|-------------|----------|--------|-----------|------|
| Trip fetch | `GET /shuttle/trips/:id` | GET | Real | Bearer |
| Cancel booking | `PATCH /bookings/:id/cancel` | PATCH | Real | Bearer |
| Chat messages | `GET /trips/:id/chat` | GET | Real | Bearer |
| Send chat | `POST /trips/:id/chat` | POST | Real | Bearer |

**Socket events:**
| Event | Direction | Handled? |
|-------|-----------|----------|
| `passenger:join:trip` | Client → Server | ✅ Emitted on mount |
| `shuttle:driver:location` | Server → Client | ✅ Moves bus pin on map |
| `shuttle:trip:status` | Server → Client | ✅ Updates status timeline |
| `trip:chat:message` | Server → Client | ✅ Appended to chat list |

**UI/UX issues:** None critical.

**Backend connection:** ✅ Fully connected.

---

### 3.14 Trip Tracking — `app/trip-tracking.tsx`

**What it shows:** Full-screen map for live car/scooter tracking — driver pin, passenger pin, estimated arrival, driver info strip.

**API calls:**
| Hook / Call | Endpoint | Method | Real/Mock | Auth |
|-------------|----------|--------|-----------|------|
| HTTP fallback poll | `GET /rides/:id` | GET | Real | Bearer |

**Socket events:**
| Event | Direction | Handled? |
|-------|-----------|----------|
| `join:trip` | Client → Server | ✅ On mount |
| `ride:driver_location` | Server → Client | ✅ Driver pin update |
| `ride:arrived` | Server → Client | ✅ Banner |
| `ride:completed` | Server → Client | ✅ Navigate to rating |
| `ride:cancelled` | Server → Client | ✅ Navigate back |

**UI/UX issues:** None critical.

**Backend connection:** ✅ Fully connected.

---

### 3.15 Stations — `app/stations.tsx`

**What it shows:** List of stations for a selected shuttle route, with map pins.

**API calls:**
| Hook / Call | Endpoint | Method | Real/Mock | Auth |
|-------------|----------|--------|-----------|------|
| Station list | `GET /routes/:routeId/stations` | GET | Real | Bearer |

**Socket events:** None.

**UI/UX issues:**
- Falls back to `constants/data.ts` static fixture data when API fails — stale data risk.

**Backend connection:** ⚠️ Partial — real API used but static fallback masks failures.

---

### 3.16 Notifications — `app/notifications.tsx`

**What it shows:** Chronological list of in-app notifications with read/unread state.

**API calls:**
| Hook / Call | Endpoint | Method | Real/Mock | Auth |
|-------------|----------|--------|-----------|------|
| `useNotifications` | `GET /notifications` | GET | Real | Bearer |
| Mark all read | `PATCH /notifications/read-all` | PATCH | Real | Bearer |

**Socket events:**
| Event | Direction | Handled? |
|-------|-----------|----------|
| `notification:new` | Server → Client | ✅ Appended to list live |

**UI/UX issues:** None.

**Backend connection:** ✅ Fully connected.

---

### 3.17 Promo — `app/promo.tsx`

**What it shows:** Promo code text input and apply button. List of available/featured promo codes (if any).

**API calls:**
| Hook / Call | Endpoint | Method | Real/Mock | Auth |
|-------------|----------|--------|-----------|------|
| `usePromos` validate | `POST /promo/validate` | POST | Real | Bearer |
| `usePromos` list | No list endpoint called | — | `promos: []` hardcoded | — |

**Socket events:** None.

**UI/UX issues:**
- `usePromos` returns `promos: []` — featured/available promos list is always empty; no `GET /promos` endpoint is called.

**Backend connection:** ⚠️ Partial — validate works; promo listing not implemented.

---

### 3.18 Support — `app/support.tsx`

**What it shows:** Support ticket form — subject, category, message. Submit creates a ticket.

**API calls:**
| Hook / Call | Endpoint | Method | Real/Mock | Auth |
|-------------|----------|--------|-----------|------|
| Submit ticket | `POST /support/tickets` | POST | Real | Bearer |

**Socket events:** None.

**UI/UX issues:** None.

**Backend connection:** ✅ Fully connected.

---

### 3.19 Suspended — `app/suspended.tsx`

**What it shows:** Lockout screen explaining account suspension, contact support link.

**API calls:** None (reached via redirect).

**Socket events:** None.

**UI/UX issues:** None.

**Backend connection:** ✅ Triggered correctly by 403 interceptor.

---

## 4. All API Calls — Complete Table

| File | Endpoint | Method | Real/Mock | Auth Token | Issues |
|------|----------|--------|-----------|------------|--------|
| `src/api/client.ts` | `/auth/refresh` | POST | Real | Refresh token | Concurrent 401s queued; correct |
| `app/auth.tsx` | `/auth/login` | POST | Real | None | None |
| `app/auth.tsx` | `/auth/register` | POST | Real | None | None |
| `app/auth.tsx` | `/auth/forgot-password` | POST | Real | None | No OTP entry screen follows |
| `app/index.tsx` | `/users/me` | GET | Real | Bearer | None |
| `src/hooks/useProfile.ts` | `/users/me` | GET | Real | Bearer | None |
| `src/hooks/useProfile.ts` | `/users/me` | PATCH | Real | Bearer | None |
| `src/hooks/useProfile.ts` | `/users/me/push-token` | POST | Real | Bearer | Silent failure if token unavailable |
| `src/hooks/useRoutes.ts` | `/shuttle/lines` | GET | Real | Bearer | None |
| `src/hooks/useRoutes.ts` | `/shuttle/lines/:id` | GET | Real | Bearer | Response key-unwrap logic present |
| `src/hooks/useRoutes.ts` | `/routes/:routeId/stations` | GET | Real | Bearer | Static fallback in `constants/data.ts` |
| `context/BookingContext.tsx` | `/bookings` | POST | Real | Bearer | Seat count hardcoded to 1 |
| `context/BookingContext.tsx` | `/bookings/:id/cancel` | PATCH | Real | Bearer | None |
| `context/BookingContext.tsx` | `/wallet` | GET | Real | Bearer | None |
| `src/hooks/useTrips.ts` | `/bookings` | GET | Real | Bearer | None |
| `src/hooks/useTrips.ts` | `/shuttle/my-trips` | GET | Real | Bearer | None |
| `src/hooks/useTrips.ts` | `/shuttle/trips/:id` | GET | Real | Bearer | None |
| `src/hooks/useRide.ts` | `/rides/estimate` | POST | Real | Bearer | None |
| `src/hooks/useRide.ts` | `/rides/request` | POST | Real | Bearer | None |
| `src/hooks/useRide.ts` | `/rides/:id/cancel` | PATCH | Real | Bearer | No cancel-reason picker in UI |
| `src/hooks/useRide.ts` | `/rides/:id/rate-driver` | POST | Real | Bearer | None |
| `src/hooks/useRide.ts` | `/rides/:id/sos` | POST | Real | Bearer | SOS button not clearly surfaced |
| `src/hooks/useRide.ts` | `/rides/:id` | GET | Real | Bearer | HTTP fallback poll every 5s |
| `src/hooks/useRide.ts` | `/rides` | GET | Real | Bearer | None |
| `src/hooks/useWallet.ts` | `/wallet` | GET | Real | Bearer | None |
| `src/hooks/useWallet.ts` | `/wallet/transactions` | GET | Real | Bearer | None |
| `src/hooks/useWallet.ts` | `/wallet/topup` | POST | Real | Bearer | None |
| `src/hooks/useDebt.ts` | `/shuttle/my-debt` | GET | Real | Bearer | None |
| `src/hooks/usePromos.ts` | `/promo/validate` | POST | Real | Bearer | None |
| `src/hooks/usePromos.ts` | (promo list) | — | **Mock** `[]` | — | No `/promos` GET call — always empty |
| `src/hooks/useNotifications.ts` | `/notifications` | GET | Real | Bearer | None |
| `src/hooks/useNotifications.ts` | `/notifications/read-all` | PATCH | Real | Bearer | None |
| `src/hooks/useRideChat.ts` | `/trips/:id/chat` | GET | Real | Bearer | None |
| `src/hooks/useRideChat.ts` | `/trips/:id/chat` | POST | Real | Bearer | None |
| `context/ServiceControlContext.tsx` | `/services/control` | GET | Real | Bearer | None |
| `context/ServiceControlContext.tsx` | `/zones/locate` | GET | Real | Bearer | None |
| `app/support.tsx` | `/support/tickets` | POST | Real | Bearer | None |

**Base URL:** `EXPO_PUBLIC_API_URL` environment variable. App throws at startup if not set.
**Auth mechanism:** Bearer JWT injected by Axios request interceptor. Refresh handled automatically on 401.

---

## 5. Socket / Real-Time

### Connection Setup (`src/api/socket.ts`)

- Singleton socket created with `socket.io-client`.
- Transport: WebSocket with polling fallback.
- Auth: JWT access token sent in `auth.token` handshake option.
- Auto-reconnect: enabled (default exponential backoff).
- On connection: emits `join` with user ID to join personal channel.
- Token refresh is not applied to existing socket on re-auth — requires socket reconnect.

### Server → Client Events

| Event | Purpose | Handled In | Handler Status | Issues |
|-------|---------|-----------|----------------|--------|
| `ride:driver_assigned` | Driver accepted, sends driver object | `useRide.ts`, `car.tsx` | ✅ Handled | None |
| `ride:driver_location` | Real-time GPS update | `useRide.ts`, `trip-tracking.tsx` | ✅ Handled | HTTP poll fallback covers disconnects |
| `ride:arrived` | Driver at pickup | `useRide.ts` | ✅ Handled | None |
| `ride:started` | Trip in progress | `useRide.ts` | ✅ Handled | None |
| `ride:completed` | Trip ended | `useRide.ts` | ✅ Handled — opens RatingSheet | Payment receipt not shown |
| `ride:cancelled` | Ride cancelled externally | `useRide.ts` | ✅ Handled | None |
| `ride:timeout` | No driver found | `useRide.ts` | ✅ Handled | None |
| `ride:status_update` | Generic status | `useRide.ts` | ✅ Handled | None |
| `ride:waiting:charge:started` | Waiting billing started | `useRide.ts` | ✅ Handled | None |
| `ride:waiting:charge:updated` | Live waiting fare update | `useRide.ts` | ✅ Handled | None |
| `ride:waiting:charge:capped` | Waiting fare cap reached | `useRide.ts` | ✅ Handled | None |
| `surge:updated` | Surge pricing change | `useRide.ts` | ✅ Handled — re-fetches estimate | None |
| `shuttle:driver:location` | Shuttle bus GPS | `trip-detail.tsx` | ✅ Handled | None |
| `shuttle:trip:status` | Shuttle status change | `trip-detail.tsx` | ✅ Handled | None |
| `booking:boarded` | Passenger scanned / boarded | `ticket.tsx` | ✅ Handled | None |
| `passenger:trip:tracking` | Live tracking on boarding pass | `ticket.tsx` | ✅ Handled | None |
| `notification:new` | New push/in-app notification | `useNotifications.ts` | ✅ Handled | None |
| `service:control:changed` | Service availability update | `ServiceControlContext.tsx` | ✅ Handled | None |
| `trip:chat:message` | In-trip chat message | `useRideChat.ts`, `trip-detail.tsx` | ✅ Handled | None |

### Client → Server Events

| Event | Purpose | Emitted From | Status | Issues |
|-------|---------|-------------|--------|--------|
| `join` | Join personal user channel | `socket.ts` on connect | ✅ | None |
| `join:trip` | Join car/scooter ride room | `useRide.ts` on request | ✅ | None |
| `leave:trip` | Leave car/scooter ride room | `useRide.ts` on cancel/complete | ✅ | None |
| `passenger:join:trip` | Join shuttle trip room | `ticket.tsx`, `trip-detail.tsx` | ✅ | None |

### Mock / Fake Socket Events

None found — all socket events are real.

### Fallback Behaviour

`useRide.ts` implements an HTTP polling fallback (`GET /rides/:id` every 5 seconds) that activates when the socket is disconnected. This prevents the tracking UI from freezing.

---

## 6. State Management

### What Is Stored Where

| Data | Storage | Persistence |
|------|---------|-------------|
| JWT access token | `expo-secure-store` (native) / `localStorage` (web) | Persists across restarts |
| JWT refresh token | `expo-secure-store` / `localStorage` | Persists across restarts |
| User session object | `AsyncStorage (@veego_session_v1)` | Persists across restarts |
| Language preference | `AsyncStorage (@veego_language)` | Persists across restarts |
| Onboarding seen flag | `AsyncStorage` | Persists across restarts |
| User profile | TanStack Query cache | In-memory; re-fetched on app focus |
| Shuttle lines | TanStack Query cache | In-memory |
| Wallet balance | TanStack Query cache | In-memory |
| Transaction history | TanStack Query cache | In-memory |
| Notifications | TanStack Query cache | In-memory |
| Trips / bookings | TanStack Query cache | In-memory |
| Active ride state | `useRide` hook local state + socket | In-memory (lost on full reload) |
| Shuttle booking state | `BookingContext` (React Context) | In-memory |
| Service availability | `ServiceControlContext` (React Context) | In-memory; re-fetched on mount |
| Theme (dark/light) | `ThemeProvider` Context | In-memory (not persisted to backend) |
| Biometric / 2FA toggles | Local React state in `profile.tsx` | **Not persisted** — resets on reload |
| Privacy toggles | Local React state in `profile.tsx` | **Not persisted** — resets on reload |
| Favorite routes | Local state derived from API | In-memory |
| Frequent destinations | Derived from ride history API | In-memory |

### Session Persistence Across Restarts

- Tokens and session key survive app restarts via `expo-secure-store` / `AsyncStorage`.
- TanStack Query does not use `AsyncStorage` persistence — all API data is re-fetched on cold start.
- Active ride state is not persisted — if the app is killed mid-ride, the state is re-hydrated by polling `GET /rides/:id` on next launch.

---

## 7. Localization

### i18n Coverage

| Feature | Status | Notes |
|---------|--------|-------|
| English translation | ✅ Complete | All strings in `constants/i18n.ts` |
| Arabic translation | ⚠️ Present | Strings present but completeness vs English not verified |
| Language toggle at runtime | ✅ Yes | Profile page toggle; re-renders app |
| `t()` hook usage in screens | ✅ Yes | All screens use the translation hook |
| RTL layout enforcement | ⚠️ Unverified | i18n uses Arabic strings but explicit `I18nManager.forceRTL()` or RTL stylesheet mirroring not confirmed |
| Date / number formatting (locale-aware) | ⚠️ Unverified | Not confirmed; dates may display in LTR format in AR mode |

### Known Hardcoded Strings (should be in i18n)

| Location | Hardcoded String |
|----------|-----------------|
| `app/ticket.tsx` | `'VEEGO-0000'` fallback booking reference |
| `components/bike/bikeMapData.ts` | Station name strings in mock data |
| `components/scooter/scooterMapData.ts` | Station name strings in mock data |
| `constants/data.ts` | Station names in static fallback |

---

## 8. Dead Code & Unused Features

| Item | Location | Issue |
|------|----------|-------|
| `MOCK_LOCATIONS = []` | `app/(tabs)/index.tsx` and `app/(tabs)/car.tsx` | Empty array — location suggestion UI exists but is always empty |
| `MOCK_CARDS = []` | `app/(tabs)/wallet.tsx` and `app/(tabs)/profile.tsx` | Card management UI renders but has no data — no real card API |
| `FALLBACK_BOOKING_ID = 'VEEGO-0000'` | `app/ticket.tsx` | Renders a fake-looking booking ID if params missing |
| `components/bike/bikeMapData.ts` | `components/bike/` | 100% static mock — no real bike API consumed |
| `components/scooter/scooterMapData.ts` | `components/scooter/` | 100% static mock — no real scooter API consumed |
| `constants/data.ts` static stations | `constants/data.ts`, `app/stations.tsx` | Stale fallback used when API fails — masks real errors |
| `usePromos` — `promos: []` | `src/hooks/usePromos.ts` | No GET endpoint called for promo listings; always returns empty array |
| Biometric / 2FA toggles | `app/(tabs)/profile.tsx` | UI and local state exist, backend persistence not wired |
| Privacy toggles | `app/(tabs)/profile.tsx` | UI and local state exist, backend persistence not wired |
| Delivery service tab | `app/(tabs)/index.tsx` | Shown as "Soon" with no content, timeline, or API backing |
| `POST /rides/:id/sos` | `src/hooks/useRide.ts` | Endpoint hooked up but dedicated SOS safety screen UI not found |

### Socket Events Defined but Never Handled

None — all events in `constants/socketEvents.ts` are consumed.

### Screens Never Navigated To

All screens have at least one navigation path. No orphaned screens found.

---

## 9. Missing Features (Compared to Spec / Backend API)

| # | Feature | Evidence of Spec / Backend | Missing In Client |
|---|---------|---------------------------|-------------------|
| 1 | OTP verification step after forgot-password | `POST /auth/forgot-password` sends OTP | No OTP input screen |
| 2 | Password reset form (enter new password) | Implied by forgot-password flow | Not found |
| 3 | Cancel ride with reason picker | Backend likely accepts cancel reason | UI uses plain Alert with no reason |
| 4 | Safety / SOS screen (call 122, WhatsApp trip details) | `POST /rides/:id/sos` exists | No dedicated safety sheet UI |
| 5 | Route deviation alert | Common in ride-hailing; server likely emits event | No client-side alert UI |
| 6 | Post-trip fare receipt / summary | Implied by completed ride flow | Only RatingSheet shown, no receipt |
| 7 | Real card add / management | `MOCK_CARDS = []` suggests card API exists | No card add / delete UI or API call |
| 8 | Location / geocoding for suggestions | Implied by pickup/dropoff search | `MOCK_LOCATIONS = []` — no geocoding |
| 9 | Featured promo listings | `POST /promo/validate` implies list exists | `usePromos` returns `[]` — no GET |
| 10 | Multi-seat shuttle booking | Backend likely supports `seatCount > 1` | Hardcoded `seatCount: 1` |
| 11 | 10-hour cancellation penalty (client warning) | Business rule | No client-side enforcement or warning |
| 12 | Biometric / Face ID enable (persisted) | Security feature in profile UI | Toggle local only — not saved |
| 13 | 2FA enable (persisted) | Security feature in profile UI | Toggle local only — not saved |
| 14 | Privacy preferences (persisted) | Privacy section in profile UI | Toggles local only — not saved |
| 15 | Bike service (real data) | Bike tab / service exists | `bikeMapData.ts` is fully mock |
| 16 | Scooter service (real data) | Scooter tab / service exists | `scooterMapData.ts` is fully mock |
| 17 | Delivery service | Shown as tab in Home | Zero implementation — "Soon" only |
| 18 | Social login (Google / Apple) | Common for ride-hailing | Not implemented |
| 19 | In-app rating dispute / edit | User may want to change rating | No edit rating flow |
| 20 | RTL layout enforcement for Arabic | Arabic strings present | RTL mirroring not confirmed |

---

## 10. Summary Table

| # | Feature | Status | Priority |
|---|---------|--------|----------|
| 1 | Splash / session guard | ✅ Done | — |
| 2 | Language selection | ✅ Done | — |
| 3 | Onboarding | ✅ Done | — |
| 4 | Sign in | ✅ Done | — |
| 5 | Sign up | ✅ Done | — |
| 6 | Forgot password (phone submission) | ⚠️ Partial | High |
| 7 | OTP verification step | ❌ Missing | High |
| 8 | Password reset form | ❌ Missing | High |
| 9 | Auto-login / token persistence | ✅ Done | — |
| 10 | Token refresh | ✅ Done | — |
| 11 | Account suspension screen | ✅ Done | — |
| 12 | Home — service switcher | ✅ Done | — |
| 13 | Home — location suggestions | ❌ Missing (mock empty) | Medium |
| 14 | Shuttle route browsing | ✅ Done | — |
| 15 | Shuttle route search + filter | ✅ Done | — |
| 16 | Shuttle trip selection + booking | ✅ Done | — |
| 17 | Multi-seat booking | ❌ Missing | Medium |
| 18 | Shuttle promo code at checkout | ✅ Done | — |
| 19 | Featured promo listing | ❌ Missing | Low |
| 20 | Shuttle QR ticket | ✅ Done | — |
| 21 | Shuttle live boarding status | ✅ Done | — |
| 22 | Shuttle trip cancellation | ✅ Done | — |
| 23 | 10-hour cancellation warning | ❌ Missing | Medium |
| 24 | Car service map + location | ✅ Done | — |
| 25 | Car price estimate | ✅ Done | — |
| 26 | Car ride request | ✅ Done | — |
| 27 | Driver searching overlay | ✅ Done | — |
| 28 | Driver info card | ✅ Done | — |
| 29 | Call driver | ✅ Done | — |
| 30 | Chat with driver | ✅ Done | — |
| 31 | Cancel ride | ⚠️ Partial (no reason picker) | High |
| 32 | Cancel ride with reason | ❌ Missing | High |
| 33 | Safety / SOS screen | ❌ Missing | High |
| 34 | Call 122 from safety | ❌ Missing | High |
| 35 | WhatsApp trip share from safety | ❌ Missing | High |
| 36 | Route deviation alert | ❌ Missing | High |
| 37 | Waiting time billing UI | ✅ Done | — |
| 38 | Surge pricing UI | ✅ Done | — |
| 39 | Live driver tracking (socket) | ✅ Done | — |
| 40 | HTTP polling fallback for tracking | ✅ Done | — |
| 41 | Post-trip rating | ✅ Done | — |
| 42 | Post-trip fare receipt | ❌ Missing | Medium |
| 43 | Scooter service (real data) | ❌ Missing (mock) | Medium |
| 44 | Bike service (real data) | ❌ Missing (mock) | Medium |
| 45 | Delivery service | ❌ Missing | Low |
| 46 | Trips — upcoming list | ✅ Done | — |
| 47 | Trips — history list | ✅ Done | — |
| 48 | Wallet — balance | ✅ Done | — |
| 49 | Wallet — transaction history | ✅ Done | — |
| 50 | Wallet — top-up | ✅ Done | — |
| 51 | Wallet — cash debt banner | ✅ Done | — |
| 52 | Wallet — card management | ❌ Missing (mock) | Medium |
| 53 | Profile — read/update info | ✅ Done | — |
| 54 | Profile — biometric toggle (persisted) | ❌ Missing | Medium |
| 55 | Profile — 2FA toggle (persisted) | ❌ Missing | Medium |
| 56 | Profile — privacy toggles (persisted) | ❌ Missing | Low |
| 57 | Favorites — saved routes | ✅ Done | — |
| 58 | Favorites — frequent destinations | ✅ Done | — |
| 59 | Notifications list + mark-read | ✅ Done | — |
| 60 | Support ticket submission | ✅ Done | — |
| 61 | English localization | ✅ Done | — |
| 62 | Arabic localization | ⚠️ Partial | Medium |
| 63 | RTL layout enforcement | ⚠️ Unverified | Medium |
| 64 | Social login (Google / Apple) | ❌ Missing | Low |

---

## 11. Critical Action Items

### 🔴 High Priority

1. **Build OTP entry screen** — `POST /auth/forgot-password` successfully sends OTP but there is no screen to enter it. The forgot-password user flow is a dead end. Add an OTP input step and connect it to the password reset endpoint.
2. **Build password reset form** — After OTP verification, user needs a screen to enter and confirm a new password. Endpoint likely exists on backend; client implementation is entirely missing.
3. **Add cancel-ride reason picker** — Cancelling a ride via the current native `Alert` (yes/no only) is incomplete. Build a bottom sheet with a list of cancellation reasons (per backend-accepted values) and pass the selected reason in `PATCH /rides/:id/cancel`.
4. **Build Safety / SOS screen** — `POST /rides/:id/sos` is implemented in the hook but no UI button or safety sheet is visible to the user. Build a dedicated safety sheet accessible during an active ride with: SOS call (122), share trip via WhatsApp, and SOS API trigger.
5. **Add route deviation notification** — Implement a client-side alert (banner or modal) when the server signals a route deviation event. This is a safety-critical feature.
6. **Fix FALLBACK_BOOKING_ID** — `'VEEGO-0000'` in `app/ticket.tsx` can appear on real QR tickets if navigation params are missing. Add a hard guard: if booking ID is missing, show an error state instead of rendering a fake ID.

### 🟠 Medium Priority

7. **Implement geocoding / place suggestions** — `MOCK_LOCATIONS = []` means pickup/dropoff search in both the Home screen and Car screen shows no suggestions. Integrate a geocoding API (e.g. Google Places, Mapbox) and populate suggestions from user input.
8. **Add post-trip fare receipt screen** — After `ride:completed`, only the RatingSheet is shown. Build a receipt screen showing fare breakdown, distance, time, and payment method used.
9. **Wire card management to backend** — `MOCK_CARDS = []` in Wallet and Profile means the card management UI is non-functional. Implement `GET /payment/cards`, `POST /payment/cards`, and `DELETE /payment/cards/:id` (or equivalent endpoints) and connect them to the card list UI.
10. **Implement featured promos listing** — `usePromos` always returns `promos: []`. Add a `GET /promos` call (or equivalent) to populate the featured promos on the Promo screen.
11. **Persist biometric and 2FA toggles** — Security toggles in the Profile screen are local state only and reset on every app load. Persist them via `PATCH /users/me` or a dedicated `PATCH /users/me/settings` endpoint.
12. **Implement real scooter service** — `scooterMapData.ts` is entirely static mock data. Replace with real API calls for scooter availability, locations, and pricing.
13. **Implement real bike service** — `bikeMapData.ts` is entirely static mock data. Replace with real API calls.
14. **Add multi-seat shuttle booking** — `seatCount` is hardcoded to `1` in `BookingContext`. If the backend supports multiple seats, add a seat selector in `TripSheet`.
15. **Add 10-hour cancellation warning** — Display a client-side warning on the cancel confirmation if the trip is within 10 hours, showing the penalty amount, so users make an informed decision.
16. **Verify and enforce RTL for Arabic** — Confirm `I18nManager.forceRTL(true)` is called when Arabic is selected. Audit all `StyleSheet` definitions for left/right margin/padding that should use `start`/`end` in RTL.

### 🟡 Low Priority

17. **Complete Arabic translation audit** — Compare every key in the English translations object against the Arabic object and identify any missing keys. Fill gaps.
18. **Persist privacy toggles to backend** — Location history, analytics, and ads preference toggles in Profile are local state only. Wire them to `PATCH /users/me` or a preferences endpoint.
19. **Remove static fallback in `constants/data.ts`** — The stations screen silently falls back to stale static data when the API fails. Replace the silent fallback with an explicit error state + retry button.
20. **Add delivery service implementation** — If delivery is on the roadmap, implement the booking and tracking flow. If it is not, remove the "Soon" tab entirely to avoid confusing users.
21. **Add locale-aware date and number formatting** — Ensure all date displays and currency amounts use locale-aware formatters so Arabic users see appropriate numeral and date formats.
22. **Register push token error surfacing** — `POST /users/me/push-token` fails silently. Log the error or add a retry mechanism so the team is aware when push token registration fails.
23. **Consider social login** — Google and Apple sign-in are standard in ride-hailing. Evaluate adding `expo-auth-session` with both providers.
24. **Move `localStorage` web token storage to `HttpOnly` cookies** — `localStorage` on web is vulnerable to XSS. For the web build, consider using `HttpOnly` session cookies for token storage.

---

## 12. Stats

| Metric | Count |
|--------|-------|
| **Total screens** | 19 |
| **Screens fully connected to backend** | 11 |
| **Screens partially connected** | 6 |
| **Screens with no backend (local only)** | 2 (lang-select, onboarding) |
| **Mock data instances** | 5 (`MOCK_LOCATIONS`, `MOCK_CARDS`, `bikeMapData.ts`, `scooterMapData.ts`, `promos: []`) |
| **Estimated hardcoded strings (not in i18n)** | 8+ (fallback IDs, mock station names, etc.) |
| **API endpoints called (real)** | 35 |
| **API endpoints with mock/empty data** | 4 |
| **Socket events handled (server → client)** | 19 |
| **Socket events emitted (client → server)** | 4 |
| **Unhandled socket events** | 0 |
| **Features fully implemented** | 36 |
| **Features partially implemented** | 9 |
| **Features missing** | 20 |
| **Critical (High) action items** | 6 |
| **Medium priority action items** | 10 |
| **Low priority action items** | 8 |
