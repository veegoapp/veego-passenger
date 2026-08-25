import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { showAppAlert } from '@/components/shared/AppAlertHost';
import type { Booking, PaymentStatus, Route, ShuttleDirection, ShuttleTripSlot } from '@/constants/data';
import api from '@/src/api/client';
import { getSocket } from '@/src/api/socket';
import { useServiceControl } from '@/context/ServiceControlContext';
import { usePassengerTracking } from '@/src/hooks/shared/usePassengerTracking';
import { PASSENGER_SHUTTLE_LOCATION_TASK } from '@/src/hooks/shared/backgroundLocationTask';
import { useTheme } from '@/context/ThemeContext';


type BookingContextType = {
  selectedRoute: Route | null;
  tripSheetOpen: boolean;
  confirmSheetOpen: boolean;
  pendingBooking: Booking | null;
  confirmedBookingId: string | null;
  confirmedTripId: number | null;
  routeLoading: boolean;
  tripsLoading: boolean;
  scheduledTrips: ShuttleTripSlot[];
  tripsTotal: number;
  bookingError: string | null;
  seatCount: number;
  setSeatCount: (n: number) => void;
  openRoute: (route: Route) => void;
  closeTripSheet: () => void;
  handleBook: (booking: Booking) => void;
  handleConfirm: (promoCode?: string, paymentMethod?: 'cash' | 'wallet') => void;
  closeConfirmSheet: () => void;
  clearBookingError: () => void;
  refreshLineTrips: (routeId: string) => Promise<void>;
  prepareBooking: (booking: Booking) => void;
};

const BookingContext = createContext<BookingContextType>({
  selectedRoute: null,
  tripSheetOpen: false,
  confirmSheetOpen: false,
  pendingBooking: null,
  confirmedBookingId: null,
  confirmedTripId: null,
  routeLoading: false,
  tripsLoading: false,
  scheduledTrips: [],
  tripsTotal: 0,
  bookingError: null,
  seatCount: 1,
  setSeatCount: () => {},
  openRoute: () => {},
  closeTripSheet: () => {},
  handleBook: () => {},
  handleConfirm: (_promoCode?: string, _paymentMethod?: 'cash' | 'wallet') => {},
  closeConfirmSheet: () => {},
  clearBookingError: () => {},
  refreshLineTrips: async () => {},
  prepareBooking: () => {},
});

function mapStations(rawStations: any[]): Route['path'] {
  return rawStations
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s) => ({
      id:           String(s.id ?? Math.random()),
      name:         s.name         ?? s.stationName  ?? '',
      nameAr:       s.nameAr       ?? null,   // §3, §21.5
      area:         s.area         ?? s.district      ?? '',
      distance:     s.distance     ?? '—',
      eta:          s.eta          ?? '—',
      latitude:     s.latitude     ?? undefined,
      longitude:    s.longitude    ?? undefined,
      order:        s.order        ?? undefined,
      direction:    s.direction    ?? undefined,
      segmentPrice: s.segmentPrice ?? null,   // §21.6
    }));
}

async function fetchLineTrips(routeId: string): Promise<ShuttleTripSlot[]> {
  try {
    const { data } = await api.get(`/shuttle/lines/${routeId}`);
    const full = data?.data ?? data;
    return Array.isArray(full.activeTrips) ? full.activeTrips : [];
  } catch {
    return [];
  }
}

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTheme();
  // ServiceControlProvider wraps BookingProvider in _layout.tsx, so this is safe
  const { getService } = useServiceControl();
  // Use a ref so handleConfirm always reads the latest value without needing it in dep arrays
  const getServiceRef = useRef(getService);
  getServiceRef.current = getService;
  const confirmingRef = useRef(false);

  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [tripSheetOpen, setTripSheetOpen] = useState(false);
  const [confirmSheetOpen, setConfirmSheetOpen] = useState(false);
  const [pendingBooking, setPendingBooking] = useState<Booking | null>(null);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);
  const [confirmedTripId, setConfirmedTripId] = useState<number | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [scheduledTrips, setScheduledTrips] = useState<ShuttleTripSlot[]>([]);
  const [tripsTotal, setTripsTotal] = useState(0);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [seatCount, setSeatCount] = useState<number>(1);

  // Refresh trips for a line after booking/cancel
  const refreshLineTrips = useCallback(async (routeId: string) => {
    setTripsLoading(true);
    try {
      const trips = await fetchLineTrips(routeId);
      setScheduledTrips(trips);
      setTripsTotal(trips.length);
    } finally {
      setTripsLoading(false);
    }
  }, []);

  const openRoute = useCallback(async (route: Route) => {
    setSelectedRoute(route);
    setRouteLoading(true);
    setTripSheetOpen(true);
    setScheduledTrips([]);
    setTripsTotal(0);

    try {
      const { data } = await api.get(`/shuttle/lines/${route.id}`);

      // Unwrap envelope — backend may wrap in { data: { ... } } or return flat object
      const full: any = data?.data ?? data ?? {};

      // ── Stations ─────────────────────────────────────────────────────────────
      const rawStations: any[] = Array.isArray(full.stations) ? full.stations : [];
      const path = rawStations.length >= 2 ? mapStations(rawStations) : route.path;

      // ── Trips: tolerate every plausible key the backend might use ─────────────
      // API contract says "activeTrips" but real backends sometimes use other names
      const activeTrips: any[] =
        Array.isArray(full.activeTrips)    ? full.activeTrips    :
        Array.isArray(full.trips)          ? full.trips          :
        Array.isArray(full.upcomingTrips)  ? full.upcomingTrips  :
        Array.isArray(full.scheduledTrips) ? full.scheduledTrips :
        Array.isArray(full.data)           ? full.data           :
        [];

      // Use trip with most available seats for route-level seat display
      const bestTrip = activeTrips.find((t) => (t.availableSeats ?? 0) > 0) ?? activeTrips[0];

      // Tiered-pricing fields — only present on routes that opted in; absent
      // (undefined) leaves the flat-pricing display from the list endpoint untouched.
      const pricingModel: 'flat' | 'tiered' | undefined =
        full.pricingModel === 'tiered' || full.pricingModel === 'flat' ? full.pricingModel : undefined;
      const startingPrice: number | undefined =
        typeof full.startingPrice === 'number' ? full.startingPrice : undefined;

      setSelectedRoute((prev) =>
        prev
          ? {
              ...prev,
              path,
              seatsLeft: bestTrip?.availableSeats ?? prev.seatsLeft,
              totalSeats: bestTrip?.totalSeats ?? prev.totalSeats ?? 14,
              pricingModel: pricingModel ?? prev.pricingModel,
              startingPrice: startingPrice ?? prev.startingPrice,
            }
          : prev,
      );

      setScheduledTrips(activeTrips);
      setTripsTotal(activeTrips.length);
    } catch {
      // Route detail load failure is handled gracefully — TripSheet shows available data
    } finally {
      setRouteLoading(false);
    }
  }, []);

  const closeTripSheet = useCallback(() => {
    setTripSheetOpen(false);
  }, []);

  const clearBookingError = useCallback(() => {
    setBookingError(null);
  }, []);

  const prepareBooking = useCallback((booking: Booking) => {
    setPendingBooking(booking);
  }, []);

  const handleBook = useCallback((booking: Booking) => {
    setTripSheetOpen(false);
    setPendingBooking(booking);
    setTimeout(() => setConfirmSheetOpen(true), 280);
  }, []);

  const handleConfirm = useCallback(async (promoCode?: string, paymentMethod?: 'cash' | 'wallet') => {
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    setConfirmSheetOpen(false);
    if (!pendingBooking) { confirmingRef.current = false; return; }

    // ── Service-control gate: re-check at confirmation time ──────────────────
    // This catches the case where admin disabled the service AFTER TripSheet opened
    const svc = getServiceRef.current('shuttle');
    if (svc && (!svc.isEnabled || svc.displayMode !== 'live')) {
      const msg = svc.unavailableMessage ?? t('service_unavailable');
      showAppAlert(t('service_unavailable'), msg);
      confirmingRef.current = false;
      return;
    }

    setBookingError(null);

    const tripId = pendingBooking.tripId ?? null;

    if (!tripId) {
      setBookingError(t('no_trip_selected'));
      confirmingRef.current = false;
      return;
    }

    // Client-side guard only — server must enforce seat count limits
    if (!seatCount || seatCount < 1 || seatCount > 2 || !Number.isInteger(seatCount)) {
      showAppAlert(t('error'), t('invalid_seat_count'));
      confirmingRef.current = false;
      return;
    }

    // ── Direction guard: re-verify the boarding station still matches the
    // trip's direction right before booking. TripSheet already filters the
    // station picker by direction, so this should never trip in practice —
    // it's a last-line defense against stale/edited pendingBooking state.
    // Only enforced when both values are actually known (never fabricated).
    const boardingStation = pendingBooking.route?.path?.[pendingBooking.fromIdx];
    if (
      pendingBooking.direction &&
      boardingStation?.direction &&
      boardingStation.direction !== pendingBooking.direction
    ) {
      setBookingError(t('booking_station_mismatch'));
      confirmingRef.current = false;
      return;
    }

    // Tiered routes require both boarding and destination stations — the
    // backend rejects the booking outright without them, so fail fast here
    // with a clear message instead of a generic server error.
    if (pendingBooking.route?.pricingModel === 'tiered') {
      if (!pendingBooking.boardingStationId || !pendingBooking.alightingStationId) {
        showAppAlert(t('error'), t('booking_stations_required'));
        confirmingRef.current = false;
        return;
      }
    }

    let bookingSuccess = false;

    try {
      const body: Record<string, any> = {
        tripId,
        seatCount,
        paymentMethod: paymentMethod ?? 'cash',
      };
      if (promoCode) body.promoCode = promoCode;
      // Pass along the boarding/alighting stations the passenger actually
      // selected — the backend expects these as JSON numbers, not strings,
      // so they're coerced with Number() here (Station.id is a string
      // throughout the app's UI layer; only the wire payload needs a number).
      if (pendingBooking.boardingStationId) body.boardingStationId = Number(pendingBooking.boardingStationId);
      if (pendingBooking.alightingStationId) body.alightingStationId = Number(pendingBooking.alightingStationId);

      const { data } = await api.post('/bookings', body);
      const bookingId = data?.id ?? data?.booking?.id ?? null;

      if (bookingId) {
        setConfirmedBookingId(String(bookingId));
        setConfirmedTripId(Number(tripId));
        bookingSuccess = true;

        // Refresh trip data immediately after booking
        if (pendingBooking.route?.id) {
          refreshLineTrips(pendingBooking.route.id).catch(() => {});
        }

        // Emit socket join after confirmed booking
        try {
          const socket = await getSocket();
          socket.emit('passenger:join:trip', Number(tripId));
        } catch (socketErr) {
          console.warn('[BookingContext] Socket join failed:', socketErr);
        }
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const respData = e?.response?.data;
      const msg: string =
        respData?.error ?? respData?.message ?? e?.message ?? t('booking_failed_title');

      if (status === 402) {
        // Insufficient wallet balance — backend is the source of truth on the
        // amounts; the client only formats them, it never re-derives them.
        const required = typeof respData?.required === 'number' ? respData.required : undefined;
        const availableBalance = typeof respData?.balance === 'number' ? respData.balance : undefined;
        setBookingError(msg);
        showAppAlert(
          t('insufficient_balance_title'),
          required != null && availableBalance != null
            ? t('insufficient_balance_msg')
                .replace('{required}', String(required))
                .replace('{balance}', String(availableBalance))
            : msg,
        );
      } else if (status === 409) {
        // Could be duplicate booking OR race condition (seat snatched)
        const isDuplicate = msg.toLowerCase().includes('already have');
        if (isDuplicate) {
          setBookingError(t('already_booked_msg'));
          showAppAlert(t('already_booked_title'), t('already_booked_msg'));
        } else {
          setBookingError(t('seats_taken_msg'));
          showAppAlert(t('seats_taken_title'), t('seats_taken_msg'));
        }
      } else {
        showAppAlert(t('booking_failed_title'), msg);
      }
    } finally {
      confirmingRef.current = false;
    }

    if (bookingSuccess) {
      setTimeout(() => router.push('/ticket'), 260);
    }
  }, [pendingBooking, refreshLineTrips, t]);

  const closeConfirmSheet = useCallback(() => {
    setConfirmSheetOpen(false);
  }, []);

  // Track passenger location for the duration of a confirmed shuttle trip
  usePassengerTracking({
    isActive: confirmedTripId !== null,
    tripId: confirmedTripId,
    taskName: PASSENGER_SHUTTLE_LOCATION_TASK,
  });

  // Memoized: an inline object literal here would re-render every
  // useBooking() consumer on every BookingProvider render, regardless of
  // whether any of these values actually changed (every callback field is
  // already stable via useCallback above; setSeatCount is a state setter,
  // stable by default).
  const value = useMemo(
    () => ({
      selectedRoute,
      tripSheetOpen,
      confirmSheetOpen,
      pendingBooking,
      confirmedBookingId,
      confirmedTripId,
      routeLoading,
      tripsLoading,
      scheduledTrips,
      tripsTotal,
      bookingError,
      seatCount,
      setSeatCount,
      openRoute,
      closeTripSheet,
      handleBook,
      handleConfirm,
      closeConfirmSheet,
      clearBookingError,
      refreshLineTrips,
      prepareBooking,
    }),
    [
      selectedRoute, tripSheetOpen, confirmSheetOpen, pendingBooking,
      confirmedBookingId, confirmedTripId, routeLoading, tripsLoading,
      scheduledTrips, tripsTotal, bookingError, seatCount,
      setSeatCount, openRoute, closeTripSheet, handleBook, handleConfirm,
      closeConfirmSheet, clearBookingError,
      refreshLineTrips, prepareBooking,
    ],
  );

  return (
    <BookingContext.Provider value={value}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  return useContext(BookingContext);
}
