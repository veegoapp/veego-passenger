import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import type { Trip, TripType } from '@/constants/data';

interface UseTripsResult {
  upcomingTrips: Trip[];
  pastTrips: Trip[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
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

function detectType(b: any): TripType {
  const raw = (
    b.type ?? b.bookingType ?? b.booking_type ??
    b.serviceType ?? b.service_type ?? b.category ?? ''
  ).toLowerCase();
  if (raw === 'car' || raw === 'ride' || raw === 'car_ride') return 'car';
  if (raw === 'scooter' || raw === 'scooter_ride' || raw === 'bike') return 'scooter';
  return 'shuttle';
}

function mapApiBooking(b: any): Trip {
  const trip = b.trip ?? {};
  const route = trip.route ?? trip.shuttleLine ?? trip.line ?? {};

  const bStatus = (b.status ?? '').toLowerCase();
  const tShuttleStatus = (trip.shuttleStatus ?? trip.shuttle_status ?? '').toLowerCase();
  const tStatus = (trip.status ?? '').toLowerCase();

  let status: Trip['status'];
  if (bStatus === 'cancelled' || tStatus === 'cancelled' || tShuttleStatus === 'cancelled') {
    status = 'cancelled';
  } else if (bStatus === 'completed' || tStatus === 'completed') {
    status = 'completed';
  } else {
    status = 'upcoming';
  }

  const type = detectType(b);

  const { date, time } = formatDateTimeUTC(
    trip.departureTime ?? trip.departure_time ?? b.scheduledAt ?? b.scheduled_at ?? '',
  );

  // Shuttle: route name comes from line data. Car/Scooter: derive from destination.
  const routeName =
    route.name ??
    trip.name ??
    b.destinationName ?? b.destination_name ??
    b.destinationAddress ?? b.destination_address ??
    (type === 'car' ? 'Car Ride' : type === 'scooter' ? 'Scooter Ride' : '—');

  const from =
    route.fromLocation ?? route.from_location ?? route.from ??
    b.pickupAddress ?? b.pickup_address ?? b.pickupName ?? b.pickup_name ?? b.origin ?? '—';

  const to =
    route.toLocation ?? route.to_location ?? route.to ??
    b.destinationAddress ?? b.destination_address ?? b.destinationName ?? b.destination_name ?? b.destination ?? '—';

  const routeCode =
    route.code ??
    (trip.lineId ? `L${trip.lineId}` : null) ??
    (type === 'car' ? 'CAR' : type === 'scooter' ? 'SCOOTER' : '—');

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
    price: b.totalPrice ?? b.total_price ?? trip.price ?? b.price ?? b.fare ?? 0,
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
      // Primary: shuttle bookings
      const bookingsRes = await api.get('/bookings').catch(() => ({ data: [] }));
      const bookings: any[] = Array.isArray(bookingsRes.data)
        ? bookingsRes.data
        : bookingsRes.data?.bookings ?? bookingsRes.data?.data ?? [];

      // Secondary: car/scooter rides (backend may expose a /rides endpoint)
      const ridesRes = await api.get('/rides').catch(() => ({ data: [] }));
      const rides: any[] = Array.isArray(ridesRes.data)
        ? ridesRes.data
        : ridesRes.data?.rides ?? ridesRes.data?.data ?? [];

      const all = [...bookings, ...rides];
      const mapped = all.map(mapApiBooking);

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
