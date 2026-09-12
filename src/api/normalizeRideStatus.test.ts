import { normalizeRideStatus } from './socket';

// Exercises every key currently in socket.ts's BACKEND_TO_APP_RIDE_STATUS
// lookup table so a future edit cannot silently change/drop a mapping
// without a failing test. If a new backend status is added to the table,
// add its expected mapping here too.
describe('normalizeRideStatus', () => {
  it('maps every known backend ride status to its documented app-side status', () => {
    expect(normalizeRideStatus('requested')).toBe('searching');
    expect(normalizeRideStatus('searching')).toBe('searching');
    expect(normalizeRideStatus('driver_assigned')).toBe('driver_assigned');
    expect(normalizeRideStatus('driver_arrived')).toBe('arrived');
    expect(normalizeRideStatus('active')).toBe('started');
    expect(normalizeRideStatus('completed')).toBe('completed');
    expect(normalizeRideStatus('cancelled')).toBe('cancelled');
  });

  it('returns undefined for null or undefined input', () => {
    expect(normalizeRideStatus(null)).toBeUndefined();
    expect(normalizeRideStatus(undefined)).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(normalizeRideStatus('')).toBeUndefined();
  });

  it('returns undefined for an unrecognized status string', () => {
    expect(normalizeRideStatus('some_unknown_status')).toBeUndefined();
  });
});
