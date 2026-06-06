# Frontend–Backend Integration Audit
## VeeGo Passenger App
**Date:** 2026-06-06  
**Scope:** Audit only — no code modifications made. All findings reference the backend API contract (`BACKEND_API_CONTRACT_1780729999804.md`) versus actual frontend source files.

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Audit Methodology](#2-audit-methodology)
3. [REST Endpoint Mismatches](#3-rest-endpoint-mismatches)
4. [Socket.IO Event Mismatches](#4-socketio-event-mismatches)
5. [Hardcoded / Mock Data That Should Be Dynamic](#5-hardcoded--mock-data-that-should-be-dynamic)
6. [Backend Features with No Frontend Coverage](#6-backend-features-with-no-frontend-coverage)
7. [Local-State-Only Features (No Backend Persistence)](#7-local-state-only-features-no-backend-persistence)
8. [Correct Integrations (Reference)](#8-correct-integrations-reference)
9. [Risk Matrix](#9-risk-matrix)
10. [Findings Summary Table](#10-findings-summary-table)

---

## 1. Executive Summary

The audit identified **34 distinct integration defects** across the VeeGo passenger app. These fall into five categories:

| Category | Count | Highest Severity |
|---|---|---|
| Wrong REST endpoint path or method | 10 | Critical |
| Non-existent endpoint called | 3 | Critical |
| Socket.IO event name mismatches | 5 | High |
| Hardcoded / mock data used instead of API | 8 | High |
| Backend features with no frontend coverage | 8 | Medium |

**Critical impact:** Ride requesting, ride cancellation, driver rating, user profile read/update, and chat message delivery are all broken due to wrong endpoints. The app cannot complete a ride end-to-end in production.

---

## 2. Audit Methodology

### Files Reviewed — Frontend
| File | Role |
|---|---|
| `src/api/client.ts` | Axios base client, `BASE_URL` configuration |
| `src/api/socket.ts` | Socket.IO connection factory |
| `src/constants/socketEvents.ts` | Named socket event constants |
| `src/hooks/useRide.ts` | Ride request, cancel, socket ride events |
| `src/hooks/useWallet.ts` | Wallet balance and transactions |
| `src/hooks/useTrips.ts` | Booking history |
| `src/hooks/useRoutes.ts` | Shuttle route listing |
| `src/hooks/useProfile.ts` | User profile CRUD |
| `src/hooks/usePromos.ts` | Promo code listing |
| `src/hooks/useNotifications.ts` | Notification listing |
| `src/hooks/useRideChat.ts` | In-ride chat messages |
| `app/(tabs)/car.tsx` | Car service UI — ride request, estimate, rating |
| `app/(tabs)/wallet.tsx` | Wallet UI |
| `app/(tabs)/trips.tsx` | Trip history UI |
| `app/(tabs)/routes.tsx` | Shuttle route browser |
| `app/(tabs)/profile.tsx` | Profile UI, privacy, security, payment methods |
| `app/(tabs)/favorites.tsx` | Favorites tab |
| `app/(tabs)/index.tsx` | Home screen |
| `app/auth.tsx` | Login / register / forgot-password |
| `app/notifications.tsx` | Notification UI |
| `app/promo.tsx` | Promo code UI |
| `app/support.tsx` | Support request UI |
| `context/BookingContext.tsx` | Shuttle booking flow |
| `context/ServiceControlContext.tsx` | Service control socket listener |
| `constants/data.ts` | Static/seed data constants |

### Backend Contract Reference
- **Source:** `attached_assets/BACKEND_API_CONTRACT_1780729999804.md` (3408 lines)
- **Base path prefix:** All backend routes are prefixed `/api/` (e.g., `POST /api/rides`)
- **Frontend base URL:** Configured in `src/api/client.ts` — the client appends paths without repeating `/api/`; the `BASE_URL` is expected to include `/api` (e.g., `https://host/api`). Paths in this report show what the frontend sends after the base, compared with the contract's full path.

---

## 3. REST Endpoint Mismatches

### F-001 — Ride Request: Wrong path
**Severity: Critical**  
**File:** `src/hooks/useRide.ts`

```typescript
// Frontend sends:
api.post('/rides/request', { ... })

// Backend contract specifies:
POST /api/rides
```

**Impact:** Every ride request in the car service will receive a 404. No car ride can be initiated.

---

### F-002 — Ride Estimate: Endpoint Does Not Exist
**Severity: Critical**  
**File:** `app/(tabs)/car.tsx`

```typescript
// Frontend sends:
api.post('/rides/estimate', { pickup, destination })

// Backend contract: No ride estimate / price preview endpoint is documented.
```

**Impact:** The fare estimation step in the car booking flow will always fail with a 404. There is no equivalent endpoint in the contract — either the feature needs a contract addition or must be removed.

---

### F-003 — Rate Driver: Wrong path
**Severity: Critical**  
**File:** `app/(tabs)/car.tsx`

```typescript
// Frontend sends:
api.post(`/rides/${rideId}/rate`, { rating, comment })

// Backend contract specifies:
POST /api/rides/:id/rate-driver
// Body: { rating: number, comment?: string }
```

**Impact:** Post-ride driver ratings are silently lost — users see success but no rating is stored.

---

### F-004 — Ride Cancellation: Wrong HTTP method
**Severity: High**  
**File:** `src/hooks/useRide.ts`

```typescript
// Frontend sends:
api.patch(`/rides/${rideId}/cancel`)

// Backend contract specifies:
POST /api/rides/:id/cancel
```

**Impact:** Cancellation requests fail with 405 Method Not Allowed. Passengers cannot cancel rides; backend ride state becomes inconsistent.

---

### F-005 — User Profile: Wrong path (GET and PATCH)
**Severity: Critical**  
**File:** `src/hooks/useProfile.ts`

```typescript
// Frontend sends:
api.get('/users/me')
api.patch('/users/me', { ... })

// Backend contract specifies:
GET  /api/auth/me
PATCH /api/auth/me
```

**Impact:** Profile data never loads (404 on mount). Profile updates are never saved. Every screen that reads user name/avatar will show empty or stale state.

---

### F-006 — Chat: Wrong path and resource name
**Severity: High**  
**File:** `src/hooks/useRideChat.ts`

```typescript
// Frontend sends:
api.get(`/trips/${tripId}/chat`)
api.post(`/trips/${tripId}/chat`, { message })

// Backend contract specifies:
GET  /api/chat/:rideId
POST /api/chat/:rideId
// Body for POST: { message: string }
```

**Impact:** In-ride chat is completely non-functional. Messages cannot be fetched or sent. Additionally, the frontend keys on `tripId` while the contract keys on `rideId` — these are different identifiers and must be reconciled.

---

### F-007 — Shuttle Booking Cancellation: Wrong HTTP method
**Severity: High**  
**File:** `app/(tabs)/trips.tsx`

```typescript
// Frontend sends:
api.patch(`/bookings/${tripId}/cancel`)

// Backend contract specifies:
POST /api/bookings/:id/cancel
```

**Impact:** Shuttle booking cancellation always fails with 405. Passengers cannot cancel booked shuttle seats.

---

### F-008 — Promo Code Listing: Endpoint Requires Admin Auth
**Severity: High**  
**File:** `src/hooks/usePromos.ts`

```typescript
// Frontend sends:
api.get('/promo')

// Backend contract specifies:
GET /api/promos  — Admin only (requires admin JWT role)
```

**Impact:** Calling this endpoint as a passenger will receive a 401/403. The passenger-facing flow for promos should use `POST /api/promos/validate` (validating a specific code the user types) rather than listing all promos. The current implementation exposes an admin endpoint to every passenger session.

---

### F-009 — Forgot Password: Endpoint Does Not Exist
**Severity: High**  
**File:** `app/auth.tsx`

```typescript
// Frontend sends:
api.post('/auth/forgot-password', { email })

// Backend contract: No forgot-password endpoint is documented anywhere.
```

**Impact:** The "Forgot Password" flow always returns a 404. Users cannot recover their accounts. The feature needs either a contract addition or must be removed from the UI.

---

### F-010 — Wallet Balance in BookingContext: Path Inconsistency
**Severity: Low**  
**File:** `context/BookingContext.tsx`

```typescript
// BookingContext fetches:
api.get('/wallet')

// useWallet.ts fetches:
api.get('/wallet')

// Backend contract specifies:
GET /api/wallet
```

Both files use `/wallet` which resolves correctly if `BASE_URL` includes `/api`. This is consistent and correct **only if** the Axios base URL is configured as `https://host/api`. If `BASE_URL` is `https://host`, both calls will 404. Verify `BASE_URL` in environment configuration.

---

## 4. Socket.IO Event Mismatches

### S-001 — Service Control: Event Name Mismatch
**Severity: High**  
**File:** `context/ServiceControlContext.tsx`

```typescript
// Frontend listens for:
socket.on('service:control:changed', handler)

// Backend contract emits:
service:control_changed
//              ^ underscore, not colon
```

**Impact:** Real-time service enable/disable/maintenance events from admin will never reach the app. The service control display will become stale immediately after connection and will only update on full app restart.

---

### S-002 — Driver Location Updates: Event Name Mismatch
**Severity: High**  
**File:** `src/hooks/useRide.ts`

```typescript
// Frontend listens for:
socket.on('ride:driver_location', handler)

// Backend contract emits:
ride:location_updated
// Payload: { rideId, lat, lng, heading, speed }
```

**Impact:** The live driver location marker on the car map never moves during a ride. Passengers see a static map with no driver position updates.

---

### S-003 — Trip Join: Event Name Mismatch
**Severity: High**  
**File:** `context/BookingContext.tsx`

```typescript
// Frontend emits:
socket.emit('passenger:join:trip', tripId)

// Backend contract expects:
passenger:join_trip
// Payload: { tripId: number }
```

**Impact:** After a shuttle booking is confirmed, the passenger never joins the real-time trip room. They will miss all subsequent trip events: driver location, ETA updates, boarding alerts, and cancellation notifications.

Additionally, the frontend passes `tripId` as a bare number while the contract specifies `{ tripId: number }` as the payload object.

---

### S-004 — Waiting Charge Events: Not Handled
**Severity: Medium**  
**File:** `src/hooks/useRide.ts` (and all ride-related components)

```typescript
// Backend emits (not handled by frontend at all):
ride:free_window_ended     // free waiting period is over
ride:waiting_charge_updated // { charge: number } — accumulating waiting fee
```

**Impact:** Passengers receive no UI indication when a waiting charge begins to accrue, leading to unexpected charges with no in-app explanation.

---

### S-005 — Surge Pricing Updates: Not Handled
**Severity: Medium**  
**Files:** `src/hooks/useRide.ts`, `app/(tabs)/car.tsx`

```typescript
// Backend emits (not handled by frontend at all):
surge:update   // { multiplier: number, zoneId: string }
```

**Impact:** If surge pricing activates after the app opens, the displayed fare estimate will be wrong. The user will not be warned of the multiplier change in real time.

---

## 5. Hardcoded / Mock Data That Should Be Dynamic

### M-001 — Home Screen Location Search: Static Mock Array
**Severity: High**  
**File:** `app/(tabs)/index.tsx`

```typescript
const MOCK_LOCATIONS = [
  { id: '1', name: 'Cairo Festival City', ... },
  { id: '2', name: 'Zamalek (26th of July St)', ... },
  { id: '3', name: 'Smart Village', ... },
  { id: '4', name: 'Maadi Degla', ... },
];
```

**Impact:** The pickup/destination search on the home screen shows only 4 hardcoded Egyptian cities regardless of the user's actual location or typed query. The backend contract documents `GET /api/zones` and `GET /api/zones/:id` for zone data. A geocoding/autocomplete integration (e.g., backend-proxied places API) is expected but absent.

---

### M-002 — Shuttle Routes and Stations: Hardcoded Seed Data
**Severity: High**  
**File:** `constants/data.ts`, `app/(tabs)/favorites.tsx`

```typescript
export const routes: Route[] = [
  { id: 'r1', code: 'L01', name: 'خط الخارجة السريع', ... },
  // 3 more hardcoded routes
];

export const stations: Station[] = [
  { id: 's1', name: 'الخارجة - وسط المدينة', ... },
  // 5 more hardcoded stations
];
```

**Impact:** The `favorites.tsx` screen imports `routes` directly from `constants/data` (static array) rather than from `useRoutes()`. Any route added or removed by admin on the backend is not reflected in Favorites. Only the home screen and routes tab correctly use the live `useRoutes()` hook.

---

### M-003 — Trip History: Hardcoded Static Trips
**Severity: High**  
**File:** `constants/data.ts`

```typescript
export const upcomingTrips: Trip[] = [
  { id: 't1', type: 'shuttle', routeName: 'خط الخارجة السريع', ... },
  { id: 't2', type: 'car', routeName: 'رحلة خاصة', ... },
];

export const pastTrips: Trip[] = [
  { id: 'p1', ... }, { id: 'p2', ... }, { id: 'p3', ... },
];
```

`useTrips.ts` exists and correctly calls `GET /api/trips` and `GET /api/bookings` — but the audit found components that may still fall back to these static arrays. These constants should be removed once all consumers use `useTrips`.

---

### M-004 — Notification List: Hardcoded Static Notifications
**Severity: Medium**  
**File:** `constants/data.ts`

```typescript
export const notifications: Notification[] = [
  { id: 'n1', category: 'trip', title: 'الباص يصل خلال 3 دقائق', ... },
  // 3 more hardcoded notifications
];
```

`useNotifications.ts` correctly calls `GET /api/notifications`, but `constants/data.ts` exports static notification data. If any component imports `notifications` from this file instead of `useNotifications`, users see stale example data.

---

### M-005 — Favorites (Car & Bike): Entirely Hardcoded
**Severity: High**  
**File:** `app/(tabs)/favorites.tsx`

```typescript
const CAR_DESTINATIONS = [
  { id: 'cd1', name: 'الخارجة - وسط المدينة', fare: 25, ... },
  { id: 'cd2', name: 'جامعة وادي الجديد', fare: 35, ... },
  { id: 'cd3', name: 'مستشفى الخارجة', fare: 30, ... },
  { id: 'cd4', name: 'سوق الخارجة', fare: 20, ... },
];

const BIKE_TRIPS = [
  { id: 'bt1', from: 'الخارجة - وسط المدينة', to: 'سوق الخارجة', price: 8 },
  // 2 more
];
```

**Impact:** Car and bike "favorites" are static decoration with fake fares and ETAs. The backend provides `GET /api/user/locations` for saved/favorite locations — this is not consumed anywhere. Tapping "Book Car" or "Book Bike" triggers an `Alert.alert('Car Booking', 'Opening car booking flow…')` placeholder.

---

### M-006 — Profile Payment Methods: Hardcoded Mock Cards
**Severity: High**  
**File:** `app/(tabs)/profile.tsx`

```typescript
const MOCK_CARDS = [
  { id: 'c1', type: 'visa', last4: '4242', label: 'Personal Visa', expiry: '12/26' },
  { id: 'c2', type: 'mastercard', last4: '8888', label: 'Work Card', expiry: '09/25' },
];
```

**Impact:** The Payment Methods section in Profile always shows two fake cards. The backend contract does not document card management endpoints for passengers. Either this feature has no backend yet, or it is provided by the payment gateway (Stripe/Paymob) and needs a separate integration.

---

### M-007 — Delivery Service: UI Shell with No Backend
**Severity: Medium**  
**File:** `app/(tabs)/index.tsx`

```typescript
const SERVICES = [
  { id: 'delivery', labelKey: 'delivery', icon: Package },
  // ...
];
```

**Impact:** The Delivery tab button appears in the service grid. The backend contract has no delivery-related endpoints. Tapping Delivery does nothing (the `handleServicePress` handler only acts on `shuttle`, `car`, and `bike`). This misleads users.

---

### M-008 — Bike Service: UI Shell with No Backend
**Severity: Medium**  
**File:** `app/(tabs)/index.tsx`, `context/BookingContext.tsx`

The bike mode renders `<BikeMap>` with a hardcoded `phase` prop and no API integration. There are no bike-related endpoints in the backend contract. Tapping "Book Bike" in Favorites shows a placeholder alert.

---

## 6. Backend Features with No Frontend Coverage

The following documented backend endpoints and socket events have zero corresponding frontend implementation.

### B-001 — SOS / Emergency Alert
**Severity: High**  
**Contract:** `POST /api/rides/:id/sos`  
**Description:** Triggers an emergency alert associated with the active ride.  
**Status:** No SOS button, no emergency flow exists anywhere in the frontend.

---

### B-002 — Ride Sharing / Tracking Link
**Severity: Medium**  
**Contract:** `POST /api/rides/:id/share`  
**Response:** `{ trackingUrl: string }`  
**Description:** Generates a shareable real-time tracking URL for a ride.  
**Status:** No share button or flow exists in any ride screen.

---

### B-003 — Saved Locations (User Addresses)
**Severity: Medium**  
**Contract:**
```
GET    /api/user/locations
POST   /api/user/locations
PATCH  /api/user/locations/:id
DELETE /api/user/locations/:id
```
**Description:** Manage user-saved home/work/custom addresses.  
**Status:** Not implemented anywhere. Favorites screen uses static mock data instead (see M-005).

---

### B-004 — Ride Event History
**Severity: Low**  
**Contract:** `GET /api/rides/:id/events`  
**Description:** Full audit log of state transitions for a ride.  
**Status:** No UI to display ride event history.

---

### B-005 — Promo Code Validation (Correct Passenger Flow)
**Severity: High**  
**Contract:** `POST /api/promos/validate`  
**Body:** `{ code: string }`  
**Response:** `{ valid: boolean, discount: number, type: string }`  
**Status:** `usePromos.ts` calls the admin-only `GET /api/promos` list endpoint. The correct passenger flow — validate a code the user typed — calls `POST /api/promos/validate`, which is not called anywhere.

---

### B-006 — Driver Profile / Vehicle Info During Ride
**Severity: Medium**  
**Contract:** `GET /api/drivers/:id`  
**Description:** Returns driver name, photo, vehicle plate, rating.  
**Status:** `car.tsx` shows hardcoded driver info during the matching phase rather than fetching from the assigned driver's profile endpoint.

---

### B-007 — Wallet Top-Up Initiation
**Severity: Medium**  
**Contract:** `POST /api/wallet/topup`  
**Body:** `{ amount: number, paymentMethod: string }`  
**Description:** Initiates a wallet top-up payment.  
**Status:** `useWallet.ts` and `wallet.tsx` display balances and transaction history but do not implement the top-up initiation flow. The UI shows top-up UI elements (amount input, "Top Up" button) but the button likely triggers a placeholder or is incomplete.

---

### B-008 — Ride Rating for Shuttle (Booking Rating)
**Severity: Medium**  
**Contract:** `POST /api/bookings/:id/rate`  
**Body:** `{ rating: number, comment?: string }`  
**Description:** Rate a completed shuttle booking (distinct from rating a car ride driver).  
**Status:** No post-shuttle-trip rating flow exists. The `car.tsx` rating dialog only targets car rides via the wrong endpoint (see F-003).

---

## 7. Local-State-Only Features (No Backend Persistence)

These features maintain state only in React state or AsyncStorage. They will reset on app reinstall, are not synced across devices, and do not match any backend endpoint.

### L-001 — Privacy Settings (Location History, Analytics, Ads)
**File:** `app/(tabs)/profile.tsx`  
**Backend endpoint:** None documented for passengers.  
**Status:** Three toggle switches (`shareLocation`, `analytics`, `personalizedAds`) use `useState` and are never persisted. Restarting the app resets them.

---

### L-002 — Security Settings (Biometric, 2FA)
**File:** `app/(tabs)/profile.tsx`  
**Backend endpoint:** None documented for passengers.  
**Status:** `biometric` and `twoFactor` toggles use `useState`. No backend call is made when toggled. The 2FA toggle in particular is a security-critical feature that must be server-side.

---

### L-003 — Notification Preferences
**File:** `src/hooks/useNotifications.ts`  
**Backend endpoint:** `PATCH /api/driver/settings` exists but is driver-only; no passenger notification preference endpoint is documented.  
**Status:** Notification preferences (push enabled, categories) appear to be stored in `AsyncStorage` only. Not synced to the backend.

---

### L-004 — Shuttle Route Favorites
**File:** `context/FavoritesContext.tsx` (inferred), `app/(tabs)/favorites.tsx`  
**Backend endpoint:** `GET/POST/PATCH/DELETE /api/user/locations` could serve this role.  
**Status:** Favorite shuttle routes are stored in local React context (and likely AsyncStorage). They are not persisted to the backend and will be lost on reinstall or across devices.

---

## 8. Correct Integrations (Reference)

The following integrations are correctly implemented and match the backend contract:

| Feature | Frontend Call | Contract Endpoint | Status |
|---|---|---|---|
| Login | `POST /auth/login` | `POST /api/auth/login` | ✅ Correct |
| Register | `POST /auth/register` | `POST /api/auth/register` | ✅ Correct |
| Wallet balance | `GET /wallet` | `GET /api/wallet` | ✅ Correct |
| Wallet transactions | `GET /wallet/transactions` | `GET /api/wallet/transactions` | ✅ Correct |
| Shuttle routes list | `GET /routes` | `GET /api/routes` | ✅ Correct |
| Shuttle line detail | `GET /shuttle/lines/:id` | `GET /api/shuttle/lines/:id` | ✅ Correct |
| Create booking | `POST /bookings` | `POST /api/bookings` | ✅ Correct |
| Booking history | `GET /bookings` | `GET /api/bookings` | ✅ Correct |
| Service control fetch | `GET /service-controls` | `GET /api/service-controls` | ✅ Correct |
| Service control socket auth | `{ token }` in handshake | Bearer token auth | ✅ Correct |
| Support ticket create | `POST /support` | `POST /api/support` | ✅ Correct |
| Notifications list | `GET /notifications` | `GET /api/notifications` | ✅ Correct |

---

## 9. Risk Matrix

| ID | Description | Severity | User Impact | Broken In Production? |
|---|---|---|---|---|
| F-001 | Ride request wrong path | **Critical** | Cannot book any car ride | Yes |
| F-003 | Rate driver wrong path | **Critical** | Ratings silently lost | Yes |
| F-005 | Profile wrong path | **Critical** | Profile never loads or saves | Yes |
| F-006 | Chat wrong path | **Critical** | In-ride chat broken | Yes |
| F-002 | Fare estimate endpoint missing | **Critical** | Car booking flow blocked | Yes |
| F-004 | Ride cancel wrong method | **High** | Cannot cancel car rides | Yes |
| F-007 | Booking cancel wrong method | **High** | Cannot cancel shuttle | Yes |
| F-008 | Promo listing admin-only | **High** | 403 on promo screen | Yes |
| F-009 | Forgot password missing | **High** | Account recovery broken | Yes |
| S-001 | Service control event name | **High** | Service status stale | Yes |
| S-002 | Driver location event name | **High** | Map marker never moves | Yes |
| S-003 | Trip join event name + payload | **High** | No real-time shuttle updates | Yes |
| B-001 | No SOS feature | **High** | Safety feature missing | N/A (never built) |
| B-005 | Promo validate not called | **High** | Promo discount never applied | Yes |
| M-001 | Mock location search | **High** | Search unusable in prod | Yes |
| M-005 | Hardcoded car/bike favorites | **High** | Fake fares displayed | Yes |
| M-006 | Mock payment cards | **High** | Fake cards displayed | Yes |
| S-004 | Waiting charge events missing | **Medium** | Silent unexpected charges | Yes |
| S-005 | Surge update event missing | **Medium** | Wrong fare shown | Yes |
| B-003 | Saved locations not implemented | **Medium** | Feature missing | N/A |
| B-006 | Driver profile not fetched | **Medium** | Hardcoded driver info | Yes |
| B-007 | Wallet top-up not wired | **Medium** | Top-up flow broken | Yes |
| B-008 | Shuttle trip rating missing | **Medium** | Cannot rate shuttle | N/A |
| L-002 | 2FA toggle local only | **Medium** | Security setting not real | Yes |
| M-002 | Static routes in Favorites | **Medium** | Stale route data | Yes |
| M-003 | Hardcoded trip history | **Medium** | Fake trips shown | Partial |
| B-002 | No ride share/tracking link | **Low** | Feature missing | N/A |
| B-004 | No ride event history | **Low** | Feature missing | N/A |
| M-004 | Static notifications | **Low** | Stale examples | Partial |
| M-007 | Delivery UI no backend | **Low** | Dead button | Yes |
| M-008 | Bike UI no backend | **Low** | Dead placeholder | Yes |
| L-001 | Privacy settings local only | **Low** | Resets on reinstall | Yes |
| L-003 | Notification prefs local | **Low** | Not synced | Yes |
| L-004 | Favorites local only | **Low** | Not synced | Yes |

---

## 10. Findings Summary Table

| ID | Category | File(s) | Frontend Call | Contract Spec | Issue |
|---|---|---|---|---|---|
| F-001 | Wrong path | `useRide.ts` | `POST /rides/request` | `POST /api/rides` | Extra `/request` segment |
| F-002 | Missing endpoint | `car.tsx` | `POST /rides/estimate` | *(none)* | Endpoint not in contract |
| F-003 | Wrong path | `car.tsx` | `POST /rides/{id}/rate` | `POST /api/rides/:id/rate-driver` | Missing `-driver` suffix |
| F-004 | Wrong method | `useRide.ts` | `PATCH /rides/{id}/cancel` | `POST /api/rides/:id/cancel` | PATCH → POST |
| F-005 | Wrong path | `useProfile.ts` | `GET/PATCH /users/me` | `GET/PATCH /api/auth/me` | `/users/` → `/auth/` |
| F-006 | Wrong path + resource | `useRideChat.ts` | `GET/POST /trips/{id}/chat` | `GET/POST /api/chat/:rideId` | Wrong resource namespace |
| F-007 | Wrong method | `trips.tsx` | `PATCH /bookings/{id}/cancel` | `POST /api/bookings/:id/cancel` | PATCH → POST |
| F-008 | Admin endpoint exposed | `usePromos.ts` | `GET /promo` | `GET /api/promos` (admin) | Passenger calling admin route |
| F-009 | Missing endpoint | `auth.tsx` | `POST /auth/forgot-password` | *(none)* | Endpoint not in contract |
| F-010 | Config risk | `BookingContext.tsx` | `GET /wallet` | `GET /api/wallet` | Correct only if BASE_URL has `/api` |
| S-001 | Event name | `ServiceControlContext.tsx` | `service:control:changed` | `service:control_changed` | Colon vs underscore |
| S-002 | Event name | `useRide.ts` | `ride:driver_location` | `ride:location_updated` | Different event name |
| S-003 | Event name + payload | `BookingContext.tsx` | `emit('passenger:join:trip', id)` | `emit('passenger:join_trip', {tripId})` | Name + payload format wrong |
| S-004 | Unhandled event | `useRide.ts` | *(not listening)* | `ride:free_window_ended`, `ride:waiting_charge_updated` | Events ignored |
| S-005 | Unhandled event | `useRide.ts`, `car.tsx` | *(not listening)* | `surge:update` | Event ignored |
| M-001 | Hardcoded data | `index.tsx` | `MOCK_LOCATIONS` array | Geocoding/places API | Static 4-item list |
| M-002 | Hardcoded data | `constants/data.ts`, `favorites.tsx` | `routes` static import | `GET /api/routes` | Static seed data |
| M-003 | Hardcoded data | `constants/data.ts` | `upcomingTrips`, `pastTrips` | `GET /api/trips`, `GET /api/bookings` | Static seed trips |
| M-004 | Hardcoded data | `constants/data.ts` | `notifications` array | `GET /api/notifications` | Static seed data |
| M-005 | Hardcoded data | `favorites.tsx` | `CAR_DESTINATIONS`, `BIKE_TRIPS` | *(none / user locations)* | Fake fares, placeholder alert |
| M-006 | Hardcoded data | `profile.tsx` | `MOCK_CARDS` | *(no card endpoint in contract)* | Fake payment methods |
| M-007 | No backend | `index.tsx` | *(delivery button does nothing)* | *(none)* | Dead UI element |
| M-008 | No backend | `index.tsx`, `favorites.tsx` | *(bike = placeholder)* | *(none)* | Placeholder |
| B-001 | Missing feature | *(none)* | *(no SOS UI)* | `POST /api/rides/:id/sos` | Safety feature absent |
| B-002 | Missing feature | *(none)* | *(no share UI)* | `POST /api/rides/:id/share` | Feature not built |
| B-003 | Missing feature | *(none)* | *(no saved locations UI)* | `GET/POST/PATCH/DELETE /api/user/locations` | Feature not built |
| B-004 | Missing feature | *(none)* | *(no event log UI)* | `GET /api/rides/:id/events` | Feature not built |
| B-005 | Wrong endpoint | `usePromos.ts` | `GET /promo` | `POST /api/promos/validate` | Wrong endpoint for passenger use case |
| B-006 | Missing fetch | `car.tsx` | *(hardcoded driver)* | `GET /api/drivers/:id` | Driver info not fetched |
| B-007 | Incomplete | `wallet.tsx` | *(top-up button incomplete)* | `POST /api/wallet/topup` | Top-up flow not wired |
| B-008 | Missing feature | *(none)* | *(no shuttle rating UI)* | `POST /api/bookings/:id/rate` | Feature not built |
| L-001 | Local state only | `profile.tsx` | *(no API call)* | *(none documented)* | Resets on reinstall |
| L-002 | Local state only | `profile.tsx` | *(no API call)* | *(none documented)* | Security setting fake |
| L-003 | Local state only | `useNotifications.ts` | *(AsyncStorage only)* | *(none for passengers)* | Not synced |
| L-004 | Local state only | `FavoritesContext` | *(local context)* | `GET/POST /api/user/locations` | Not persisted to backend |

---

*End of audit. No code was modified during this review.*
