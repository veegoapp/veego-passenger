import { useCallback, useMemo } from 'react';
import { getMyTrips } from '../../api/shuttleService';
import { getMyRides } from '../../api/rideService';
import { BookingItemSchema, checkContract } from '../../api/schemas';
import { usePaginatedList } from './usePaginatedList';
import type { Trip, TripType, ShuttleTripStatus, BookingStatus, PaymentStatus } from '@/constants/data';
import { isShuttleTripUpcoming, formatCairoDateTime } from '@/constants/data';

interface UseTripsResult {
  upcomingTrips:   Trip[];
  pastTrips:       Trip[];
  loading:         boolean;
  refreshing:      boolean;
  error:           string | null;
  hasMore:         boolean;
  loadMore:        () => Promise<void>;
  refresh:         () => Promise<void>;
  retry:           () => Promise<void>;
  /** Isolated to the shuttle upcoming fetch — a rides/history failure never affects these. */
  upcomingLoading: boolean;
  upcomingError:   string | null;
  upcomingRetry:   () => Promise<void>;
}

const PAGE_LIMIT = 10;

/** Statuses a shuttle booking can still be self-cancelled from, used only when the backend omits `canCancel`. */
const FALLBACK_CANCELLABLE_STATUSES: ShuttleTripStatus[] = ['scheduled', 'waiting_driver', 'driver_assigned', 'upcoming'];

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
 * Maps a raw item from GET /shuttle/my-trips into the normalized Trip model.
 * Always tagged type: 'shuttle' — the source endpoint already tells us this.
 * Departure times are formatted in Africa/Cairo timezone per §21.9.
 *
 * The backend (getMyShuttleTrips, shuttleService.ts) returns a FLAT object —
 * no nested `trip`/`route` — with `tripId`, `bookingId`, `routeName`,
 * `toLocation`, `fromStation: {id, name} | null`, `date`, `departureTime`,
 * `driverName`, `driverRating`, `status` (booking status), `tripStatus` (raw
 * trip status — the authoritative one for upcoming/cancelled filtering),
 * `ticketPrice`, `paymentStatus`, `passengerRating`, `direction`,
 * `totalSeats`, `passengerCount`, `canCancel`.
 */
function mapShuttleTrip(b: any): Trip {
  const rawBookingStatus = (b.status ?? '').toLowerCase() as BookingStatus;
  const rawTripStatus    = (b.tripStatus ?? '').toLowerCase();
  // tripStatus is authoritative for whether this trip is still upcoming (it's
  // the real trips.status column — auto-cancelled/expired trips flip it to
  // 'cancelled'/'completed' independently of the booking's own status).
  const status: ShuttleTripStatus = mapBackendStatus(rawTripStatus || rawBookingStatus);

  const departureIso = b.departureTime ?? '';
  const { date, time } = formatCairoDateTime(departureIso);

  const routeName = b.routeName ?? '—';
  const from      = b.fromStation?.name ?? '—';
  const to        = b.toLocation ?? '—';
  const routeCode = b.tripId ? `L${b.tripId}` : '—';

  const direction = b.direction ?? undefined;

  // Backend field is authoritative; only fall back to a status-based guess when it's absent.
  const canCancel: boolean =
    typeof b.canCancel === 'boolean' ? b.canCancel : FALLBACK_CANCELLABLE_STATUSES.includes(status);

  return {
    id:   String(b.bookingId ?? Math.random()),
    type: 'shuttle',
    routeCode,
    routeName,
    routeNameAr:  null,
    from,
    fromAr:       null,
    to,
    toAr:         null,
    date,
    time,
    departureIso,
    seat: '—',
    status,
    bookingStatus: rawBookingStatus || undefined,
    paymentStatus: b.paymentStatus as PaymentStatus | undefined,
    price:         b.ticketPrice ?? 0,
    tripId:        b.tripId ?? null,
    bookingId:     String(b.bookingId ?? ''),
    pickupLat:     null,
    pickupLng:     null,
    passengerCount: b.passengerCount ?? null,
    minPassengers:  undefined,
    seatCount:      1,
    promoCodeId:    null,
    vehicleType:    undefined,
    totalSeats:     b.totalSeats ?? undefined,
    availableSeats: undefined,
    direction,
    canCancel,
    driverName:      b.driverName ?? null,
    driverRating:    typeof b.driverRating === 'number' ? b.driverRating : null,
    passengerRating: typeof b.passengerRating === 'number' ? b.passengerRating : null,
  };
}

/**
 * Maps a raw item from GET /rides/my into the normalized Trip model.
 * Ride items expose `vehicleType` directly (car | scooter | delivery).
 */
function mapRideTrip(r: any): Trip {
  const type: TripType = r.vehicleType === 'scooter' || r.vehicleType === 'delivery' ? r.vehicleType : 'car';
  const status: ShuttleTripStatus = mapBackendStatus(r.status ?? '');

  const departureIso = r.completedAt ?? r.startedAt ?? r.requestedAt ?? r.createdAt ?? '';
  const { date, time } = formatCairoDateTime(departureIso);

  const pickup  = r.pickup  ?? {};
  const dropoff = r.dropoff ?? {};

  const label = type === 'scooter' ? 'Scooter Ride' : type === 'delivery' ? 'Delivery' : 'Car Ride';

  return {
    id:   String(r.id ?? Math.random()),
    type,
    routeCode: type.toUpperCase(),
    routeName: label,
    routeNameAr: null,
    from:   pickup.address  ?? r.pickupAddress     ?? '—',
    fromAr: null,
    to:     dropoff.address ?? r.dropoffAddress    ?? '—',
    toAr:   null,
    date,
    time,
    departureIso,
    seat: '—',
    status,
    bookingStatus: undefined,
    paymentStatus: r.paymentStatus as PaymentStatus | undefined,
    price:     r.finalPrice ?? r.estimatedPrice ?? r.price ?? 0,
    tripId:    null,
    bookingId: String(r.id ?? ''),
    pickupLat: pickup.latitude  ?? null,
    pickupLng: pickup.longitude ?? null,
    seatCount: 1,
  };
}

function byNewestFirst(a: Trip, b: Trip): number {
  const at = new Date(a.departureIso).getTime();
  const bt = new Date(b.departureIso).getTime();
  return (isNaN(bt) ? 0 : bt) - (isNaN(at) ? 0 : at);
}

function bySoonestFirst(a: Trip, b: Trip): number {
  const at = new Date(a.departureIso).getTime();
  const bt = new Date(b.departureIso).getTime();
  return (isNaN(at) ? 0 : at) - (isNaN(bt) ? 0 : bt);
}

async function fetchShuttlePage(page: number) {
  const res = await getMyTrips(page, PAGE_LIMIT);
  if (__DEV__ && res.data.length > 0) checkContract('Shuttle my-trips item', res.data[0], BookingItemSchema);
  return { items: res.data, page: res.page, total: res.total };
}

async function fetchRidePage(page: number) {
  const res = await getMyRides(page, PAGE_LIMIT);
  return { items: res.data, page: res.meta.page, total: res.meta.total };
}

/**
 * My Trips data layer.
 *
 * Upcoming is derived solely from GET /shuttle/my-trips (rides have no
 * scheduled/upcoming concept — an in-progress ride lives in ActiveSession,
 * not in trip history). History merges GET /shuttle/my-trips (non-upcoming
 * statuses) with GET /rides/my, normalizing both endpoints' differing
 * pagination shapes (top-level total/page/limit vs meta.total/page/limit)
 * into one common paging model via usePaginatedList.
 */
export function useTrips(): UseTripsResult {
  const shuttle = usePaginatedList(fetchShuttlePage, 'Failed to load shuttle trips');
  const ride    = usePaginatedList(fetchRidePage, 'Failed to load ride trips');

  const upcomingTrips = useMemo(
    () => shuttle.items.map(mapShuttleTrip).filter((t) => isShuttleTripUpcoming(t.status)).sort(bySoonestFirst),
    [shuttle.items],
  );

  const pastTrips = useMemo(() => {
    const shuttleHistory = shuttle.items.map(mapShuttleTrip).filter((t) => !isShuttleTripUpcoming(t.status));
    const rideHistory    = ride.items.map(mapRideTrip);
    return [...shuttleHistory, ...rideHistory].sort(byNewestFirst);
  }, [shuttle.items, ride.items]);

  const loading    = shuttle.loading || ride.loading;
  const refreshing = shuttle.refreshing || ride.refreshing;
  const error      = shuttle.error ?? ride.error;
  const hasMore    = shuttle.hasMore || ride.hasMore;

  const loadMore = useCallback(async () => {
    await Promise.all([
      shuttle.hasMore ? shuttle.loadMore() : Promise.resolve(),
      ride.hasMore    ? ride.loadMore()    : Promise.resolve(),
    ]);
  }, [shuttle, ride]);

  const refresh = useCallback(async () => {
    await Promise.all([shuttle.refresh(), ride.refresh()]);
  }, [shuttle, ride]);

  const retry = useCallback(async () => {
    await Promise.all([shuttle.retry(), ride.retry()]);
  }, [shuttle, ride]);

  // Upcoming is shuttle-only, so its loading/error must never reflect a rides fetch failure.
  const upcomingLoading = shuttle.loading;
  const upcomingError   = shuttle.error;
  const upcomingRetry   = shuttle.retry;

  return {
    upcomingTrips, pastTrips, loading, refreshing, error, hasMore, loadMore, refresh, retry,
    upcomingLoading, upcomingError, upcomingRetry,
  };
}
