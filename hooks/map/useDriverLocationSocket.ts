import { useEffect, useRef, useState } from 'react';
import { getSocket, onSocketConnectionChange, type DriverLocation } from '@/src/api/socket';
import { SOCKET_EVENTS } from '@/constants/socketEvents';

interface Options {
  /** Standard-ride id to scope the live socket feed to. Null/undefined disables
   *  the socket subscription entirely (e.g. the shuttle caller, which drives
   *  driverLocation from its own hook and just wants `seed` echoed back). */
  rideId?: string | number | null;
  /** Initial/recovered value — e.g. from ActiveSessionContext's session:snapshot
   *  or a deep-link REST fetch. Re-applied whenever it changes so reconnect
   *  recovery still reaches the map, without that value living in the parent
   *  screen's state (which would re-render the whole screen on every tick). */
  seed?: DriverLocation | null;
}

/**
 * Owns the live `ride:driver_location` subscription for a single ride.
 * State updates from socket ticks are local to whichever component calls
 * this hook — callers should invoke it from inside the map component itself
 * so re-renders stay scoped to the map/marker subtree instead of bubbling up
 * to a screen-level parent.
 */
export function useDriverLocationSocket({ rideId, seed }: Options): DriverLocation | null {
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(seed ?? null);

  // Wall-clock time of the most recently applied *live* socket tick. Used to
  // reject a late-arriving seed (e.g. a slow REST fallback that started
  // before the live tick but resolves after it) so reconnect/recovery data
  // can never snap the marker backward over a position we've already shown.
  const lastLiveAtMsRef = useRef<number>(0);

  useEffect(() => {
    if (!seed) return;
    // A seed with no timestamp can't prove its recency. Trust it only before
    // any live tick has arrived (initial hydration / cold start); once live
    // data is flowing, an untimestamped seed is discarded rather than risking
    // a backward snap.
    if (seed.updatedAtMs == null) {
      if (lastLiveAtMsRef.current === 0) setDriverLocation(seed);
      return;
    }
    if (seed.updatedAtMs < lastLiveAtMsRef.current) return; // older than what we already have — discard
    setDriverLocation(seed);
  }, [seed]);

  useEffect(() => {
    if (rideId == null) return;

    let active = true;
    // Tracks whichever socket instance onDriverLocation is currently bound
    // to, so a reconnect that replaces the socket instance (reconnectSocket()
    // in src/api/socket.ts — e.g. after a token refresh mid-ride) can be
    // detected and re-bound. Without this the listener stays attached to the
    // dead old instance and the driver marker silently freezes for the rest
    // of the ride.
    let boundSocket: Awaited<ReturnType<typeof getSocket>> | null = null;
    let prevLat: number | undefined;
    let prevLng: number | undefined;
    let prevHeading: number | undefined;

    const onDriverLocation = (data: any) => {
      if (!active) return;
      const loc = data?.location;
      if (!loc) return;

      // ── Validate incoming payload ──────────────────────────────────────────
      // A malformed or out-of-range coordinate must never reach the tracking
      // buffer — it would corrupt the interpolation segment. Reject the tick.
      const latitude = loc.latitude;
      const longitude = loc.longitude;
      if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return;
      if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return;
      if (String(data.rideId) !== String(rideId)) return;

      // Normalise optional fields: keep only finite, in-domain values; anything
      // else becomes undefined (omitted) rather than flowing through as junk.
      const heading =
        typeof loc.heading === 'number' && Number.isFinite(loc.heading) ? loc.heading : undefined;
      const speed =
        typeof loc.speed === 'number' && Number.isFinite(loc.speed) && loc.speed >= 0 ? loc.speed : undefined;
      const accuracy =
        typeof loc.accuracy === 'number' && Number.isFinite(loc.accuracy) && loc.accuracy >= 0 ? loc.accuracy : undefined;
      const timestamp =
        typeof loc.timestamp === 'number' && Number.isFinite(loc.timestamp) && loc.timestamp > 0 ? loc.timestamp : undefined;

      // Identity guard: skip no-op updates so we don't re-render on duplicates.
      if (prevLat === latitude && prevLng === longitude && prevHeading === heading) return;
      prevLat = latitude;
      prevLng = longitude;
      prevHeading = heading;
      lastLiveAtMsRef.current = Date.now();

      // Emit only validated fields. speed/accuracy/timestamp are carried for
      // later phases; nothing consumes them yet.
      setDriverLocation({
        latitude,
        longitude,
        ...(heading !== undefined && { heading }),
        ...(speed !== undefined && { speed }),
        ...(accuracy !== undefined && { accuracy }),
        ...(timestamp !== undefined && { timestamp }),
      });
    };

    const bindTo = async () => {
      const socket = await getSocket();
      if (!active || boundSocket === socket) return;
      boundSocket?.off(SOCKET_EVENTS.RIDE_DRIVER_LOCATION, onDriverLocation);
      boundSocket = socket;
      socket.on(SOCKET_EVENTS.RIDE_DRIVER_LOCATION, onDriverLocation);
    };

    bindTo().catch(() => {});

    // Re-bind on every reconnect. Same-instance reconnects (socket.io's own
    // built-in reconnection) keep their listeners automatically — bindTo's
    // own `boundSocket === socket` check skips those as a no-op — so this
    // only does real work when reconnectSocket() swapped in a new instance.
    const unsubscribe = onSocketConnectionChange((state) => {
      if (state === 'connected') bindTo().catch(() => {});
    });

    return () => {
      active = false;
      unsubscribe();
      boundSocket?.off(SOCKET_EVENTS.RIDE_DRIVER_LOCATION, onDriverLocation);
    };
  }, [rideId]);

  return driverLocation;
}
