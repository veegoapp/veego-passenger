/**
 * useTrackingBuffer  (Phase 3A — tracking layer)
 *
 * Separates socket location *delivery* from map *rendering*. Callers push each
 * validated driver point in via `point`; this hook owns a single AnimatedRegion
 * and a single frame clock that interpolates a smooth position between the last
 * rendered coordinate and the newest point. The marker reads only the resulting
 * AnimatedRegion — it never moves directly off a socket tick.
 *
 * What this layer does (Phase 3A scope):
 *   - stores the last rendered position + the newest target, each stamped with
 *     local *arrival* time (skew-free; the device `timestamp` field is carried
 *     on the point for later phases but is deliberately NOT used for pacing yet)
 *   - interpolates the current position each frame between from → to
 *   - handles gaps by holding at the newest point once a segment completes
 *     (no extrapolation / dead-reckoning — that is a later phase)
 *   - retargets from the *current rendered position* on every new point, so
 *     bursts or late arrivals glide instead of snapping (this subsumes the old
 *     stop-before-start skip fix)
 *
 * Explicitly out of scope here (built on top in later phases):
 *   - heading / rotation smoothing (Phase 3B) — heading on the point is ignored
 *   - camera control (Phase 3C) — this hook only produces a marker coordinate
 *
 * Usage:
 *   const { animatedCoord } = useTrackingBuffer({ point: driverLocation, initialCoords: pickup });
 *   // Pass animatedCoord to <MarkerAnimated coordinate={animatedCoord} …/>
 */

import { useEffect, useRef } from 'react';
import { AnimatedRegion } from 'react-native-maps';

interface LatLng {
  latitude: number;
  longitude: number;
}

interface UseTrackingBufferOptions {
  /** Newest validated driver point. Interpolation retargets on every change. */
  point: (LatLng & { heading?: number }) | null | undefined;
  /** Fallback seed for the AnimatedRegion before any real point arrives
   *  (e.g. pickup) so the marker starts at the right place rather than 0/0.
   *  Ignored after mount. */
  initialCoords?: LatLng | null;
}

interface UseTrackingBufferResult {
  /** AnimatedRegion to pass directly to <MarkerAnimated coordinate={…} />. */
  animatedCoord: AnimatedRegion;
}

// Segment duration is the real inter-arrival gap, clamped so a very short
// burst still eases visibly and a long stall (or the initial ~5 s cadence)
// never produces an absurdly slow glide.
const MIN_SEGMENT_MS = 500;
const MAX_SEGMENT_MS = 6000;
// ~30 fps render clock — matches the cadence AnimatedRegion.timing drove
// internally, but here we own the path so we can interpolate across gaps.
const FRAME_MS = 1000 / 30;

export function useTrackingBuffer({
  point,
  initialCoords,
}: UseTrackingBufferOptions): UseTrackingBufferResult {
  // Seed with the first available position. 0/0 is a safe fallback because the
  // marker is only rendered by callers once a real point exists, so the seed
  // coordinate is never visible on its own.
  const initLat = point?.latitude ?? initialCoords?.latitude ?? 0;
  const initLng = point?.longitude ?? initialCoords?.longitude ?? 0;

  const animatedCoord = useRef(
    new AnimatedRegion({
      latitude: initLat,
      longitude: initLng,
      latitudeDelta: 0,
      longitudeDelta: 0,
    }),
  ).current;

  // Interpolation segment state. All refs — the clock reads them every frame
  // without forcing a React re-render.
  const fromRef = useRef<LatLng>({ latitude: initLat, longitude: initLng });
  const toRef = useRef<LatLng>({ latitude: initLat, longitude: initLng });
  const segStartRef = useRef<number>(0);
  const segDurRef = useRef<number>(0);
  const lastArrivalRef = useRef<number>(0);
  const seededRef = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Frame clock ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!point) return;

    const now = Date.now();

    // First point ever → instant seed, no glide (matches prior seed behavior).
    if (!seededRef.current) {
      fromRef.current = { latitude: point.latitude, longitude: point.longitude };
      toRef.current = { latitude: point.latitude, longitude: point.longitude };
      segStartRef.current = now;
      segDurRef.current = 0;
      lastArrivalRef.current = now;
      seededRef.current = true;
      animatedCoord.setValue({
        latitude: point.latitude,
        longitude: point.longitude,
        latitudeDelta: 0,
        longitudeDelta: 0,
      });
      return;
    }

    // Retarget from the CURRENT rendered position so a new (possibly late or
    // bursty) point glides forward instead of snapping to an intermediate spot.
    const dur = segDurRef.current;
    const f = dur <= 0 ? 1 : Math.min(1, Math.max(0, (now - segStartRef.current) / dur));
    fromRef.current = {
      latitude:
        fromRef.current.latitude + (toRef.current.latitude - fromRef.current.latitude) * f,
      longitude:
        fromRef.current.longitude + (toRef.current.longitude - fromRef.current.longitude) * f,
    };
    toRef.current = { latitude: point.latitude, longitude: point.longitude };
    segStartRef.current = now;
    // Pace on local arrival dt (skew-free), clamped. Device timestamp is
    // intentionally not consulted here yet.
    const dt = now - lastArrivalRef.current;
    segDurRef.current = Math.min(MAX_SEGMENT_MS, Math.max(MIN_SEGMENT_MS, dt));
    lastArrivalRef.current = now;

    // Start the clock if it isn't already running. It stops itself when the
    // segment completes and holds at the target (gap handling).
    if (timerRef.current == null) {
      timerRef.current = setInterval(() => {
        const t = Date.now();
        const d = segDurRef.current;
        const frac = d <= 0 ? 1 : Math.min(1, Math.max(0, (t - segStartRef.current) / d));
        animatedCoord.setValue({
          latitude:
            fromRef.current.latitude + (toRef.current.latitude - fromRef.current.latitude) * frac,
          longitude:
            fromRef.current.longitude +
            (toRef.current.longitude - fromRef.current.longitude) * frac,
          latitudeDelta: 0,
          longitudeDelta: 0,
        });
        if (frac >= 1 && timerRef.current != null) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }, FRAME_MS);
    }
    // point.heading is intentionally ignored — rotation is handled elsewhere.
  }, [point?.latitude, point?.longitude, animatedCoord]);

  // Stop the clock on unmount so it never runs against a detached region.
  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return { animatedCoord };
}
