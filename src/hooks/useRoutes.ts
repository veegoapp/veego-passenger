import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import type { Route } from '@/constants/data';

interface UseRoutesResult {
  routes: Route[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const ROUTE_COLORS = [
  '#d8ecf7', '#d5f0e5', '#e3daf5', '#f5f0d3',
  '#fde8d8', '#d8f5e8', '#f5d8ec', '#dff5f8',
];

function mapApiRoute(r: any, idx: number): Route {
  // openTrips: trips in 'open' state (need more bookings)
  // activeTrips: trips in 'active' state (guaranteed)
  const openCount: number = r.openTrips ?? 0;
  const activeCount: number = r.activeTrips ?? 0;
  const totalSeats: number = r.totalSeats ?? 14;
  const minRequired: number = r.minRequired ?? 7;

  // Derive seatsLeft from the counts (prefer activeTrips available seats if known)
  // Since the lines list doesn't return per-trip seat counts, we show a general indicator
  const hasActiveTrips = activeCount > 0;
  const hasOpenTrips = openCount > 0;

  return {
    id: String(r.id ?? ''),
    code: r.code ?? `L${String(r.id).padStart(2, '0')}`,
    name: r.name ?? '',
    from: r.fromLocation ?? r.from_location ?? r.from ?? '',
    to: r.toLocation ?? r.to_location ?? r.to ?? '',
    stations: r.stationCount ?? r.station_count ?? r.stations ?? 0,
    duration: r.estimatedDuration
      ? `${r.estimatedDuration} min`
      : r.estimated_duration
      ? `${r.estimated_duration} min`
      : r.duration ?? '—',
    // Show seats available across all open+active trips (summary level)
    seatsLeft: r.availableSeats ?? (hasActiveTrips ? totalSeats : hasOpenTrips ? totalSeats : 0),
    totalSeats,
    price: r.basePrice ?? r.base_price ?? r.price ?? 0,
    nextDeparture: r.nextDeparture ?? r.next_departure ?? '—',
    color: r.color ?? ROUTE_COLORS[idx % ROUTE_COLORS.length],
    path: Array.isArray(r.stations)
      ? r.stations.map((s: any) => ({
          id: String(s.id ?? s._id ?? Math.random()),
          name: s.name ?? s.stationName ?? s.station_name ?? '',
          area: s.area ?? '',
          distance: s.distance ?? '—',
          eta: s.eta ?? '—',
        }))
      : [],
  };
}

export function useRoutes(): UseRoutesResult {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // GET /shuttle/lines — no auth required per API contract
      const { data } = await api.get('/shuttle/lines');
      const list: any[] = Array.isArray(data) ? data : data.data ?? data.routes ?? data.items ?? [];
      setRoutes(list.map((r, idx) => mapApiRoute(r, idx)));
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? 'Failed to load routes';
      setError(msg);
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  return { routes, loading, error, refresh: fetchRoutes };
}
