# VeeGo Passenger App — Backend API Integration Report

**Prepared for:** Backend Engineering Team
**Source:** Full codebase audit — all `// TODO:` annotations extracted verbatim from source files
**Frontend stack:** React Native 0.81.5 · Expo SDK 54 · expo-router · TypeScript
**Base URL convention:** All paths are relative to `EXPO_PUBLIC_API_URL` (e.g. `https://api.veego.app/api`)

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Both client and server are live and connected |
| 🟡 | Client is wired and listening — server must implement or extend |
| 🔴 | Frontend is fully ready — backend endpoint not yet built |

---

## Summary Checklist

| # | Endpoint | Method | Status |
|---|----------|--------|--------|
| API-01 | `/users/me/password` | `PATCH` | 🔴 Not connected |
| API-02 | `/users/me/privacy` | `PATCH` + `GET` | 🔴 Not connected |
| API-03 | `/users/me/notifications` | `PATCH` + `GET` | 🟡 AsyncStorage only |
| API-04 | `/users/me/rating` | `GET` | 🔴 Mock data shown |
| API-05 | `/users/me/stats` | `GET` | 🔴 Not connected |
| API-06 | `/users/me/avatar` | `POST` | 🔴 Not connected |
| API-07 | `/promo/validate` | `POST` | 🟡 Hook wired, endpoint pending |
| API-08 | `/bookings` | `POST` + `promoCode` field | 🟡 Endpoint exists, field missing |
| API-09 | `/shuttle/lines/:id` | `GET` + `duration` / `departureCount` | 🟡 Endpoint exists, fields missing |
| API-10 | `/users/me/bookings` | `GET` (paginated) | ✅ Connected |
| API-11 | `/bookings/:id/cancel` | `PATCH` | ✅ Connected |
| API-12 | `/shuttle/trips/:id/availability` | `GET` | 🔴 Not connected |
| SOCKET-01 | `join:trip` / `leave:trip` | Client emits | ✅ Client emits |
| SOCKET-02 | `shuttle:trip:status` | Server emits | 🟡 Client listens, server must emit |
| SOCKET-03 | `ride:*` events (9 events) | Server emits | 🟡 Client listens, server must emit |
| SOCKET-04 | `notification:new` | Server emits | 🟡 Client listens, server must emit |
| SOCKET-05 | `booking:boarded` | Server emits | 🟡 Client listens, server must emit |

---

## Module 1 — Authenticated User Profile Suite & Security Toggles

---

### API-01 · Change Password

- **Feature / Screen:** Profile → Personal Info modal (`app/(tabs)/profile.tsx` line 264)
- **Action / Trigger:** User fills current password + new password + confirm fields and taps **Save Changes**
- **Endpoint & Method:** `PATCH /users/me/password`
- **Auth:** Bearer token required

**Request Payload:**
```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

**Success Response `200`:**
```json
{
  "message": "Password updated successfully."
}
```

**Error Response `400` / `401`:**
```json
{
  "message": "Current password is incorrect."
}
```

**Context / Why it's needed:**
The frontend already calls `api.patch('/users/me/password', payload)` and surfaces `e.response.data.message` directly to the user via `Alert`. No client-side hashing — passwords are transmitted over HTTPS and must be validated server-side. The endpoint should re-issue or invalidate existing refresh tokens to force re-authentication on other devices after a successful password change.

---

### API-02 · Privacy Preference Toggles

- **Feature / Screen:** Profile → Privacy modal (`app/(tabs)/profile.tsx` line 465)
- **Action / Trigger:** User toggles any of the three privacy switches
- **Endpoint & Method:** `PATCH /users/me/privacy` · `GET /users/me/privacy`
- **Auth:** Bearer token required

**Request Payload (PATCH):**
```json
{
  "locationHistory": true,
  "analytics": true,
  "personalizedAds": false
}
```

**Success Response `200` (both PATCH and GET return the same shape):**
```json
{
  "locationHistory": true,
  "analytics": true,
  "personalizedAds": false
}
```

**Context / Why it's needed:**
All three toggles are currently stored in **React local state only** — they reset on every app restart. The backend must persist these preferences per user and honour them when deciding whether to:
- Log GPS traces (`locationHistory`)
- Send behavioural analytics events (`analytics`)
- Serve personalised promotional offers (`personalizedAds`)

The frontend calls `PATCH` on every toggle change (recommend 800 ms debounce). On modal open, `GET /users/me/privacy` is needed to hydrate the initial toggle states from the server.

---

### API-03 · Notification Preference Toggles

- **Feature / Screen:** Profile → Notifications modal (`app/(tabs)/profile.tsx` line 551)
- **Action / Trigger:** User toggles any of the four notification category switches
- **Endpoint & Method:** `PATCH /users/me/notifications` · `GET /users/me/notifications`
- **Auth:** Bearer token required

**Request Payload (PATCH):**
```json
{
  "trips": true,
  "promos": false,
  "system": true,
  "driverUpdates": true
}
```

**Success Response `200` (both PATCH and GET return the same shape):**
```json
{
  "trips": true,
  "promos": false,
  "system": true,
  "driverUpdates": true
}
```

**Context / Why it's needed:**
Preferences are currently persisted only in `AsyncStorage` under key `@veego_notif_v1` — they are not synced to the backend. The backend must use these flags as gates before dispatching push notifications. The four categories map to:

| Field | Notification Type |
|-------|------------------|
| `trips` | Booking confirmations, departure reminders, status changes |
| `promos` | Promotional offers and discount codes |
| `system` | System messages and operational announcements |
| `driverUpdates` | Real-time driver location and ETA alerts |

The frontend already has AsyncStorage as an offline fallback. `GET /users/me/notifications` is needed on modal open to hydrate from the server.

---

### API-04 · Passenger Rating Statistics

- **Feature / Screen:** Profile hero card + Rating Details modal (`app/(tabs)/profile.tsx` lines 709, 906, 912)
- **Action / Trigger:** Profile screen mount; user taps the Rating stat on the hero card
- **Endpoint & Method:** `GET /users/me/rating`
- **Auth:** Bearer token required

**Success Response `200`:**
```json
{
  "overallScore": 4.9,
  "totalRatings": 124,
  "distribution": {
    "5": 72,
    "4": 18,
    "3": 6,
    "2": 2,
    "1": 2
  }
}
```

> **Note:** `distribution` values are **integer percentages** (0–100) that must sum to 100. The animated bar chart in `RatingDetailsModal` computes bar widths as `distribution[star] / 100` directly.

**Context / Why it's needed:**
The profile hero card currently displays `—` for the Rating stat. `RatingDetailsModal` is rendering hardcoded mock constants (`MOCK_OVERALL_SCORE = 4.9`, `MOCK_TOTAL_RATINGS = 124`, `MOCK_RATING_DISTRIBUTION`). These will be replaced with a `useEffect` fetch the moment this endpoint is live — no additional frontend changes required.

---

### API-05 · Profile Savings Statistics

- **Feature / Screen:** Profile hero card — "Saved" stat (`app/(tabs)/profile.tsx` lines 827, 912)
- **Action / Trigger:** Profile screen mount
- **Endpoint & Method:** `GET /users/me/stats`
- **Auth:** Bearer token required

**Success Response `200`:**
```json
{
  "savedAmount": 240.50
}
```

`savedAmount` is a float representing cumulative EGP saved via promo codes and loyalty discounts across all past bookings. The hero card currently renders `—` for this field.

**Context / Why it's needed:**
The wallet `spent` field already in the system tracks **expenditure**, not savings. These are different metrics. The backend should compute `savedAmount` as the sum of `discountAmount` across all confirmed (non-cancelled) bookings for the authenticated user.

---

### API-06 · User Avatar Upload

- **Feature / Screen:** Profile hero avatar circle (`app/(tabs)/profile.tsx` lines 849–858)
- **Action / Trigger:** User taps avatar → picks from photo library → optimistic preview shown immediately
- **Endpoint & Method:** `POST /users/me/avatar`
- **Auth:** Bearer token required
- **Content-Type:** `multipart/form-data`

**Request Payload (multipart):**

| Field | Value |
|-------|-------|
| Field name | `avatar` |
| File format | JPEG |
| Quality | 0.8 (80%) |
| Aspect ratio | 1:1 (square crop enforced by client) |
| MIME type | `image/jpeg` |
| Filename | `avatar.jpg` |

**Success Response `200`:**
```json
{
  "avatarUrl": "https://cdn.veego.app/avatars/user_123.jpg"
}
```

**Error Response `400` / `413`:**
```json
{
  "message": "Upload failed. File too large or invalid format."
}
```

**Context / Why it's needed:**
The frontend shows an optimistic preview immediately using the local device URI. If the upload fails, it automatically rolls back to the previous avatar. The `avatarUrl` in the response should be the permanent CDN-hosted URL — the frontend stores this and uses `<Image source={{ uri: avatarUrl }} />` on all subsequent sessions.

---

## Module 2 — Home Screen, Routes & Booking Flow (Promos & Fare Calculation)

---

### API-07 · Promo Code Validation

- **Feature / Screen:** Review & Confirm screen — promo code input (`app/review-confirm.tsx` line 90)
- **Action / Trigger:** User types a promo code and taps **Apply**
- **Endpoint & Method:** `POST /promo/validate`
- **Auth:** Bearer token required

**Request Payload:**
```json
{
  "code": "SAVE20",
  "orderTotal": 150.00
}
```

`orderTotal` is the raw fare before any discount, in EGP (float).

**Success Response `200` — Fixed EGP discount:**
```json
{
  "valid": true,
  "discount": "30.00",
  "discountType": "fixed",
  "message": "Promo applied! You save 30 EGP."
}
```

**Success Response `200` — Percentage discount:**
```json
{
  "valid": true,
  "discount": "20%",
  "discountType": "percent",
  "message": "20% discount applied!"
}
```

**Response for invalid / expired code:**
```json
{
  "valid": false,
  "message": "This promo code has expired."
}
```

**Context / Why it's needed:**
The `validateCode()` helper inside `BookingContext` calls this endpoint. The `discount` field is parsed by `parseDiscountAmount()` on the client, which accepts either:
- A numeric string (`"30.00"`) → fixed EGP deduction
- A percentage string (`"20%"`) → computed as `orderTotal * 0.20`

The client then computes `finalTotal = max(0, baseTotal - discountAmt)` for display purposes only. The authoritative deduction must be enforced server-side at booking creation (see API-08).

---

### API-08 · Booking Confirmation with Promo Discount

- **Feature / Screen:** Review & Confirm screen — Confirm Booking button (`app/review-confirm.tsx` line 114)
- **Action / Trigger:** User taps **Confirm Booking** after optionally applying a promo code
- **Endpoint & Method:** `POST /bookings` *(existing endpoint — extend with `promoCode` field)*
- **Auth:** Bearer token required

**Updated Request Payload:**
```json
{
  "tripId": "string",
  "seatCount": 1,
  "fromStationId": "string",
  "toStationId": "string",
  "promoCode": "SAVE20"
}
```

> `promoCode` is optional — omit or send `null` if no code was applied by the user.

**Success Response `201`:**
```json
{
  "bookingId": "string",
  "totalPrice": 120.00,
  "discountApplied": 30.00,
  "seatNumber": "B4",
  "status": "scheduled"
}
```

**Context / Why it's needed:**
The frontend passes `appliedCode` (the validated promo string) directly into `handleConfirm()`. The backend **must re-validate the promo code server-side** at booking creation — the client-side validation (API-07) is for UX preview only and must never be trusted as authoritative. The backend should reject the booking with a clear error message if the promo has expired or been used between the validation call and the confirmation call.

---

### API-09 · Shuttle Line Enrichment — Departure Count & Duration

- **Feature / Screen:** TripSheet stat cards — Departures & Trip Duration (`components/TripSheet.tsx` line 516)
- **Action / Trigger:** TripSheet bottom sheet opens when user selects a route from the Routes screen
- **Endpoint & Method:** `GET /shuttle/lines/:id` *(existing endpoint — add two fields to response)*
- **Auth:** Bearer token required

**Required additions to the existing response body:**
```json
{
  "id": "string",
  "name": "string",
  "name_ar": "string",
  "price": 25,
  "stations": [],

  "duration": "45 min",
  "departureCount": 12
}
```

| New Field | Type | Description |
|-----------|------|-------------|
| `duration` | `string` | Human-readable trip duration. Should be locale-aware (e.g. `"45 دقيقة"` for Arabic). The frontend renders this value verbatim — no client-side formatting needed. |
| `departureCount` | `integer` | Total number of available departures for the current calendar day on this line. |

**Context / Why it's needed:**
These two values power the horizontal stat cards at the top of TripSheet. Currently `route.duration` is `null` for most lines, so the Duration card shows `—`. The `departureCount` is currently computed on the client as `visibleTrips.length` (which is accurate but causes a brief flicker until all trips finish loading). A server-provided value eliminates this flicker and is more efficient.

---

## Module 3 — MyTrips Screen, Passenger Capacity Sync & Cancellation Flow

---

### API-10 · Paginated Booking History

- **Feature / Screen:** My Trips screen — Upcoming and Past tabs (`app/(tabs)/trips.tsx` lines 2–4)
- **Action / Trigger:** Screen mount; pull-to-refresh; "Load More" tapped
- **Endpoint & Method:** `GET /users/me/bookings?page=1&limit=10`
- **Auth:** Bearer token required

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | integer | 1-based page number |
| `limit` | integer | Items per page (default: 10) |

**Success Response `200`:**
```json
{
  "total": 47,
  "bookings": [
    {
      "id": "bk_001",
      "type": "shuttle",
      "status": "scheduled",
      "seatNumber": "B4",
      "seatCount": 1,
      "totalPrice": 120.00,
      "promoCodeId": "promo_xyz",
      "paymentStatus": "paid",
      "scheduledAt": "2025-06-14T08:30:00Z",
      "trip": {
        "id": "trip_001",
        "shuttleStatus": "scheduled",
        "departureTime": "2025-06-14T08:30:00Z",
        "passengerCount": 8,
        "totalSeats": 20,
        "availableSeats": 12,
        "minPassengers": 5,
        "vehicleType": "minibus",
        "pickupStation": {
          "id": "st_01",
          "latitude": 30.0626,
          "longitude": 31.2497
        },
        "route": {
          "code": "L01",
          "name": "Maadi → Tahrir",
          "name_ar": "معادي ← التحرير",
          "fromLocation": "Maadi",
          "fromLocationAr": "المعادي",
          "toLocation": "Tahrir Square",
          "toLocationAr": "ميدان التحرير"
        }
      }
    }
  ]
}
```

**Context / Why it's needed:**
The `useTrips` hook (`src/hooks/useTrips.ts`) maps this response using `mapApiBooking()`, which already normalises several field aliases (`trip.route ?? trip.shuttleLine ?? trip.line`, etc.). Key implementation notes:
- Departure times **must be ISO-8601 UTC** — the client converts to `Africa/Cairo` timezone for display.
- Arabic name fields (`name_ar`, `fromLocationAr`, `toLocationAr`) are used when the app language is set to Arabic.
- The hook also calls `GET /rides/my` separately for car/scooter rides on page 1 only.
- The `total` field drives the "Load More" button visibility (`hasMore = loaded < total`).

> **Status:** ✅ This endpoint is connected. The schema above documents the exact field names the client expects — please verify your response matches.

---

### API-11 · Cancel Booking

- **Feature / Screen:** My Trips screen — Cancel button → CancelReasonSheet (`app/(tabs)/trips.tsx` line 3)
- **Action / Trigger:** User selects a cancellation reason in the bottom sheet and confirms
- **Endpoint & Method:** `PATCH /bookings/:id/cancel`
- **Auth:** Bearer token required

**Request Payload:**
```json
{
  "reason": "Driver is too far away"
}
```

> `reason` is optional — the request body may be omitted entirely if the user dismisses without selecting a reason.

**Success Response `200`:**
```json
{
  "bookingId": "string",
  "status": "cancelled",
  "refundAmount": 0,
  "message": "Booking cancelled successfully."
}
```

**Context / Why it's needed:**
The frontend calls `api.patch('/bookings/${tripId}/cancel', reason ? { reason } : undefined)` then triggers a full trip list refresh with an animated fade-out of the cancelled card. This cancellation must atomically:
1. Set booking `status` to `cancelled`
2. Release the reserved seat slot back to the trip's `availableSeats` count
3. Emit a `shuttle:trip:status` socket event (see SOCKET-02) to all connected passengers on the same trip so their capacity bars update instantly

> **Status:** ✅ This endpoint is connected. Points 2 and 3 above may need to be verified server-side.

---

### API-12 · Live Trip Seat Availability

- **Feature / Screen:** TripSheet departure-time selector rows (`components/TripSheet.tsx` line 602); My Trips capacity bar
- **Action / Trigger:** TripSheet opens; called again when user changes selected departure time
- **Endpoint & Method:** `GET /shuttle/trips/:id/availability`
- **Auth:** Bearer token required

**Success Response `200`:**
```json
{
  "tripId": "string",
  "availableSeats": 7,
  "bookedSeats": 13,
  "totalSeats": 20,
  "passengerCount": 13,
  "status": "scheduled"
}
```

**Context / Why it's needed:**
Currently the frontend falls back to snapshot values embedded in `GET /shuttle/lines/:id` (`trip.availableSeats`, `trip.totalSeats`). These are stale by the time the user is actively selecting a departure. This dedicated endpoint provides a fresh, authoritative seat count. The TripSheet calls it on mount and on every departure time change. The My Trips screen uses it alongside socket patches (SOCKET-02) to keep the `CapacityBar` component accurate in real-time.

---

## Module 4 — Real-time Notifications & Socket Events

**Socket connection:** Connects to the server root (not `/api`) at Socket.IO path `/api/socket.io`.
**Authentication:** Passed via `auth: { token }` in the Socket.IO handshake options.
**Transport:** WebSocket preferred; falls back to polling on web platform only.

All client-side event listeners are already wired in `src/api/socket.ts` and the screens below. The backend must emit the events with the exact payload shapes specified.

---

### SOCKET-01 · Trip Room Subscription

| Direction | Event | Payload |
|-----------|-------|---------|
| Client → Server | `join:trip` | `{ "tripId": "string" }` |
| Client → Server | `leave:trip` | `{ "tripId": "string" }` |

**Context / Why it's needed:**
The My Trips screen emits `join:trip` for every upcoming shuttle trip on mount (filtered to `type === 'shuttle'` with a non-null `tripId`). The server must add the socket to a room named by `tripId` so trip-specific broadcast events can be scoped correctly. On component unmount or trip completion, the client emits `leave:trip` to clean up the room subscription.

---

### SOCKET-02 · Live Trip Status & Capacity Push

| Direction | Event | Payload |
|-----------|-------|---------|
| Server → Client | `shuttle:trip:status` | See below |

**Payload:**
```json
{
  "tripId": "trip_001",
  "status": "boarding",
  "passengerCount": 15
}
```

> Both `status` and `passengerCount` are **optional** — the server may emit either or both fields in a single event. The client merges the patch onto the existing trip card state.

**Valid `status` values:**

| Value | Meaning |
|-------|---------|
| `waiting_driver` | Trip created, no driver yet |
| `scheduled` | Driver assigned, not yet departed |
| `driver_assigned` | Driver confirmed and en route to first pickup |
| `active` | Trip is in progress |
| `boarding` | Currently picking up passengers |
| `completed` | Trip finished |
| `cancelled` | Trip cancelled by operator |

**Context / Why it's needed:**
This is the primary real-time channel for the My Trips screen. Emit to room `tripId` whenever:
- A passenger boards → increment `passengerCount`
- A booking is cancelled → decrement `passengerCount`, adjust `availableSeats`
- The trip's operational status changes

The frontend has a 60-second fallback REST poll (`refresh()`) as a safety net for any missed socket events.

---

### SOCKET-03 · Ride Lifecycle Events (Car & Scooter)

All nine events below are typed in `RideSocketEvents` (`src/api/socket.ts` lines 89–101).

| Event | Payload |
|-------|---------|
| `ride:driver_assigned` | `{ rideId, driver: { name, phone, vehicle, rating }, eta: number }` |
| `ride:driver_location` | `{ rideId, location: { latitude, longitude, heading? } }` |
| `ride:arrived` | `{ rideId }` |
| `ride:started` | `{ rideId }` |
| `ride:completed` | `{ rideId, fare: number }` |
| `ride:cancelled` | `{ rideId, reason: string }` |
| `ride:driver_cancelled` | `{ rideId?, reason? }` |
| `ride:no_show_cancelled` | `{ rideId?, reason? }` |
| `ride:timeout` | `{ rideId }` |

**Full example — `ride:driver_assigned`:**
```json
{
  "rideId": "ride_abc123",
  "driver": {
    "name": "Ahmed Hassan",
    "phone": "+201001234567",
    "vehicle": "Toyota Yaris — White",
    "rating": 4.8
  },
  "eta": 5
}
```

**Full example — `ride:driver_location`:**
```json
{
  "rideId": "ride_abc123",
  "location": {
    "latitude": 30.0626,
    "longitude": 31.2497,
    "heading": 180
  }
}
```

**Full example — `ride:completed`:**
```json
{
  "rideId": "ride_abc123",
  "fare": 87.50
}
```

**Context / Why it's needed:**
These events drive the live ride-tracking screen and the `TripSheet` status banners for car/scooter bookings.
- `ride:driver_location` should be emitted at a **minimum 3-second interval** while the ride is in `driver_assigned` or `started` status.
- `fare` in `ride:completed` should reflect the **final metered amount in EGP**.
- `eta` in `ride:driver_assigned` is in **minutes**.

---

### SOCKET-04 · In-App Push Notification Bridge

| Direction | Event | Payload |
|-----------|-------|---------|
| Server → Client | `notification:new` | See below |

**Payload:**
```json
{
  "id": "notif_xyz",
  "type": "booking_confirmed",
  "title": "Booking Confirmed",
  "body": "Your seat on L01 — Maadi → Tahrir is confirmed for 8:30 AM.",
  "createdAt": "2025-06-14T06:15:00Z"
}
```

**Suggested `type` values:**

| Value | Use Case |
|-------|---------|
| `booking_confirmed` | Booking successfully created |
| `booking_cancelled` | Booking cancelled (by user or operator) |
| `driver_assigned` | Driver has been assigned to a ride |
| `trip_departed` | Shuttle has departed from first station |
| `promo` | Promotional offer or discount code |
| `system` | Operational or maintenance announcements |

**Context / Why it's needed:**
The frontend notification badge and in-app notification tray listen to this event. The `type` field controls which icon and accent colour the frontend renders. This event should be emitted to the user's personal socket room after: booking confirmation, cancellation, driver assignment, and operator broadcasts. This is **separate from OS-level push notifications** (APNs/FCM) — it drives the in-app UI only.

---

### SOCKET-05 · Passenger Boarding Confirmation

| Direction | Event | Payload |
|-----------|-------|---------|
| Server → Client | `booking:boarded` | See below |

**Payload:**
```json
{
  "bookingId": "bk_001",
  "passengerId": "user_123",
  "timestamp": "2025-06-14T08:31:42Z"
}
```

**Context / Why it's needed:**
Emitted to the trip room when a passenger's QR code is scanned by the driver or station attendant. The frontend uses this event to transition the booking card from `scheduled` → `boarding` status and may display a "You're on board!" confirmation toast. Also increments the live `passengerCount` displayed in the capacity bar.

---

## Appendix — Frontend Field Alias Tolerance

The `mapApiBooking()` function in `src/hooks/useTrips.ts` already handles several common naming variations. The following aliases are all accepted:

| Logical Field | Accepted API Keys |
|---------------|-------------------|
| Booking type | `type`, `bookingType`, `booking_type`, `serviceType`, `service_type`, `category` |
| Trip status | `shuttleStatus`, `shuttle_status`, `status` |
| Departure time | `departureTime`, `departure_time`, `scheduledAt`, `scheduled_at` |
| Route object | `trip.route`, `trip.shuttleLine`, `trip.line` |
| Route name (EN) | `route.name`, `trip.name`, `b.destinationName`, `b.destination_name` |
| Route name (AR) | `route.nameAr`, `route.name_ar` |
| From location (EN) | `route.fromLocation`, `route.from_location`, `route.from`, `b.pickupAddress`, `b.pickup_name`, `b.origin` |
| From location (AR) | `route.fromLocationAr`, `route.from_location_ar` |
| To location (EN) | `route.toLocation`, `route.to_location`, `route.to`, `b.destinationAddress`, `b.destination_name`, `b.destination` |
| To location (AR) | `route.toLocationAr`, `route.to_location_ar` |
| Seat number | `seatNumber`, `seat_number`, `seat` |
| Total price | `totalPrice`, `total_price`, `trip.price`, `price`, `fare` |
| Trip ID | `trip.id`, `trip._id`, `tripId`, `trip_id` |
| Passenger count | `passengerCount`, `passenger_count` |
| Total seats | `totalSeats`, `total_seats` |
| Available seats | `availableSeats`, `available_seats` |

Using camelCase versions of these fields is recommended for consistency with the rest of the API.

---

*Report generated from codebase audit — `app/`, `components/`, `src/` directories*
*Last updated: June 2025*
