import {
  mergePaymentStatus,
  mapDriverFromRide,
  shouldIgnoreStaleRideUpdate,
  deriveCancelFields,
} from './rideStateMerge';

const TERMINAL_STATUSES = ['completed', 'cancelled', 'timeout'];

describe('mergePaymentStatus', () => {
  it('never regresses out of the terminal "confirmed" state, even with a fresh-looking incoming value', () => {
    expect(mergePaymentStatus('confirmed', 'awaiting_confirmation')).toBe('confirmed');
    expect(mergePaymentStatus('confirmed', 'awaiting_payment')).toBe('confirmed');
    expect(mergePaymentStatus('confirmed', 'not_required')).toBe('confirmed');
  });

  it('does not regress out of "confirmed" when the incoming value is missing', () => {
    expect(mergePaymentStatus('confirmed', undefined)).toBe('confirmed');
    expect(mergePaymentStatus('confirmed', null)).toBe('confirmed');
  });

  it('lets a fresh incoming value win when the existing state is not yet terminal', () => {
    expect(mergePaymentStatus('awaiting_payment', 'awaiting_confirmation')).toBe('awaiting_confirmation');
    expect(mergePaymentStatus('not_required', 'awaiting_payment')).toBe('awaiting_payment');
    expect(mergePaymentStatus('awaiting_confirmation', 'confirmed')).toBe('confirmed');
  });

  it('returns null when both existing and incoming are undefined/null', () => {
    expect(mergePaymentStatus(null, undefined)).toBeNull();
    expect(mergePaymentStatus(null, null)).toBeNull();
  });

  it('falls back to the existing non-terminal value when incoming is missing', () => {
    expect(mergePaymentStatus('awaiting_payment', undefined)).toBe('awaiting_payment');
    expect(mergePaymentStatus('awaiting_confirmation', null)).toBe('awaiting_confirmation');
  });
});

describe('mapDriverFromRide', () => {
  it('returns the fallback driver unchanged when the ride carries no driver', () => {
    const fallback = { name: 'Juan', phone: '0917', avatar: 'a.png', vehicle: 'Vios', rating: 4.9, eta: 3, instaPayEnabled: true };
    expect(mapDriverFromRide(null, undefined, fallback)).toBe(fallback);
    expect(mapDriverFromRide(undefined, undefined, fallback)).toBe(fallback);
  });

  it('returns null when there is neither a ride driver nor a fallback', () => {
    expect(mapDriverFromRide(null, undefined, null)).toBeNull();
  });

  it('builds a fresh driver from ride data when there is no fallback yet', () => {
    const result = mapDriverFromRide(
      { name: 'Maria', phone: '0918', avatar: 'fresh.png', vehicle: 'Innova', rating: 4.7 },
      5,
      null,
    );
    expect(result).toEqual({
      name: 'Maria',
      phone: '0918',
      avatar: 'fresh.png',
      vehicle: 'Innova',
      vehicleColor: undefined,
      vehicleColorHex: undefined,
      plateNumber: undefined,
      rating: 4.7,
      eta: 5,
      instaPayEnabled: false,
    });
  });

  it('keeps the on-screen avatar instead of replacing it with a re-signed poll URL', () => {
    const fallback = { name: 'Maria', phone: '0918', avatar: 'https://cdn/photo?sig=old', vehicle: 'Innova', rating: 4.7, eta: 3, instaPayEnabled: false };
    const result = mapDriverFromRide(
      { name: 'Maria', phone: '0918', avatar: 'https://cdn/photo?sig=new', vehicle: 'Innova', rating: 4.7 },
      3,
      fallback,
    );
    expect(result?.avatar).toBe('https://cdn/photo?sig=old');
  });

  it('uses the poll avatar only when there is no fallback avatar yet', () => {
    const fallback = { name: 'Maria', phone: '0918', avatar: null, vehicle: 'Innova', rating: 4.7, eta: 3, instaPayEnabled: false };
    const result = mapDriverFromRide(
      { name: 'Maria', phone: '0918', avatar: 'https://cdn/photo?sig=first' },
      3,
      fallback,
    );
    expect(result?.avatar).toBe('https://cdn/photo?sig=first');
  });

  it('prefers the top-level eta over the driver-embedded eta and the fallback', () => {
    const fallback = { name: 'Maria', phone: '0918', avatar: null, vehicle: 'Innova', rating: 4.7, eta: 9, instaPayEnabled: false };
    expect(mapDriverFromRide({ name: 'Maria', eta: 7 }, 5, fallback)?.eta).toBe(5);
    expect(mapDriverFromRide({ name: 'Maria', eta: 7 }, undefined, fallback)?.eta).toBe(7);
    expect(mapDriverFromRide({ name: 'Maria' }, undefined, fallback)?.eta).toBe(9);
  });
});

describe('shouldIgnoreStaleRideUpdate', () => {
  it('ignores an update for a ride that already reached a terminal status', () => {
    expect(shouldIgnoreStaleRideUpdate('completed', 'ride-1', TERMINAL_STATUSES)).toBe(true);
    expect(shouldIgnoreStaleRideUpdate('cancelled', 'ride-1', TERMINAL_STATUSES)).toBe(true);
    expect(shouldIgnoreStaleRideUpdate('timeout', 'ride-1', TERMINAL_STATUSES)).toBe(true);
  });

  it('accepts updates for a ride that has not reached a terminal status', () => {
    expect(shouldIgnoreStaleRideUpdate('searching', 'ride-1', TERMINAL_STATUSES)).toBe(false);
    expect(shouldIgnoreStaleRideUpdate('driver_assigned', 'ride-1', TERMINAL_STATUSES)).toBe(false);
    expect(shouldIgnoreStaleRideUpdate('started', 'ride-1', TERMINAL_STATUSES)).toBe(false);
  });

  it('lets a terminal-looking status through once rideId has been reset to null (e.g. "Try Again")', () => {
    expect(shouldIgnoreStaleRideUpdate('completed', null, TERMINAL_STATUSES)).toBe(false);
    expect(shouldIgnoreStaleRideUpdate('cancelled', null, TERMINAL_STATUSES)).toBe(false);
  });
});

describe('deriveCancelFields', () => {
  it('clears cancelReason and stamps terminationReason as "passenger" when the resynced status is cancelled', () => {
    const prev: { cancelReason: string | null; terminationReason: 'passenger' | 'driver' | 'no_show' | 'timeout' | null } =
      { cancelReason: 'stale reason', terminationReason: null };
    expect(deriveCancelFields('cancelled', prev)).toEqual({
      cancelReason: null,
      terminationReason: 'passenger',
    });
  });

  it('carries cancelReason and terminationReason forward unchanged for any non-cancelled status', () => {
    const prev = { cancelReason: 'existing reason', terminationReason: 'driver' as const };
    expect(deriveCancelFields('searching', prev)).toEqual(prev);
    expect(deriveCancelFields('driver_assigned', prev)).toEqual(prev);
    expect(deriveCancelFields('started', prev)).toEqual(prev);
    expect(deriveCancelFields('completed', prev)).toEqual(prev);
  });
});
