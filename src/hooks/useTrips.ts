import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import type { Trip, TripType } from '@/constants/data';

interface UseTripsResult {
  upcomingTrips: Trip[];
  pastTrips: Trip[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function formatDateTimeUTC(raw: string): { date: string; time: string } {
  if (!raw) return { date: '—', time: '—' };
  const d = new Date(raw);
  if (isNaN(d.getTime())) return { date: raw, time: '—' };
  return {
    date: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false }),
  };
}

function mapApiBooking(b: any): Trip {
  const trip = b.trip ?? {};
  const route = trip.route ?? trip.shuttleLine ?? trip.line ?? {};

  const bStatus = (b.status ?? '').toLowerCase();
  const tShuttleStatus = (trip.shuttleStatus ?? '').toLowerCase();
  const tStatus = (trip.status ?? '').toLowerCase();

  let status: Trip['status'];
  if (bStatus === 'cancelled' || tStatus === 'cancelled' || tShuttleStatus === 'cancelled') {
    status = 'cancelled';
  } else if (bStatus === 'completed' || tStatus === 'completed') {
    status = 'completed';
  } else {
    // pending = upcoming (boarding not yet happened)
    status = 'upcoming';
  }

  const rawType = 'shuttle';
  const type: TripType = rawType;

  const { date, time } = formatDateTimeUTC(trip.departureTime ?? trip.departure_time ?? '');

  const routeName = route.name ?? trip.name ?? (trip.routeId ? `Route #${trip.routeId}` : '—');
  const from = route.fromLocation ?? route.from_location ?? route.from ?? '—';
  const to = route.toLocation ?? route.to_location ?? route.to ?? '—';

  return {
    id: String(b.id ?? b._id ?? Math.random()),
    type,
    routeCode: route.code ?? (trip.lineId ? `L${trip.lineId}` : '—'),
    routeName,
    from,
    to,
    date,
    time,
    seat: b.seatNumber ?? b.seat_number ?? b.seat ?? '—',
    status,
    price: b.totalPrice ?? b.total_price ?? trip.price ?? b.price ?? 0,
  };
}

export function useTrips(): UseTripsResult {
  const [upcomingTrips, setUpcomingTrips] = useState<Trip[]>([]);
  const [pastTrips, setPastTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // GET /bookings — user's shuttle bookings (auth required)
      const { data } = await api.get('/bookings');
      const allBookings: any[] = Array.isArray(data) ? data : data.bookings ?? data.data ?? [];
      const mapped = allBookings.map(mapApiBooking);

      setUpcomingTrips(mapped.filter((t) => t.status === 'upcoming'));
      setPastTrips(mapped.filter((t) => t.status !== 'upcoming'));
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? 'Failed to load trips';
      setError(msg);
      setUpcomingTrips([]);
      setPastTrips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  return { upcomingTrips, pastTrips, loading, error, refresh: fetchTrips };
}
