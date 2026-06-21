import { useState, useCallback, useRef, useEffect } from 'react';
import api from '../../api/client';
import { getSocket, type RideStatus, type DriverLocation } from '../../api/socket';
import { usePassengerTracking } from '../shared/usePassengerTracking';

export interface DriverInfo {
  name: string;
  phone: string;
  vehicle: string;
  vehicleColor?: string;
  plateNumber?: string;
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
  waitingCharge: number | null;
  waitingChargeStatus: 'none' | 'active' | 'capped';
  waitingRatePerMinute: number | null;
  surgeMultiplier: number | null;
  deviationWarning: boolean;
  passengerRating: { id: number; score: number } | null;
}

interface UseRideResult {
  rideState: RideState;
  requesting: boolean;
  requestRide: (payload: {
    type: 'car' | 'scooter';
    pickup: { latitude: number; longitude: number; address?: string };
    dropoff: { latitude: number; longitude: number; address?: string };
    notes?: string;
    promoCode?: string;
  }) => Promise<{ success: boolean; rideId?: string; error?: string }>;
  cancelRide: (reason?: string) => Promise<void>;
  clearDeviationWarning: () => void;
  resetRide: () => void;
}

const DEFAULT_STATE: RideState = {
  rideId: null,
  status: 'searching',
  driver: null,
  driverLocation: null,
  fare: null,
  cancelReason: null,
  waitingCharge: null,
  waitingChargeStatus: 'none',
  waitingRatePerMinute: null,
  surgeMultiplier: null,
  deviationWarning: false,
  passengerRating: null,
};

const TERMINAL_STATUSES: RideStatus[] = ['completed', 'cancelled', 'timeout'];
const POLL_INTERVAL_MS = 5000;

export function useRide(): UseRideResult {
  const [rideState, setRideState] = useState<RideState>(DEFAULT_STATE);
  const [requesting, setRequesting] = useState(false);
  const socketListening = useRef(false);
  const socketRef = useRef<Awaited<ReturnType<typeof getSocket>> | null>(null);
  const socketCleanupRef = useRef<(() => void) | null>(null);
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
                vehicleColor: data.driver.vehicleColor ?? data.driver.vehicle_color ?? prev.driver?.vehicleColor,
                plateNumber: data.driver.plateNumber ?? data.driver.plate_number ?? prev.driver?.plateNumber,
                rating: data.driver.rating ?? prev.driver?.rating ?? 4.8,
                eta: data.eta ?? data.driver.eta ?? prev.driver?.eta ?? 5,
              }
            : prev.driver;

          const updatedLocation: DriverLocation | null =
            data.driverLocation ?? data.driver_location ?? prev.driverLocation;

          const updatedPassengerRating =
            data.passengerRating !== undefined ? data.passengerRating : prev.passengerRating;

          return { ...prev, status, driver: updatedDriver, driverLocation: updatedLocation, passengerRating: updatedPassengerRating };
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
      const s = socketRef.current;
      if (s) {
        s.off('ride:driver_assigned');
        s.off('ride:driver_location');
        s.off('ride:arrived');
        s.off('ride:started');
        s.off('ride:completed');
        s.off('ride:cancelled');
        s.off('ride:driver_cancelled');
        s.off('ride:no_show_cancelled');
        s.off('ride:timeout');
        s.off('ride:status_update');
        s.off('ride:status:changed');
        s.off('ride:waiting:charge:started');
        s.off('ride:waiting:charge:updated');
        s.off('ride:waiting:charge:capped');
        s.off('surge:updated');
        s.off('ride:deviation_warning');
      }
      socketListening.current = false;
      stopPolling();
    };
    socketCleanupRef.current = cleanup;

    try {
      const socket = await getSocket();
      socketRef.current = socket;

      socket.on('ride:driver_assigned', (data: any) => {
        if (data.rideId !== rideId) return;
        setRideState((prev) => ({
          ...prev,
          status: 'driver_assigned',
          driver: {
            name: data.driver?.name ?? 'Driver',
            phone: data.driver?.phone ?? '',
            vehicle: data.driver?.vehicle ?? '',
            vehicleColor: data.driver?.vehicleColor ?? data.driver?.vehicle_color ?? '',
            plateNumber: data.driver?.plateNumber ?? data.driver?.plate_number ?? '',
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

      socket.on('ride:driver_cancelled', (data: any) => {
        if (data.rideId && data.rideId !== rideId) return;
        setRideState((prev) => ({
          ...prev,
          status: 'cancelled',
          cancelReason: data.reason ?? 'Driver cancelled your ride',
        }));
        cleanup();
      });

      socket.on('ride:no_show_cancelled', (data: any) => {
        if (data.rideId && data.rideId !== rideId) return;
        setRideState((prev) => ({
          ...prev,
          status: 'cancelled',
          cancelReason: data.reason ?? 'Ride cancelled: driver did not arrive in time',
        }));
        cleanup();
      });

      socket.on('ride:timeout', (data: any) => {
        if (data.rideId !== rideId) return;
        setRideState((prev) => ({ ...prev, status: 'timeout' }));
        cleanup();
      });

      socket.on('ride:status_update', (data: any) => {
        if (data.rideId !== rideId) return;
        const status: RideStatus = data.status;
        if (!status) return;
        setRideState((prev) => ({ ...prev, status }));
        if (TERMINAL_STATUSES.includes(status)) cleanup();
      });

      // Task 5: ride:status:changed — authoritative status transitions with meta
      socket.on('ride:status:changed', (data: any) => {
        if (data.rideId !== rideId) return;
        const status: RideStatus = data.status;
        if (!status) return;
        setRideState((prev) => {
          const updates: Partial<RideState> = { status };
          if (status === 'driver_assigned' && data.meta) {
            updates.driver = {
              name: data.meta.driverName ?? prev.driver?.name ?? 'Driver',
              phone: data.meta.driverPhone ?? prev.driver?.phone ?? '',
              vehicle: data.meta.vehicle ?? prev.driver?.vehicle ?? '',
              vehicleColor: data.meta.vehicleColor ?? prev.driver?.vehicleColor,
              plateNumber: data.meta.plateNumber ?? prev.driver?.plateNumber,
              rating: data.meta.rating ?? prev.driver?.rating ?? 4.8,
              eta: data.meta.eta ?? prev.driver?.eta ?? 5,
            };
          }
          if (status === 'completed') {
            updates.fare = data.meta?.finalPrice ?? prev.fare;
          }
          if (status === 'cancelled') {
            const cancelledBy = data.meta?.cancelledBy ?? '';
            const msg = data.meta?.message ?? '';
            updates.cancelReason = msg || (cancelledBy ? `Cancelled by ${cancelledBy}` : null);
          }
          if (status === 'active') {
            updates.waitingChargeStatus = 'none';
            updates.waitingRatePerMinute = null;
          }
          return { ...prev, ...updates };
        });
        if (TERMINAL_STATUSES.includes(status)) cleanup();
      });

      // Task 2: waiting charge events with rideId guard and ratePerMinute
      socket.on('ride:waiting:charge:started', (data: any) => {
        if (data.rideId && data.rideId !== rideId) return;
        setRideState((prev) => ({
          ...prev,
          waitingChargeStatus: 'active',
          waitingCharge: 0,
          waitingRatePerMinute: data?.ratePerMinute ?? prev.waitingRatePerMinute,
        }));
      });

      socket.on('ride:waiting:charge:updated', (data: any) => {
        if (data.rideId && data.rideId !== rideId) return;
        setRideState((prev) => ({
          ...prev,
          waitingCharge: data?.currentCharge ?? data?.charge ?? prev.waitingCharge,
        }));
      });

      socket.on('ride:waiting:charge:capped', (data: any) => {
        if (data.rideId && data.rideId !== rideId) return;
        setRideState((prev) => ({
          ...prev,
          waitingChargeStatus: 'capped',
          waitingCharge: data?.finalCharge ?? data?.charge ?? prev.waitingCharge,
        }));
      });

      socket.on('surge:updated', (data: any) => {
        setRideState((prev) => ({ ...prev, surgeMultiplier: data?.multiplier ?? prev.surgeMultiplier }));
      });

      // Task 2: Route deviation warning
      socket.on('ride:deviation_warning', (data: any) => {
        if (data.rideId && data.rideId !== rideId) return;
        setRideState((prev) => ({ ...prev, deviationWarning: true }));
      });
    } catch (err) {
      console.warn('[useRide] Socket setup failed:', err);
    }
  }, [stopPolling]);

  const requestRide = useCallback(async (payload: {
    type: 'car' | 'scooter';
    pickup: { latitude: number; longitude: number; address?: string };
    dropoff: { latitude: number; longitude: number; address?: string };
    notes?: string;
    promoCode?: string;
  }) => {
    setRequesting(true);
    setRideState(DEFAULT_STATE);
    stopPolling();
    try {
      const { data } = await api.post('/rides/request', {
        vehicleType:        payload.type,
        pickupLatitude:     payload.pickup.latitude,
        pickupLongitude:    payload.pickup.longitude,
        pickupAddress:      payload.pickup.address ?? '',
        dropoffLatitude:    payload.dropoff.latitude,
        dropoffLongitude:   payload.dropoff.longitude,
        dropoffAddress:     payload.dropoff.address ?? '',
        notes:              payload.notes,
        paymentMethod:      'cash',
        ...(payload.promoCode ? { promoCode: payload.promoCode } : {}),
      });
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

  const cancelRide = useCallback(async (reason?: string) => {
    const { rideId } = rideState;
    if (rideId) {
      try {
        await api.patch(`/rides/${rideId}/cancel`, reason ? { reason } : {});
      } catch {}
    }
    stopPolling();
    activeRideIdRef.current = null;
    setRideState((prev) => ({
      ...prev,
      status: 'cancelled',
      cancelReason: reason ?? 'Cancelled by user',
    }));
    socketListening.current = false;
  }, [rideState, stopPolling]);

  const clearDeviationWarning = useCallback(() => {
    setRideState((prev) => ({ ...prev, deviationWarning: false }));
  }, []);

  const resetRide = useCallback(() => {
    stopPolling();
    activeRideIdRef.current = null;
    setRideState(DEFAULT_STATE);
    socketListening.current = false;
  }, [stopPolling]);

  useEffect(() => {
    return () => {
      socketCleanupRef.current?.();
      socketCleanupRef.current = null;
      stopPolling();
    };
  }, [stopPolling]);

  usePassengerTracking({
    isActive: rideState.status === 'started',
    rideId: rideState.rideId,
  });

  return { rideState, requesting, requestRide, cancelRide, clearDeviationWarning, resetRide };
}
