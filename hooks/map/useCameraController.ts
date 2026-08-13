/**
 * useCameraController  (Phase 3C — camera controller)
 *
 * Uber-like follow camera. Replaces the old per-socket-tick
 * animateToRegion(rawDriverLocation) follow with a single rAF loop that reads
 * the SAME interpolated position that drives the marker (positionRef) and the
 * SAME smoothed heading from Phase 3B (headingRef), and commits them with
 * setCamera (course-up, tilted, fixed zoom).
 *
 * Key properties:
 *   - Source: positionRef + headingRef only. No raw driverLocation reaches the
 *     camera, and marker + camera share one movement source.
 *   - setCamera (instant) for the follow loop — the source is already smoothed,
 *     so no per-call easing is needed and there are no competing animations
 *     (that was the shake). animateCamera is used ONLY for discrete transitions
 *     (recenter / resume-after-overview).
 *   - Throttled writes: the rAF loop runs at display rate but effective
 *     setCamera calls are capped (~18fps) and gated by a movement/heading
 *     dead-band, so a stationary vehicle issues ~zero native calls.
 *   - User interaction: pan / pinch / rotate suspend the follow; an ~8s idle
 *     timer (or the recenter button) resumes it.
 *   - Overview fits: the component pauses follow (suspendForOverview), runs its
 *     existing fitToCoordinates, then calls resumeFollow.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type MapView from 'react-native-maps';

interface LatLng {
  latitude: number;
  longitude: number;
}

interface UseCameraControllerOptions {
  mapRef: React.RefObject<MapView | null>;
  mapReadyRef: React.MutableRefObject<boolean>;
  /** Interpolated driver position (from useTrackingBuffer). Null until known. */
  positionRef: React.MutableRefObject<LatLng | null>;
  /** Smoothed heading in [0,360) (from useSmoothedHeading). */
  headingRef: React.MutableRefObject<number>;
  /** Follow is allowed only while true (driver present & active phase). */
  followActive: boolean;
  /** Camera tilt. Default 45°. */
  pitch?: number;
  /** Fixed follow zoom for this phase. Default 16. */
  zoom?: number;
  /** Rotate the map to the direction of travel. Default true. */
  courseUp?: boolean;
  /** Idle time before follow auto-resumes after a gesture. Default 8000ms;
   *  0 disables auto-resume (recenter button only). */
  autoResumeMs?: number;
}

interface UseCameraControllerResult {
  /** True while the user has manual control (follow paused) — drives the
   *  recenter button's visibility. */
  isSuspended: boolean;
  /** Wire to <MapView onPanDrag={…} />. */
  onPanDrag: () => void;
  /** Wire to <MapView onRegionChangeComplete={onRegionChangeComplete} /> —
   *  catches pinch-zoom / rotate gestures that onPanDrag misses. */
  onRegionChangeComplete: (region: unknown, details?: { isGesture?: boolean }) => void;
  /** Recenter button handler — resume follow and glide to the current pose. */
  recenter: () => void;
  /** Pause follow for a programmatic overview fitToCoordinates. */
  suspendForOverview: () => void;
  /** Resume follow after an overview fit (glides back to the follow pose). */
  resumeFollow: () => void;
}

const DEFAULT_PITCH = 0;
const DEFAULT_ZOOM = 16;
const DEFAULT_AUTO_RESUME_MS = 8000;
// Cap effective setCamera writes to ~18fps regardless of display refresh.
const WRITE_INTERVAL_MS = 1000 / 18;
// Dead-band: below these deltas the follow frame is unchanged, skip the write.
const MIN_MOVE_M = 0.5;
const MIN_HEADING_DEG = 0.5;
// Duration of the animateCamera glide used for resume/recenter transitions.
const TRANSITION_MS = 450;

function metersBetween(a: LatLng, b: LatLng): number {
  const dLat = (b.latitude - a.latitude) * 111320;
  const dLng =
    (b.longitude - a.longitude) * 111320 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/** Absolute shortest angular difference in degrees, wrap-safe. */
function headingDiff(a: number, b: number): number {
  return Math.abs(((b - a + 540) % 360) - 180);
}

export function useCameraController({
  mapRef,
  mapReadyRef,
  positionRef,
  headingRef,
  followActive,
  pitch = DEFAULT_PITCH,
  zoom = DEFAULT_ZOOM,
  courseUp = true,
  autoResumeMs = DEFAULT_AUTO_RESUME_MS,
}: UseCameraControllerOptions): UseCameraControllerResult {
  const [isSuspended, setIsSuspended] = useState(false);

  // Refs mirrored from props so the rAF loop reads them without re-subscribing.
  const followActiveRef = useRef(followActive);
  const courseUpRef = useRef(courseUp);
  const pitchRef = useRef(pitch);
  const zoomRef = useRef(zoom);
  useEffect(() => { followActiveRef.current = followActive; }, [followActive]);
  useEffect(() => { courseUpRef.current = courseUp; }, [courseUp]);
  useEffect(() => { pitchRef.current = pitch; }, [pitch]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Pause state (loop reads refs; state only drives the button).
  const userSuspendedRef = useRef(false);
  const overviewPausedRef = useRef(false);
  // While Date.now() < holdUntilRef the loop yields to an in-flight
  // animateCamera transition instead of fighting it with setCamera.
  const holdUntilRef = useRef(0);

  const lastWriteAtRef = useRef(0);
  const lastCenterRef = useRef<LatLng | null>(null);
  const lastHeadingRef = useRef<number>(0);
  const autoResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  // Glide to the current follow pose (used on resume / recenter). One
  // animateCamera call; the loop holds off until it completes.
  const animateToFollowPose = useCallback(() => {
    const pos = positionRef.current;
    if (!pos || !mapReadyRef.current) return;
    holdUntilRef.current = Date.now() + TRANSITION_MS;
    mapRef.current?.animateCamera(
      {
        center: { latitude: pos.latitude, longitude: pos.longitude },
        heading: courseUpRef.current ? headingRef.current : 0,
        pitch: pitchRef.current,
        zoom: zoomRef.current,
      },
      { duration: TRANSITION_MS },
    );
  }, [mapRef, mapReadyRef, positionRef, headingRef]);

  const clearAutoResume = useCallback(() => {
    if (autoResumeTimerRef.current != null) {
      clearTimeout(autoResumeTimerRef.current);
      autoResumeTimerRef.current = null;
    }
  }, []);

  // ── User suspension (gestures) ─────────────────────────────────────────────
  const userSuspend = useCallback(() => {
    if (!followActiveRef.current) return;
    userSuspendedRef.current = true;
    setIsSuspended(true);
    clearAutoResume();
    if (autoResumeMs > 0) {
      autoResumeTimerRef.current = setTimeout(() => {
        userSuspendedRef.current = false;
        setIsSuspended(false);
        autoResumeTimerRef.current = null;
        animateToFollowPose();
      }, autoResumeMs);
    }
  }, [autoResumeMs, clearAutoResume, animateToFollowPose]);

  const recenter = useCallback(() => {
    clearAutoResume();
    userSuspendedRef.current = false;
    overviewPausedRef.current = false;
    setIsSuspended(false);
    animateToFollowPose();
  }, [clearAutoResume, animateToFollowPose]);

  const onPanDrag = useCallback(() => { userSuspend(); }, [userSuspend]);

  const onRegionChangeComplete = useCallback(
    (_region: unknown, details?: { isGesture?: boolean }) => {
      // On platforms/versions that report it, only user gestures suspend —
      // programmatic camera moves also fire this callback but with isGesture
      // false/undefined. When the flag is absent we do NOT suspend here
      // (onPanDrag already covers pans); this avoids programmatic setCamera
      // writes from suspending themselves in a feedback loop.
      if (details?.isGesture) userSuspend();
    },
    [userSuspend],
  );

  // ── Overview fit hooks (component keeps its own fitToCoordinates) ───────────
  const suspendForOverview = useCallback(() => {
    overviewPausedRef.current = true;
  }, []);

  const resumeFollow = useCallback(() => {
    overviewPausedRef.current = false;
    // Only auto-glide back if the user hasn't grabbed manual control.
    if (!userSuspendedRef.current) animateToFollowPose();
  }, [animateToFollowPose]);

  // ── Follow loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!followActive) {
      // Reset per-follow bookkeeping so the next activation starts clean.
      lastCenterRef.current = null;
      return;
    }

    let mounted = true;

    const tick = () => {
      if (!mounted) return;
      rafRef.current = requestAnimationFrame(tick);

      const now = Date.now();
      if (userSuspendedRef.current || overviewPausedRef.current) return;
      if (now < holdUntilRef.current) return;
      if (!mapReadyRef.current) return;
      const pos = positionRef.current;
      if (!pos) return;

      // Throttle to ~18fps.
      if (now - lastWriteAtRef.current < WRITE_INTERVAL_MS) return;

      const heading = courseUpRef.current ? headingRef.current : 0;

      // Dead-band: skip when neither center nor heading moved meaningfully.
      const last = lastCenterRef.current;
      if (
        last &&
        metersBetween(last, pos) < MIN_MOVE_M &&
        headingDiff(lastHeadingRef.current, heading) < MIN_HEADING_DEG
      ) {
        return;
      }

      mapRef.current?.setCamera({
        center: { latitude: pos.latitude, longitude: pos.longitude },
        heading,
        pitch: pitchRef.current,
        zoom: zoomRef.current,
      });
      lastWriteAtRef.current = now;
      lastCenterRef.current = { latitude: pos.latitude, longitude: pos.longitude };
      lastHeadingRef.current = heading;
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      mounted = false;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [followActive, mapRef, mapReadyRef, positionRef, headingRef]);

  // Clean up the auto-resume timer on unmount.
  useEffect(() => clearAutoResume, [clearAutoResume]);

  return {
    isSuspended,
    onPanDrag,
    onRegionChangeComplete,
    recenter,
    suspendForOverview,
    resumeFollow,
  };
}
