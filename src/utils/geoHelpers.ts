export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const sinHalf =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(sinHalf));
}

// Assumes 25 km/h average urban speed for shuttle
export function estimateEtaMinutes(driver: LatLng, nextStation: LatLng): number {
  const distM = haversineMeters(driver, nextStation);
  const speedMps = 25_000 / 3600;
  return Math.max(1, Math.ceil(distM / speedMps / 60));
}

// Trims a road-snapped route so it starts at `position`'s projection onto the
// route instead of the route's original origin — the "already traveled"
// segment behind the current position is dropped. The route itself is not
// refetched (that stays on its own throttle); this only changes what gets
// drawn, recomputed on every position tick so the line visibly shortens as
// the marker advances, instead of staying frozen as the full origin->target
// polyline between refetches.
//
// Projection uses a local planar approximation (longitude scaled by
// cos(latitude) of each segment's start point) — accurate enough for the
// short segments Google Directions returns, and far cheaper than a proper
// geodesic projection.
export function trimRouteToPosition(route: LatLng[], position: LatLng): LatLng[] {
  if (route.length < 2) return route;

  let bestSegIdx = 0;
  let bestT = 0;
  let bestDist = Infinity;

  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const cosLat = Math.cos((a.latitude * Math.PI) / 180);
    const ax = a.longitude * cosLat, ay = a.latitude;
    const bx = b.longitude * cosLat, by = b.latitude;
    const px = position.longitude * cosLat, py = position.latitude;
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projected: LatLng = {
      latitude: a.latitude + (b.latitude - a.latitude) * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
    };
    const dist = haversineMeters(position, projected);
    if (dist < bestDist) {
      bestDist = dist;
      bestSegIdx = i;
      bestT = t;
    }
  }

  const a = route[bestSegIdx];
  const b = route[bestSegIdx + 1];
  const projected: LatLng = {
    latitude: a.latitude + (b.latitude - a.latitude) * bestT,
    longitude: a.longitude + (b.longitude - a.longitude) * bestT,
  };

  return [projected, ...route.slice(bestSegIdx + 1)];
}
