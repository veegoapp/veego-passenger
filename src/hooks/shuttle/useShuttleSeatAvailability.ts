import { useEffect, useState } from 'react';
import { getTripAvailability } from '@/src/api/shuttleService';

interface LiveAvailability {
  availableSeats: number;
  bookedSeats: number;
  totalSeats: number;
}

/**
 * Fetches live seat availability for a shuttle trip (GET
 * /shuttle/trips/:id/availability). Re-fetches whenever tripId changes;
 * resets to null when there is no trip selected or the request fails.
 */
export function useShuttleSeatAvailability(tripId: string | number | null | undefined): LiveAvailability | null {
  const [liveAvailability, setLiveAvailability] = useState<LiveAvailability | null>(null);

  useEffect(() => {
    if (!tripId) { setLiveAvailability(null); return; }
    getTripAvailability(tripId).then((data) => {
      setLiveAvailability({
        availableSeats: data.availableSeats ?? 0,
        bookedSeats: data.bookedSeats ?? 0,
        totalSeats: data.totalSeats ?? 0,
      });
    }).catch(() => setLiveAvailability(null));
  }, [tripId]);

  return liveAvailability;
}
