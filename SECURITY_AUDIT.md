# VEEGO PASSENGER APP — FULL SECURITY AUDIT

**Date:** 2026-06-21  
**Scope:** React Native / Expo frontend (veego-passenger)  
**Focus:** Security vulnerabilities only

---

## TABLE OF CONTENTS

1. [Authentication Security](#1-authentication-security)
2. [API Security](#2-api-security)
3. [Socket Security](#3-socket-security)
4. [Data Exposure](#4-data-exposure)
5. [App Logic Abuse](#5-app-logic-abuse)
6. [Input & State Manipulation](#6-input--state-manipulation)
7. [Security Score](#security-score)
8. [Top 10 Risks](#top-10-risks-priority-order)

---

## 1. AUTHENTICATION SECURITY

---

### [P0] JWT Stored in `localStorage` on Web Platform

**File:** `src/api/client.ts:27`

```ts
if (Platform.OS === 'web') return localStorage.getItem(key);
```

**Exploit scenario:** On the web build, both the access token (`veego_access_token`) and refresh token (`veego_refresh_token`) are stored in `localStorage`. Any XSS payload — injected via a push notification deep link, a malicious promo code value rendered without sanitization, or a third-party SDK — can exfiltrate both tokens with a single `localStorage.getItem()` call, giving an attacker persistent session access.

**Impact:** Full account takeover. Refresh token theft enables session survival even after access token expiry. No mitigation without switching to `httpOnly` cookies on web.

---

### [P0] Splash Screen Authentication Gate Bypassed by AsyncStorage Forgery

**File:** `app/index.tsx:43-59`

```ts
const session = await AsyncStorage.getItem(SESSION_KEY);
if (session) {
  router.replace('/(tabs)');
} else {
  router.replace('/onboarding');
}
```

**Exploit scenario:** The splash gate only checks for the presence of `@veego_session_v1` in `AsyncStorage` — a plain JSON blob containing `{ identifier, name, loggedInAt }` with **no JWT**. On a rooted Android device (or via another malicious app sharing the same `AsyncStorage` namespace on older Android), an attacker writes:

```json
{"identifier":"victim@mail.com","name":"User","loggedInAt":1700000000000}
```

The app immediately skips to `/(tabs)`, fully bypassing the auth screen. The UI loads, and any API call that actually requires the JWT will fail — but many read-only screens (favorites, UI state) render fine without backend validation.

**Impact:** Unauthorized access to protected screens; UI data exposure; potential for session fixation if the app later stores a token under an attacker-influenced identity.

---

### [P1] Socket JWT Passed in Plaintext Auth Handshake (Logged to Console)

**File:** `src/api/socket.ts:32-40, 43-44`

```ts
socket = io(SOCKET_URL, {
  auth: token ? { token } : {},
  ...
});
socket.on('connect', () => {
  console.log('[Socket] connected:', socket?.id);
});
```

**Exploit scenario:** The JWT is passed as `auth.token` during the socket.io handshake. On web, this is included in the upgrade HTTP headers, which are logged by development proxies and corporate network appliances. The `console.log` statement also exposes the `socket?.id` in production logs, which helps an attacker correlate sessions in socket room attacks.

**Impact:** Token leakage through proxy/network logs; socket session enumeration.

---

### [P1] No JWT Validity Check on App Resume / Token Revocation

**File:** `app/index.tsx:53`, `src/api/client.ts:61-67`

The Axios interceptor attaches a cached JWT to every request, and the 401 handler refreshes it — but only when a request fails. If an account is suspended server-side and the app is in background, all protected screens remain accessible until the next API call. The `/suspended` screen redirect only fires after a `403 account_suspended` response.

**Exploit scenario:** Admin suspends an account. The passenger still has a valid short-lived JWT. For the next 12–60 minutes (depending on JWT TTL), the user (or someone borrowing their device) can browse all screens, see booking history, request rides, and attempt actions — none of which are blocked client-side.

**Impact:** Suspended account enforcement delayed; no immediate lockout.

---

## 2. API SECURITY

---

### [P0] SOS Event Emitted on Driver-Owned Socket Channel

**File:** `app/trip-detail.tsx:500-508`

```ts
socket.emit('driver:sos', { rideId: null, latitude: 0, longitude: 0, notes: 'Passenger SOS' });
```

**Exploit scenario:** The passenger SOS button emits `driver:sos` — an event clearly intended for the driver app. The event is sent with hardcoded `latitude: 0, longitude: 0` (Gulf of Guinea) and `rideId: null`. Any passenger can:

1. **Flood the emergency queue** — tap SOS repeatedly, sending hundreds of fake alerts with null ride IDs to the backend.
2. **Spoof driver identity** — if the server accepts `driver:sos` from any authenticated socket (not validating the emitter's role), a passenger is impersonating a driver emergency.

**Impact:** P0 — DoS against the emergency dispatch system; driver role impersonation; resource exhaustion on backend.

---

### [P1] IDOR — Booking and Trip IDs Controlled by Route Params

**File:** `app/trip-detail.tsx:214`, `app/trip-tracking.tsx:89`

```ts
// trip-detail.tsx
const single = await api.get(`/bookings/${id}`).catch(() => null);

// trip-tracking.tsx (deep link path)
api.get(`/rides/${deepId}`)
```

`id` comes from `useLocalSearchParams()`, which can be set by any navigation call or deep link. The deep link handler in `_layout.tsx:79` does:

```ts
router.push(`/trip-detail?id=${tripId}` as any);
```

where `tripId` is extracted from untrusted notification payload without sanitization.

**Exploit scenario:** Attacker crafts a push notification deep link `veego://shuttle/trip/999` where `999` belongs to another passenger's booking. If the server does not enforce that `/bookings/999` belongs to the requesting user, the attacker sees another user's trip details including pickup location, driver info, seat number, and price.

**Impact:** Cross-passenger data disclosure; privacy violation; booking manipulation.

---

### [P1] Passenger App Calls Driver-Only API Endpoint

**File:** `app/trip-detail.tsx:262-275`

```ts
const res = await api.get(`/driver/trips/${tripId}/stations`);
```

**Exploit scenario:** The passenger client calls `/driver/trips/:id/stations` — a route prefixed with `/driver/`, indicating it belongs to the driver service layer. If the server routes don't enforce role-based access (driver vs. passenger), any authenticated passenger can:

- Enumerate any trip's station progression data
- Access driver management metadata not intended for passengers
- Probe other trips beyond their own by iterating `tripId`

**Impact:** Data exposure; potential privilege escalation if the driver endpoint has write operations nearby.

---

### [P1] Wallet Top-Up Has No Client-Side Amount Bounds Enforcement

**File:** `src/hooks/shared/useWallet.ts:138-150`

```ts
const recharge = useCallback(async (amount: number, paymentMethod: string = 'wallet') => {
  await api.post('/wallet/topup', { amount, paymentMethod });
```

`amount` is passed from client state with no validation before the API call. The UI only presents 50/100/200/500 EGP options, but these are pure UI controls — a developer console call or a patched app binary can send `POST /wallet/topup { amount: 99999999 }`.

**Impact:** Financial abuse if the server trusts the client amount; wallet balance manipulation.

---

### [P1] `verify-phone` Phone Parameter Comes from Untrusted Route Params

**File:** `app/verify-phone.tsx:28, 75`

```ts
const { phone, maskedPhone, termsVersion } = useLocalSearchParams<{ phone: string; ... }>();
...
const { data } = await api.post('/auth/verify-otp', { phone, otp });
```

**Exploit scenario:** An attacker deep-links directly to `/verify-phone?phone=%2B201234567890` with a victim's phone number. The screen auto-requests an OTP to the victim's phone and then allows OTP attempts. The attacker can use this to:

1. Spam OTP SMS to any phone number
2. Perform OTP brute force if the server has weak rate limiting
3. Initiate account takeover if OTP entropy is low (6 digits = 1,000,000 combinations, feasible if server rate limit window > 60 seconds)

**Impact:** Phone enumeration; OTP spam DoS; potential account takeover.

---

## 3. SOCKET SECURITY

---

### [P1] `join:trip` Room Emitted with Any Attacker-Controlled Trip ID

**File:** `app/trip-detail.tsx:315`, `app/ticket.tsx:314`

```ts
socket.emit('join:trip', { tripId: id });           // trip-detail.tsx
socket.emit('passenger:join:trip', Number(tripId)); // ticket.tsx
```

Both `id` (from route params) and `tripId` (from `BookingContext`) are sent to the server to join a socket room. If the server does not verify that the connecting user has an active booking for `tripId`, any passenger can subscribe to any trip room.

**Exploit scenario:** Attacker brute-forces or guesses `tripId` values and joins those rooms. They receive real-time driver GPS location, passenger count updates, and boarding confirmations for trips they're not booked on — giving live tracking of strangers.

**Impact:** Real-time passenger tracking / surveillance; location privacy violation.

---

### [P1] `booking:boarded` Event Accepted Without Booking ID Verification in Trip Detail

**File:** `app/trip-detail.tsx:358-360`

```ts
const boardedHandler = () => setBoarded(true);
socket.on('booking:boarded', boardedHandler);
```

Compare to `app/ticket.tsx:277-284` which properly checks `String(data.bookingId) === bare`. The `trip-detail.tsx` handler fires on **any** `booking:boarded` event received on the socket, regardless of which booking it belongs to.

**Exploit scenario:** Passenger A is viewing their trip detail screen. If the server broadcasts a generic `booking:boarded` event to the trip room (not just the passenger's personal room), Passenger A's screen will show "on board" even if it was Passenger B who boarded. This corrupts UI state and could mask a fraud scenario (someone else scanning your QR code to board in your place).

**Impact:** Incorrect boarding state; potential fraud concealment.

---

### [P1] Optional `rideId` Guard in Waiting Charge Socket Events

**File:** `src/hooks/car/useRide.ts:270-294`

```ts
socket.on('ride:waiting:charge:started', (data: any) => {
  if (data.rideId && data.rideId !== rideId) return;
  setRideState((prev) => ({ ...prev, waitingChargeStatus: 'active', ... }));
});
```

The guard `if (data.rideId && ...)` is only active when `data.rideId` is truthy. If a malicious or malformed event omits `rideId`, the check is skipped entirely and the charge state is updated for the wrong ride.

**Exploit scenario:** Attacker (or buggy backend) sends `{ charge: 9999 }` without `rideId` — the passenger's waiting charge counter updates to 9999 EGP even though their ride hasn't started. This is a UI manipulation and could cause a passenger to cancel, thinking they owe money.

**Impact:** Fare UI manipulation; passenger confusion; potential premature cancellation.

---

### [P2] Socket Payload Data Trusted Without Schema Validation

**File:** `src/hooks/car/useRide.ts:155-303`

All socket event handlers use `data: any` and directly access fields (`data.driver.phone`, `data.fare`, `data.meta.finalPrice`) with no type-checking or sanitization:

```ts
socket.on('ride:driver_assigned', (data: any) => {
  // data.driver.name, data.driver.phone displayed directly in UI
```

**Exploit scenario:** A compromised backend, MITM WebSocket injection, or malicious socket room could inject `data.driver.phone = "javascript:alert(1)"` or other payload. On web builds where this is rendered via React Native Web into DOM text nodes, XSS is possible if the value ever flows into an unsafe HTML context.

**Impact:** Potential XSS on web build; data integrity violation; UI spoofing.

---

## 4. DATA EXPOSURE

---

### [P1] Production `console.log` Statements Leaking Raw API Responses

**File:** `context/BookingContext.tsx:171-204`

```ts
console.log('[BookingContext] GET /shuttle/lines/:id raw response:', JSON.stringify(data));
console.log('[BookingContext] Unwrapped "full" keys:', Object.keys(full));
console.log('[BookingContext] First trip sample:', JSON.stringify(activeTrips[0]));
```

Three unguarded `console.log` calls dump complete raw API responses — including trip IDs, pricing, seat data, driver details — to the device's system log in production. On Android, `logcat` is accessible without root via ADB. In beta distributions, crash analytics tools (Sentry, Datadog) often capture console output.

**Impact:** Sensitive booking data leakage; driver info exposure; PII in analytics logs.

---

### [P1] Passenger Location History Stored Unencrypted in AsyncStorage

**File:** `src/hooks/shared/usePassengerTracking.ts:38-48`

```ts
const OFFLINE_STORE_KEY = 'veego_offline_location_snapshots';
await AsyncStorage.setItem(OFFLINE_STORE_KEY, JSON.stringify(snapshots));
```

Offline location snapshots accumulate indefinitely (up to 500) in plain AsyncStorage as JSON. Each entry contains `{ latitude, longitude, speed, heading, accuracy, recordedAt, tripId, rideId }`. On Android, this is stored in the app's SQLite-backed file, accessible on rooted devices or if the device is unlocked and connected via ADB.

**Impact:** Historical GPS trail of passenger movements stored in plaintext; privacy violation if device is compromised.

---

### [P1] Session Identifier Stored in AsyncStorage Instead of SecureStore

**File:** `app/auth.tsx:17-23`, `app/verify-phone.tsx:78-83`

```ts
const SESSION_KEY = '@veego_session_v1';
await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({
  identifier: data.user.email ?? data.user.phone ?? phone,
  name: data.user.name ?? '',
  loggedInAt: Date.now(),
}));
```

The session object storing the user's **email/phone** is stored in `AsyncStorage` instead of `SecureStore`. On Android < API 23, AsyncStorage is stored unencrypted. On rooted devices, it's readable by any process. This is particularly sensitive because email/phone are authentication identifiers.

**Impact:** PII exposure; session identifier leakage.

---

### [P2] Driver Internal `userId` Exposed in Client State and API Calls

**File:** `app/trip-detail.tsx:94`, `app/trip-detail.tsx:478`

```ts
driverUserId: trip.driver?.userId ?? trip.driver?.user?.id ?? ...
// Later:
await api.post('/shuttle/ratings', { tripId: Number(trip.id), rateeId: trip.driverUserId, stars });
```

The driver's internal database `userId` is exposed to the passenger client and used as `rateeId` in the rating API call. If the `rateeId` is not validated server-side against the actual trip's driver, a passenger can rate any user by modifying this value.

**Impact:** Rating manipulation; internal user ID exposure.

---

### [P2] Driver Phone Number Stored in Unprotected Client State

**File:** `src/hooks/car/useRide.ts:163`, `app/trip-tracking.tsx:258-261`

Driver phone numbers are stored in React state (`rideState.driver.phone`) and rendered in the UI. On a shared/family device, another user can view the trip tracking screen and harvest driver phone numbers.

**Impact:** Driver privacy violation; phone number scraping.

---

## 5. APP LOGIC ABUSE

---

### [P1] QR Scanner Accepts Arbitrary Hex Strings as Valid Booking IDs

**File:** `components/shared/QRScanner.tsx:66-69`

```ts
if (/^(VG-|#VG-|VEEGO-)/i.test(data) || /^[a-f0-9]{8,}$/i.test(data)) {
  isValid = true;
  parsedData = data.replace(/^#/, '');
}
```

Any hex string of 8+ characters passes as a valid booking ID. An attacker can generate QR codes with arbitrary UUIDs or hex strings and attempt to board buses.

**Exploit scenario:** Generate a QR code containing a random UUID like `deadbeef12345678`. The scanner accepts it as valid and passes it to the boarding handler. If the server doesn't validate the booking-to-passenger relationship properly, this could enable unauthorized boarding.

**Impact:** Potential unauthorized boarding; bypass of QR boarding gate.

---

### [P1] Seat Count is Client-Controlled State with No Client-Side Maximum

**File:** `context/BookingContext.tsx:135, 278-282`

```ts
const [seatCount, setSeatCount] = useState<number>(1);
// ...
const body = { tripId, seatCount, paymentMethod: 'cash' };
await api.post('/bookings', body);
```

`seatCount` is stored in context and exposed via `setSeatCount`. The UI restricts seat count, but since `setSeatCount` is accessible through the context, a patched build or developer console can set `seatCount = 0` or `seatCount = 99` and submit the booking.

**Impact:** Booking manipulation; seat overbooking attempts; zero-seat booking abuse.

---

### [P2] Client-Side Service Availability Gate Can Be Bypassed

**File:** `context/BookingContext.tsx:255-261`

```ts
const svc = getServiceRef.current('shuttle');
if (svc && (!svc.isEnabled || svc.displayMode !== 'live')) {
  Alert.alert('Service Unavailable', msg);
  return;
}
```

The service control check happens in client-side context state. On a patched or compromised build, an attacker can modify the service control state to always return `{ isEnabled: true, displayMode: 'live' }` and bypass the gate to submit bookings even when the service is administratively disabled.

**Impact:** Bookings during maintenance windows; admin control circumvention.

---

### [P2] Deep Link Promo Code Auto-Applied Without User Confirmation

**File:** `app/promo.tsx:144-153`

```ts
useEffect(() => {
  if (prefillCode && !autoApplied.current) {
    autoApplied.current = true;
    setTimeout(() => handleApply(trimmed), 400);
  }
}, [prefillCode]);
```

A promo code delivered via notification deep link (`veego://promo/CODE`) is automatically applied without any user confirmation. A malicious push notification (if the attacker gains access to push notification sending) could force-apply a promo code that tracks usage, exhausts valid codes, or associates the user's account with a specific campaign without consent.

**Impact:** Silent promo code application; analytics tracking without consent; code exhaustion DoS.

---

## 6. INPUT & STATE MANIPULATION

---

### [P1] Navigation Params Carry Unvalidated Driver Data to Trip Tracking Screen

**File:** `app/trip-tracking.tsx:39-72`

```ts
const params = useLocalSearchParams<{
  driverName?: string;
  driverVehicle?: string;
  driverRating?: string;
  driverPhone?: string;
  ...
}>();
const [driverInfo, setDriverInfo] = useState({
  name: params.driverName,
  vehicle: params.driverVehicle,
  ...
});
```

The trip tracking screen accepts `driverName`, `driverVehicle`, `driverRating`, `driverPhone` from navigation parameters and renders them directly in the UI without API verification.

**Exploit scenario:** If an attacker can craft a navigation event to `/trip-tracking?driverName=Support+Agent&driverPhone=attacker_phone`, the screen renders the attacker's phone number as the driver's — a social-engineering attack that convinces a passenger to call this number.

**Impact:** Driver impersonation; social engineering attack vector; phishing.

---

### [P1] OTP Countdown Only Client-Side — Server Rate Limiting Is the Sole Defense

**File:** `app/auth.tsx:526-529`, `app/verify-phone.tsx:46-65`

```ts
const [countdown, setCountdown] = useState(60);
// ...
const handleResend = () => {
  setCountdown(60);
  onResend();
};
```

The 60-second OTP resend countdown is purely in React state. A fresh component mount (app restart, navigation) resets the countdown to 0, allowing unlimited resends. The only protection is server-side rate limiting.

**Impact:** If server rate limiting is misconfigured, unlimited OTP spam to any phone number.

---

### [P2] Stale Socket Listener Not Cleaned Up in `trip-tracking.tsx`

**File:** `app/trip-tracking.tsx:131-178`

```ts
return () => {
  getSocket().then((socket) => {
    socket.off('ride:driver_location', onDriverLocation);
    ...
  }).catch(() => {});
  socketListening.current = false;
};
```

If the component unmounts before the async `getSocket()` cleanup resolves, the socket listeners remain registered. On re-mount, `socketListening.current = true` blocks re-registration, leaving the component with no active socket listeners.

**Impact:** Stale closures; missed ride status updates; ghost listeners accumulating over multiple sessions.

---

### [P2] `ContactSupportModal` Does Not Send Message to Backend

**File:** `app/(tabs)/profile.tsx:671-680`

```ts
const handleSend = () => {
  if (!selectedIssue || !message.trim()) { ... }
  setSent(true); // ← No API call made
};
```

The contact support form sets `sent = true` and shows a success screen without making any API call. Users believe their support request was submitted, but it was silently dropped.

**Impact:** Users experiencing real security incidents (account compromise, billing disputes) receive false confirmation that their issue was reported — directly undermining incident response capability.

---

## SECURITY SCORE

```
=== PASSENGER APP SECURITY SCORE (0–100) ===

Authentication:      42/100  (localStorage JWT on web, AsyncStorage session bypass)
API Security:        55/100  (IDOR risk, driver endpoint exposure, wallet abuse)
Socket Security:     48/100  (unauthorized room join, boarded spoofing, SOS abuse)
Data Exposure:       50/100  (prod console.log, plain AsyncStorage location data)
App Logic:           58/100  (QR bypass, seat count manipulation, client-side gates)
Input Handling:      52/100  (nav params to UI, OTP phone param, unvalidated deep links)

OVERALL SCORE:       51 / 100
```

---

## TOP 10 RISKS (PRIORITY ORDER)

| Rank | Severity | Issue | File |
|------|----------|-------|------|
| 1 | **P0** | JWT stored in `localStorage` on web — XSS steals both tokens | `src/api/client.ts:27` |
| 2 | **P0** | SOS emits `driver:sos` from passenger — role spoofing + DoS of emergency system | `app/trip-detail.tsx:501` |
| 3 | **P0** | Splash screen auth bypassed by forging `@veego_session_v1` in AsyncStorage | `app/index.tsx:46-56` |
| 4 | **P1** | IDOR: booking/trip ID from route params used in API calls without ownership check | `app/trip-detail.tsx:214`, `app/trip-tracking.tsx:89` |
| 5 | **P1** | `join:trip` socket room accepts any passenger-supplied `tripId` — live surveillance | `app/trip-detail.tsx:315` |
| 6 | **P1** | `verify-phone` phone from route params — enables OTP spam & account takeover | `app/verify-phone.tsx:28,75` |
| 7 | **P1** | Production `console.log` dumping raw API responses including booking/user data | `context/BookingContext.tsx:171-204` |
| 8 | **P1** | Passenger calls `/driver/trips/:id/stations` — driver API without role check | `app/trip-detail.tsx:263` |
| 9 | **P1** | `booking:boarded` handler in trip-detail has no bookingId guard — any event matches | `app/trip-detail.tsx:359` |
| 10 | **P1** | Offline GPS history stored unencrypted in AsyncStorage (up to 500 location points) | `src/hooks/shared/usePassengerTracking.ts:38-48` |

---

## IMMEDIATE ACTION ITEMS

1. **Switch web token storage** from `localStorage` to `httpOnly` cookies with `Secure` + `SameSite=Strict` (`src/api/client.ts`)
2. **Remove all `console.log` calls** in `BookingContext.tsx` before any production release
3. **Rename and restrict SOS** — change `driver:sos` to `passenger:sos` and add server-side role enforcement (`app/trip-detail.tsx:501`)
4. **Add `tripId` ownership validation** on the server before accepting `join:trip` socket room subscriptions
5. **Add `bookingId` check** to `boardedHandler` in `trip-detail.tsx:359`
6. **Validate phone ownership** before displaying `verify-phone` screen — require it to be initiated only from a server-triggered flow
7. **Move session identifier** (`@veego_session_v1`) from `AsyncStorage` to `SecureStore`
8. **Move offline location snapshots** to `expo-secure-store` or encrypt the AsyncStorage value
9. **Add server-side role guard** on `/driver/trips/:id/stations` to reject non-driver tokens
10. **Add server-side amount validation** on `/wallet/topup` with a per-request maximum cap

---

*End of Audit — veego-passenger frontend security review*
