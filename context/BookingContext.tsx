import React, { createContext, useCallback, useContext, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import type { Booking, Route } from '@/constants/data';
import api from '@/src/api/client';
import { getSocket } from '@/src/api/socket';

type BookingContextType = {
  selectedRoute: Route | null;
  tripSheetOpen: boolean;
  confirmSheetOpen: boolean;
  pendingBooking: Booking | null;
  activeBooking: Booking | null;
  confirmedBookingId: string | null;
  confirmedTripId: number | null;
  routeLoading: boolean;
  tripsLoading: boolean;
  scheduledTrips: any[];
  tripsTotal: number;
  tripsPage: number;
  walletBalance: number | null;
  bookingError: string | null;
  openRoute: (route: Route) => void;
  closeTripSheet: () => void;
  handleBook: (booking: Booking) => void;
  handleConfirm: (promoCode?: string) => void;
  closeConfirmSheet: () => void;
  setActiveBooking: (b: Booking | null) => void;
  fetchTripsForDate: (routeId: string, utcDate: string) => Promise<void>;
  loadMoreTrips: () => Promise<void>;
  clearBookingError: () => void;
  refreshLineTrips: (routeId: string) => Promise<void>;
};

const BookingContext = createContext<BookingContextType>({
  selectedRoute: null,
  tripSheetOpen: false,
  confirmSheetOpen: false,
  pendingBooking: null,
  activeBooking: null,
  confirmedBookingId: null,
  confirmedTripId: null,
  routeLoading: false,
  tripsLoading: false,
  scheduledTrips: [],
  tripsTotal: 0,
  tripsPage: 1,
  walletBalance: null,
  bookingError: null,
  openRoute: () => {},
  closeTripSheet: () => {},
  handleBook: () => {},
  handleConfirm: (_promoCode?: string) => {},
  closeConfirmSheet: () => {},
  setActiveBooking: () => {},
  fetchTripsForDate: async () => {},
  loadMoreTrips: async () => {},
  clearBookingError: () => {},
  refreshLineTrips: async () => {},
});

function mapStations(rawStations: any[]): Route['path'] {
  return rawStations
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s) => ({
      id: String(s.id ?? s._id ?? Math.random()),
      name: s.name ?? s.stationName ?? s.station_name ?? '',
      area: s.area ?? s.district ?? '',
      distance: s.distance ?? '—',
      eta: s.eta ?? '—',
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

async function fetchLineTrips(routeId: string): Promise<any[]> {
  try {
    const { data } = await api.get(`/shuttle/lines/${routeId}`);
    const full = data?.data ?? data;
    return Array.isArray(full.activeTrips) ? full.activeTrips : [];
  } catch {
    return [];
  }
}

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [tripSheetOpen, setTripSheetOpen] = useState(false);
  const [confirmSheetOpen, setConfirmSheetOpen] = useState(false);
  const [pendingBooking, setPendingBooking] = useState<Booking | null>(null);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);
  const [confirmedTripId, setConfirmedTripId] = useState<number | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [scheduledTrips, setScheduledTrips] = useState<any[]>([]);
  const [tripsTotal, setTripsTotal] = useState(0);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

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

    try {
      const { data } = await api.get(`/shuttle/lines/${route.id}`);

      // ── Diagnostic: log the full raw response so we can confirm the key names ──
      console.log('[BookingContext] GET /shuttle/lines/:id raw response:', JSON.stringify(data));

      // Unwrap envelope — backend may wrap in { data: { ... } } or return flat object
      const full: any = data?.data ?? data ?? {};

      console.log('[BookingContext] Unwrapped "full" keys:', Object.keys(full));

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

      console.log(
        `[BookingContext] Parsed ${activeTrips.length} trips from key:`,
        full.activeTrips    != null ? 'activeTrips'    :
        full.trips          != null ? 'trips'          :
        full.upcomingTrips  != null ? 'upcomingTrips'  :
        full.scheduledTrips != null ? 'scheduledTrips' :
        full.data           != null ? 'data'           :
        'NONE — check raw response above',
      );
      if (activeTrips.length > 0) {
        console.log('[BookingContext] First trip sample:', JSON.stringify(activeTrips[0]));
      }

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
    } catch (e: any) {
      console.warn('[BookingContext] Failed to load route details:', e?.message ?? e);
      console.warn('[BookingContext] Error detail:', e?.response?.status, JSON.stringify(e?.response?.data));
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

  const handleBook = useCallback((booking: Booking) => {
    setTripSheetOpen(false);
    setPendingBooking(booking);
    setTimeout(() => setConfirmSheetOpen(true), 280);
  }, []);

  const handleConfirm = useCallback(async (promoCode?: string) => {
    setConfirmSheetOpen(false);
    if (!pendingBooking) return;

    setActiveBooking(pendingBooking);
    setBookingError(null);

    // Step 1: Check wallet balance
    const balance = await fetchWalletBalance();
    setWalletBalance(balance);

    if (balance !== null && balance < pendingBooking.price) {
      Alert.alert(
        'Insufficient Balance',
        `Your wallet balance is ${balance.toFixed(2)} EGP but this trip costs ${pendingBooking.price} EGP. Please top up your wallet to continue.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setActiveBooking(null) },
          {
            text: 'Top Up',
            onPress: () => {
              setActiveBooking(null);
              router.push('/wallet' as any);
            },
          },
        ],
      );
      return;
    }

    const tripId = pendingBooking.tripId ?? null;

    if (!tripId) {
      setBookingError('No trip selected. Please select a departure time.');
      setActiveBooking(null);
      return;
    }

    let bookingSuccess = false;

    try {
      const body: Record<string, any> = {
        tripId,
        seatCount: 1, // API contract: seatCount MUST always be 1
      };
      if (promoCode) body.promoCode = promoCode;

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
      const msg: string =
        e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? 'Booking failed';

      if (status === 409) {
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
      } else if (
        status === 400 &&
        (msg.toLowerCase().includes('wallet') ||
          msg.toLowerCase().includes('balance') ||
          msg.toLowerCase().includes('insufficient'))
      ) {
        Alert.alert(
          'Insufficient Balance',
          `${msg}\n\nWould you like to top up your wallet?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Top Up', onPress: () => router.push('/wallet' as any) },
          ],
        );
      } else {
        Alert.alert('Booking Failed', msg);
      }

      setActiveBooking(null);
    }

    if (bookingSuccess) {
      setTimeout(() => router.push('/ticket'), 260);
    }
  }, [pendingBooking, refreshLineTrips]);

  const closeConfirmSheet = useCallback(() => {
    setConfirmSheetOpen(false);
  }, []);

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
        routeLoading,
        tripsLoading,
        scheduledTrips,
        tripsTotal,
        tripsPage: 1,
        walletBalance,
        bookingError,
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
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  return useContext(BookingContext);
}
