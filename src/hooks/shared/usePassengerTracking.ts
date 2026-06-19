import { useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/client';

const TRACKING_INTERVAL_MS = 5 * 60 * 1000;
const OFFLINE_STORE_KEY = 'veego_offline_location_snapshots';
const MAX_BATCH_SIZE = 500;

interface LocationSnapshot {
  entityType: 'passenger';
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  recordedAt: string;
  tripId: number | null;
  rideId: string | null;
  isOfflineSync: boolean;
}

interface UsePassengerTrackingOptions {
  isActive: boolean;
  tripId?: number | null;
  rideId?: string | null;
}

async function loadPendingSnapshots(): Promise<LocationSnapshot[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_STORE_KEY);
    return raw ? (JSON.parse(raw) as LocationSnapshot[]) : [];
  } catch {
    return [];
  }
}

async function savePendingSnapshots(snapshots: LocationSnapshot[]): Promise<void> {
  try {
    if (snapshots.length === 0) {
      await AsyncStorage.removeItem(OFFLINE_STORE_KEY);
    } else {
      await AsyncStorage.setItem(OFFLINE_STORE_KEY, JSON.stringify(snapshots));
    }
  } catch {
    // storage write failure is non-fatal
  }
}

function isNetworkError(err: any): boolean {
  return !err?.response;
}

async function flushOfflineSnapshots(): Promise<void> {
  const pending = await loadPendingSnapshots();
  if (pending.length === 0) return;

  try {
    const batch = pending.slice(0, MAX_BATCH_SIZE);
    await api.post('/api/tracking/locations/batch', { locations: batch });
    const remaining = pending.slice(MAX_BATCH_SIZE);
    await savePendingSnapshots(remaining);
    // If there's more than MAX_BATCH_SIZE, they'll be flushed on the next tick
  } catch (err) {
    if (!isNetworkError(err)) {
      // Server rejected the batch (4xx/5xx) — discard to avoid infinite retry loops
      await savePendingSnapshots([]);
    }
    // Network error → keep pending for next attempt
  }
}

async function sendSnapshot(snapshot: LocationSnapshot): Promise<void> {
  await api.post('/api/tracking/location', snapshot);
}

async function getCurrentLocation(): Promise<{
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
} | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      speed: loc.coords.speed ?? null,
      heading: loc.coords.heading ?? null,
      accuracy: loc.coords.accuracy ?? null,
    };
  } catch {
    return null;
  }
}

export function usePassengerTracking({
  isActive,
  tripId = null,
  rideId = null,
}: UsePassengerTrackingOptions): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tripIdRef = useRef(tripId);
  const rideIdRef = useRef(rideId);

  // Keep refs current so the interval closure always has the latest IDs
  useEffect(() => { tripIdRef.current = tripId; }, [tripId]);
  useEffect(() => { rideIdRef.current = rideId; }, [rideId]);

  const tick = useCallback(async () => {
    // First: try to flush any offline-stored snapshots from prior connectivity gaps
    await flushOfflineSnapshots();

    // Then: capture and send the current snapshot
    const coords = await getCurrentLocation();
    if (!coords) return;

    const snapshot: LocationSnapshot = {
      entityType: 'passenger',
      latitude: coords.latitude,
      longitude: coords.longitude,
      speed: coords.speed,
      heading: coords.heading,
      accuracy: coords.accuracy,
      recordedAt: new Date().toISOString(),
      tripId: tripIdRef.current ?? null,
      rideId: rideIdRef.current ?? null,
      isOfflineSync: false,
    };

    try {
      await sendSnapshot(snapshot);
    } catch (err) {
      if (isNetworkError(err)) {
        // Device is offline — persist locally for batch upload when reconnected
        const pending = await loadPendingSnapshots();
        pending.push({ ...snapshot, isOfflineSync: true });
        // Cap stored snapshots to avoid unbounded storage growth
        const trimmed = pending.length > MAX_BATCH_SIZE ? pending.slice(pending.length - MAX_BATCH_SIZE) : pending;
        await savePendingSnapshots(trimmed);
      }
      // Non-network errors (4xx/5xx) are silently dropped — tracking is best-effort
    }
  }, []);

  const stopTracking = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // Flush any remaining offline snapshots now that the trip is ending
    await flushOfflineSnapshots();
  }, []);

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        stopTracking();
      }
      return;
    }

    // Fire immediately on activation, then every 5 minutes
    tick();
    intervalRef.current = setInterval(tick, TRACKING_INTERVAL_MS);

    return () => {
      stopTracking();
    };
  }, [isActive, tick, stopTracking]);
}
