/**
 * useSmoothedHeading  (Phase 3B — heading smoothing layer)
 *
 * Turns the raw, noisy per-tick driver heading into a smooth, low-jitter
 * rotation source. Deliberately independent of marker rendering: it produces
 * both an Animated rotation value (for the marker) AND a plain numeric ref
 * (for the Phase 3C camera controller), so the map and the camera can share
 * one smoothed heading rather than each deriving its own.
 *
 * Behavior:
 *   - Circular math: rotates along the shortest arc and never spins the long
 *     way round at the 359°→0° wrap (a continuous, unwrapped accumulator is
 *     animated; consumers read it mod 360).
 *   - Low-speed freeze: below SPEED_THRESHOLD_MS the heading is held, so a
 *     stationary or crawling vehicle doesn't spin on GPS heading noise.
 *   - Smooth slew: each accepted heading is eased with Animated.timing rather
 *     than snapped.
 *
 * Explicitly NOT here:
 *   - marker position interpolation (Phase 3A — useTrackingBuffer)
 *   - camera control (Phase 3C — will consume headingRef)
 *
 * Speed source: uses point.speed (m/s, from the enriched pipeline) when
 * present; otherwise derives an effective speed from the distance/time between
 * consecutive points so the freeze still works for older/lean payloads.
 */

import { useEffect, useRef, type MutableRefObject } from 'react';
import { Animated } from 'react-native';

interface LatLng {
  latitude: number;
  longitude: number;
}

interface HeadingPoint extends LatLng {
  heading?: number;
  /** Ground speed in m/s when known (enriched payload). */
  speed?: number;
}

interface UseSmoothedHeadingOptions {
  point: HeadingPoint | null | undefined;
}

interface UseSmoothedHeadingResult {
  /** Continuous (unwrapped) degrees — bind to <MarkerAnimated rotation={…} />. */
  rotation: Animated.Value;
  /** Latest smoothed heading in [0, 360). Kept in sync every animation frame so
   *  the Phase 3C camera controller can read it without a React re-render. */
  headingRef: MutableRefObject<number>;
}

// Below this ground speed the heading is considered unreliable (GPS course
// noise dominates when nearly stationary) and is frozen.
const SPEED_THRESHOLD_MS = 1.5; // ~5.4 km/h
// Duration of the rotation ease toward each newly accepted heading.
const ROTATION_DURATION_MS = 400;
const EARTH_RADIUS_M = 6371000;

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Signed shortest angular delta from `from` to `to`, in (−180, 180]. */
function shortestDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

function normalize360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function useSmoothedHeading({ point }: UseSmoothedHeadingOptions): UseSmoothedHeadingResult {
  // Continuous, unwrapped rotation in degrees. Animated so the marker eases and
  // (via the listener below) headingRef stays current for the camera.
  const rotation = useRef(new Animated.Value(0)).current;
  const headingRef = useRef<number>(0);

  // Last heading we committed to (normalized [0,360)); used for shortest-arc.
  const lastStableRef = useRef<number>(0);
  // Running unwrapped target the Animated.Value is easing toward.
  const continuousRef = useRef<number>(0);
  // Previous point + time, for the speed fallback when point.speed is absent.
  const prevPointRef = useRef<LatLng | null>(null);
  const prevTimeRef = useRef<number>(0);
  const seededRef = useRef<boolean>(false);

  // Mirror the animated rotation into a plain ref (mod 360) every frame so the
  // camera controller can read the current smoothed heading cheaply.
  useEffect(() => {
    const id = rotation.addListener(({ value }) => {
      headingRef.current = normalize360(value);
    });
    return () => rotation.removeListener(id);
  }, [rotation]);

  useEffect(() => {
    if (!point) return;

    const now = Date.now();

    // ── Effective speed (m/s) ──────────────────────────────────────────────
    let speed = typeof point.speed === 'number' && point.speed >= 0 ? point.speed : null;
    if (speed == null && prevPointRef.current && prevTimeRef.current > 0) {
      const dtSec = (now - prevTimeRef.current) / 1000;
      if (dtSec > 0) speed = haversineMeters(prevPointRef.current, point) / dtSec;
    }
    prevPointRef.current = { latitude: point.latitude, longitude: point.longitude };
    prevTimeRef.current = now;

    // ── Decide whether to accept the heading ───────────────────────────────
    const hasHeading = typeof point.heading === 'number' && Number.isFinite(point.heading);
    // Moving when speed is unknown (can't prove it's stationary) or above the
    // freeze threshold. Below threshold with known speed → freeze (hold last).
    const moving = speed == null || speed >= SPEED_THRESHOLD_MS;

    if (!hasHeading || !moving) {
      // Freeze: keep the last stable heading. First-ever point with no usable
      // heading just leaves rotation at 0 until a valid moving fix arrives.
      return;
    }

    const target = normalize360(point.heading as number);

    // ── Seed: first valid heading snaps into place (no spin-up) ─────────────
    if (!seededRef.current) {
      seededRef.current = true;
      lastStableRef.current = target;
      continuousRef.current = target;
      headingRef.current = target;
      rotation.setValue(target);
      return;
    }

    // ── Circular shortest-arc slew ─────────────────────────────────────────
    const delta = shortestDelta(lastStableRef.current, target);
    if (delta === 0) return; // no-op — avoid a redundant animation
    lastStableRef.current = target;
    continuousRef.current += delta;

    Animated.timing(rotation, {
      toValue: continuousRef.current,
      duration: ROTATION_DURATION_MS,
      useNativeDriver: false,
    }).start();
  }, [point?.latitude, point?.longitude, point?.heading, point?.speed, rotation]);

  return { rotation, headingRef };
}
