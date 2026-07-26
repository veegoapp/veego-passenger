import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import type { Booking, PaymentStatus, Route, ShuttleBookingMeta, ShuttleDirection, ShuttleTripSlot } from '@/constants/data';
import { formatCairoDateTime } from '@/constants/data';
import api from '@/src/api/client';
import { getSocket } from '@/src/api/socket';
import { useServiceControl } from '@/context/ServiceControlContext';
import { usePassengerTracking } from '@/src/hooks/shared/usePassengerTracking';


type BookingContextType = {
  selectedRoute: Route | null;
  tripSheetOpen: boolean;
  confirmSheetOpen: boolean;
  pendingBooking: Booking | null;
  activeBooking: Booking | null;
  confirmedBookingId: string | null;
  confirmedTripId: number | null;
  /** Real-time seat metadata returned by POST /bookings (§2.10) */
  shuttleInfo: ShuttleBookingMeta | null;
  routeLoading: boolean;
  tripsLoading: boolean;
  scheduledTrips: ShuttleTripSlot[];
  tripsTotal: number;
  tripsPage: number;
  walletBalance: number | null;
  bookingError: string | null;
  seatCount: number;
  setSeatCount: (n: number) => void;
  openRoute: (route: Route) => void;
  closeTripSheet: () => void;
  handleBook: (booking: Booking) => void;
  handleConfirm: (promoCode?: string, paymentMethod?: 'cash' | 'wallet') => void;
  closeConfirmSheet: () => void;
  setActiveBooking: (b: Booking | null) => void;
  fetchTripsForDate: (routeId: string, utcDate: string) => Promise<void>;
  loadMoreTrips: () => Promise<void>;
  clearBookingError: () => void;
  refreshLineTrips: (routeId: string) => Promise<void>;
  prepareBooking: (booking: Booking) => void;
};

const BookingContext = createContext<BookingContextType>({
  selectedRoute: null,
  tripSheetOpen: false,
  confirmSheetOpen: false,
  pendingBooking: null,
  activeBooking: null,
  confirmedBookingId: null,
  confirmedTripId: null,
  shuttleInfo: null,
  routeLoading: false,
  tripsLoading: false,
  scheduledTrips: [],
  tripsTotal: 0,
  tripsPage: 1,
  walletBalance: null,
  bookingError: null,
  seatCount: 1,
  setSeatCount: () => {},
  openRoute: () => {},
  closeTripSheet: () => {},
  handleBook: () => {},
  handleConfirm: (_promoCode?: string, _paymentMethod?: 'cash' | 'wallet') => {},
  closeConfirmSheet: () => {},
  setActiveBooking: () => {},
  fetchTripsForDate: async () => {},
  loadMoreTrips: async () => {},
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

async function fetchWalletBalance(): Promise<number | null> {
  try {
    const { data } = await api.get('/wallet');
    return typeof data?.balance === 'number' ? data.balance : null;
  } catch {
    return null;
  }
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
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);
  const [confirmedTripId, setConfirmedTripId] = useState<number | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [scheduledTrips, setScheduledTrips] = useState<ShuttleTripSlot[]>([]);
  const [tripsTotal, setTripsTotal] = useState(0);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [seatCount, setSeatCount] = useState<number>(1);
  const [shuttleInfo, setShuttleInfo] = useState<ShuttleBookingMeta | null>(null);

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

  // Client-side date filter — no extra API call needed
  const fetchTripsForDate = useCallback(async (_routeId: string, _utcDate: string) => {
    // Trips are already loaded from /shuttle/lines/:id — filtering is done in TripSheet
  }, []);

  const loadMoreTrips = useCallback(async () => {
    // All trips are returned in a single call from /shuttle/lines/:id
  }, []);

  const openRoute = useCallback(async (route: Route) => {
    setSelectedRoute(route);
    setRouteLoading(true);
    setTripSheetOpen(true);
    setScheduledTrips([]);
    setTripsTotal(0);

    // Refresh the wallet balance whenever the trip sheet opens — this is the
    // point where it's actually displayed (price summary / insufficient-balance
    // gate in TripSheet). Fire-and-forget so it doesn't affect route loading.
    fetchWalletBalance().then(setWalletBalance);

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

      setSelectedRoute((prev) =>
        prev
          ? {
              ...prev,
              path,
              seatsLeft: bestTrip?.availableSeats ?? prev.seatsLeft,
              totalSeats: bestTrip?.totalSeats ?? prev.totalSeats ?? 14,
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
      const msg = svc.unavailableMessage ?? 'Shuttle service is currently unavailable. Please try again later.';
      Alert.alert('Service Unavailable', msg);
      setActiveBooking(null);
      return;
    }

    setActiveBooking(pendingBooking);
    setBookingError(null);

    const tripId = pendingBooking.tripId ?? null;

    if (!tripId) {
      setBookingError('No trip selected. Please select a departure time.');
      setActiveBooking(null);
      return;
    }

    // Client-side guard only — server must enforce seat count limits
    if (!seatCount || seatCount < 1 || seatCount > 2 || !Number.isInteger(seatCount)) {
      Alert.alert('Error', 'Invalid seat count');
      setActiveBooking(null);
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
      setBookingError('Selected boarding station does not match this trip’s direction. Please choose a station again.');
      setActiveBooking(null);
      confirmingRef.current = false;
      return;
    }

    let bookingSuccess = false;

    try {
      const body: Record<string, any> = {
        tripId,
        seatCount,
        paymentMethod: paymentMethod ?? 'cash',
      };
      if (promoCode) body.promoCode = promoCode;
      // Pass along the boarding station the passenger actually selected —
      // previously the station picker's choice never reached the backend.
      if (pendingBooking.boardingStationId) body.boardingStationId = pendingBooking.boardingStationId;

      const { data } = await api.post('/bookings', body);
      const bookingId = data?.id ?? data?.booking?.id ?? null;

      if (bookingId) {
        setConfirmedBookingId(String(bookingId));
        setConfirmedTripId(Number(tripId));
        // Capture shuttle metadata block (§2.10)
        if (data?.shuttle && typeof data.shuttle === 'object') {
          setShuttleInfo(data.shuttle as ShuttleBookingMeta);
        }
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
        respData?.error ?? respData?.message ?? e?.message ?? 'Booking failed';

      if (status === 402) {
        // Insufficient wallet balance — backend is the source of truth on the
        // amounts; the client only formats them, it never re-derives them.
        const required = typeof respData?.required === 'number' ? respData.required : undefined;
        const availableBalance = typeof respData?.balance === 'number' ? respData.balance : undefined;
        setBookingError(msg);
        Alert.alert(
          'Insufficient Balance',
          required != null && availableBalance != null
            ? `You need ${required} EGP but your wallet balance is ${availableBalance} EGP. Please top up your wallet or pay with cash.`
            : msg,
        );
      } else if (status === 409) {
        // Could be duplicate booking OR race condition (seat snatched)
        const isDuplicate = msg.toLowerCase().includes('already have');
        if (isDuplicate) {
          setBookingError('You already have an active booking for this trip.');
          Alert.alert('Already Booked', 'You already have an active booking for this trip.');
        } else {
          setBookingError('Sorry, those seats were just taken. Please check for another trip.');
          Alert.alert(
            'Seats Taken',
            'Sorry, those seats were just taken. Please check for another trip.',
          );
        }
      } else {
        Alert.alert('Booking Failed', msg);
      }

      setActiveBooking(null);
    } finally {
      confirmingRef.current = false;
    }

    if (bookingSuccess) {
      setTimeout(() => router.push('/ticket'), 260);
    }
  }, [pendingBooking, refreshLineTrips]);

  const closeConfirmSheet = useCallback(() => {
    setConfirmSheetOpen(false);
  }, []);

  // Track passenger location for the duration of a confirmed shuttle trip
  usePassengerTracking({
    isActive: confirmedTripId !== null,
    tripId: confirmedTripId,
  });

  return (
    <BookingContext.Provider
      value={{
        selectedRoute,
        tripSheetOpen,
        confirmSheetOpen,
        pendingBooking,
        activeBooking,
        confirmedBookingId,
        confirmedTripId,
        shuttleInfo,
        routeLoading,
        tripsLoading,
        scheduledTrips,
        tripsTotal,
        tripsPage: 1,
        walletBalance,
        bookingError,
        seatCount,
        setSeatCount,
        openRoute,
        closeTripSheet,
        handleBook,
        handleConfirm,
        closeConfirmSheet,
        setActiveBooking,
        fetchTripsForDate,
        loadMoreTrips,
        clearBookingError,
        refreshLineTrips,
        prepareBooking,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  return useContext(BookingContext);
}
