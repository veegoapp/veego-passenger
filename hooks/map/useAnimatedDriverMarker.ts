/**
 * useAnimatedDriverMarker
 *
 * Encapsulates the AnimatedRegion lifecycle for an animated driver marker:
 *   - creates the AnimatedRegion seeded from the first available coordinates
 *   - animates smoothly to each new driverLocation tick (800 ms ease)
 *   - stops any in-flight animation before starting the next one, preventing
 *     the marker from "skipping" to an intermediate position when rapid GPS
 *     updates queue up multiple 800 ms animations
 *
 * Usage:
 *   const { animatedCoord } = useAnimatedDriverMarker(driverLocation);
 *   // Pass animatedCoord to <MarkerAnimated coordinate={animatedCoord} …/>
 *
 * initialCoords (optional):
 *   A fallback seed for the AnimatedRegion when driverLocation is not yet
 *   available.  PassengerTrackingMap passes `pickup` here so the marker
 *   starts at the pickup point; CarMap does not need a fallback (it only
 *   renders the marker after a real driverLocation is present).
 *   When omitted the region is seeded at 0/0 — never visible because the
 *   marker is conditionally rendered only when driverLocation is non-null.
 */

import { useRef, useEffect } from 'react';
import { AnimatedRegion } from 'react-native-maps';

interface LatLng {
  latitude: number;
  longitude: number;
}

interface UseAnimatedDriverMarkerOptions {
  /** Primary driver position.  Animates the marker on every change. */
  driverLocation: (LatLng & { heading?: number }) | null | undefined;
  /** Fallback seed coordinates for the AnimatedRegion.  Used when the driver
   *  location is not yet known (e.g. pass `pickup` so the marker starts at
   *  the right city rather than 0/0).  Ignored after mount. */
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
  // Seed the region with the first available position.
  // 0/0 is used as a safe fallback — the marker is never rendered without a
  // real driverLocation so these coordinates are never visible to the user
  // (mirrors the audit-L3 fix applied to both CarMap and PassengerTrackingMap).
  const initLat = driverLocation?.latitude ?? initialCoords?.latitude ?? 0;
  const initLng = driverLocation?.longitude ?? initialCoords?.longitude ?? 0;

  const animatedCoord = useRef(
    new AnimatedRegion({
      latitude: initLat,
      longitude: initLng,
      latitudeDelta: 0,
      longitudeDelta: 0,
    }),
  ).current;

  // Holds the currently-running animation so it can be stopped before the
  // next one begins.  Without this, rapid ride:driver_location events queue
  // up 800 ms animations — the second interrupts the first mid-glide, causing
  // the marker to jump to an intermediate position (the original skip bug).
  const markerAnimRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (!driverLocation) return;

    markerAnimRef.current?.stop();

    // Cast: AnimatedRegion.timing()'s TypeScript signature incorrectly requires
    // Animated.TimingAnimationConfig's `toValue` field; the actual runtime API
    // accepts the region-shaped object below.  This cast preserves the existing
    // behavior from both CarMap and PassengerTrackingMap.
    const anim = animatedCoord.timing({
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
      duration: 800,
      useNativeDriver: false,
    } as any);

    markerAnimRef.current = anim;
    anim.start(() => {
      markerAnimRef.current = null;
    });
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  return { animatedCoord };
}
