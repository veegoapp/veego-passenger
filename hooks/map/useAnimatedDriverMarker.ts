/**
 * useAnimatedDriverMarker
 *
 * Thin, backward-compatible wrapper over the Phase 3A tracking layer
 * (useTrackingBuffer). Its public API is unchanged — both CarMap and
 * PassengerTrackingMap keep calling it exactly as before and receive the same
 * `{ animatedCoord }` to hand to <MarkerAnimated coordinate={…} />.
 *
 * What changed under the hood:
 *   Previously this hook owned the AnimatedRegion and animated to each new
 *   driverLocation with a fixed 800 ms `timing()` (with a stop-before-start
 *   guard). That produced glide-then-freeze between the ~5 s socket ticks.
 *   It now delegates to useTrackingBuffer, which interpolates continuously
 *   across the inter-arrival gap on a single frame clock and retargets from the
 *   current rendered position on each new point (the stop-before-start skip
 *   fix is subsumed by that retarget).
 *
 * Unchanged by design in this phase:
 *   - seed / initialCoords fallback behavior
 *   - heading / rotation (callers still read driverLocation.heading directly)
 *   - camera (this hook only produces a marker coordinate)
 *
 * Usage:
 *   const { animatedCoord } = useAnimatedDriverMarker({ driverLocation, initialCoords });
 *   // Pass animatedCoord to <MarkerAnimated coordinate={animatedCoord} …/>
 */

import { AnimatedRegion } from 'react-native-maps';
import { useTrackingBuffer } from './useTrackingBuffer';

interface LatLng {
  latitude: number;
  longitude: number;
}

interface UseAnimatedDriverMarkerOptions {
  /** Primary driver position. Moves the marker on every change. */
  driverLocation: (LatLng & { heading?: number }) | null | undefined;
  /** Fallback seed coordinates for the AnimatedRegion. Used when the driver
   *  location is not yet known (e.g. pass `pickup` so the marker starts at
   *  the right city rather than 0/0). Ignored after mount. */
  initialCoords?: LatLng | null;
}

interface UseAnimatedDriverMarkerResult {
  /** AnimatedRegion to pass directly to <MarkerAnimated coordinate={…} /> */
  animatedCoord: AnimatedRegion;
}

export function useAnimatedDriverMarker({
  driverLocation,
  initialCoords,
}: UseAnimatedDriverMarkerOptions): UseAnimatedDriverMarkerResult {
  return useTrackingBuffer({ point: driverLocation, initialCoords });
}
