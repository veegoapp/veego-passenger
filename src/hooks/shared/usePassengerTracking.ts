import { useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../api/client';
import { PASSENGER_LOCATION_TASK } from './backgroundLocationTask';

const TRACKING_INTERVAL_MS = 5 * 60 * 1000;
const OFFLINE_STORE_KEY = 'veego_offline_location_snapshots';
const MAX_BATCH_SIZE = 500;
const MAX_OFFLINE_SNAPSHOTS = 50;

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
    // Purge immediately after successful upload
    await savePendingSnapshots([]);
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
    // First: try to flush any offline-stored snapshots (including those from background task)
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
        if (pending.length >= MAX_OFFLINE_SNAPSHOTS) {
          // Cap exceeded — attempt sync before appending; if offline, drop oldest
          try { await flushOfflineSnapshots(); } catch {}
          const after = await loadPendingSnapshots();
          if (after.length >= MAX_OFFLINE_SNAPSHOTS) {
            after.shift(); // drop oldest if still at cap
          }
          after.push({ ...snapshot, isOfflineSync: true });
          await savePendingSnapshots(after);
        } else {
          pending.push({ ...snapshot, isOfflineSync: true });
          await savePendingSnapshots(pending);
        }
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

    // Start background location task when active (best-effort; falls back to setInterval)
    (async () => {
      try {
        const available = await TaskManager.isAvailableAsync();
        if (available) {
          const { status: fg } = await Location.requestForegroundPermissionsAsync();
          if (fg === 'granted') {
            const { status: bg } = await Location.requestBackgroundPermissionsAsync();
            if (bg === 'granted') {
              const started = await Location.hasStartedLocationUpdatesAsync(PASSENGER_LOCATION_TASK);
              if (!started) {
                await Location.startLocationUpdatesAsync(PASSENGER_LOCATION_TASK, {
                  accuracy: Location.Accuracy.Balanced,
                  timeInterval: TRACKING_INTERVAL_MS,
                  distanceInterval: 200,
                  foregroundService: {
                    notificationTitle: 'VeeGo',
                    notificationBody: 'Tracking your trip location.',
                    notificationColor: '#2d2d42',
                  },
                  activityType: Location.ActivityType.Other,
                  showsBackgroundLocationIndicator: true,
                  pausesUpdatesAutomatically: false,
                });
              }
            }
          }
        }
      } catch {
        // Background task start is best-effort; setInterval handles foreground coverage
      }
    })();

    // Fire immediately on activation, then every 5 minutes (foreground coverage)
    tick();
    intervalRef.current = setInterval(tick, TRACKING_INTERVAL_MS);

    return () => {
      stopTracking();
      // Stop background location task
      TaskManager.isAvailableAsync()
        .then((available) => {
          if (!available) return;
          return Location.hasStartedLocationUpdatesAsync(PASSENGER_LOCATION_TASK)
            .then((started) => {
              if (started) Location.stopLocationUpdatesAsync(PASSENGER_LOCATION_TASK).catch(() => {});
            });
        })
        .catch(() => {});
    };
  }, [isActive, tick, stopTracking]);
}
