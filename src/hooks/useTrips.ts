import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import type { Trip, TripType, ShuttleTripStatus, BookingStatus, PaymentStatus } from '@/constants/data';
import { isShuttleTripUpcoming, formatCairoDateTime } from '@/constants/data';

interface UseTripsResult {
  upcomingTrips: Trip[];
  pastTrips:     Trip[];
  loading:       boolean;
  error:         string | null;
  hasMore:       boolean;
  loadMore:      () => Promise<void>;
  refresh:       () => Promise<void>;
}

function detectType(b: any): TripType {
  const raw = (
    b.type ?? b.bookingType ?? b.booking_type ??
    b.serviceType ?? b.service_type ?? b.category ?? ''
  ).toLowerCase();
  if (raw === 'car'     || raw === 'ride'   || raw === 'car_ride')     return 'car';
  if (raw === 'scooter' || raw === 'scooter_ride' || raw === 'bike')   return 'scooter';
  return 'shuttle';
}

function mapBackendStatus(raw: string): ShuttleTripStatus {
  switch (raw.toLowerCase()) {
    case 'waiting_driver':  return 'waiting_driver';
    case 'scheduled':       return 'scheduled';
    case 'driver_assigned': return 'driver_assigned';
    case 'active':          return 'active';
    case 'boarding':        return 'boarding';
    case 'completed':       return 'completed';
    case 'cancelled':       return 'cancelled';
    case 'open':            return 'scheduled';  // legacy alias
    default:                return 'upcoming';
  }
}

/**
 * Maps a raw booking object (from GET /users/me/bookings) into the Trip display model.
 * Stores both English and Arabic name fields so screens can choose based on locale.
 * Departure times are formatted in Africa/Cairo timezone per §21.9.
 */
function mapApiBooking(b: any): Trip {
  const trip  = b.trip  ?? {};
  const route = trip.route ?? trip.shuttleLine ?? trip.line ?? {};

  // Booking status (raw) — §2.4, §21.1
  const rawBookingStatus = (b.status ?? '').toLowerCase() as BookingStatus;
  // Trip status — drives upcoming/past classification
  const rawTripStatus    = (trip.shuttleStatus ?? trip.shuttle_status ?? trip.status ?? '').toLowerCase();
  const status: ShuttleTripStatus = mapBackendStatus(rawTripStatus || rawBookingStatus);

  const type = detectType(b);

  const departureIso =
    trip.departureTime ?? trip.departure_time ?? b.scheduledAt ?? b.scheduled_at ?? '';

  // §21.9: display in Africa/Cairo, not UTC
  const { date, time } = formatCairoDateTime(departureIso);

  // English + Arabic route names (§3)
  const routeName   = route.name          ?? trip.name     ?? b.destinationName ?? b.destination_name ?? (type === 'car' ? 'Car Ride' : type === 'scooter' ? 'Scooter Ride' : '—');
  const routeNameAr = route.nameAr        ?? route.name_ar ?? null;

  const from   = route.fromLocation   ?? route.from_location  ?? route.from  ?? b.pickupAddress     ?? b.pickup_name     ?? b.origin ?? '—';
  const fromAr = route.fromLocationAr ?? route.from_location_ar ?? null;

  const to     = route.toLocation     ?? route.to_location    ?? route.to    ?? b.destinationAddress ?? b.destination_name ?? b.destination ?? '—';
  const toAr   = route.toLocationAr   ?? route.to_location_ar   ?? null;

  const routeCode = route.code ??
    (trip.lineId ? `L${trip.lineId}` : null) ??
    (type === 'car' ? 'CAR' : type === 'scooter' ? 'SCOOTER' : '—');

  const pickupStation = trip.pickupStation ?? b.pickupStation ?? null;

  return {
    id:   String(b.id ?? b._id ?? Math.random()),
    type,
    routeCode,
    routeName,
    routeNameAr,
    from,
    fromAr,
    to,
    toAr,
    date,
    time,
    departureIso,
    seat: b.seatNumber ?? b.seat_number ?? b.seat ?? '—',
    status,
    bookingStatus: rawBookingStatus || undefined,
    paymentStatus: (b.paymentStatus ?? b.payment_status) as PaymentStatus | undefined,
    price:         b.totalPrice ?? b.total_price ?? trip.price ?? b.price ?? b.fare ?? 0,
    tripId:        trip.id ?? trip._id ?? b.tripId ?? b.trip_id ?? null,
    bookingId:     String(b.id ?? b._id ?? ''),
    pickupLat:     pickupStation?.latitude ?? pickupStation?.lat ?? null,
    pickupLng:     pickupStation?.longitude ?? pickupStation?.lng ?? null,
    passengerCount: trip.passengerCount ?? trip.passenger_count ?? null,
    minPassengers:  trip.minPassengers  ?? trip.min_passengers  ?? null,
    seatCount:      b.seatCount         ?? b.seat_count         ?? 1,
    promoCodeId:    b.promoCodeId       ?? b.promo_code_id      ?? null,
    vehicleType:    trip.vehicleType    ?? trip.vehicle_type     ?? undefined,
    totalSeats:     trip.totalSeats     ?? trip.total_seats      ?? undefined,
    availableSeats: trip.availableSeats ?? trip.available_seats  ?? undefined,
  };
}

const PAGE_LIMIT = 10;

export function useTrips(): UseTripsResult {
  const [upcomingTrips, setUpcomingTrips] = useState<Trip[]>([]);
  const [pastTrips,     setPastTrips]     = useState<Trip[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [page,          setPage]          = useState(1);
  const [total,         setTotal]         = useState(0);

  const fetchTrips = useCallback(async (pageNum = 1) => {
    if (pageNum === 1) setLoading(true);
    setError(null);
    try {
      // §11.5: GET /users/me/bookings — replaces deprecated /shuttle/my-trips
      const shuttleRes = await api
        .get('/users/me/bookings', { params: { page: pageNum, limit: PAGE_LIMIT } })
        .catch(() => ({ data: [] }));

      const d = shuttleRes.data;
      const shuttleBookings: any[] = Array.isArray(d)
        ? d
        : d.trips ?? d.bookings ?? d.data ?? d.items ?? [];
      const serverTotal: number =
        typeof d.total  === 'number' ? d.total  :
        typeof d.count  === 'number' ? d.count  :
        shuttleBookings.length;

      // Rides (car/scooter) — only on first page
      const ridesRes = pageNum === 1
        ? await api.get('/rides').catch(() => ({ data: [] }))
        : { data: [] };
      const rides: any[] = Array.isArray(ridesRes.data)
        ? ridesRes.data
        : ridesRes.data?.rides ?? ridesRes.data?.data ?? [];

      const mapped = [...shuttleBookings, ...rides].map(mapApiBooking);

      const upcoming = mapped.filter((t) => isShuttleTripUpcoming(t.status));
      const past     = mapped.filter((t) => !isShuttleTripUpcoming(t.status));

      if (pageNum === 1) {
        setUpcomingTrips(upcoming);
        setPastTrips(past);
      } else {
        setUpcomingTrips((prev) => [...prev, ...upcoming]);
        setPastTrips((prev)     => [...prev, ...past]);
      }

      setTotal(serverTotal);
      setPage(pageNum);
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? 'Failed to load trips';
      setError(msg);
      if (pageNum === 1) {
        setUpcomingTrips([]);
        setPastTrips([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchTrips(1);
  }, [fetchTrips]);

  const loadMore = useCallback(async () => {
    const loaded = upcomingTrips.length + pastTrips.length;
    if (loaded >= total) return;
    await fetchTrips(page + 1);
  }, [fetchTrips, page, upcomingTrips.length, pastTrips.length, total]);

  useEffect(() => {
    fetchTrips(1);
  }, [fetchTrips]);

  const hasMore = (upcomingTrips.length + pastTrips.length) < total;

  return { upcomingTrips, pastTrips, loading, error, hasMore, loadMore, refresh };
}
