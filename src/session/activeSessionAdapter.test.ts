import {
  adaptPassengerActiveSession,
  isNormalizedPassengerActiveSession,
  normalizePassengerRideVehicleType,
  normalizePassengerRideStatus,
  normalizePassengerShuttleBookingStatus,
  normalizePassengerShuttleTripStatus,
} from './activeSessionAdapter';

const baseRideSession = {
  sessionType: 'ride',
  vehicleType: 'car',
  rideId: 42,
  status: 'searching',
  requestedCategory: null,
  pickup: { latitude: 30.0, longitude: 31.0, address: 'A' },
  dropoff: { latitude: 30.1, longitude: 31.1, address: 'B' },
  recipient: null,
  distanceKm: null,
  estimatedDurationMinutes: null,
  estimatedPrice: null,
  finalPrice: null,
  waitingCharge: 0,
  paymentMethod: 'cash',
  promoCode: null,
  driver: null,
  dispatchState: null,
  requestedAt: '2026-01-01T00:00:00.000Z',
  driverAssignedAt: null,
  driverArrivedAt: null,
  driverArrivedLocation: null,
  startedAt: null,
};

const baseShuttleSession = {
  sessionType: 'shuttle_booking',
  bookingId: 7,
  bookingStatus: 'confirmed',
  seatCount: 1,
  totalPrice: 25,
  paymentMethod: 'wallet',
  paymentStatus: 'paid',
  trip: {
    id: 1,
    status: 'scheduled',
    vehicleType: 'HiAce',
    departureTime: '2026-01-01T08:00:00.000Z',
    arrivalTime: '2026-01-01T09:00:00.000Z',
    direction: 'outbound',
    price: 25,
    totalSeats: 14,
    availableSeats: 5,
    minRequired: 4,
    route: { id: 1, name: 'Route 1', nameAr: null, fromLocation: 'A', toLocation: 'B' },
    driver: null,
  },
  boardingStation: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('adaptPassengerActiveSession', () => {
  it('returns null unchanged for a null payload (the explicit no-active-session state)', () => {
    expect(adaptPassengerActiveSession(null)).toBeNull();
  });

  it('returns null unchanged for an undefined payload', () => {
    expect(adaptPassengerActiveSession(undefined)).toBeNull();
  });

  it('adapts a well-formed ride session, adding kind/serviceType/raw', () => {
    const result = adaptPassengerActiveSession(baseRideSession);
    expect(result).toMatchObject({
      kind: 'ride',
      serviceType: 'car',
      status: 'searching',
      rideId: 42,
    });
    expect(result?.raw).toEqual(baseRideSession);
  });

  it('adapts a well-formed shuttle session, adding kind/serviceType/raw and normalizing trip.status', () => {
    const result = adaptPassengerActiveSession(baseShuttleSession);
    expect(result).toMatchObject({
      kind: 'shuttle',
      serviceType: 'shuttle',
      bookingId: 7,
      bookingStatus: 'confirmed',
    });
    if (result?.kind === 'shuttle') {
      expect(result.trip.status).toBe('scheduled');
    } else {
      throw new Error('expected a shuttle session');
    }
  });

  it('throws for a payload that is not an object', () => {
    expect(() => adaptPassengerActiveSession('not-an-object')).toThrow(
      'Passenger ActiveSession payload is not an object',
    );
    expect(() => adaptPassengerActiveSession(42)).toThrow();
  });

  it('throws for an unrecognized sessionType (a backend contract change)', () => {
    expect(() => adaptPassengerActiveSession({ sessionType: 'something_new' })).toThrow(
      'Unsupported passenger session type: something_new',
    );
  });

  it('throws when a ride session is missing a numeric rideId', () => {
    const { rideId, ...withoutRideId } = baseRideSession;
    expect(() => adaptPassengerActiveSession(withoutRideId)).toThrow(
      'Passenger ride session is missing a numeric rideId',
    );
  });

  it('throws when a ride session has an unsupported vehicleType', () => {
    expect(() => adaptPassengerActiveSession({ ...baseRideSession, vehicleType: 'plane' })).toThrow(
      'Unsupported passenger ride vehicle type: plane',
    );
  });

  it('throws when a ride session has an unsupported status', () => {
    expect(() => adaptPassengerActiveSession({ ...baseRideSession, status: 'teleporting' })).toThrow(
      'Unsupported passenger ride status: teleporting',
    );
  });

  it('throws when a shuttle session is missing a numeric bookingId', () => {
    const { bookingId, ...withoutBookingId } = baseShuttleSession;
    expect(() => adaptPassengerActiveSession(withoutBookingId)).toThrow(
      'Passenger Shuttle session is missing a numeric bookingId',
    );
  });

  it('throws when a shuttle session is missing trip data entirely', () => {
    const { trip, ...withoutTrip } = baseShuttleSession;
    expect(() => adaptPassengerActiveSession(withoutTrip)).toThrow(
      'Passenger Shuttle session is missing trip data',
    );
  });

  it('throws when a shuttle session has an unsupported bookingStatus', () => {
    expect(() =>
      adaptPassengerActiveSession({ ...baseShuttleSession, bookingStatus: 'refunded' }),
    ).toThrow('Unsupported passenger Shuttle booking status: refunded');
  });

  it('throws when a shuttle trip has an unsupported status', () => {
    expect(() =>
      adaptPassengerActiveSession({
        ...baseShuttleSession,
        trip: { ...baseShuttleSession.trip, status: 'derailed' },
      }),
    ).toThrow('Unsupported passenger Shuttle trip status: derailed');
  });
});

describe('normalizePassengerRideVehicleType / normalizePassengerRideStatus', () => {
  it('accepts every documented ride vehicle type', () => {
    for (const v of ['car', 'scooter', 'delivery']) {
      expect(normalizePassengerRideVehicleType(v)).toBe(v);
    }
  });

  it('accepts every documented ride status', () => {
    for (const s of ['requested', 'searching', 'driver_assigned', 'driver_arrived', 'active']) {
      expect(normalizePassengerRideStatus(s)).toBe(s);
    }
  });

  it('rejects a non-string value', () => {
    expect(() => normalizePassengerRideVehicleType(123)).toThrow();
    expect(() => normalizePassengerRideStatus(null)).toThrow();
  });
});

describe('normalizePassengerShuttleBookingStatus / normalizePassengerShuttleTripStatus', () => {
  it('accepts every documented shuttle booking status', () => {
    for (const s of ['pending', 'confirmed', 'boarded']) {
      expect(normalizePassengerShuttleBookingStatus(s)).toBe(s);
    }
  });

  it('accepts every documented shuttle trip status', () => {
    for (const s of ['scheduled', 'waiting_driver', 'driver_assigned', 'boarding', 'active']) {
      expect(normalizePassengerShuttleTripStatus(s)).toBe(s);
    }
  });

  it('rejects an unrecognized value', () => {
    expect(() => normalizePassengerShuttleBookingStatus('cancelled')).toThrow();
    expect(() => normalizePassengerShuttleTripStatus('done')).toThrow();
  });
});

describe('isNormalizedPassengerActiveSession', () => {
  it('is a type guard that narrows null away', () => {
    expect(isNormalizedPassengerActiveSession(null)).toBe(false);
    const session = adaptPassengerActiveSession(baseRideSession);
    expect(isNormalizedPassengerActiveSession(session)).toBe(true);
  });
});
