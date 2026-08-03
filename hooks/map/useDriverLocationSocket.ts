import { useEffect, useRef, useState } from 'react';
import { getSocket, getSocketSync, type DriverLocation } from '@/src/api/socket';
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
    let prevLat: number | undefined;
    let prevLng: number | undefined;
    let prevHeading: number | undefined;

    const onDriverLocation = (data: any) => {
      const loc = data?.location;
      if (!loc || !active) return;
      if (String(data.rideId) !== String(rideId)) return;
      // Identity guard: skip no-op updates so we don't re-render on duplicates.
      if (prevLat === loc.latitude && prevLng === loc.longitude && prevHeading === loc.heading) return;
      prevLat = loc.latitude;
      prevLng = loc.longitude;
      prevHeading = loc.heading;
      lastLiveAtMsRef.current = Date.now();
      setDriverLocation(loc);
    };

    getSocket().then((socket) => {
      if (!active) return;
      socket.on(SOCKET_EVENTS.RIDE_DRIVER_LOCATION, onDriverLocation);
    }).catch(() => {});

    return () => {
      active = false;
      const s = getSocketSync();
      if (s) s.off(SOCKET_EVENTS.RIDE_DRIVER_LOCATION, onDriverLocation);
    };
  }, [rideId]);

  return driverLocation;
}
