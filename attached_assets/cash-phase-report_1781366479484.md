# Cash Phase Report
**Date:** June 13, 2026  
**Scope:** Wallet screen flag, payment method config, and cash-only payment path

---

## What Was Built or Changed

### 1. Database — New Columns
| Table | Column | Type | Default |
|---|---|---|---|
| `rides` | `payment_method` | `text` | `'wallet'` |
| `bookings` | `payment_method` | `text` | `'wallet'` |

All existing records default to `'wallet'` — fully backward compatible.

### 2. Database — New Settings Keys
| Key | Initial Value | Purpose |
|---|---|---|
| `wallet_feature` | `{"isEnabled":false,"displayMode":"coming_soon","unavailableMessage":"Wallet is coming soon"}` | Controls the wallet screen state in the passenger app |
| `payment_methods` | `{"cash":true,"wallet":false,"card":false}` | Controls which payment methods are available |

Both are stored in the existing `settings` table and editable from the Admin Dashboard via API.

### 3. New File — `artifacts/api-server/src/routes/paymentConfig.ts`
Handles all wallet feature flag and payment method configuration endpoints.

### 4. Modified — `artifacts/api-server/src/routes/rides.ts`
- `paymentMethod` field added to ride request body (`"cash"` | `"wallet"`, defaults to `"cash"`)
- Wallet balance check skipped when `paymentMethod === "cash"`
- Wallet escrow deduction skipped when `paymentMethod === "cash"`
- `paymentMethod` stored on the ride row
- Cancellation refund skipped when ride was cash
- Ride completion: waiting charge wallet deduction skipped when cash
- `payments` table entry records the correct method (`"cash"` or `"wallet"`) on completion

### 5. Modified — `artifacts/api-server/src/routes/bookings.ts`
- `paymentMethod` field added to booking body (`"cash"` | `"wallet"`, defaults to `"cash"`)
- Wallet balance check skipped when `paymentMethod === "cash"`
- Wallet deduction skipped when `paymentMethod === "cash"`
- Cash bookings set `paymentStatus: "pending"` (payment not yet collected) and create a `payments` record with `status: "pending"` and `method: "cash"`
- Cancellation wallet refund skipped when `paymentMethod !== "cash"` or `paymentStatus !== "paid"`

### 6. Modified — `lib/db/src/schema/rides.ts` and `lib/db/src/schema/bookings.ts`
Added `paymentMethod` text column to both Drizzle schemas.

### 7. Modified — `lib/api-zod/src/generated/api.ts`
Added `paymentMethod: zod.enum(["cash", "wallet"]).optional()` to `CreateBookingBody`.

### 8. Modified — `artifacts/api-server/src/lib/socket-events.ts`
Added two new socket events:
- `WALLET_FEATURE_CHANGED: "wallet:feature:changed"`
- `PAYMENT_METHODS_CHANGED: "payment:methods:changed"`

### 9. Modified — `artifacts/api-server/src/routes/index.ts`
Registered `paymentConfigRouter`.

---

## New and Modified Endpoints

### New Public Endpoints (JWT required, any role)

#### `GET /api/config/wallet-feature`
Returns the current wallet feature flag.

**Response:**
```json
{
  "data": {
    "isEnabled": false,
    "displayMode": "coming_soon",
    "unavailableMessage": "Wallet is coming soon"
  }
}
```

`displayMode` values: `"live"` | `"coming_soon"` | `"unavailable"` | `"maintenance"`

#### `GET /api/config/payment-methods`
Returns which payment methods are currently active.

**Response:**
```json
{
  "data": {
    "cash": true,
    "wallet": false,
    "card": false
  }
}
```

---

### New Admin Endpoints (JWT + admin role required)

#### `GET /api/admin/config/wallet-feature`
Same response as the public endpoint.

#### `PATCH /api/admin/config/wallet-feature`
Update the wallet feature flag. Broadcasts `wallet:feature:changed` via WebSocket to all connected clients.

**Request body** (all fields optional):
```json
{
  "isEnabled": false,
  "displayMode": "coming_soon",
  "unavailableMessage": "Wallet is coming soon"
}
```

#### `GET /api/admin/config/payment-methods`
Same response as the public endpoint.

#### `PATCH /api/admin/config/payment-methods`
Update which payment methods are active. Broadcasts `payment:methods:changed` via WebSocket to all connected clients.

**Request body** (all fields optional):
```json
{
  "cash": true,
  "wallet": false,
  "card": false
}
```

---

### Modified Endpoints

#### `POST /api/rides/request`
New optional field:

| Field | Type | Default | Description |
|---|---|---|---|
| `paymentMethod` | `"cash"` \| `"wallet"` | `"cash"` | Payment method for this ride |

**Cash behavior:**
- No wallet balance check
- No wallet escrow deduction at request time
- No wallet refund on cancellation
- No wallet deduction for waiting charge on completion
- Ride record stores `payment_method: "cash"`
- `payments` table entry on completion has `method: "cash"`

#### `POST /api/bookings`
New optional field:

| Field | Type | Default | Description |
|---|---|---|---|
| `paymentMethod` | `"cash"` \| `"wallet"` | `"cash"` | Payment method for this booking |

**Cash behavior:**
- No wallet balance check
- No wallet deduction at booking time
- `paymentStatus` set to `"pending"` (not `"paid"`)
- A `payments` record is created with `method: "cash"`, `status: "pending"` for audit trail
- On cancellation: no wallet refund issued (there was no deduction)

---

## WebSocket Events

### `wallet:feature:changed`
Emitted to **all connected clients** when the wallet feature flag is updated via admin.

**Payload:**
```json
{
  "isEnabled": false,
  "displayMode": "coming_soon",
  "unavailableMessage": "Wallet is coming soon",
  "changedAt": "2026-06-13T22:00:00.000Z"
}
```

### `payment:methods:changed`
Emitted to **all connected clients** when payment method config is updated via admin.

**Payload:**
```json
{
  "cash": true,
  "wallet": false,
  "card": false,
  "changedAt": "2026-06-13T22:00:00.000Z"
}
```

---

## Passenger App Notes

### Wallet Screen

1. **On app startup and after login**, call `GET /api/config/wallet-feature` and store the result.

2. **Listen for the WebSocket event** `wallet:feature:changed` and update the stored value in real-time without requiring a screen refresh.

3. **Render the wallet tab/screen based on `displayMode`:**

   | `displayMode` | Behavior |
   |---|---|
   | `"live"` | Show wallet normally |
   | `"coming_soon"` | Grey out the tab with a "Coming Soon" badge; tapping it shows `unavailableMessage` or a default banner |
   | `"unavailable"` | Same as coming_soon visually, different messaging |
   | `"maintenance"` | Show maintenance state |

   > Current value: `displayMode: "coming_soon"`, `unavailableMessage: "Wallet is coming soon"`

4. **If `isEnabled` is `false`**, the wallet route/screen should not be accessible (redirect or show the coming-soon state).

---

### Payment Method Selection

1. **On app startup and after login**, call `GET /api/config/payment-methods` and store the result.

2. **Listen for `payment:methods:changed`** WebSocket event to update in real-time.

3. **Only show payment methods where the value is `true`:**
   - Currently: only `cash: true` — show only cash
   - When `wallet: true` is enabled later — add wallet option
   - When `card: true` is enabled — add card/Paymob option

4. **When requesting a ride** (`POST /api/rides/request`), send `paymentMethod: "cash"` in the request body.

5. **When creating a shuttle booking** (`POST /api/bookings`), send `paymentMethod: "cash"` in the request body.

6. **Remove or hide** the "Top Up Wallet" / "Add Funds" flow from the home screen and any ride confirmation screen until `wallet` is enabled.

7. **For cash rides:**
   - No need to show wallet balance or check balance before requesting
   - At ride completion, show "Pay driver [amount] EGP in cash"
   - The driver app will confirm receipt

---

## Driver App Notes

### Cash Ride Handling

1. **The ride offer payload is unchanged** — drivers receive the same `ride:offer` / `ride:new_request` WebSocket event as before.

2. **The ride object now includes `paymentMethod`** in the ride record returned from `GET /api/driver/rides/:id` and all ride status events. Possible values: `"cash"` | `"wallet"`.

3. **When `paymentMethod === "cash"`**, show a clear indicator on the ride detail screen:
   - e.g., a cash icon or "Cash Payment" label
   - At ride completion, prompt the driver: "Collect [finalPrice] EGP in cash from passenger"

4. **Earnings are credited the same way** — the platform records driver earnings via the `driver_earnings` table regardless of payment method. Commission still applies.

5. **No action required for driver cancellations** — the cancellation fee logic is unchanged; however, for cash rides where the driver cancelled, no wallet refund is issued to the passenger (there was none to refund). The cancellation fee for driver-cancelled cash rides may need a separate product decision (currently not enforced from the passenger's wallet for cash).

---

## Notes for Future Phase

- When the wallet is ready to launch, call `PATCH /api/admin/config/wallet-feature` with `{ "isEnabled": true, "displayMode": "live" }` — the change propagates to all connected passenger app clients instantly via WebSocket.
- When enabling wallet payments, call `PATCH /api/admin/config/payment-methods` with `{ "wallet": true }` — the passenger app should immediately show the wallet as a payment option.
- The `paymentMethod` field on rides and bookings is stored for all time, giving a clean audit trail of which payment method was used for each transaction.
