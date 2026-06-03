import React, { createContext, useCallback, useContext, useState } from 'react';
import { router } from 'expo-router';
import type { Booking, Route } from '@/constants/data';
import api from '@/src/api/client';

type BookingContextType = {
  selectedRoute: Route | null;
  tripSheetOpen: boolean;
  confirmSheetOpen: boolean;
  pendingBooking: Booking | null;
  activeBooking: Booking | null;
  confirmedBookingId: string | null;
  routeLoading: boolean;
  scheduledTrips: any[];
  openRoute: (route: Route) => void;
  closeTripSheet: () => void;
  handleBook: (booking: Booking) => void;
  handleConfirm: () => void;
  closeConfirmSheet: () => void;
  setActiveBooking: (b: Booking | null) => void;
};

const BookingContext = createContext<BookingContextType>({
  selectedRoute: null,
  tripSheetOpen: false,
  confirmSheetOpen: false,
  pendingBooking: null,
  activeBooking: null,
  confirmedBookingId: null,
  routeLoading: false,
  scheduledTrips: [],
  openRoute: () => {},
  closeTripSheet: () => {},
  handleBook: () => {},
  handleConfirm: () => {},
  closeConfirmSheet: () => {},
  setActiveBooking: () => {},
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

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [tripSheetOpen, setTripSheetOpen] = useState(false);
  const [confirmSheetOpen, setConfirmSheetOpen] = useState(false);
  const [pendingBooking, setPendingBooking] = useState<Booking | null>(null);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeActiveTrips, setRouteActiveTrips] = useState<any[]>([]);

  const openRoute = useCallback(async (route: Route) => {
    // Open the sheet immediately with partial data while fetching full details
    setSelectedRoute(route);
    setRouteLoading(true);
    setTripSheetOpen(true);
    setRouteActiveTrips([]);

    try {
      const { data } = await api.get(`/shuttle/lines/${route.id}`);
      const full = data.data ?? data;

      // Map stations to path format
      const rawStations: any[] = Array.isArray(full.stations) ? full.stations : [];
      const path = rawStations.length >= 2 ? mapStations(rawStations) : route.path;

      // Update seatsLeft from the most seat-available upcoming trip
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

      if (activeTrips.length > 0) setRouteActiveTrips(activeTrips);
    } catch (e: any) {
      console.warn('[BookingContext] Failed to load route details:', e?.message ?? e);
    } finally {
      setRouteLoading(false);
    }
  }, []);

  const closeTripSheet = useCallback(() => {
    setTripSheetOpen(false);
  }, []);

  const handleBook = useCallback((booking: Booking) => {
    setTripSheetOpen(false);
    setPendingBooking(booking);
    setTimeout(() => setConfirmSheetOpen(true), 280);
  }, []);

  const handleConfirm = useCallback(async () => {
    setConfirmSheetOpen(false);
    if (!pendingBooking) return;

    setActiveBooking(pendingBooking);

    let bookingSuccess = false;

    try {
      const routeId = pendingBooking.route.id;
      let tripId: number | null = null;

      // Use stored active trips (from route details fetch) for better seat matching
      if (routeActiveTrips.length > 0) {
        const needed = pendingBooking.passengers ?? 1;
        const fit = routeActiveTrips.find((t) => (t.availableSeats ?? 0) >= needed);
        tripId = (fit ?? routeActiveTrips[0])?.id ?? null;
      }

      if (!tripId) {
        // Fallback: query shuttle trips API (passenger-accessible)
        try {
          const tripsRes = await api.get('/shuttle/trips', {
            params: { routeId, status: 'scheduled', limit: 5 },
          });
          const tripsList: any[] = Array.isArray(tripsRes.data)
            ? tripsRes.data
            : tripsRes.data.trips ?? tripsRes.data.data ?? [];
          const needed = pendingBooking.passengers ?? 1;
          const fit = tripsList.find((t) => (t.availableSeats ?? 0) >= needed);
          tripId = (fit ?? tripsList[0])?.id ?? null;
        } catch {
          // No trips found
        }
      }

      if (tripId) {
        const route = pendingBooking.route;
        const boardingStationId = route.path[pendingBooking.fromIdx]?.id ?? null;
        const alightingStationId = route.path[pendingBooking.toIdx]?.id ?? null;
        const { data } = await api.post('/shuttle/book', {
          tripId,
          seatCount: pendingBooking.passengers,
          boardingStationId,
          alightingStationId,
        });
        const bookingId = data.bookingId ?? data.id ?? data._id ?? null;
        if (bookingId) {
          setConfirmedBookingId(String(bookingId));
          bookingSuccess = true;
        }
      } else {
        console.warn('[BookingContext] No available trip found for routeId:', routeId);
      }
    } catch (e: any) {
      console.warn(
        '[BookingContext] Booking failed:',
        e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message,
      );
    }

    // ✅ Only navigate to ticket if booking was actually created on the server
    if (bookingSuccess) {
      setTimeout(() => router.push('/ticket'), 260);
    } else {
      setActiveBooking(null);
    }
  }, [pendingBooking, routeActiveTrips]);

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
        routeLoading,
        scheduledTrips: routeActiveTrips,
        openRoute,
        closeTripSheet,
        handleBook,
        handleConfirm,
        closeConfirmSheet,
        setActiveBooking,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  return useContext(BookingContext);
}
