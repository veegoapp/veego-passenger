/**
 * Pure state-merging/derivation helpers used by useRide.ts, pulled out into
 * their own dependency-free module so they can be unit tested without
 * loading the rest of the hook (sockets, native task-manager, etc).
 */

/** Present only for InstaPay rides, once the ride completes. */
export type PaymentStatus =
  | 'not_required'
  | 'awaiting_payment'
  | 'awaiting_confirmation'
  | 'confirmed'
  | null;

/**
 * Merges a fresh `paymentStatus` value (from a poll or a status-change
 * socket event) with the value already in local state.
 *
 * 'confirmed' is a terminal state — it is only ever set by the dedicated
 * `ride:instapay:confirmed` event once the driver has confirmed receipt of
 * payment. A later poll or a re-delivered/out-of-order `ride:status:changed`
 * event can still carry a stale, pre-confirmation `paymentStatus` (or omit
 * the field entirely); naively preferring "fresh over stale" there would
 * regress the UI from "payment confirmed" back to "awaiting confirmation"
 * (the exact class of bug found in the driver app's shuttle status-merge
 * code). So once local state is 'confirmed', it stays 'confirmed'
 * regardless of what a later merge carries.
 */
export function mergePaymentStatus(
  existing: PaymentStatus,
  incoming: PaymentStatus | null | undefined,
): PaymentStatus {
  if (existing === 'confirmed') return 'confirmed';
  return incoming ?? existing;
}

/**
 * Merges a fresh driver payload (poll response) with the driver already in
 * local state.
 */
export function mapDriverFromRide(
  rideDriver: any,
  topLevelEta: number | undefined,
  fallback: any | null,
): any | null {
  if (!rideDriver) return fallback;
  return {
    name: rideDriver.name ?? fallback?.name ?? 'Driver',
    phone: rideDriver.phone ?? fallback?.phone ?? '',
    // Prefer the URL already on screen over the poll's fresh one: the
    // backend re-signs the storage URL on every single GET /rides/:id call
    // (POLL_INTERVAL_MS = 5000), so a same-photo poll still returns a
    // different signature/token each time. Replacing `avatar` with that new
    // string every 5s made <Image> treat it as a different source and
    // reload — a visible flicker with no actual change. Once a working URL
    // is on screen, keep it; only fall back to the poll's value when we
    // don't have one yet (e.g. this is the first snapshot after recovery).
    avatar: fallback?.avatar ?? rideDriver.avatar ?? null,
    vehicle: rideDriver.vehicle ?? fallback?.vehicle ?? '',
    vehicleColor: rideDriver.vehicleColor ?? rideDriver.vehicle_color ?? fallback?.vehicleColor,
    vehicleColorHex: rideDriver.vehicleColorHex ?? rideDriver.vehicle_color_hex ?? fallback?.vehicleColorHex,
    plateNumber: rideDriver.plateNumber ?? rideDriver.plate_number ?? fallback?.plateNumber,
    rating: rideDriver.rating ?? fallback?.rating ?? 4.8,
    eta: topLevelEta ?? rideDriver.eta ?? fallback?.eta ?? null,
    instaPayEnabled: rideDriver.instaPayEnabled ?? fallback?.instaPayEnabled ?? false,
  };
}
