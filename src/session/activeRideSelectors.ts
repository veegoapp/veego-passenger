/**
 * activeRideSelectors.ts
 *
 * Thin selector layer that extracts a ready-to-render ride snapshot from the
 * ActiveSession context. Components and hooks should consume this instead of
 * reading ActiveSessionContext directly.
 *
 * - Returns null when there is no session, or when the session is a
 *   shuttle_booking (Shuttle is not migrated in this phase).
 * - Converts ActiveSession field shapes (lat/lng, backend status enums) to
 *   the client-side shapes already used by useRide / trip-tracking.
 */

import type { NormalizedPassengerActiveSession } from './activeSessionTypes';
import { normalizeRideStatus } from '../api/socket';
import type { RideStatus, DriverLocation } from '../api/socket';

export type ActiveRideType = 'car' | 'scooter' | 'delivery';

export interface ActiveRideDriverInfo {
  name: string;
  phone: string;
  /** Signed URL to the driver's profile photo, or null when they have none set. */
  avatar: string | null;
  /** Combined vehicle description (make/model or vehicleType label). */
  vehicle: string;
  vehicleColor?: string;
  plateNumber?: string;
  rating: number;
  /** ETA in minutes — not stored in ActiveSession; defaulted to 5. Socket
   *  events (ride:driver_assigned, ride:eta_update) will refine this. */
  eta: number;
}

/**
 * Normalized snapshot of an active car / scooter / delivery ride, derived
 * entirely from ActiveSession. All field shapes match what useRide / the ride
 * UI already expects so callers need no additional mapping.
 */
export interface ActiveRideSnapshot {
  rideId: string;
  rideType: ActiveRideType;
  status: RideStatus;
  driver: ActiveRideDriverInfo | null;
  driverLocation: DriverLocation | null;
  fare: number | null;
  waitingCharge: number;
  pickup: { latitude: number; longitude: number; address: string };
  dropoff: { latitude: number; longitude: number; address: string };
  /** Delivery only — null for car/scooter. */
  recipient: { name: string; phone: string } | null;
  estimatedPrice: number | null;
  paymentMethod: string;
}


/**
 * Returns the active ride snapshot from the normalized session, or null when:
 *   - session is null (no active session)
 *   - session.kind === 'shuttle' (Shuttle not migrated in this phase)
 */
export function selectActiveRide(
  session: NormalizedPassengerActiveSession | null,
): ActiveRideSnapshot | null {
  if (!session || session.kind !== 'ride') return null;

  // Build driver info from the ActiveSession driver object.
  let driver: ActiveRideDriverInfo | null = null;
  if (session.driver) {
    const d = session.driver;
    // Prefer vehicle.make + model for the label; fall back to vehicleType.
    const vehicleLabel = d.vehicle
      ? `${d.vehicle.make} ${d.vehicle.model}`.trim()
      : (d.vehicleType ?? '');

    driver = {
      name: d.name,
      phone: d.phone ?? '',
      avatar: d.avatar ?? null,
      vehicle: vehicleLabel,
      vehicleColor: d.vehicle?.color,
      plateNumber: d.vehicle?.plateNumber,
      rating: d.rating ?? 4.8,
      eta: 5, // ActiveSession has no ETA field; socket events refine this.
    };
  }

  // Convert ActiveSession's {lat, lng} location to DriverLocation {latitude, longitude}.
  let driverLocation: DriverLocation | null = null;
  if (session.driver?.location) {
    const loc = session.driver.location;
    const updatedAtMs = loc.updatedAt ? new Date(loc.updatedAt).getTime() : NaN;
    driverLocation = {
      latitude: loc.lat,
      longitude: loc.lng,
      ...(loc.heading !== null ? { heading: loc.heading } : {}),
      ...(Number.isFinite(updatedAtMs) ? { updatedAtMs } : {}),
    };
  }

  return {
    rideId: String(session.rideId),
    rideType: session.vehicleType,
    // normalizeRideStatus() is the single canonical status mapping for the app;
    // the former local mapActiveSessionStatus() duplicated the same logic.
    status: (normalizeRideStatus(session.status) ?? 'searching') as RideStatus,
    driver,
    driverLocation,
    // NOTE: session.finalPrice is the locked/estimated price of an in-progress
    // ride, not the completion-time netCashPayable amount — PassengerRideSession
    // (activeSessionTypes.ts) has no 'completed' status because the backend
    // clears the session snapshot the moment a ride completes (rideCompletionService
    // GAP-3), so this value is superseded by the ride:completed / ride:status:changed
    // socket payloads (which do carry netCashPayable) before it could ever be
    // read as a final amount. useRide's terminal-state guards prevent this
    // pre-completion value from overwriting the completion fare afterwards.
    fare: session.finalPrice,
    waitingCharge: session.waitingCharge,
    pickup: session.pickup,
    dropoff: session.dropoff,
    recipient: session.recipient,
    estimatedPrice: session.estimatedPrice,
    paymentMethod: session.paymentMethod,
  };
}
