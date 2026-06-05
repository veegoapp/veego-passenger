import React, { createContext, useCallback, useContext, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import type { Booking, Route } from '@/constants/data';
import api from '@/src/api/client';
import { getSocket } from '@/src/api/socket';

const TRIPS_PER_PAGE = 20;

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
  const [tripsPage, setTripsPage] = useState(1);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [currentRouteId, setCurrentRouteId] = useState<string | null>(null);
  const [currentDateFilter, setCurrentDateFilter] = useState<string | null>(null);

  const fetchScheduledTrips = useCallback(async (
    routeId: string,
    utcDate: string | null,
    page: number,
    append: boolean,
  ) => {
    setTripsLoading(true);
    try {
      // No status filter — fetch all upcoming trips so the UI can show
      // which ones are bookable (scheduled/active) vs awaiting a driver
      const params: Record<string, any> = {
        routeId,
        limit: TRIPS_PER_PAGE,
        page,
      };
      if (utcDate) params.date = utcDate;

      const { data } = await api.get('/trips', { params });
      const list: any[] = Array.isArray(data) ? data : data.data ?? data.trips ?? [];
      const total: number = data.total ?? list.length;

      setTripsTotal(total);
      setTripsPage(page);
      setScheduledTrips((prev) => (append ? [...prev, ...list] : list));
    } catch (e: any) {
      console.warn('[BookingContext] Failed to fetch trips:', e?.message ?? e);
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
    setTripsPage(1);
    setCurrentRouteId(route.id);
    setCurrentDateFilter(null);

    try {
      const [detailRes] = await Promise.allSettled([
        api.get(`/shuttle/lines/${route.id}`),
      ]);

      if (detailRes.status === 'fulfilled') {
        const full = detailRes.value.data?.data ?? detailRes.value.data;
        const rawStations: any[] = Array.isArray(full.stations) ? full.stations : [];
        const path = rawStations.length >= 2 ? mapStations(rawStations) : route.path;
        const activeTrips: any[] = Array.isArray(full.activeTrips) ? full.activeTrips : [];
        const bestTrip = activeTrips.find((t) => (t.availableSeats ?? 0) > 0) ?? activeTrips[0];

        setSelectedRoute((prev) =>
          prev
            ? {
                ...prev,
                path,
                seatsLeft: bestTrip?.availableSeats ?? prev.seatsLeft,
                totalSeats: bestTrip?.totalSeats ?? prev.totalSeats,
              }
            : prev,
        );
      }
    } catch (e: any) {
      console.warn('[BookingContext] Failed to load route details:', e?.message ?? e);
    } finally {
      setRouteLoading(false);
    }

    // Fetch scheduled trips after route detail (non-blocking)
    await fetchScheduledTrips(route.id, null, 1, false);
  }, [fetchScheduledTrips]);

  const fetchTripsForDate = useCallback(async (routeId: string, utcDate: string) => {
    setCurrentDateFilter(utcDate);
    setCurrentRouteId(routeId);
    setTripsPage(1);
    await fetchScheduledTrips(routeId, utcDate, 1, false);
  }, [fetchScheduledTrips]);

  const loadMoreTrips = useCallback(async () => {
    if (!currentRouteId) return;
    const nextPage = tripsPage + 1;
    if ((tripsPage * TRIPS_PER_PAGE) >= tripsTotal) return;
    await fetchScheduledTrips(currentRouteId, currentDateFilter, nextPage, true);
  }, [currentRouteId, currentDateFilter, tripsPage, tripsTotal, fetchScheduledTrips]);

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

    let bookingSuccess = false;

    try {
      const routeId = pendingBooking.route.id;

      let tripId: number | null = pendingBooking.tripId ?? null;

      if (!tripId) {
        // Try bookable statuses in priority order (backend only accepts scheduled/active)
        const needed = pendingBooking.passengers ?? 1;
        for (const status of ['scheduled', 'active', 'boarding', 'driver_assigned']) {
          try {
            const tripsRes = await api.get('/trips', {
              params: { routeId, status, limit: 10 },
            });
            const tripsList: any[] = Array.isArray(tripsRes.data)
              ? tripsRes.data
              : tripsRes.data.data ?? tripsRes.data.trips ?? [];
            const fit = tripsList.find((t) => (t.availableSeats ?? 0) >= needed);
            const candidate = fit ?? tripsList[0];
            if (candidate?.id) {
              tripId = candidate.id;
              break;
            }
          } catch {
            // try next status
          }
        }
      }

      if (tripId) {
        const body: Record<string, any> = {
          tripId,
          seatCount: pendingBooking.passengers,
        };
        if (promoCode) body.promoCode = promoCode;

        const { data } = await api.post('/bookings', body);
        const bookingId = data?.booking?.id ?? data?.id ?? null;

        if (bookingId) {
          setConfirmedBookingId(String(bookingId));
          setConfirmedTripId(Number(tripId));
          bookingSuccess = true;

          // Emit socket join after confirmed booking
          try {
            const socket = await getSocket();
            socket.emit('passenger:join:trip', Number(tripId));
          } catch (socketErr) {
            console.warn('[BookingContext] Socket join failed:', socketErr);
          }
        }
      } else {
        console.warn('[BookingContext] No available trip found for routeId:', routeId);
        setBookingError('No available trips found. Please try again.');
        setActiveBooking(null);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const msg: string =
        e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? 'Booking failed';

      if (status === 409) {
        setBookingError('Seats just filled up, please try again.');
        Alert.alert('Seats Taken', 'Seats just filled up. Please select a different trip or try again.');
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
  }, [pendingBooking]);

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
        tripsPage,
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
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  return useContext(BookingContext);
}
