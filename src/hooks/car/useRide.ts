import { useState, useCallback, useRef, useEffect } from 'react';
import { z } from 'zod';
import api from '../../api/client';
import { getSocket, type RideStatus, type DriverLocation } from '../../api/socket';
import { usePassengerTracking } from '../shared/usePassengerTracking';

const DriverAssignedSchema = z.object({
  rideId: z.string().or(z.number()),
  driver: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    vehicle: z.string().optional(),
    vehicleColor: z.string().optional(),
    vehicle_color: z.string().optional(),
    plateNumber: z.string().optional(),
    plate_number: z.string().optional(),
    rating: z.number().optional(),
  }).optional(),
  eta: z.number().optional(),
});

const RideIdSchema = z.object({ rideId: z.string().or(z.number()) });

const WaitingChargeStartedSchema = z.object({
  rideId: z.string().or(z.number()),
  ratePerMinute: z.number().optional(),
});

const WaitingChargeUpdatedSchema = z.object({
  rideId: z.string().or(z.number()),
  currentCharge: z.number().optional(),
  charge: z.number().optional(),
});

const WaitingChargeCappedSchema = z.object({
  rideId: z.string().or(z.number()),
  finalCharge: z.number().optional(),
  charge: z.number().optional(),
});

const RideCompletedSchema = z.object({
  rideId: z.string().or(z.number()),
  fare: z.number().optional(),
});

const RideCancelledSchema = z.object({
  rideId: z.string().or(z.number()),
  reason: z.string().optional(),
});

const RideCancelledOptionalIdSchema = z.object({
  rideId: z.string().or(z.number()).optional(),
  reason: z.string().optional(),
});

const RideDriverLocationSchema = z.object({
  rideId: z.string().or(z.number()),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    heading: z.number().optional(),
  }),
});

const RideStatusUpdateSchema = z.object({
  rideId: z.string().or(z.number()),
  status: z.string(),
});

const RideStatusChangedSchema = z.object({
  rideId: z.string().or(z.number()),
  status: z.string(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const SurgeUpdatedSchema = z.object({
  multiplier: z.number().optional(),
});

const DeviationWarningSchema = z.object({
  rideId: z.string().or(z.number()),
});

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

export interface ResumedRide {
  rideId: string;
  status: RideStatus;
  dropoffAddress?: string;
  pickupAddress?: string;
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
  resumeActiveRide: () => Promise<ResumedRide | null>;
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

    // Declared before cleanup so closure in cleanup can reference it
    let reconnectHandler: (() => Promise<void>) | null = null;

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
        if (reconnectHandler) s.io.off('reconnect', reconnectHandler);
      }
      socketListening.current = false;
      stopPolling();
    };
    socketCleanupRef.current = cleanup;

    try {
      const socket = await getSocket();
      socketRef.current = socket;

      socket.on('ride:driver_assigned', (raw: unknown) => {
        const parsed = DriverAssignedSchema.safeParse(raw);
        if (!parsed.success) { console.warn('[Socket] Invalid ride:driver_assigned payload'); return; }
        const data = parsed.data;
        if (String(data.rideId) !== String(rideId)) return;
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

      socket.on('ride:driver_location', (raw: unknown) => {
        const parsed = RideDriverLocationSchema.safeParse(raw);
        if (!parsed.success) { console.warn('[Socket] Invalid ride:driver_location payload'); return; }
        if (String(parsed.data.rideId) !== String(rideId)) return;
        setRideState((prev) => ({ ...prev, driverLocation: parsed.data.location }));
      });

      socket.on('ride:arrived', (raw: unknown) => {
        const parsed = RideIdSchema.safeParse(raw);
        if (!parsed.success) { console.warn('[Socket] Invalid ride:arrived payload'); return; }
        if (String(parsed.data.rideId) !== String(rideId)) return;
        setRideState((prev) => ({ ...prev, status: 'arrived' }));
      });

      socket.on('ride:started', (raw: unknown) => {
        const parsed = RideIdSchema.safeParse(raw);
        if (!parsed.success) { console.warn('[Socket] Invalid ride:started payload'); return; }
        if (String(parsed.data.rideId) !== String(rideId)) return;
        setRideState((prev) => ({ ...prev, status: 'started' }));
      });

      socket.on('ride:completed', (raw: unknown) => {
        const parsed = RideCompletedSchema.safeParse(raw);
        if (!parsed.success) { console.warn('[Socket] Invalid ride:completed payload'); return; }
        if (String(parsed.data.rideId) !== String(rideId)) return;
        setRideState((prev) => ({ ...prev, status: 'completed', fare: parsed.data.fare ?? null }));
        cleanup();
      });

      socket.on('ride:cancelled', (raw: unknown) => {
        const parsed = RideCancelledSchema.safeParse(raw);
        if (!parsed.success) { console.warn('[Socket] Invalid ride:cancelled payload'); return; }
        if (String(parsed.data.rideId) !== String(rideId)) return;
        setRideState((prev) => ({ ...prev, status: 'cancelled', cancelReason: parsed.data.reason ?? null }));
        cleanup();
      });

      socket.on('ride:driver_cancelled', (raw: unknown) => {
        const parsed = RideCancelledOptionalIdSchema.safeParse(raw);
        if (!parsed.success) { console.warn('[Socket] Invalid ride:driver_cancelled payload'); return; }
        if (!parsed.data.rideId || String(parsed.data.rideId) !== String(rideId)) return;
        setRideState((prev) => ({
          ...prev,
          status: 'cancelled',
          cancelReason: parsed.data.reason ?? 'Driver cancelled your ride',
        }));
        cleanup();
      });

      socket.on('ride:no_show_cancelled', (raw: unknown) => {
        const parsed = RideCancelledOptionalIdSchema.safeParse(raw);
        if (!parsed.success) { console.warn('[Socket] Invalid ride:no_show_cancelled payload'); return; }
        if (!parsed.data.rideId || String(parsed.data.rideId) !== String(rideId)) return;
        setRideState((prev) => ({
          ...prev,
          status: 'cancelled',
          cancelReason: parsed.data.reason ?? 'Ride cancelled: driver did not arrive in time',
        }));
        cleanup();
      });

      socket.on('ride:timeout', (raw: unknown) => {
        const parsed = RideIdSchema.safeParse(raw);
        if (!parsed.success) { console.warn('[Socket] Invalid ride:timeout payload'); return; }
        if (String(parsed.data.rideId) !== String(rideId)) return;
        setRideState((prev) => ({ ...prev, status: 'timeout' }));
        cleanup();
      });

      socket.on('ride:status_update', (raw: unknown) => {
        const parsed = RideStatusUpdateSchema.safeParse(raw);
        if (!parsed.success) { console.warn('[Socket] Invalid ride:status_update payload'); return; }
        if (String(parsed.data.rideId) !== String(rideId)) return;
        const status = parsed.data.status as RideStatus;
        if (!status) return;
        setRideState((prev) => ({ ...prev, status }));
        if (TERMINAL_STATUSES.includes(status)) cleanup();
      });

      socket.on('ride:status:changed', (raw: unknown) => {
        const parsed = RideStatusChangedSchema.safeParse(raw);
        if (!parsed.success) { console.warn('[Socket] Invalid ride:status:changed payload'); return; }
        const data = parsed.data;
        if (String(data.rideId) !== String(rideId)) return;
        const status = data.status as RideStatus;
        if (!status) return;
        setRideState((prev) => {
          const updates: Partial<RideState> = { status };
          if (status === 'driver_assigned' && data.meta) {
            const m = data.meta as any;
            updates.driver = {
              name: m.driverName ?? prev.driver?.name ?? 'Driver',
              phone: m.driverPhone ?? prev.driver?.phone ?? '',
              vehicle: m.vehicle ?? prev.driver?.vehicle ?? '',
              vehicleColor: m.vehicleColor ?? prev.driver?.vehicleColor,
              plateNumber: m.plateNumber ?? prev.driver?.plateNumber,
              rating: m.rating ?? prev.driver?.rating ?? 4.8,
              eta: m.eta ?? prev.driver?.eta ?? 5,
            };
          }
          if (status === 'completed') {
            updates.fare = (data.meta as any)?.finalPrice ?? prev.fare;
          }
          if (status === 'cancelled') {
            const m = data.meta as any;
            const cancelledBy = m?.cancelledBy ?? '';
            const msg = m?.message ?? '';
            updates.cancelReason = msg || (cancelledBy ? `Cancelled by ${cancelledBy}` : null);
          }
          if ((status as string) === 'active') {
            updates.waitingChargeStatus = 'none';
            updates.waitingRatePerMinute = null;
          }
          return { ...prev, ...updates };
        });
        if (TERMINAL_STATUSES.includes(status)) cleanup();
      });

      socket.on('ride:waiting:charge:started', (raw: unknown) => {
        const parsed = WaitingChargeStartedSchema.safeParse(raw);
        if (!parsed.success) { console.warn('[Socket] Invalid ride:waiting:charge:started payload'); return; }
        if (!parsed.data.rideId || String(parsed.data.rideId) !== String(rideId)) return;
        setRideState((prev) => ({
          ...prev,
          waitingChargeStatus: 'active',
          waitingCharge: 0,
          waitingRatePerMinute: parsed.data.ratePerMinute ?? prev.waitingRatePerMinute,
        }));
      });

      socket.on('ride:waiting:charge:updated', (raw: unknown) => {
        const parsed = WaitingChargeUpdatedSchema.safeParse(raw);
        if (!parsed.success) { console.warn('[Socket] Invalid ride:waiting:charge:updated payload'); return; }
        if (!parsed.data.rideId || String(parsed.data.rideId) !== String(rideId)) return;
        setRideState((prev) => ({
          ...prev,
          waitingCharge: parsed.data.currentCharge ?? parsed.data.charge ?? prev.waitingCharge,
        }));
      });

      socket.on('ride:waiting:charge:capped', (raw: unknown) => {
        const parsed = WaitingChargeCappedSchema.safeParse(raw);
        if (!parsed.success) { console.warn('[Socket] Invalid ride:waiting:charge:capped payload'); return; }
        if (!parsed.data.rideId || String(parsed.data.rideId) !== String(rideId)) return;
        setRideState((prev) => ({
          ...prev,
          waitingChargeStatus: 'capped',
          waitingCharge: parsed.data.finalCharge ?? parsed.data.charge ?? prev.waitingCharge,
        }));
      });

      socket.on('surge:updated', (raw: unknown) => {
        const parsed = SurgeUpdatedSchema.safeParse(raw);
        if (!parsed.success) { console.warn('[Socket] Invalid surge:updated payload'); return; }
        setRideState((prev) => ({ ...prev, surgeMultiplier: parsed.data.multiplier ?? prev.surgeMultiplier }));
      });

      socket.on('ride:deviation_warning', (raw: unknown) => {
        const parsed = DeviationWarningSchema.safeParse(raw);
        if (!parsed.success) { console.warn('[Socket] Invalid ride:deviation_warning payload'); return; }
        if (!parsed.data.rideId || String(parsed.data.rideId) !== String(rideId)) return;
        setRideState((prev) => ({ ...prev, deviationWarning: true }));
      });

      // On reconnect, re-fetch ride state to recover any events missed during the disconnect window
      reconnectHandler = async () => {
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
            const updatedFare = data.fare ?? data.finalPrice ?? prev.fare;
            return { ...prev, status, driver: updatedDriver, fare: updatedFare };
          });
          if (TERMINAL_STATUSES.includes(status)) cleanup();
        } catch {}
      };
      socket.io.on('reconnect', reconnectHandler);
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

  const resumeActiveRide = useCallback(async (): Promise<ResumedRide | null> => {
    try {
      const { data } = await api.get('/rides/active');
      const ride = data?.data ?? data;
      if (!ride?.id) return null;

      const rideId = String(ride.id);
      const status: RideStatus = ride.status ?? ride.rideStatus;
      if (!status || TERMINAL_STATUSES.includes(status)) return null;

      const driver: DriverInfo | null = ride.driver
        ? {
            name: ride.driver.name ?? 'Driver',
            phone: ride.driver.phone ?? '',
            vehicle: ride.driver.vehicle ?? '',
            vehicleColor: ride.driver.vehicleColor ?? ride.driver.vehicle_color,
            plateNumber: ride.driver.plateNumber ?? ride.driver.plate_number,
            rating: ride.driver.rating ?? 4.8,
            eta: ride.eta ?? ride.driver.eta ?? 5,
          }
        : null;

      activeRideIdRef.current = rideId;
      setRideState((prev) => ({
        ...prev,
        rideId,
        status,
        driver,
        driverLocation: ride.driverLocation ?? ride.driver_location ?? null,
        fare: ride.fare ?? ride.finalPrice ?? null,
      }));

      await setupSocketListeners(rideId);
      startPolling(rideId);

      return {
        rideId,
        status,
        pickupAddress: ride.pickupAddress ?? ride.pickup_address,
        dropoffAddress: ride.dropoffAddress ?? ride.dropoff_address,
      };
    } catch {
      return null;
    }
  }, [setupSocketListeners, startPolling]);

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

  return { rideState, requesting, requestRide, cancelRide, clearDeviationWarning, resetRide, resumeActiveRide };
}
