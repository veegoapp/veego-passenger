import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import type { Route, TimeSlot } from '@/constants/data';

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
  const openCount: number  = r.openTrips   ?? 0;
  const activeCount: number = r.activeTrips ?? 0;
  const totalSeats: number  = r.totalSeats  ?? 14;
  const minRequired: number = r.minRequired ?? 7;

  const hasActiveTrips = activeCount > 0;
  const hasOpenTrips   = openCount   > 0;

  // Prefer timeslots over deprecated timeSlots (§20)
  const timeslots: TimeSlot[] = Array.isArray(r.timeslots)
    ? r.timeslots
    : Array.isArray(r.timeSlots)
    ? r.timeSlots
    : [];

  return {
    id:   String(r.id ?? ''),
    code: r.code ?? `L${String(r.id).padStart(2, '0')}`,

    // English name fields
    name: r.name ?? '',
    from: r.fromLocation ?? r.from_location ?? r.from ?? '',
    to:   r.toLocation   ?? r.to_location   ?? r.to   ?? '',

    // Arabic name fields (§3, §21.5)
    nameAr: r.nameAr          ?? r.name_ar           ?? null,
    fromAr: r.fromLocationAr  ?? r.from_location_ar  ?? null,
    toAr:   r.toLocationAr    ?? r.to_location_ar    ?? null,

    stations: r.stationCount ?? r.station_count ?? r.stations ?? 0,
    duration: r.estimatedDuration
      ? `${r.estimatedDuration} min`
      : r.estimated_duration
      ? `${r.estimated_duration} min`
      : r.duration ?? '—',

    seatsLeft:    r.availableSeats ?? (hasActiveTrips ? totalSeats : hasOpenTrips ? totalSeats : 0),
    totalSeats,
    price:        r.basePrice ?? r.base_price ?? r.price ?? 0,
    nextDeparture: r.nextDeparture ?? r.next_departure ?? '—',
    color:        r.color ?? ROUTE_COLORS[idx % ROUTE_COLORS.length],

    // Shuttle line computed fields (§2.9)
    openTrips:         r.openTrips   ?? 0,
    activeTrips:       r.activeTrips ?? 0,
    totalTrips:        r.totalTrips  ?? 0,
    minRequired,
    upcomingWeekStart: r.upcomingWeekStart ?? null,
    timeslots,

    path: Array.isArray(r.stations)
      ? r.stations
          .slice()
          .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
          .map((s: any) => ({
            id:           String(s.id ?? s._id ?? Math.random()),
            name:         s.name         ?? s.stationName  ?? s.station_name ?? '',
            nameAr:       s.nameAr       ?? s.name_ar      ?? null,
            area:         s.area         ?? '',
            distance:     s.distance     ?? '—',
            eta:          s.eta          ?? '—',
            latitude:     s.latitude     ?? s.lat          ?? undefined,
            longitude:    s.longitude    ?? s.lng          ?? undefined,
            order:        s.order        ?? undefined,
            direction:    s.direction    ?? undefined,
            segmentPrice: s.segmentPrice ?? s.segment_price ?? null,
          }))
      : [],
  };
}

export function useRoutes(): UseRoutesResult {
  const [routes, setRoutes]   = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // GET /shuttle/lines — public, no auth required
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
