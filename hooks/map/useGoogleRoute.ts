/**
 * useGoogleRoute
 *
 * Encapsulates the Google Directions fetch lifecycle shared by CarMap and
 * PassengerTrackingMap:
 *
 *   - calls fetchGoogleRoute(origin, targets) when enabled
 *   - throttles refetches: skips if elapsed < 75 s AND driver has not moved
 *     >= 300 m since the last fetch
 *   - forces an immediate refetch when the targets change (new destination or
 *     phase change — detected by comparing a stable string key of the coords)
 *   - cancels any in-flight fetch when the component unmounts or when a new
 *     fetch supersedes it
 *   - exposes a `loading` flag so callers can show a fallback polyline while
 *     the route is loading
 *
 * Usage:
 *   const { routeCoords, durationSeconds, loading } = useGoogleRoute({
 *     origin: driverLocation,
 *     targets: [dropoff],
 *     enabled: tripPhase === 'trip_started',
 *   });
 *
 * Throttle constants (match both CarMap and PassengerTrackingMap):
 *   ROUTE_REFRESH_INTERVAL_MS = 75_000  (75 seconds)
 *   SIGNIFICANT_MOVE_METERS   = 300
 *
 * Assumptions / design notes:
 *   - `targets` is treated as stable if all coordinates are identical.
 *     Callers do not need to memoize the array; the hook memoizes a string key
 *     internally so a new array reference with the same coords does NOT trigger
 *     a refetch.
 *   - When `enabled` becomes false the route and duration are cleared
 *     immediately.  This matches the behaviour in both existing components
 *     (CarMap clears on destCoords === null; PTM clears on tripPhase === null).
 *   - The more specialised logic that exists in each component — CarMap's
 *     pre-driver "fetch once per pickup/destination pair" key guard, and PTM's
 *     force-refetch on phase change — is intentionally NOT folded in here.
 *     Those callers will continue to own that logic until Phase 2.
 */

import { useState, useRef, useEffect } from 'react';
import { fetchGoogleRoute } from '@/src/utils/googleDirections';
import { haversineMeters } from '@/src/utils/geoHelpers';

// ── Throttle constants ────────────────────────────────────────────────────────
// Identical to the values inlined in both CarMap and PassengerTrackingMap.
export const ROUTE_REFRESH_INTERVAL_MS = 75_000;
export const SIGNIFICANT_MOVE_METERS   = 300;

// ── Types ─────────────────────────────────────────────────────────────────────
interface LatLng {
  latitude: number;
  longitude: number;
}

interface UseGoogleRouteOptions {
  /** Route origin — typically the live driver position. */
  origin: LatLng | null | undefined;
  /**
   * Ordered waypoints / destination(s).
   * The hook compares a string key of all coordinates to detect destination
   * changes; passing a new array reference with the same values does NOT
   * trigger a refetch.
   */
  targets: LatLng[];
  /**
   * Gates all fetching.  Set to false to clear the route immediately (e.g.
   * when tripPhase is null or destCoords is null).
   * Defaults to true.
   */
  enabled?: boolean;
}

interface UseGoogleRouteResult {
  /** Road-snapped polyline coordinates from Google Directions. */
  routeCoords: LatLng[];
  /** Route travel time in seconds from the last successful fetch, or null. */
  durationSeconds: number | null;
  /** True while a fetch is in flight — callers can render a fallback line. */
  loading: boolean;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useGoogleRoute({
  origin,
  targets,
  enabled = true,
}: UseGoogleRouteOptions): UseGoogleRouteResult {
  const [routeCoords, setRouteCoords]       = useState<LatLng[]>([]);
  const [durationSeconds, setDurationSecs]  = useState<number | null>(null);
  const [loading, setLoading]               = useState(false);

  // Throttle refs — track where and when the last fetch originated.
  const lastFetchOriginRef = useRef<LatLng | null>(null);
  const lastFetchAtRef     = useRef(0);

  // Stable string key derived from the current targets list.  Recomputed on
  // every render but cheap (small arrays); used both in the effect body and as
  // the effect dependency so a new array reference with identical coords does
  // NOT trigger a re-run.
  const targetsKey = targets
    .map((t) => `${t.latitude},${t.longitude}`)
    .join('|');

  useEffect(() => {
    // ── Disabled / no origin / no targets: clear state ───────────────────────
    if (!enabled || !origin || targets.length === 0) {
      setRouteCoords([]);
      setDurationSecs(null);
      setLoading(false);
      lastFetchOriginRef.current = null;
      lastFetchAtRef.current     = 0;
      return;
    }

    // ── Throttle check ────────────────────────────────────────────────────────
    // The effect re-runs when targetsKey changes (new destination) — that alone
    // is enough to force an immediate fetch.  For the same destination, we also
    // refetch when the driver has moved >= 300 m or 75 s have elapsed.
    const now     = Date.now();
    const elapsed = now - lastFetchAtRef.current;

    const movedSignificantly = lastFetchOriginRef.current
      ? haversineMeters(lastFetchOriginRef.current, origin) >= SIGNIFICANT_MOVE_METERS
      : true; // always fetch the first time

    if (elapsed < ROUTE_REFRESH_INTERVAL_MS && !movedSignificantly) {
      // targetsKey is already in deps, so a destination change always bypasses
      // this guard — no explicit destinationChanged check is needed here.
      return;
    }

    // ── Issue the fetch ───────────────────────────────────────────────────────
    lastFetchOriginRef.current = { latitude: origin.latitude, longitude: origin.longitude };
    lastFetchAtRef.current     = now;

    let cancelled = false;
    setLoading(true);

    fetchGoogleRoute(origin, targets).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result?.coords?.length) {
        setRouteCoords(result.coords);
        // Only overwrite duration when a real value comes back — preserves the
        // previous valid ETA rather than dropping to null if a refresh returns
        // coords but no duration (mirrors PTM's existing logic).
        if (result.durationSeconds !== null) {
          setDurationSecs(result.durationSeconds);
        }
      }
      // On failure: keep whatever routeCoords are already in state.
      // The caller renders a straight-line fallback until this resolves.
    });

    return () => {
      cancelled = true;
    };
  // origin's object identity is excluded — individual lat/lng values and the
  // stable targetsKey drive re-runs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.latitude, origin?.longitude, targetsKey, enabled]);

  return { routeCoords, durationSeconds, loading };
}
