import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { z } from 'zod';
import {
  getRide as getRideApi,
  requestRide as requestRideApi,
  cancelRide as cancelRideApi,
} from '../../api/rideService';
import { getSocket, getSocketSync, onSocketConnectionChange, type RideStatus, type DriverLocation, normalizeRideStatus } from '../../api/socket';
import { usePassengerTracking } from '../shared/usePassengerTracking';
import { PASSENGER_RIDE_LOCATION_TASK } from '../shared/backgroundLocationTask';
import { SOCKET_EVENTS } from '../../../constants/socketEvents';
import { useActiveSession } from '../../../context/ActiveSessionContext';
import { selectActiveRide } from '../../session/activeRideSelectors';

const DriverAssignedSchema = z.object({
  rideId: z.string().or(z.number()),
  driver: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    avatar: z.string().nullable().optional(),
    vehicle: z.string().optional(),
    vehicleColor: z.string().optional(),
    vehicle_color: z.string().optional(),
    vehicleColorHex: z.string().optional(),
    vehicle_color_hex: z.string().optional(),
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
  /** Cash the passenger still owes the driver in person — 0 for wallet-paid rides. */
  netCashPayable: z.number().optional(),
  /** Original trip price before any promo discount. */
  grossFare: z.number().optional(),
  /** EGP amount knocked off by a promo code, 0 when none was used. */
  promoDiscount: z.number().optional(),
  /** Portion of the fare paid from the passenger's wallet, 0 for cash rides. */
  walletDeduction: z.number().optional(),
});

const RideCancelledSchema = z.object({
  rideId: z.string().or(z.number()),
  reason: z.string().optional(),
});

const RideCancelledOptionalIdSchema = z.object({
  rideId: z.string().or(z.number()).optional(),
  reason: z.string().optional(),
  refundAmount: z.number().optional(),
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

const RideEtaUpdateSchema = z.object({
  rideId: z.string().or(z.number()),
  etaMinutes: z.number().optional(),
  distanceM: z.number().optional(),
});

export interface DriverInfo {
  name: string;
  phone: string;
  /** Signed URL to the driver's profile photo, or null when they have none set. */
  avatar?: string | null;
  vehicle: string;
  vehicleColor?: string;
  vehicleColorHex?: string;
  plateNumber?: string;
  rating: number;
  /** Minutes until arrival, or null when no real estimate has arrived yet
   *  (never a guessed/default value — the UI must show a non-numeric state). */
  eta: number | null;
}

export interface RideState {
  rideId: string | null;
  status: RideStatus;
  driver: DriverInfo | null;
  driverLocation: DriverLocation | null;
  /** netCashPayable — cash still owed to the driver in person, 0 for wallet-paid rides. */
  fare: number | null;
  /** Original trip price before any promo discount — only set once the ride completes. */
  grossFare: number | null;
  /** EGP amount knocked off by a promo code — only set once the ride completes. */
  promoDiscount: number | null;
  /** Portion of the fare paid from the passenger's wallet — only set once the ride completes. */
  walletDeduction: number | null;
  cancelReason: string | null;
  /** F6: who/what ended the ride, so the UI can show a distinct message per cause. */
  terminationReason: 'passenger' | 'driver' | 'no_show' | 'timeout' | null;
  /** Set only on a no-show cancellation when the backend refunded escrowed wallet funds. */
  refundAmount: number | null;
  waitingCharge: number | null;
  waitingChargeStatus: 'none' | 'active' | 'capped';
  waitingRatePerMinute: number | null;
  surgeMultiplier: number | null;
  deviationWarning: boolean;
  passengerRating: { id: number; score: number } | null;
  /** Live road distance (metres) to the current target — pickup while the
   *  driver is approaching, dropoff during the trip — from the backend's
   *  ride:eta_update (real Google distance). Pairs with driver.eta (minutes)
   *  for the nav card. Null until the first update. */
  liveDistanceM?: number | null;
}

export interface ResumedRide {
  rideId: string;
  status: RideStatus;
  dropoffAddress?: string;
  dropoffLatitude?: number;
  dropoffLongitude?: number;
  pickupAddress?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
}

/**
 * Normalizes a raw `ride.driver` object (from a REST ride payload) into
 * DriverInfo, merging against `fallback` (typically the previous driver
 * state) field-by-field so a partial update never blanks out already-known
 * details. Returns `fallback` unchanged when the ride has no driver data.
 */
function mapDriverFromRide(
  rideDriver: any,
  topLevelEta: number | undefined,
  fallback: DriverInfo | null,
): DriverInfo | null {
  if (!rideDriver) return fallback;
  return {
    name: rideDriver.name ?? fallback?.name ?? 'Driver',
    phone: rideDriver.phone ?? fallback?.phone ?? '',
    avatar: rideDriver.avatar ?? fallback?.avatar ?? null,
    vehicle: rideDriver.vehicle ?? fallback?.vehicle ?? '',
    vehicleColor: rideDriver.vehicleColor ?? rideDriver.vehicle_color ?? fallback?.vehicleColor,
    vehicleColorHex: rideDriver.vehicleColorHex ?? rideDriver.vehicle_color_hex ?? fallback?.vehicleColorHex,
    plateNumber: rideDriver.plateNumber ?? rideDriver.plate_number ?? fallback?.plateNumber,
    rating: rideDriver.rating ?? fallback?.rating ?? 4.8,
    eta: topLevelEta ?? rideDriver.eta ?? fallback?.eta ?? null,
  };
}

interface UseRideResult {
  rideState: RideState;
  requesting: boolean;
  requestRide: (payload: {
    type: 'car' | 'scooter' | 'delivery';
    pickup: { latitude: number; longitude: number; address?: string };
    dropoff: { latitude: number; longitude: number; address?: string };
    promoCode?: string;
    recipientName?: string;
    recipientPhone?: string;
    paymentMethod?: 'cash' | 'wallet';
  }) => Promise<{
    success: boolean;
    rideId?: string;
    error?: string;
    /** Present only when the backend rejected the request with 402 insufficient-balance. */
    insufficientBalance?: { required: number; balance: number };
  }>;
  cancelRide: (reason?: string) => Promise<{
    success: boolean;
    error?: string;
    /** Present on a successful cancel; > 0 when a wallet-paid ride's escrow was partially or fully returned. */
    refundAmount?: number;
    cancellationFee?: number;
  }>;
  clearDeviationWarning: () => void;
  resetRide: () => void;
  resumeActiveRide: () => Promise<ResumedRide | null>;
  /** True when the status-polling fallback (used alongside sockets) is currently failing to reach the server. */
  pollingStale: boolean;
}

const DEFAULT_STATE: RideState = {
  rideId: null,
  status: 'searching',
  driver: null,
  driverLocation: null,
  fare: null,
  grossFare: null,
  promoDiscount: null,
  walletDeduction: null,
  cancelReason: null,
  terminationReason: null,
  refundAmount: null,
  waitingCharge: null,
  waitingChargeStatus: 'none',
  waitingRatePerMinute: null,
  surgeMultiplier: null,
  deviationWarning: false,
  passengerRating: null,
};

const TERMINAL_STATUSES: RideStatus[] = ['completed', 'cancelled', 'timeout'];
const POLL_INTERVAL_MS = 5000;

export function useRide(serviceType?: 'car' | 'scooter' | 'delivery'): UseRideResult {
  const [rideState, setRideState] = useState<RideState>(DEFAULT_STATE);
  const [requesting, setRequesting] = useState(false);
  const [pollingStale, setPollingStale] = useState(false);
  const socketListening = useRef(false);
  const socketCleanupRef = useRef<(() => void) | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRideIdRef = useRef<string | null>(null);

  // ── ActiveSession integration ─────────────────────────────────────────────
  // Consume the centralized session state. This is the source of truth for
  // recovery and for ongoing state syncs triggered by session:snapshot events.
  const { session, refreshActiveSession } = useActiveSession();
  const activeRideSnapshot = useMemo(() => selectActiveRide(session), [session]);

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
        const data = await getRideApi(activeRideIdRef.current);
        setPollingStale(false);
        const ride = data?.data ?? data;
        const status = normalizeRideStatus(ride.status ?? ride.rideStatus);
        if (!status) return;

        setRideState((prev) => {
          const updatedDriver = mapDriverFromRide(ride.driver, ride.eta, prev.driver);

          const updatedLocation: DriverLocation | null =
            ride.driverLocation ?? ride.driver_location ?? prev.driverLocation;

          const updatedPassengerRating =
            ride.passengerRating !== undefined ? ride.passengerRating : prev.passengerRating;

          return { ...prev, status, driver: updatedDriver, driverLocation: updatedLocation, passengerRating: updatedPassengerRating };
        });

        if (TERMINAL_STATUSES.includes(status)) {
          stopPolling();
        }
      } catch {
        // Polling failures don't interrupt the ride — socket events remain the
        // primary source — but we surface `pollingStale` so the UI can show a
        // lightweight "reconnecting" hint without changing socket behavior.
        setPollingStale(true);
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  const setupSocketListeners = useCallback(async (rideId: string) => {
    if (socketListening.current) return;
    socketListening.current = true;

    // Tracks whichever socket instance the handlers below are currently
    // bound to. reconnectSocket() (src/api/socket.ts) can replace the shared
    // socket with a brand-new io() instance (e.g. after a token refresh mid-
    // ride) — without re-binding onto that new instance, these listeners stay
    // attached to the dead old one and ride:completed/cancelled/waiting-charge/
    // surge/eta_update all go silently unreceived for the rest of the ride.
    let boundSocket: Awaited<ReturnType<typeof getSocket>> | null = null;
    let unsubscribeConnection: (() => void) | null = null;

    // Driver location is intentionally NOT handled here — useDriverLocationSocket
    // (used internally by CarMap / PassengerTrackingMap) is the single source
    // of truth for live driver:ride:location ticks, and re-binds itself on
    // reconnect independently. A second listener here duplicated GPS
    // processing and kept its own divergent copy of the position.

    const onDriverAssigned = (raw: unknown) => {
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
          avatar: data.driver?.avatar ?? null,
          vehicle: data.driver?.vehicle ?? '',
          vehicleColor: data.driver?.vehicleColor ?? data.driver?.vehicle_color ?? '',
          vehicleColorHex: data.driver?.vehicleColorHex ?? data.driver?.vehicle_color_hex ?? '',
          plateNumber: data.driver?.plateNumber ?? data.driver?.plate_number ?? '',
          rating: data.driver?.rating ?? 4.8,
          eta: data.eta ?? null,
        },
      }));
    };

    const onDriverArrived = (raw: unknown) => {
      const parsed = RideIdSchema.safeParse(raw);
      if (!parsed.success) { console.warn('[Socket] Invalid ride:driver_arrived payload'); return; }
      if (String(parsed.data.rideId) !== String(rideId)) return;
      setRideState((prev) => ({ ...prev, status: 'arrived' }));
    };

    const onStarted = (raw: unknown) => {
      const parsed = RideIdSchema.safeParse(raw);
      if (!parsed.success) { console.warn('[Socket] Invalid ride:started payload'); return; }
      if (String(parsed.data.rideId) !== String(rideId)) return;
      setRideState((prev) => ({ ...prev, status: 'started' }));
    };

    const onCompleted = (raw: unknown) => {
      const parsed = RideCompletedSchema.safeParse(raw);
      if (!parsed.success) { console.warn('[Socket] Invalid ride:completed payload'); return; }
      if (String(parsed.data.rideId) !== String(rideId)) return;
      setRideState((prev) => ({
        ...prev,
        status: 'completed',
        fare: parsed.data.netCashPayable ?? null,
        grossFare: parsed.data.grossFare ?? null,
        promoDiscount: parsed.data.promoDiscount ?? null,
        walletDeduction: parsed.data.walletDeduction ?? null,
      }));
      cleanup();
      refreshActiveSession().catch(() => {});
    };

    const onCancelled = (raw: unknown) => {
      const parsed = RideCancelledSchema.safeParse(raw);
      if (!parsed.success) { console.warn('[Socket] Invalid ride:cancelled payload'); return; }
      if (String(parsed.data.rideId) !== String(rideId)) return;
      setRideState((prev) => ({ ...prev, status: 'cancelled', cancelReason: parsed.data.reason ?? null }));
      cleanup();
      refreshActiveSession().catch(() => {});
    };

    const onDriverCancelled = (raw: unknown) => {
      const parsed = RideCancelledOptionalIdSchema.safeParse(raw);
      if (!parsed.success) { console.warn('[Socket] Invalid ride:driver_cancelled payload'); return; }
      // rideId is optional on this event: this listener only exists while
      // actively tracking this specific ride (registered/torn down per
      // rideId by setupSocketListeners/cleanup), so an omitted rideId is
      // already implicitly scoped to it. A *present* rideId must still match.
      if (parsed.data.rideId != null && String(parsed.data.rideId) !== String(rideId)) return;
      setRideState((prev) => ({
        ...prev,
        status: 'cancelled',
        cancelReason: parsed.data.reason ?? null,
        terminationReason: 'driver',
      }));
      cleanup();
      refreshActiveSession().catch(() => {});
    };

    const onNoShowCancelled = (raw: unknown) => {
      const parsed = RideCancelledOptionalIdSchema.safeParse(raw);
      if (!parsed.success) { console.warn('[Socket] Invalid ride:no_show_cancelled payload'); return; }
      // Same reasoning as ride:driver_cancelled above: an omitted rideId is
      // safe here because this listener is scoped to one ride at a time; a
      // *present* rideId must still match.
      if (parsed.data.rideId != null && String(parsed.data.rideId) !== String(rideId)) return;
      setRideState((prev) => ({
        ...prev,
        status: 'cancelled',
        cancelReason: parsed.data.reason ?? null,
        terminationReason: 'no_show',
        refundAmount: parsed.data.refundAmount ?? null,
      }));
      cleanup();
      refreshActiveSession().catch(() => {});
    };

    const onTimeout = (raw: unknown) => {
      const parsed = RideIdSchema.safeParse(raw);
      if (!parsed.success) { console.warn('[Socket] Invalid ride:timeout payload'); return; }
      if (String(parsed.data.rideId) !== String(rideId)) return;
      setRideState((prev) => ({ ...prev, status: 'timeout', terminationReason: 'timeout' }));
      cleanup();
      refreshActiveSession().catch(() => {});
    };

    // ride:status_update and ride:status:changed carry the same logical
    // event (a ride status transition); ride:status_update is the older,
    // bare-status-only shape and is routed through the same rich handler
    // below so a status transition never silently drops driver/fare/cancel
    // data depending on which event name the backend happens to emit.
    const onStatusChanged = (raw: unknown) => {
      const parsed = RideStatusChangedSchema.safeParse(raw);
      if (!parsed.success) { console.warn('[Socket] Invalid ride:status:changed payload'); return; }
      const data = parsed.data;
      if (String(data.rideId) !== String(rideId)) return;
      const status = normalizeRideStatus(data.status);
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
            vehicleColorHex: m.vehicleColorHex ?? prev.driver?.vehicleColorHex,
            plateNumber: m.plateNumber ?? prev.driver?.plateNumber,
            rating: m.rating ?? prev.driver?.rating ?? 4.8,
            eta: m.eta ?? prev.driver?.eta ?? null,
          };
        }
        if (status === 'completed') {
          const meta = data.meta as any;
          updates.fare = meta?.netCashPayable ?? prev.fare;
          updates.grossFare = meta?.grossFare ?? prev.grossFare;
          updates.promoDiscount = meta?.promoDiscount ?? prev.promoDiscount;
          updates.walletDeduction = meta?.walletDeduction ?? prev.walletDeduction;
        }
        if (status === 'cancelled') {
          const m = data.meta as any;
          const cancelledBy = m?.cancelledBy ?? '';
          const msg = m?.message ?? '';
          updates.cancelReason = msg || (cancelledBy ? `Cancelled by ${cancelledBy}` : null);
        }
        if (status === 'started') {
          updates.waitingChargeStatus = 'none';
          updates.waitingRatePerMinute = null;
        }
        return { ...prev, ...updates };
      });
      if (TERMINAL_STATUSES.includes(status)) cleanup();
    };

    const onWaitingChargeStarted = (raw: unknown) => {
      const parsed = WaitingChargeStartedSchema.safeParse(raw);
      if (!parsed.success) { console.warn('[Socket] Invalid ride:waiting:charge:started payload'); return; }
      if (!parsed.data.rideId || String(parsed.data.rideId) !== String(rideId)) return;
      setRideState((prev) => ({
        ...prev,
        waitingChargeStatus: 'active',
        waitingCharge: 0,
        waitingRatePerMinute: parsed.data.ratePerMinute ?? prev.waitingRatePerMinute,
      }));
    };

    const onWaitingChargeUpdated = (raw: unknown) => {
      const parsed = WaitingChargeUpdatedSchema.safeParse(raw);
      if (!parsed.success) { console.warn('[Socket] Invalid ride:waiting:charge:updated payload'); return; }
      if (!parsed.data.rideId || String(parsed.data.rideId) !== String(rideId)) return;
      setRideState((prev) => ({
        ...prev,
        waitingCharge: parsed.data.currentCharge ?? parsed.data.charge ?? prev.waitingCharge,
      }));
    };

    const onWaitingChargeCapped = (raw: unknown) => {
      const parsed = WaitingChargeCappedSchema.safeParse(raw);
      if (!parsed.success) { console.warn('[Socket] Invalid ride:waiting:charge:capped payload'); return; }
      if (!parsed.data.rideId || String(parsed.data.rideId) !== String(rideId)) return;
      setRideState((prev) => ({
        ...prev,
        waitingChargeStatus: 'capped',
        waitingCharge: parsed.data.finalCharge ?? parsed.data.charge ?? prev.waitingCharge,
      }));
    };

    const onSurgeUpdated = (raw: unknown) => {
      const parsed = SurgeUpdatedSchema.safeParse(raw);
      if (!parsed.success) { console.warn('[Socket] Invalid surge:updated payload'); return; }
      setRideState((prev) => ({ ...prev, surgeMultiplier: parsed.data.multiplier ?? prev.surgeMultiplier }));
    };

    const onDeviationWarning = (raw: unknown) => {
      const parsed = DeviationWarningSchema.safeParse(raw);
      if (!parsed.success) { console.warn('[Socket] Invalid ride:deviation:warning payload'); return; }
      if (!parsed.data.rideId || String(parsed.data.rideId) !== String(rideId)) return;
      setRideState((prev) => ({ ...prev, deviationWarning: true }));
    };

    const onEtaUpdate = (raw: unknown) => {
      const parsed = RideEtaUpdateSchema.safeParse(raw);
      if (!parsed.success) { console.warn('[Socket] Invalid ride:eta_update payload'); return; }
      if (String(parsed.data.rideId) !== String(rideId)) return;
      const { etaMinutes, distanceM } = parsed.data;
      if (etaMinutes === undefined && distanceM === undefined) return;
      setRideState((prev) => {
        const next = { ...prev };
        if (etaMinutes !== undefined && prev.driver) {
          next.driver = { ...prev.driver, eta: etaMinutes };
        }
        if (distanceM !== undefined) {
          next.liveDistanceM = distanceM;
        }
        return next;
      });
    };

    // Every on()/off() below names the exact handler — a bare `.off(eventName)`
    // would remove ALL listeners for that event on the shared socket
    // singleton, silently killing unrelated subscribers (e.g. another tab's
    // useRide instance) bound to an event with the same name.
    const bindTo = (s: Awaited<ReturnType<typeof getSocket>>) => {
      s.on('ride:driver_assigned', onDriverAssigned);
      s.on(SOCKET_EVENTS.RIDE_DRIVER_ARRIVED, onDriverArrived);
      s.on('ride:started', onStarted);
      s.on('ride:completed', onCompleted);
      s.on('ride:cancelled', onCancelled);
      s.on('ride:driver_cancelled', onDriverCancelled);
      s.on('ride:no_show_cancelled', onNoShowCancelled);
      s.on('ride:timeout', onTimeout);
      s.on('ride:status_update', onStatusChanged);
      s.on('ride:status:changed', onStatusChanged);
      s.on('ride:waiting:charge:started', onWaitingChargeStarted);
      s.on('ride:waiting:charge:updated', onWaitingChargeUpdated);
      s.on('ride:waiting:charge:capped', onWaitingChargeCapped);
      s.on('surge:updated', onSurgeUpdated);
      s.on('ride:deviation:warning', onDeviationWarning);
      s.on('ride:eta_update', onEtaUpdate);
    };

    const unbindFrom = (s: Awaited<ReturnType<typeof getSocket>>) => {
      s.off('ride:driver_assigned', onDriverAssigned);
      s.off(SOCKET_EVENTS.RIDE_DRIVER_ARRIVED, onDriverArrived);
      s.off('ride:started', onStarted);
      s.off('ride:completed', onCompleted);
      s.off('ride:cancelled', onCancelled);
      s.off('ride:driver_cancelled', onDriverCancelled);
      s.off('ride:no_show_cancelled', onNoShowCancelled);
      s.off('ride:timeout', onTimeout);
      s.off('ride:status_update', onStatusChanged);
      s.off('ride:status:changed', onStatusChanged);
      s.off('ride:waiting:charge:started', onWaitingChargeStarted);
      s.off('ride:waiting:charge:updated', onWaitingChargeUpdated);
      s.off('ride:waiting:charge:capped', onWaitingChargeCapped);
      s.off('surge:updated', onSurgeUpdated);
      s.off('ride:deviation:warning', onDeviationWarning);
      s.off('ride:eta_update', onEtaUpdate);
    };

    const cleanup = () => {
      if (boundSocket) {
        unbindFrom(boundSocket);
        boundSocket = null;
      }
      unsubscribeConnection?.();
      unsubscribeConnection = null;
      socketListening.current = false;
      stopPolling();
    };
    socketCleanupRef.current = cleanup;

    try {
      const socket = await getSocket();
      boundSocket = socket;
      bindTo(socket);

      // Re-bind whenever the socket reconnects onto a genuinely NEW instance
      // (reconnectSocket() disconnects the old one and creates a fresh io()).
      // A same-instance reconnect (socket.io's own built-in reconnection)
      // keeps its listeners automatically — re-binding onto the same object
      // would just double-register, so this only acts when the instance
      // actually changed.
      unsubscribeConnection = onSocketConnectionChange((state) => {
        if (state !== 'connected') return;
        const current = getSocketSync();
        if (!current || current === boundSocket) return;
        if (boundSocket) unbindFrom(boundSocket);
        boundSocket = current;
        bindTo(current);
      });

      // Full ride-state recovery on reconnect is still owned by
      // ActiveSessionContext via session:snapshot; the activeRideSnapshot sync
      // effect below applies those updates. This re-binding only ensures
      // *future* events on this new instance are actually received.
    } catch (err) {
      console.warn('[useRide] Socket setup failed:', err);
      socketListening.current = false;
      socketCleanupRef.current = null;
    }
  }, [stopPolling, refreshActiveSession]);

  const requestRide = useCallback(async (payload: {
    type: 'car' | 'scooter' | 'delivery';
    pickup: { latitude: number; longitude: number; address?: string };
    dropoff: { latitude: number; longitude: number; address?: string };
    promoCode?: string;
    recipientName?: string;
    recipientPhone?: string;
    paymentMethod?: 'cash' | 'wallet';
  }) => {
    setRequesting(true);
    setRideState(DEFAULT_STATE);
    stopPolling();
    try {
      const data = await requestRideApi(payload);
      const rawId = data?.data?.id ?? data?.rideId ?? data?.id ?? data?._id;
      if (rawId == null) {
        throw new Error('Ride request did not return a valid ride id');
      }
      const rideId = String(rawId);
      setRideState((prev) => ({ ...prev, rideId, status: 'searching' }));
      await setupSocketListeners(rideId);
      startPolling(rideId);
      // Sync ActiveSessionContext so ActiveRideBanner (and any other global
      // consumer) immediately sees the new ride without waiting for the next
      // session:snapshot socket event (which is only emitted on socket connect).
      refreshActiveSession().catch(() => {});
      return { success: true, rideId };
    } catch (e: any) {
      const status = e?.response?.status;
      const respData = e?.response?.data;
      const error = respData?.error ?? respData?.message ?? e?.message ?? 'Failed to request ride';
      setRideState((prev) => ({ ...prev, status: 'cancelled', cancelReason: error }));
      const insufficientBalance =
        status === 402 && typeof respData?.required === 'number' && typeof respData?.balance === 'number'
          ? { required: respData.required, balance: respData.balance }
          : undefined;
      return { success: false, error, insufficientBalance };
    } finally {
      setRequesting(false);
    }
  }, [setupSocketListeners, startPolling, stopPolling, refreshActiveSession]);

  const cancelRide = useCallback(async (reason?: string): Promise<{
    success: boolean;
    error?: string;
    refundAmount?: number;
    cancellationFee?: number;
  }> => {
    const { rideId } = rideState;
    if (!rideId) {
      return { success: false, error: 'No active ride to cancel' };
    }

    let cancelResult: { refundAmount?: number; cancellationFee?: number } = {};
    try {
      cancelResult = await cancelRideApi(rideId, reason);
    } catch (e: any) {
      // The cancel call failed — don't assume the ride was cancelled. Resync
      // with the backend's actual status instead of guessing, and leave the
      // passenger in their current ride flow either way.
      try {
        const data = await getRideApi(rideId);
        const ride = data?.data ?? data;
        const status = normalizeRideStatus(ride.status ?? ride.rideStatus);
        if (status) {
          setRideState((prev) => ({
            ...prev,
            status,
            cancelReason: status === 'cancelled' ? null : prev.cancelReason,
            terminationReason: status === 'cancelled' ? 'passenger' : prev.terminationReason,
          }));
          if (TERMINAL_STATUSES.includes(status)) {
            activeRideIdRef.current = null;
            socketCleanupRef.current?.();
            socketCleanupRef.current = null;
          }
        }
      } catch {}
      const error = e?.response?.data?.message ?? e?.message ?? 'Failed to cancel ride';
      return { success: false, error };
    }

    activeRideIdRef.current = null;
    socketCleanupRef.current?.();
    socketCleanupRef.current = null;
    setRideState((prev) => ({
      ...prev,
      status: 'cancelled',
      cancelReason: null,
      terminationReason: 'passenger',
    }));
    // Clear ActiveSessionContext immediately so the banner disappears without
    // waiting for the next foreground refresh or session:snapshot event.
    refreshActiveSession().catch(() => {});
    return { success: true, refundAmount: cancelResult.refundAmount, cancellationFee: cancelResult.cancellationFee };
  }, [rideState, refreshActiveSession]);

  const clearDeviationWarning = useCallback(() => {
    setRideState((prev) => ({ ...prev, deviationWarning: false }));
  }, []);

  const resetRide = useCallback(() => {
    if (socketCleanupRef.current) {
      socketCleanupRef.current();
      socketCleanupRef.current = null;
    } else {
      stopPolling();
    }
    activeRideIdRef.current = null;
    setRideState(DEFAULT_STATE);
  }, [stopPolling]);

  const resumeActiveRide = useCallback(async (): Promise<ResumedRide | null> => {
    // ActiveSessionContext is the sole source of ride recovery.
    // A null snapshot is an authoritative answer — either no active session
    // (data: null) or a shuttle booking (not a ride). Both mean no ride to resume.
    if (!activeRideSnapshot) return null;

    const { rideId, rideType, status, driver, driverLocation } = activeRideSnapshot;

    // Enforce per-tab serviceType isolation: each tab only resumes rides
    // that belong to its own vehicle type.
    if (serviceType && rideType !== serviceType) return null;

    activeRideIdRef.current = rideId;
    setRideState((prev) => ({
      ...prev,
      rideId,
      status,
      driver,
      driverLocation,
      fare: activeRideSnapshot.fare,
      waitingCharge: activeRideSnapshot.waitingCharge > 0
        ? activeRideSnapshot.waitingCharge
        : prev.waitingCharge,
    }));

    await setupSocketListeners(rideId);
    startPolling(rideId);

    return {
      rideId,
      status,
      pickupAddress: activeRideSnapshot.pickup.address,
      pickupLatitude: activeRideSnapshot.pickup.latitude,
      pickupLongitude: activeRideSnapshot.pickup.longitude,
      dropoffAddress: activeRideSnapshot.dropoff.address,
      dropoffLatitude: activeRideSnapshot.dropoff.latitude,
      dropoffLongitude: activeRideSnapshot.dropoff.longitude,
    };
  }, [activeRideSnapshot, serviceType, setupSocketListeners, startPolling]);

  useEffect(() => {
    return () => {
      socketCleanupRef.current?.();
      socketCleanupRef.current = null;
      stopPolling();
    };
  }, [stopPolling]);

  // ── ActiveSession → ride state sync ──────────────────────────────────────
  // When the ActiveSessionContext receives a session:snapshot socket event, it
  // updates `session`, which re-derives `activeRideSnapshot`. We apply that
  // snapshot to the local ride state so that the ride UI reacts to the
  // centralized session without needing to handle session:snapshot directly.
  //
  // Guards:
  //  1. serviceType filter — each tab only reacts to its own vehicle type.
  //  2. rideId filter — only sync when the snapshot matches the current ride
  //     (or we have no locally-initiated ride yet, i.e. recovery case).
  //  3. Terminal states — do not overwrite completed/cancelled/timeout; those
  //     are handled by specific socket events and the ride is absent from
  //     ActiveSession anyway.
  useEffect(() => {
    if (!activeRideSnapshot) return;

    // serviceType guard
    if (serviceType && activeRideSnapshot.rideType !== serviceType) return;

    // Terminal guard — never re-apply a cancelled/completed/timeout snapshot.
    // This prevents a race where the user presses "Try Again" (resetting rideId
    // to null) before ActiveSession clears its snapshot: without this guard the
    // sync would re-stamp the old terminal rideId back onto the reset state and
    // push phase back to 'cancelled', blocking a new booking.
    if (TERMINAL_STATUSES.includes(activeRideSnapshot.status)) return;

    const snapRideId = activeRideSnapshot.rideId;

    // rideId guard: only apply when there's no conflicting local ride
    if (activeRideIdRef.current !== null && activeRideIdRef.current !== snapRideId) return;

    setRideState((prev) => {
      // Do not overwrite terminal states — the ride is done locally even if
      // there was a brief window before ActiveSession cleared.
      if (TERMINAL_STATUSES.includes(prev.status) && prev.rideId !== null) return prev;

      return {
        ...prev,
        rideId: snapRideId,
        status: activeRideSnapshot.status,
        // Prefer snapshot driver data; fall back to previous to avoid blanking
        // out details that socket events may have already enriched.
        driver: activeRideSnapshot.driver ?? prev.driver,
        // Prefer most-recent location; socket ride:driver_location events are
        // more frequent than snapshots, so only update when snapshot has data.
        driverLocation: activeRideSnapshot.driverLocation ?? prev.driverLocation,
        // Pricing fields — snapshot is authoritative.
        fare: activeRideSnapshot.fare ?? prev.fare,
        waitingCharge:
          activeRideSnapshot.waitingCharge > 0
            ? activeRideSnapshot.waitingCharge
            : prev.waitingCharge,
      };
    });
  }, [activeRideSnapshot, serviceType]);

  usePassengerTracking({
    isActive: rideState.status === 'started',
    rideId: rideState.rideId,
    taskName: PASSENGER_RIDE_LOCATION_TASK,
  });

  return { rideState, requesting, requestRide, cancelRide, clearDeviationWarning, resetRide, resumeActiveRide, pollingStale };
}
