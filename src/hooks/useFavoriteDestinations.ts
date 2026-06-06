import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import type { TripType } from '@/constants/data';

export interface FavoriteDestination {
  key: string;
  type: TripType;
  from: string;
  to: string;
  count: number;
  lastUsed: string | null;
  lastPrice: number;
}

interface UseFavoriteDestinationsResult {
  destinations: FavoriteDestination[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
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

function formatLastUsed(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function useFavoriteDestinations(): UseFavoriteDestinationsResult {
  const [destinations, setDestinations] = useState<FavoriteDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDestinations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Combine all booking sources to derive frequent routes
      const [bookingsRes, ridesRes] = await Promise.allSettled([
        api.get('/bookings'),
        api.get('/rides'),
      ]);

      const bookings: any[] =
        bookingsRes.status === 'fulfilled'
          ? Array.isArray(bookingsRes.value.data)
            ? bookingsRes.value.data
            : bookingsRes.value.data?.bookings ?? bookingsRes.value.data?.data ?? []
          : [];

      const rides: any[] =
        ridesRes.status === 'fulfilled'
          ? Array.isArray(ridesRes.value.data)
            ? ridesRes.value.data
            : ridesRes.value.data?.rides ?? ridesRes.value.data?.data ?? []
          : [];

      const all = [...bookings, ...rides];

      // Group by (type, from, to) and count frequency
      const groups = new Map<string, FavoriteDestination>();

      for (const b of all) {
        const type = detectType(b);
        const trip = b.trip ?? {};
        const route = trip.route ?? trip.shuttleLine ?? trip.line ?? {};

        const from =
          route.fromLocation ?? route.from_location ?? route.from ??
          b.pickupAddress ?? b.pickup_address ?? b.pickupName ?? b.pickup_name ?? b.origin ?? '';
        const to =
          route.toLocation ?? route.to_location ?? route.to ??
          b.destinationAddress ?? b.destination_address ?? b.destinationName ?? b.destination_name ?? b.destination ?? '';

        if (!from || !to || from === '—' || to === '—') continue;

        const key = `${type}::${from}::${to}`;
        const rawDate = trip.departureTime ?? trip.departure_time ?? b.scheduledAt ?? b.scheduled_at ?? null;
        const price = b.totalPrice ?? b.total_price ?? trip.price ?? b.price ?? b.fare ?? 0;

        if (groups.has(key)) {
          const existing = groups.get(key)!;
          existing.count += 1;
          // Keep the most recent date
          if (rawDate && (!existing.lastUsed || rawDate > existing.lastUsed)) {
            existing.lastUsed = formatLastUsed(rawDate);
          }
          if (price > 0) existing.lastPrice = price;
        } else {
          groups.set(key, {
            key,
            type,
            from,
            to,
            count: 1,
            lastUsed: formatLastUsed(rawDate),
            lastPrice: price,
          });
        }
      }

      // Sort by frequency descending, then by last used descending
      const sorted = Array.from(groups.values()).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        if (a.lastUsed && b.lastUsed) return b.lastUsed.localeCompare(a.lastUsed);
        return 0;
      });

      setDestinations(sorted.slice(0, 10));
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? 'Failed to load frequent destinations';
      setError(msg);
      setDestinations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDestinations();
  }, [fetchDestinations]);

  return { destinations, loading, error, refresh: fetchDestinations };
}
