import type {
  NormalizedPassengerActiveSession,
  PassengerActiveSession,
  PassengerRideSession,
  PassengerRideStatus,
  PassengerRideVehicleType,
  PassengerShuttleBookingStatus,
  PassengerShuttleSession,
  PassengerShuttleTripStatus,
} from './activeSessionTypes';

const RIDE_VEHICLE_TYPES: readonly PassengerRideVehicleType[] = [
  'car',
  'scooter',
  'delivery',
];

const RIDE_STATUSES: readonly PassengerRideStatus[] = [
  'requested',
  'searching',
  'driver_assigned',
  'driver_arrived',
  'active',
];

const SHUTTLE_BOOKING_STATUSES: readonly PassengerShuttleBookingStatus[] = [
  'pending',
  'confirmed',
  'boarded',
];

const SHUTTLE_TRIP_STATUSES: readonly PassengerShuttleTripStatus[] = [
  'scheduled',
  'waiting_driver',
  'driver_assigned',
  'boarding',
  'active',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

export function normalizePassengerRideVehicleType(value: unknown): PassengerRideVehicleType {
  if (isOneOf(value, RIDE_VEHICLE_TYPES)) return value;
  throw new Error(`Unsupported passenger ride vehicle type: ${String(value)}`);
}

export function normalizePassengerRideStatus(value: unknown): PassengerRideStatus {
  if (isOneOf(value, RIDE_STATUSES)) return value;
  throw new Error(`Unsupported passenger ride status: ${String(value)}`);
}

export function normalizePassengerShuttleBookingStatus(value: unknown): PassengerShuttleBookingStatus {
  if (isOneOf(value, SHUTTLE_BOOKING_STATUSES)) return value;
  throw new Error(`Unsupported passenger Shuttle booking status: ${String(value)}`);
}

export function normalizePassengerShuttleTripStatus(value: unknown): PassengerShuttleTripStatus {
  if (isOneOf(value, SHUTTLE_TRIP_STATUSES)) return value;
  throw new Error(`Unsupported passenger Shuttle trip status: ${String(value)}`);
}

function adaptRideSession(value: Record<string, unknown>): NormalizedPassengerActiveSession {
  const vehicleType = normalizePassengerRideVehicleType(value.vehicleType);
  const status = normalizePassengerRideStatus(value.status);

  if (!isNumber(value.rideId)) {
    throw new Error('Passenger ride session is missing a numeric rideId');
  }

  return {
    ...(value as unknown as PassengerRideSession),
    kind: 'ride',
    serviceType: vehicleType,
    status,
    raw: value as unknown as PassengerRideSession,
  };
}

function adaptShuttleSession(value: Record<string, unknown>): NormalizedPassengerActiveSession {
  const bookingStatus = normalizePassengerShuttleBookingStatus(value.bookingStatus);
  const trip = value.trip;

  if (!isNumber(value.bookingId)) {
    throw new Error('Passenger Shuttle session is missing a numeric bookingId');
  }
  if (!isRecord(trip)) {
    throw new Error('Passenger Shuttle session is missing trip data');
  }

  const tripStatus = normalizePassengerShuttleTripStatus(trip.status);

  return {
    ...(value as unknown as PassengerShuttleSession),
    kind: 'shuttle',
    serviceType: 'shuttle',
    bookingStatus,
    trip: {
      ...(trip as unknown as PassengerShuttleSession['trip']),
      status: tripStatus,
    },
    raw: value as unknown as PassengerShuttleSession,
  };
}

/**
 * Converts the backend discriminator into a stable client model.
 * `null` is the explicit terminal/no-active-session state.
 */
export function adaptPassengerActiveSession(
  value: unknown,
): NormalizedPassengerActiveSession | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new Error('Passenger ActiveSession payload is not an object');

  if (value.sessionType === 'ride') return adaptRideSession(value);
  if (value.sessionType === 'shuttle_booking') return adaptShuttleSession(value);

  throw new Error(`Unsupported passenger session type: ${String(value.sessionType)}`);
}

export function isNormalizedPassengerActiveSession(
  value: NormalizedPassengerActiveSession | null,
): value is NormalizedPassengerActiveSession {
  return value !== null;
}