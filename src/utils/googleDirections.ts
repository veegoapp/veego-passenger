import { GOOGLE_MAPS_API_KEY } from '../constants/config';

export interface LatLng {
  latitude: number;
  longitude: number;
}

// Google encoded polyline decoder (no external dependency required)
function decodePolyline(encoded: string): LatLng[] {
  const result: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let value = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      value |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += value & 1 ? ~(value >> 1) : value >> 1;

    shift = 0;
    value = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      value |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += value & 1 ? ~(value >> 1) : value >> 1;

    result.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return result;
}

export interface DirectionsResult {
  coords: LatLng[];
  durationSeconds: number | null;
}

/**
 * Fetches a road-snapped route from Google Directions API.
 * origin    = driver current position
 * waypoints = ordered remaining stations (first stop → last stop)
 *
 * Intended to be called ONCE per trip — caller is responsible for not
 * calling again unless the trip resets.
 */
export async function fetchGoogleRoute(
  origin: LatLng,
  waypoints: LatLng[],
): Promise<DirectionsResult | null> {
  if (!GOOGLE_MAPS_API_KEY || waypoints.length === 0) return null;

  const destination = waypoints[waypoints.length - 1];
  const middle = waypoints.slice(0, -1);

  const originStr = `${origin.latitude},${origin.longitude}`;
  const destStr = `${destination.latitude},${destination.longitude}`;
  const waypointsParam = middle.length > 0
    ? `&waypoints=${middle.map((p) => `${p.latitude},${p.longitude}`).join('|')}`
    : '';

  const url =
    `https://maps.googleapis.com/maps/api/directions/json` +
    `?origin=${originStr}` +
    `&destination=${destStr}` +
    waypointsParam +
    `&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'OK' || !data.routes?.length) return null;

    const route = data.routes[0];
    const coords = decodePolyline(route.overview_polyline.points);

    // Sum duration across all legs
    const durationSeconds: number | null = route.legs
      ? (route.legs as any[]).reduce(
          (sum: number, leg: any) => sum + (leg.duration?.value ?? 0),
          0,
        )
      : null;

    return { coords, durationSeconds };
  } catch {
    return null;
  }
}
