import { selectActiveRide } from './activeRideSelectors';
import type {
  NormalizedPassengerRideSession,
  NormalizedPassengerShuttleSession,
  PassengerRideDriver,
} from './activeSessionTypes';

function makeRideSession(
  overrides: Partial<NormalizedPassengerRideSession> = {},
): NormalizedPassengerRideSession {
  const base: NormalizedPassengerRideSession = {
    kind: 'ride',
    serviceType: 'car',
    sessionType: 'ride',
    vehicleType: 'car',
    rideId: 123,
    status: 'driver_assigned',
    requestedCategory: null,
    pickup: { latitude: 14.5, longitude: 121.0, address: 'Pickup St' },
    dropoff: { latitude: 14.6, longitude: 121.1, address: 'Dropoff Ave' },
    recipient: null,
    distanceKm: 5,
    estimatedDurationMinutes: 10,
    estimatedPrice: 150,
    finalPrice: null,
    waitingCharge: 0,
    paymentMethod: 'cash',
    promoCode: null,
    driver: null,
    dispatchState: null,
    requestedAt: '2026-09-12T00:00:00.000Z',
    driverAssignedAt: null,
    driverArrivedAt: null,
    driverArrivedLocation: null,
    startedAt: null,
    raw: {} as NormalizedPassengerRideSession['raw'],
  };
  return { ...base, ...overrides };
}

function makeDriver(overrides: Partial<PassengerRideDriver> = {}): PassengerRideDriver {
  return {
    id: 1,
    name: 'Juan Dela Cruz',
    phone: '0917',
    avatar: null,
    rating: 4.9,
    vehicleType: 'sedan',
    location: null,
    vehicle: null,
    ...overrides,
  };
}

describe('selectActiveRide', () => {
  it('returns null when there is no session', () => {
    expect(selectActiveRide(null)).toBeNull();
  });

  it('returns null when the session is a shuttle_booking', () => {
    const shuttleSession = {
      kind: 'shuttle',
      serviceType: 'shuttle',
      sessionType: 'shuttle_booking',
    } as unknown as NormalizedPassengerShuttleSession;
    expect(selectActiveRide(shuttleSession)).toBeNull();
  });

  it('maps a car ride session field-for-field into an ActiveRideSnapshot', () => {
    const session = makeRideSession({
      rideId: 456,
      vehicleType: 'car',
      status: 'driver_arrived',
      finalPrice: null,
      waitingCharge: 20,
      estimatedPrice: 200,
      paymentMethod: 'card',
      driver: makeDriver({
        name: 'Maria',
        phone: '0918',
        avatar: 'https://cdn/a.png',
        rating: 4.7,
        vehicleType: 'suv',
        vehicle: {
          plateNumber: 'ABC-123',
          make: 'Toyota',
          model: 'Innova',
          year: 2020,
          color: 'White',
        },
        location: { lat: 14.55, lng: 121.05, heading: 90, updatedAt: '2026-09-12T00:05:00.000Z' },
      }),
    });

    const result = selectActiveRide(session);

    expect(result).not.toBeNull();
    expect(result?.rideId).toBe('456');
    expect(result?.rideType).toBe('car');
    // normalizeRideStatus maps backend 'driver_arrived' -> app 'arrived'.
    expect(result?.status).toBe('arrived');
    expect(result?.driver).toEqual({
      name: 'Maria',
      phone: '0918',
      avatar: 'https://cdn/a.png',
      vehicle: 'Toyota Innova',
      vehicleColor: 'White',
      plateNumber: 'ABC-123',
      rating: 4.7,
      eta: 5,
    });
    expect(result?.driverLocation).toEqual({
      latitude: 14.55,
      longitude: 121.05,
      heading: 90,
      updatedAtMs: new Date('2026-09-12T00:05:00.000Z').getTime(),
    });
    expect(result?.fare).toBeNull();
    expect(result?.waitingCharge).toBe(20);
    expect(result?.pickup).toEqual(session.pickup);
    expect(result?.dropoff).toEqual(session.dropoff);
    expect(result?.recipient).toBeNull();
    expect(result?.estimatedPrice).toBe(200);
    expect(result?.paymentMethod).toBe('card');
  });

  it('maps a scooter session and a delivery session with a recipient', () => {
    const scooterSession = makeRideSession({ vehicleType: 'scooter' });
    expect(selectActiveRide(scooterSession)?.rideType).toBe('scooter');

    const deliverySession = makeRideSession({
      vehicleType: 'delivery',
      recipient: { name: 'Ana', phone: '0919' },
    });
    const result = selectActiveRide(deliverySession);
    expect(result?.rideType).toBe('delivery');
    expect(result?.recipient).toEqual({ name: 'Ana', phone: '0919' });
  });

  it('falls back to vehicleType label and default rating when driver has no vehicle object', () => {
    const session = makeRideSession({
      driver: makeDriver({ vehicle: null, vehicleType: 'moto', rating: null, phone: null }),
    });
    const result = selectActiveRide(session);
    expect(result?.driver).toEqual(
      expect.objectContaining({
        vehicle: 'moto',
        vehicleColor: undefined,
        plateNumber: undefined,
        rating: 4.8,
        phone: '',
      }),
    );
  });

  it('returns null driver and driverLocation when the session has no driver', () => {
    const session = makeRideSession({ driver: null });
    const result = selectActiveRide(session);
    expect(result?.driver).toBeNull();
    expect(result?.driverLocation).toBeNull();
  });

  it('falls back to "searching" status when the backend status is unrecognized', () => {
    const session = makeRideSession({ status: 'unknown_status' as NormalizedPassengerRideSession['status'] });
    expect(selectActiveRide(session)?.status).toBe('searching');
  });
});
