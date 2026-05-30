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

function formatDateTime(raw: string): { date: string; time: string } {
  if (!raw) return { date: '—', time: '—' };
  const d = new Date(raw);
  if (isNaN(d.getTime())) return { date: raw, time: '—' };
  return {
    date: d.toLocaleDateString('ar-EG', { month: 'long', day: 'numeric' }),
    time: d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
  };
}

function mapApiBooking(b: any, routeMap: Record<number, any>): Trip {
  const trip = b.trip ?? {};
  const routeId: number = trip.routeId ?? trip.route_id ?? b.routeId ?? 0;
  const route = trip.route ?? routeMap[routeId] ?? {};

  const bStatus = (b.status ?? '').toLowerCase();
  const tStatus = (trip.status ?? '').toLowerCase();
  let status: Trip['status'];
  if (bStatus === 'cancelled' || tStatus === 'cancelled') status = 'cancelled';
  else if (bStatus === 'completed' || tStatus === 'completed') status = 'completed';
  else status = 'upcoming';

  const rawType = (route.type ?? b.type ?? 'shuttle').toLowerCase();
  const type: TripType = rawType === 'car' ? 'car' : rawType === 'bike' ? 'bike' : 'shuttle';

  const { date, time } = formatDateTime(trip.departureTime ?? trip.departure_time ?? '');

  const routeCode = route.code ?? (routeId ? `R${routeId}` : '—');
  const routeName = route.name ?? (routeId ? `Route #${routeId}` : '—');
  const from = route.fromLocation ?? route.from_location ?? route.from ?? '—';
  const to = route.toLocation ?? route.to_location ?? route.to ?? '—';

  return {
    id: String(b.id ?? b._id ?? Math.random()),
    type,
    routeCode,
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
      // Fetch bookings and routes in parallel — routes needed to resolve route names
      const [bookingsRes, routesRes] = await Promise.allSettled([
        api.get('/users/me/bookings'),
        api.get('/shuttle/lines'),
      ]);

      // Build routeId → route lookup map
      let routeMap: Record<number, any> = {};
      if (routesRes.status === 'fulfilled') {
        const d = routesRes.value.data;
        const list: any[] = Array.isArray(d) ? d : d.data ?? d.routes ?? d.items ?? [];
        for (const r of list) {
          if (r.id != null) routeMap[Number(r.id)] = r;
        }
      }

      if (bookingsRes.status === 'rejected') {
        throw bookingsRes.reason;
      }

      const d = bookingsRes.value.data;
      const allBookings: any[] = Array.isArray(d) ? d : d.bookings ?? d.data ?? [];
      const mapped = allBookings.map((b) => mapApiBooking(b, routeMap));

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
