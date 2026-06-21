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
