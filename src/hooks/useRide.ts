import { useState, useCallback, useRef, useEffect } from 'react';
import api from '../api/client';
import { getSocket, type RideStatus, type DriverLocation } from '../api/socket';

export interface DriverInfo {
  name: string;
  phone: string;
  vehicle: string;
  rating: number;
  eta: number;
}

export interface RideState {
  rideId: string | null;
  status: RideStatus;
  driver: DriverInfo | null;
  driverLocation: DriverLocation | null;
  fare: number | null;
  cancelReason: string | null;
}

interface UseRideResult {
  rideState: RideState;
  requesting: boolean;
  requestRide: (payload: {
    type: 'car' | 'bike';
    pickup: { latitude: number; longitude: number; address?: string };
    dropoff: { latitude: number; longitude: number; address?: string };
    notes?: string;
    promoCode?: string;
  }) => Promise<{ success: boolean; rideId?: string; error?: string }>;
  cancelRide: () => Promise<void>;
  resetRide: () => void;
}

const DEFAULT_STATE: RideState = {
  rideId: null,
  status: 'searching',
  driver: null,
  driverLocation: null,
  fare: null,
  cancelReason: null,
};

const TERMINAL_STATUSES: RideStatus[] = ['completed', 'cancelled', 'timeout'];
const POLL_INTERVAL_MS = 5000;

export function useRide(): UseRideResult {
  const [rideState, setRideState] = useState<RideState>(DEFAULT_STATE);
  const [requesting, setRequesting] = useState(false);
  const socketListening = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRideIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback((rideId: string) => {
    stopPolling();
    activeRideIdRef.current = rideId;

    pollIntervalRef.current = setInterval(async () => {
      if (!activeRideIdRef.current) return;
      try {
        const { data } = await api.get(`/rides/${activeRideIdRef.current}`);
        const status: RideStatus = data.status ?? data.rideStatus;
        if (!status) return;

        setRideState((prev) => {
          const updatedDriver: DriverInfo | null = data.driver
            ? {
                name: data.driver.name ?? prev.driver?.name ?? 'Driver',
                phone: data.driver.phone ?? prev.driver?.phone ?? '',
                vehicle: data.driver.vehicle ?? prev.driver?.vehicle ?? '',
                rating: data.driver.rating ?? prev.driver?.rating ?? 4.8,
                eta: data.eta ?? data.driver.eta ?? prev.driver?.eta ?? 5,
              }
            : prev.driver;

          const updatedLocation: DriverLocation | null =
            data.driverLocation ?? data.driver_location ?? prev.driverLocation;

          return { ...prev, status, driver: updatedDriver, driverLocation: updatedLocation };
        });

        if (TERMINAL_STATUSES.includes(status)) {
          stopPolling();
        }
      } catch {
        // Polling failures are silent — socket events remain the primary source
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  const setupSocketListeners = useCallback(async (rideId: string) => {
    if (socketListening.current) return;
    socketListening.current = true;

    const cleanup = () => {
      getSocket().then((s) => {
        s.off('ride:driver_assigned');
        s.off('ride:driver_location');
        s.off('ride:arrived');
        s.off('ride:started');
        s.off('ride:completed');
        s.off('ride:cancelled');
        s.off('ride:timeout');
      }).catch(() => {});
      socketListening.current = false;
      stopPolling();
    };

    try {
      const socket = await getSocket();

      socket.on('ride:driver_assigned', (data: any) => {
        if (data.rideId !== rideId) return;
        setRideState((prev) => ({
          ...prev,
          status: 'driver_assigned',
          driver: {
            name: data.driver?.name ?? 'Driver',
            phone: data.driver?.phone ?? '',
            vehicle: data.driver?.vehicle ?? '',
            rating: data.driver?.rating ?? 4.8,
            eta: data.eta ?? 5,
          },
        }));
      });

      socket.on('ride:driver_location', (data: any) => {
        if (data.rideId !== rideId) return;
        setRideState((prev) => ({ ...prev, driverLocation: data.location }));
      });

      socket.on('ride:arrived', (data: any) => {
        if (data.rideId !== rideId) return;
        setRideState((prev) => ({ ...prev, status: 'arrived' }));
      });

      socket.on('ride:started', (data: any) => {
        if (data.rideId !== rideId) return;
        setRideState((prev) => ({ ...prev, status: 'started' }));
      });

      socket.on('ride:completed', (data: any) => {
        if (data.rideId !== rideId) return;
        setRideState((prev) => ({ ...prev, status: 'completed', fare: data.fare ?? null }));
        cleanup();
      });

      socket.on('ride:cancelled', (data: any) => {
        if (data.rideId !== rideId) return;
        setRideState((prev) => ({ ...prev, status: 'cancelled', cancelReason: data.reason ?? null }));
        cleanup();
      });

      socket.on('ride:timeout', (data: any) => {
        if (data.rideId !== rideId) return;
        setRideState((prev) => ({ ...prev, status: 'timeout' }));
        cleanup();
      });
    } catch (err) {
      console.warn('[useRide] Socket setup failed:', err);
    }
  }, [stopPolling]);

  const requestRide = useCallback(async (payload: {
    type: 'car' | 'bike';
    pickup: { latitude: number; longitude: number; address?: string };
    dropoff: { latitude: number; longitude: number; address?: string };
    notes?: string;
    promoCode?: string;
  }) => {
    setRequesting(true);
    setRideState(DEFAULT_STATE);
    stopPolling();
    try {
      // FIXED: transform payload to match server's expected field names
      const { data } = await api.post('/rides/request', {
        vehicleType:        payload.type,
        pickupLatitude:     payload.pickup.latitude,
        pickupLongitude:    payload.pickup.longitude,
        pickupAddress:      payload.pickup.address ?? '',
        dropoffLatitude:    payload.dropoff.latitude,
        dropoffLongitude:   payload.dropoff.longitude,
        dropoffAddress:     payload.dropoff.address ?? '',
        notes:              payload.notes,
        ...(payload.promoCode ? { promoCode: payload.promoCode } : {}),
      });
      // FIXED: server wraps the ride object in { data: { id, ... } }
      const rideId = String(data?.data?.id ?? data?.rideId ?? data?.id ?? data?._id ?? Date.now());
      setRideState((prev) => ({ ...prev, rideId, status: 'searching' }));
      await setupSocketListeners(rideId);
      startPolling(rideId);
      return { success: true, rideId };
    } catch (e: any) {
      const error = e?.response?.data?.message ?? e?.message ?? 'Failed to request ride';
      setRideState((prev) => ({ ...prev, status: 'cancelled', cancelReason: error }));
      return { success: false, error };
    } finally {
      setRequesting(false);
    }
  }, [setupSocketListeners, startPolling, stopPolling]);

  const cancelRide = useCallback(async () => {
    const { rideId } = rideState;
    if (rideId) {
      try { await api.patch(`/rides/${rideId}/cancel`); } catch {}
    }
    stopPolling();
    activeRideIdRef.current = null;
    setRideState((prev) => ({ ...prev, status: 'cancelled', cancelReason: 'Cancelled by user' }));
    socketListening.current = false;
  }, [rideState, stopPolling]);

  const resetRide = useCallback(() => {
    stopPolling();
    activeRideIdRef.current = null;
    setRideState(DEFAULT_STATE);
    socketListening.current = false;
  }, [stopPolling]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return { rideState, requesting, requestRide, cancelRide, resetRide };
}
