# VeeGo Rider App — Technical Audit Report
**Date:** June 12, 2026  
**App:** VeeGo Passenger App (React Native / Expo)  
**Auditor:** Automated Deep Technical Audit  

---

## 1. Project Structure

### Root Layout
| Path | Description |
|------|-------------|
| `app/_layout.tsx` | Root layout — wraps app in ThemeProvider, TabBarProvider, ServiceControlProvider, BookingProvider, FavoritesProvider; handles deep-link routing |
| `app/index.tsx` | Splash/init screen — checks AsyncStorage for language & session, routes to lang-select / onboarding / tabs |
| `app/lang-select.tsx` | Language selection screen (first launch only) |
| `app/onboarding.tsx` | 3-slide onboarding carousel (first launch only) |
| `app/auth.tsx` | Sign In / Sign Up / Forgot Password screen |
| `app/suspended.tsx` | Account suspension lockout screen |
| `app/ticket.tsx` | Shuttle boarding pass with QR code |
| `app/trip-detail.tsx` | Shuttle trip detail + live status view |
| `app/trip-tracking.tsx` | Car/Scooter live tracking map screen |
| `app/stations.tsx` | Station list + map for a shuttle route |
| `app/notifications.tsx` | In-app notifications list |
| `app/promo.tsx` | Promo code entry / featured promos |
| `app/support.tsx` | Support ticket submission form |

### Tab Screens (`app/(tabs)/`)
| Path | Description |
|------|-------------|
| `(tabs)/_layout.tsx` | Bottom tab nav with custom animated pill indicator |
| `(tabs)/index.tsx` | Home screen — service selector, featured offers, most booked routes |
| `(tabs)/routes.tsx` | Searchable full list of shuttle lines |
| `(tabs)/car.tsx` | Car service — map, pickup/drop, price estimate, driver tracking |
| `(tabs)/trips.tsx` | Upcoming + past trips for all services |
| `(tabs)/wallet.tsx` | Wallet balance, transaction history, top-up |
| `(tabs)/profile.tsx` | User settings — personal info, payment, security, help, sign out |
| `(tabs)/favorites.tsx` | Saved shuttle routes + frequent car/scooter destinations |

### Components (`components/`)
| Path | Description |
|------|-------------|
| `components/car/CarMap.tsx` | Map component for car service |
| `components/car/DriverSearching.tsx` | Animated overlay during driver search |
| `components/car/DriverAssignedCard.tsx` | Driver info card (name, rating, vehicle, call/chat) |
| `components/bike/BikeServiceScreen.tsx` | Bike/Scooter service screen |
| `components/bike/bikeMapData.ts` | **Mock data** for bike map UI |
| `components/scooter/scooterMapData.ts` | **Mock data** for scooter map UI |
| `components/shared/RatingSheet.tsx` | Post-trip star rating + comment sheet |
| `components/shared/QRScanner.tsx` | QR code scanner component |
| `components/TripSheet.tsx` | Shuttle trip selector bottom sheet |
| `components/ConfirmSheet.tsx` | Shuttle booking confirmation sheet |

### Context & Hooks (`context/`, `src/hooks/`)
| Path | Description |
|------|-------------|
| `context/BookingContext.tsx` | Shuttle booking state orchestration |
| `context/ServiceControlContext.tsx` | Service availability + zone-based kill-switch |
| `context/ThemeProvider.tsx` | Theme (dark/light) + i18n provider |
| `src/hooks/useRide.ts` | Car/Scooter ride lifecycle hook |
| `src/hooks/useWallet.ts` | Wallet balance + transactions |
| `src/hooks/useTrips.ts` | Trips history + upcoming |
| `src/hooks/useFavoriteDestinations.ts` | Favorite destinations derived from ride history |
| `src/hooks/useDebt.ts` | Cash debt tracking |
| `src/hooks/usePromos.ts` | Promo code validation hook |

### API & Utilities (`src/api/`, `constants/`)
| Path | Description |
|------|-------------|
| `src/api/client.ts` | Axios instance with JWT interceptors + token refresh |
| `src/api/socket.ts` | Socket.io client setup |
| `constants/i18n.ts` | English + Arabic translation strings |
| `constants/data.ts` | Static/fallback station and shuttle data |

### Navigation Structure
```
app/index (splash → route guard)
├── app/lang-select       (first launch)
├── app/onboarding        (first launch)
├── app/auth              (unauthenticated)
└── app/(tabs)            (authenticated)
    ├── index             (Home)
    ├── routes            (Shuttle routes)
    ├── car               (Car service)
    ├── trips             (My Trips)
    ├── wallet            (Wallet)
    ├── profile           (Profile)
    └── favorites         (Favorites)
        Modal stack:
        ├── ticket
        ├── trip-detail
        ├── trip-tracking
        ├── stations
        ├── notifications
        ├── promo
        ├── support
        └── suspended
```

---

## 2. Screens Inventory

| Screen | File Path | What It Does | Backend Connected? | Status |
|--------|-----------|--------------|-------------------|--------|
| Splash | `app/index.tsx` | Init routing based on session & language flags | AsyncStorage read | ✅ Fully working |
| Language Select | `app/lang-select.tsx` | First-launch language choice (EN/AR) | AsyncStorage write | ✅ Fully working |
| Onboarding | `app/onboarding.tsx` | 3-slide feature intro, first launch only | AsyncStorage flag | ✅ Fully working |
| Auth | `app/auth.tsx` | Sign in, sign up, forgot password | `POST /auth/login`, `/register` | ✅ Fully working |
| Home | `app/(tabs)/index.tsx` | Service selector, featured offers, most booked | `GET /shuttle/lines`, ServiceControl | ⚠️ `MOCK_LOCATIONS` array empty |
| Shuttle Routes | `app/(tabs)/routes.tsx` | Searchable shuttle line list | `GET /shuttle/lines` | ✅ Fully working |
| Car Service | `app/(tabs)/car.tsx` | Map ride request, pricing, driver tracking | `/rides/estimate`, `/rides/request` | ✅ Fully working |
| My Trips | `app/(tabs)/trips.tsx` | Upcoming + past trips | `GET /bookings`, `GET /rides` | ✅ Fully working |
| Wallet | `app/(tabs)/wallet.tsx` | Balance, transactions, top-up | `GET /wallet`, `POST /wallet/topup` | ⚠️ `MOCK_CARDS` empty |
| Profile | `app/(tabs)/profile.tsx` | Settings, help, sign out | `GET /users/me` | ⚠️ Some sections may be static |
| Favorites | `app/(tabs)/favorites.tsx` | Saved routes + destinations | `useFavoriteDestinations` | ✅ Fully working |
| Boarding Pass | `app/ticket.tsx` | QR code ticket, live boarding status | Socket: `booking:boarded` | ⚠️ Fallback ID `VEEGO-0000` present |
| Trip Detail | `app/trip-detail.tsx` | Shuttle booking detail + live map | `GET /shuttle/trips/:id`, sockets | ✅ Fully working |
| Trip Tracking | `app/trip-tracking.tsx` | Live car/scooter map tracking | Socket: `ride:driver_location` | ✅ Fully working |
| Stations | `app/stations.tsx` | Station list + map | `GET /routes/:routeId/stations` | ⚠️ Static fallback data in use |
| Notifications | `app/notifications.tsx` | In-app notification list | `GET /notifications` | ✅ Fully working |
| Promo | `app/promo.tsx` | Apply/view promo codes | `POST /promo/validate` | ✅ Fully working |
| Support | `app/support.tsx` | Submit support ticket | `POST /support/tickets` | ✅ Fully working |
| Suspended | `app/suspended.tsx` | Lockout screen for banned accounts | 403 API trigger | ✅ Fully working |

---

## 3. API Integration

| Endpoint | Method | Trigger | Response Usage | Error Handled? |
|----------|--------|---------|----------------|----------------|
| `/auth/login` | POST | Sign in form | Stores JWT tokens | ✅ Yes |
| `/auth/register` | POST | Sign up form | Stores JWT tokens | ✅ Yes |
| `/auth/refresh` | POST | 401 interceptor | Replaces access token | ✅ Yes |
| `/auth/forgot-password` | POST | Forgot password form | OTP sent | ✅ Yes |
| `/users/me` | GET | App init / profile open | Populates profile data | ✅ Yes |
| `/users/me/push-token` | POST | App init | Registers push token | ⚠️ Silent fail if missing |
| `/shuttle/lines` | GET | Home / routes screen | Populates line list | ✅ Yes |
| `/shuttle/lines/:id` | GET | Route tap | Loads stations + trips | ✅ Yes (key-unwrap logic) |
| `/shuttle/my-trips` | GET | Trips screen | Lists shuttle bookings | ✅ Yes |
| `/shuttle/trips/:id` | GET | Trip detail screen | Loads single trip | ✅ Yes |
| `/shuttle/my-debt` | GET | Wallet screen | Shows cash debt banner | ✅ Yes |
| `/bookings` | GET | Trips screen | Lists all bookings | ✅ Yes |
| `/bookings` | POST | ConfirmSheet | Creates shuttle booking | ✅ Yes |
| `/bookings/:id/cancel` | PATCH | Trips / trip detail | Cancels booking | ✅ Yes |
| `/rides` | GET | Trips screen | Lists ride history | ✅ Yes |
| `/rides/estimate` | POST | Car screen | Returns price estimate | ✅ Yes |
| `/rides/request` | POST | Car confirm action | Creates ride request | ✅ Yes |
| `/rides/:id/rate-driver` | POST | RatingSheet submit | Submits driver rating | ✅ Yes |
| `/rides/:id/sos` | POST | Safety button | Triggers SOS | ⚠️ Button not clearly surfaced in UI |
| `/rides/:id/cancel` | PATCH | Cancel action | Cancels active ride | ✅ Yes |
| `/wallet` | GET | Wallet screen / BookingContext | Fetches balance | ✅ Yes |
| `/wallet/transactions` | GET | Wallet screen | Lists transactions | ✅ Yes |
| `/wallet/topup` | POST | Wallet top-up form | Adds balance | ✅ Yes |
| `/zones/locate` | GET | ServiceControlContext | Resolves user zone | ✅ Yes |
| `/services/control` | GET | ServiceControlContext | Fetches service flags | ✅ Yes |
| `/promo/validate` | POST | ConfirmSheet / promo screen | Validates promo code | ✅ Yes |
| `/notifications` | GET | Notifications screen | Lists notifications | ✅ Yes |
| `/support/tickets` | POST | Support form | Submits support ticket | ✅ Yes |
| `/routes/:routeId/stations` | GET | Stations screen | Loads station list | ⚠️ Static fallback used |

**Base URL:** Configured via `EXPO_PUBLIC_API_URL` env variable in `src/api/client.ts`.  
**Token Auth:** Bearer token injected by Axios request interceptor. Refresh handled on 401 automatically.

---

## 4. Socket / Real-Time

| Event | Direction | Purpose | Working? |
|-------|-----------|---------|----------|
| `join` | Emit | Connect user to personal channel | ✅ |
| `passenger:join:trip` | Emit | Join shuttle trip channel after booking | ✅ |
| `join:trip` | Emit | Join car/scooter ride channel | ✅ |
| `leave:trip` | Emit | Leave ride channel | ✅ |
| `ride:driver_assigned` | Listen | Receive assigned driver details | ✅ |
| `ride:driver_location` | Listen | Real-time driver GPS updates | ✅ (with HTTP polling fallback) |
| `ride:arrived` | Listen | Driver arrived at pickup | ✅ |
| `ride:started` | Listen | Trip started | ✅ |
| `ride:completed` | Listen | Trip ended, triggers rating sheet | ✅ |
| `ride:cancelled` | Listen | Ride cancelled by driver/system | ✅ |
| `ride:timeout` | Listen | No driver found timeout | ✅ |
| `ride:waiting:charge:started` | Listen | Waiting time billing started | ✅ |
| `ride:waiting:charge:updated` | Listen | Real-time waiting fare update | ✅ |
| `surge:updated` | Listen | Surge pricing change | ✅ |
| `shuttle:driver:location` | Listen | Shuttle bus GPS for trip-detail map | ✅ |
| `shuttle:trip:status` | Listen | Shuttle trip status updates | ✅ |
| `passenger:trip:tracking` | Listen | Boarding pass live tracking | ✅ |
| `booking:boarded` | Listen | Triggers "boarded" state on ticket | ✅ |
| `notification:new` | Listen | Push new in-app notification | ✅ |
| `service:control:changed` | Listen | Real-time service kill-switch update | ✅ |

**Fallback:** `useRide.ts` falls back to HTTP polling every 5 seconds if socket disconnects.  
**Status:** Socket layer is comprehensive and well-integrated. ✅

---

## 5. Authentication Flow

| Feature | Implemented? | Notes |
|---------|--------------|-------|
| Language selection (first launch) | ✅ Yes | `app/lang-select.tsx` — persisted to AsyncStorage |
| Onboarding (3 slides, first launch) | ✅ Yes | `app/onboarding.tsx` — skipped after first view |
| Phone number + OTP sign up | ⚠️ Partial | `/auth/register` exists; OTP trigger via `/auth/forgot-password`; dedicated OTP input UI not confirmed as a separate step |
| JWT token storage | ✅ Yes | `expo-secure-store` on native, `localStorage` on web |
| Token refresh (auto, on 401) | ✅ Yes | Axios response interceptor |
| Token-based auto-login (no re-login) | ✅ Yes | Session persisted in `AsyncStorage (@veego_session_v1)` |
| Account suspension handling | ✅ Yes | 403 + `account_suspended` code → redirects to `/suspended` |

---

## 6. Home Screen

| Feature | Implemented? | Notes |
|---------|--------------|-------|
| Service switcher tabs (Shuttle/Car/Scooter/Delivery) | ✅ Yes | `ServiceControlContext` drives visibility |
| "Soon" badge for inactive services | ✅ Yes | `coming_soon` state from service control |
| Shuttle search bar for routes/stations | ✅ Yes | Filtered via `app/(tabs)/routes.tsx` |
| View all shuttle routes | ✅ Yes | Routes tab |
| Most booked shuttle routes | ✅ Yes | Displayed on home |
| Featured/upcoming trips | ✅ Yes | Displayed on home |
| Car/Scooter: map + location bar | ✅ Yes | `app/(tabs)/car.tsx` |
| Notification bell | ✅ Yes | Routes to `app/notifications.tsx` |
| Zone-based service visibility | ✅ Yes | `GET /zones/locate` + `activeZoneIds` check |
| `MOCK_LOCATIONS` empty | ⚠️ | `MOCK_LOCATIONS = []` — may affect suggested locations UI |

---

## 7. Shuttle Booking Flow

| Feature | Implemented? | Notes |
|---------|--------------|-------|
| Browse and search routes | ✅ Yes | `app/(tabs)/routes.tsx` with filter |
| Select departure/arrival station | ✅ Yes | `TripSheet.tsx` station picker |
| Segment price calculation | ✅ Yes | `calcSegmentPrice` in TripSheet |
| Select date and time (trip picker) | ✅ Yes | Trip list in TripSheet with status + seats |
| View price and confirm | ✅ Yes | `ConfirmSheet.tsx` |
| Wallet balance check before booking | ✅ Yes | `GET /wallet` in BookingContext |
| Promo code at checkout | ✅ Yes | `usePromos` with real-time validation |
| Ticket / QR code received after booking | ✅ Yes | `app/ticket.tsx` |
| Pending vs. Active trip status | ✅ Yes | Status shown in TripSheet + trip detail |
| Live boarding status on ticket | ✅ Yes | `booking:boarded` socket event |
| Trip cancellation | ✅ Yes | `PATCH /bookings/:id/cancel` |
| 10-hour cancellation rule + penalty | ❓ Unknown | API may enforce it server-side; no client-side enforcement found |
| Seat count locked at 1 | ✅ Yes | Hardcoded `seatCount: 1` in BookingContext |

---

## 8. Car / Scooter / Delivery Ride Flow

| Feature | Implemented? | Notes |
|---------|--------------|-------|
| Map with current location | ✅ Yes | `CarMap.tsx` with expo-location |
| Destination selection | ✅ Yes | Pickup/dropoff input in car screen |
| Show available categories with prices | ✅ Yes | `POST /rides/estimate` → category list |
| Searching for driver (animated overlay) | ✅ Yes | `DriverSearching.tsx` |
| Driver info after acceptance | ✅ Yes | `DriverAssignedCard.tsx` — name, rating, vehicle, plate |
| Call driver button | ✅ Yes | `tel:` link in DriverAssignedCard |
| Chat button to driver | ✅ Yes | Chat action in DriverAssignedCard |
| Cancel ride with reason | ⚠️ Partial | Cancel via native alert; cancel reason selection UI not confirmed |
| Safety / SOS button | ⚠️ Partial | `POST /rides/:id/sos` endpoint exists; SOS UI button not explicitly found |
| Call 122 from safety button | ❌ Not confirmed | Not found in reviewed components |
| WhatsApp with trip details from safety | ❌ Not confirmed | Not found in reviewed components |
| Route deviation notification | ❌ Not found | Server-side logic likely; no client alert UI found |
| Waiting time fare updates | ✅ Yes | `ride:waiting:charge:updated` socket |
| Surge pricing | ✅ Yes | `surge:updated` socket |
| End of trip — payment confirmation | ⚠️ Partial | `ride:completed` triggers RatingSheet; explicit payment receipt UI not confirmed |
| Driver rating after trip | ✅ Yes | `RatingSheet.tsx` — 5-star + comment |

---

## 9. Trips Page

| Feature | Implemented? | Notes |
|---------|--------------|-------|
| Upcoming trips list | ✅ Yes | `useTrips.ts` → `GET /bookings` |
| Trip history list | ✅ Yes | Past rides + shuttle bookings |
| Trip detail view | ✅ Yes | `app/trip-detail.tsx` |
| Cancel upcoming shuttle trip | ✅ Yes | `PATCH /bookings/:id/cancel` from trips + detail |
| Help/support from trip detail | ✅ Yes | Routes to `app/support.tsx` |

---

## 10. Favorites Page

| Feature | Implemented? | Notes |
|---------|--------------|-------|
| Frequently booked shuttle routes | ✅ Yes | Saved routes list |
| Frequent car/scooter destinations | ✅ Yes | `useFavoriteDestinations` derived from ride history |
| Real data (not mock) | ✅ Yes | Pulls from actual ride/booking history |

---

## 11. Wallet Page

| Feature | Implemented? | Notes |
|---------|--------------|-------|
| Balance display | ✅ Yes | `GET /wallet` via `useWallet` |
| Transaction history | ✅ Yes | `GET /wallet/transactions` |
| Quick top-up (50, 100, 200, 500 EGP) | ✅ Yes | `POST /wallet/topup` |
| Cash debt banner | ✅ Yes | `useDebt` → `GET /shuttle/my-debt` |
| Card management | ⚠️ Partial | `MOCK_CARDS = []` — card UI present but no real card data |
| Cash-only mode (hide other payment methods) | ❓ Unknown | Not confirmed; may be server-controlled |

---

## 12. Profile Page

| Feature | Implemented? | Notes |
|---------|--------------|-------|
| Profile photo + personal info | ✅ Yes | `GET /users/me` |
| Ratings display | ⚠️ Partial | Rating from user profile; UI details not fully confirmed |
| Inbox/support messages | ✅ Yes | Routes to `app/support.tsx` |
| Language toggle | ✅ Yes | Via `ThemeProvider` / i18n |
| Dark/light mode toggle | ✅ Yes | Via `ThemeProvider` |
| Help & policies | ✅ Yes | Help/FAQ section in profile |
| Sign out | ✅ Yes | Clears session + AsyncStorage |

---

## 13. Localization

| Feature | Status | Notes |
|---------|--------|-------|
| English supported | ✅ Yes | Full strings in `constants/i18n.ts` |
| Arabic supported | ✅ Yes | Full strings in `constants/i18n.ts` |
| RTL layout for Arabic | ⚠️ Needs verification | i18n present; RTL style enforcement not confirmed |
| Translation completeness | ⚠️ Needs verification | All screens use `t()` hook but completeness of Arabic strings not audited |
| Language toggle at runtime | ✅ Yes | Profile page toggle |

---

## 14. Dead Code & Unnecessary Features

| Item | Location | Issue |
|------|----------|-------|
| `MOCK_LOCATIONS = []` | `app/(tabs)/index.tsx` | Empty array — suggested locations feature non-functional |
| `MOCK_CARDS = []` | `app/(tabs)/profile.tsx` | Empty — card management UI non-functional |
| `FALLBACK_BOOKING_ID = 'VEEGO-0000'` | `app/ticket.tsx` | Fallback ID could appear on real tickets if ID is not passed correctly |
| `bikeMapData.ts` | `components/bike/` | Static mock data for bike map — not from real backend |
| `scooterMapData.ts` | `components/scooter/` | Static mock data for scooter map — not from real backend |
| `constants/data.ts` static stations | `constants/data.ts` | Used as fallback in stations screen when API fails |

---

## Prioritized Summary Table

| # | Item | Status | Priority |
|---|------|--------|----------|
| 1 | SOS / Safety button UI (call 122 + WhatsApp with trip details) | ❌ Not confirmed in UI | 🔴 High |
| 2 | Route deviation notification UI | ❌ Not found client-side | 🔴 High |
| 3 | Cancel ride with reason selection | ⚠️ Partial — alert only, no reason picker | 🔴 High |
| 4 | OTP flow as distinct step in sign-up | ⚠️ Partial — endpoint exists, UI step unclear | 🔴 High |
| 5 | 10-hour cancellation rule + penalty enforcement (client-side) | ❓ Unknown — likely server-only | 🟠 Medium |
| 6 | Post-trip payment receipt / summary screen | ⚠️ Partial — only rating sheet confirmed | 🟠 Medium |
| 7 | Card management real data (`MOCK_CARDS = []`) | ⚠️ Mock/empty | 🟠 Medium |
| 8 | Suggested locations on home (`MOCK_LOCATIONS = []`) | ⚠️ Mock/empty | 🟠 Medium |
| 9 | `FALLBACK_BOOKING_ID = 'VEEGO-0000'` in ticket screen | ⚠️ Risky fallback | 🟠 Medium |
| 10 | Static fallback station data in `constants/data.ts` | ⚠️ Stale if API changes | 🟡 Low |
| 11 | Bike / Scooter map mock data files | ⚠️ Not from backend | 🟡 Low |
| 12 | Arabic RTL layout enforcement | ⚠️ Needs verification | 🟡 Low |
| 13 | Arabic translation completeness audit | ⚠️ Not fully verified | 🟡 Low |
| 14 | Cash-only mode / payment method visibility | ❓ Unknown behaviour | 🟡 Low |
| 15 | Push token silent failure on registration | ⚠️ No error surfaced to user | 🟡 Low |
