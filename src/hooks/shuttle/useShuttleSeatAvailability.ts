import { useEffect, useState } from 'react';
import { getTripAvailability } from '@/src/api/shuttleService';

interface LiveAvailability {
  availableSeats: number;
  bookedSeats: number;
  totalSeats: number;
}

const POLL_MS = 15_000;

/**
 * Fetches live seat availability for a shuttle trip (GET
 * /shuttle/trips/:id/availability). Re-fetches whenever tripId changes, and
 * polls every 15s while a trip is selected — a one-shot fetch could show
 * stale availability while the seat picker sits open, with the passenger
 * only learning a trip filled up when the booking itself got rejected.
 * Resets to null when there is no trip selected or a fetch fails.
 */
export function useShuttleSeatAvailability(tripId: string | number | null | undefined): LiveAvailability | null {
  const [liveAvailability, setLiveAvailability] = useState<LiveAvailability | null>(null);

  useEffect(() => {
    if (!tripId) { setLiveAvailability(null); return; }

    let cancelled = false;
    const fetchAvailability = () => {
      getTripAvailability(tripId).then((data) => {
        if (cancelled) return;
        setLiveAvailability({
          availableSeats: data.availableSeats ?? 0,
          bookedSeats: data.bookedSeats ?? 0,
          totalSeats: data.totalSeats ?? 0,
        });
      }).catch(() => { if (!cancelled) setLiveAvailability(null); });
    };

    fetchAvailability();
    const interval = setInterval(fetchAvailability, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [tripId]);

  return liveAvailability;
}
