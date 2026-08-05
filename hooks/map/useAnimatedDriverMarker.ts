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

import type { MutableRefObject } from 'react';
import type { Animated } from 'react-native';
import { AnimatedRegion } from 'react-native-maps';
import { useTrackingBuffer } from './useTrackingBuffer';
import { useSmoothedHeading } from './useSmoothedHeading';

interface LatLng {
  latitude: number;
  longitude: number;
}

interface UseAnimatedDriverMarkerOptions {
  /** Primary driver position. Moves the marker on every change. `speed` (m/s,
   *  from the enriched pipeline) is optional and used only by heading smoothing
   *  for the low-speed freeze — position interpolation ignores it. */
  driverLocation: (LatLng & { heading?: number; speed?: number }) | null | undefined;
  /** Fallback seed coordinates for the AnimatedRegion. Used when the driver
   *  location is not yet known (e.g. pass `pickup` so the marker starts at
   *  the right city rather than 0/0). Ignored after mount. */
  initialCoords?: LatLng | null;
}

interface UseAnimatedDriverMarkerResult {
  /** AnimatedRegion to pass directly to <MarkerAnimated coordinate={…} /> */
  animatedCoord: AnimatedRegion;
  /** Smoothed, wrap-safe rotation (degrees) for <MarkerAnimated rotation={…} />. */
  rotation: Animated.Value;
  /** Latest smoothed heading in [0, 360) — reused by the Phase 3C camera
   *  controller so map and camera share one heading source. */
  headingRef: MutableRefObject<number>;
}

export function useAnimatedDriverMarker({
  driverLocation,
  initialCoords,
}: UseAnimatedDriverMarkerOptions): UseAnimatedDriverMarkerResult {
  // Position interpolation — Phase 3A, unchanged.
  const { animatedCoord } = useTrackingBuffer({ point: driverLocation, initialCoords });
  // Heading smoothing — Phase 3B. Fed the same point; independent of position.
  const { rotation, headingRef } = useSmoothedHeading({ point: driverLocation });
  return { animatedCoord, rotation, headingRef };
}
