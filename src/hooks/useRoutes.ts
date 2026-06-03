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

function formatTime(raw: string): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function mapApiRoute(r: any, idx: number, nextTripMap: Record<number, any>): Route {
  const routeId = Number(r.id);
  const nextTrip = nextTripMap[routeId];

  return {
    id: String(r.id ?? ''),
    code: r.code ?? `R${r.id}`,
    name: r.name ?? '',
    from: r.fromLocation ?? r.from_location ?? r.from ?? '',
    to: r.toLocation ?? r.to_location ?? r.to ?? '',
    stations: r.stationCount ?? r.station_count ?? r.stations ?? 0,
    duration: r.estimatedDuration
      ? `${r.estimatedDuration} دقيقة`
      : r.estimated_duration
      ? `${r.estimated_duration} دقيقة`
      : r.duration ?? '—',
    seatsLeft: nextTrip?.availableSeats ?? r.availableSeats ?? r.available_seats ?? r.seatsLeft ?? 0,
    totalSeats: nextTrip?.totalSeats ?? r.totalSeats ?? r.total_seats ?? r.capacity ?? 18,
    price: r.basePrice ?? r.base_price ?? r.price ?? 0,
    nextDeparture: nextTrip ? formatTime(nextTrip.departureTime ?? nextTrip.departure_time) : (r.nextDeparture ?? r.next_departure ?? '—'),
    color: r.color ?? ROUTE_COLORS[idx % ROUTE_COLORS.length],
    path: Array.isArray(r.stations)
      ? r.stations.map((s: any) => ({
          id: String(s.id ?? s._id ?? Math.random()),
          name: s.name ?? s.stationName ?? s.station_name ?? '',
          area: s.area ?? '',
          distance: s.distance ?? '—',
          eta: s.eta ?? '—',
        }))
      : Array.isArray(r.path)
      ? r.path.map((s: any) => ({
          id: String(s.id ?? Math.random()),
          name: s.name ?? '',
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
      // Fetch routes and scheduled trips in parallel
      const [routesRes, tripsRes] = await Promise.allSettled([
        api.get('/shuttle/lines'),
        api.get('/shuttle/trips?status=scheduled&limit=200'),
      ]);

      // Build routeId → earliest upcoming trip map for seatsLeft + nextDeparture
      const nextTripMap: Record<number, any> = {};
      if (tripsRes.status === 'fulfilled') {
        const d = tripsRes.value.data;
        const tripList: any[] = Array.isArray(d) ? d : d.data ?? d.trips ?? d.items ?? [];
        for (const t of tripList) {
          const rid = Number(t.routeId ?? t.route_id);
          if (!rid) continue;
          const existing = nextTripMap[rid];
          const thisTime = new Date(t.departureTime ?? t.departure_time ?? 0).getTime();
          const existTime = existing
            ? new Date(existing.departureTime ?? existing.departure_time ?? 0).getTime()
            : Infinity;
          if (thisTime < existTime) nextTripMap[rid] = t;
        }
      }

      if (routesRes.status === 'rejected') throw routesRes.reason;

      const d = routesRes.value.data;
      const list: any[] = Array.isArray(d) ? d : d.data ?? d.routes ?? d.items ?? [];
      setRoutes(list.map((r, idx) => mapApiRoute(r, idx, nextTripMap)));
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
