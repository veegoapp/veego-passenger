import { haversineMeters, estimateEtaMinutes, trimRouteToPosition, snapPointToRoute, type LatLng } from './geoHelpers';

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    const p: LatLng = { latitude: 30, longitude: 31 };
    expect(haversineMeters(p, p)).toBe(0);
  });

  it('matches a known distance between two real-world points within 1% (Cairo -> Alexandria, ~180km)', () => {
    const cairo: LatLng = { latitude: 30.0444, longitude: 31.2357 };
    const alexandria: LatLng = { latitude: 31.2001, longitude: 29.9187 };
    const meters = haversineMeters(cairo, alexandria);
    expect(meters).toBeGreaterThan(178_000);
    expect(meters).toBeLessThan(182_000);
  });

  it('is symmetric', () => {
    const a: LatLng = { latitude: 30.0, longitude: 31.0 };
    const b: LatLng = { latitude: 30.5, longitude: 31.5 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });
});

describe('estimateEtaMinutes', () => {
  it('rounds up to at least 1 minute for a very short distance', () => {
    const a: LatLng = { latitude: 30.0, longitude: 31.0 };
    const b: LatLng = { latitude: 30.0001, longitude: 31.0 };
    expect(estimateEtaMinutes(a, b)).toBeGreaterThanOrEqual(1);
  });

  it('returns 0 minutes-equivalent as the floor of 1 when driver is already at the station', () => {
    const p: LatLng = { latitude: 30.0, longitude: 31.0 };
    expect(estimateEtaMinutes(p, p)).toBe(1);
  });

  it('scales roughly linearly with distance at the assumed 25 km/h speed', () => {
    const driver: LatLng = { latitude: 30.0, longitude: 31.0 };
    // ~25km away (roughly 1 hour at 25 km/h -> ~60 minutes)
    const farStation: LatLng = { latitude: 30.225, longitude: 31.0 };
    const eta = estimateEtaMinutes(driver, farStation);
    expect(eta).toBeGreaterThan(50);
    expect(eta).toBeLessThan(70);
  });
});

describe('trimRouteToPosition', () => {
  const straightRoute: LatLng[] = [
    { latitude: 30.0, longitude: 31.0 },
    { latitude: 30.0, longitude: 31.01 },
    { latitude: 30.0, longitude: 31.02 },
  ];

  it('returns the route unchanged when it has fewer than 2 points', () => {
    const single: LatLng[] = [{ latitude: 30, longitude: 31 }];
    expect(trimRouteToPosition(single, { latitude: 30, longitude: 31 })).toBe(single);
    expect(trimRouteToPosition([], { latitude: 30, longitude: 31 })).toEqual([]);
  });

  it('keeps the full route when the position is at the very start', () => {
    const result = trimRouteToPosition(straightRoute, straightRoute[0]);
    expect(result).toHaveLength(3);
    expect(result[0].longitude).toBeCloseTo(31.0, 5);
  });

  it('drops the traveled segment when the position is partway along the route', () => {
    // Roughly halfway between point 0 and point 1
    const midpoint: LatLng = { latitude: 30.0, longitude: 31.005 };
    const result = trimRouteToPosition(straightRoute, midpoint);
    // The trimmed route should start near the midpoint, not at the origin,
    // and still end at the route's original last point.
    expect(result[0].longitude).toBeGreaterThan(31.0);
    expect(result[result.length - 1]).toEqual(straightRoute[straightRoute.length - 1]);
  });

  it('clamps to the final point when the position is past the end of the route', () => {
    const pastEnd: LatLng = { latitude: 30.0, longitude: 31.05 };
    const result = trimRouteToPosition(straightRoute, pastEnd);
    // Trimmed to the last segment's endpoint (t clamped to 1).
    expect(result[0].longitude).toBeCloseTo(31.02, 5);
  });
});

describe('snapPointToRoute', () => {
  const straightRoute: LatLng[] = [
    { latitude: 30.0, longitude: 31.0 },
    { latitude: 30.0, longitude: 31.01 },
  ];

  it('returns the raw position unchanged when the route has fewer than 2 points', () => {
    const position: LatLng = { latitude: 30, longitude: 31 };
    expect(snapPointToRoute([], position, 50)).toBe(position);
  });

  it('snaps a nearby off-route position onto the route when within the threshold', () => {
    // Directly north of the midpoint of the route, close enough to snap.
    const nearby: LatLng = { latitude: 30.00005, longitude: 31.005 };
    const snapped = snapPointToRoute(straightRoute, nearby, 50);
    expect(snapped).not.toBe(nearby);
    expect(snapped.latitude).toBeCloseTo(30.0, 3);
  });

  it('returns the raw position unchanged (by reference) when it is farther than maxSnapM from the route', () => {
    const farAway: LatLng = { latitude: 31.0, longitude: 31.005 };
    expect(snapPointToRoute(straightRoute, farAway, 50)).toBe(farAway);
  });

  it('returns a point already on the route as effectively itself', () => {
    const onRoute: LatLng = { latitude: 30.0, longitude: 31.005 };
    const snapped = snapPointToRoute(straightRoute, onRoute, 50);
    expect(snapped.latitude).toBeCloseTo(onRoute.latitude, 5);
    expect(snapped.longitude).toBeCloseTo(onRoute.longitude, 5);
  });
});
