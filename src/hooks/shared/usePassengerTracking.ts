import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../api/client';
import { PASSENGER_LOCATION_TASK } from './backgroundLocationTask';

const TRACKING_INTERVAL_MS = 15 * 1000;
const OFFLINE_STORE_KEY = 'veego_offline_location_snapshots';
const MAX_BATCH_SIZE = 500;
const MAX_OFFLINE_SNAPSHOTS = 50;

interface LocationSnapshot {
  entityType: 'passenger';
  latitude: number;
  longitude: number;
  // speed/heading/accuracy/tripId/rideId are all omitted entirely (not sent
  // as null) when unavailable — the backend schema is `.optional()`, not
  // nullable, and rideId must be numeric.
  speed?: number;
  heading?: number;
  accuracy?: number;
  recordedAt: string;
  tripId?: number;
  rideId?: number;
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

// ── Background task helpers ───────────────────────────────────────────────────
// Extracted as module-level functions so both the activation effect and the
// AppState change handler can start/stop the task without code duplication.

async function startBackgroundTask(): Promise<void> {
  try {
    const available = await TaskManager.isAvailableAsync();
    if (!available) return;
    // Check before requesting — never re-prompt if already decided.
    let fg = (await Location.getForegroundPermissionsAsync()).status;
    if (fg !== 'granted') fg = (await Location.requestForegroundPermissionsAsync()).status;
    if (fg !== 'granted') return;
    let bg = (await Location.getBackgroundPermissionsAsync()).status;
    if (bg === 'undetermined') bg = (await Location.requestBackgroundPermissionsAsync()).status;
    if (bg !== 'granted') return;
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
  } catch {
    // Best-effort; foreground setInterval covers the gap
  }
}

async function stopBackgroundTask(): Promise<void> {
  try {
    const available = await TaskManager.isAvailableAsync();
    if (!available) return;
    const started = await Location.hasStartedLocationUpdatesAsync(PASSENGER_LOCATION_TASK);
    if (started) await Location.stopLocationUpdatesAsync(PASSENGER_LOCATION_TASK);
  } catch (err) {
    console.warn('[usePassengerTracking] Failed to stop background location task:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function flushOfflineSnapshots(): Promise<void> {
  const pending = await loadPendingSnapshots();
  if (pending.length === 0) return;

  try {
    const batch = pending.slice(0, MAX_BATCH_SIZE);
    await api.post('/tracking/locations/batch', { locations: batch });
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
  await api.post('/tracking/location', snapshot);
}

export function usePassengerTracking({
  isActive,
  tripId = null,
  rideId = null,
}: UsePassengerTrackingOptions): void {
  const watchSubRef = useRef<Location.LocationSubscription | null>(null);
  const tripIdRef = useRef(tripId);
  const rideIdRef = useRef(rideId);

  // Keep refs current so the watch callback always sends the latest IDs
  useEffect(() => { tripIdRef.current = tripId; }, [tripId]);
  useEffect(() => { rideIdRef.current = rideId; }, [rideId]);

  // Build + send one snapshot from a single location fix. Runs on each fix the
  // continuous foreground watch below delivers.
  const sendFix = useCallback(async (coords: {
    latitude: number;
    longitude: number;
    speed?: number | null;
    heading?: number | null;
    accuracy?: number | null;
  }) => {
    await flushOfflineSnapshots();

    const snapshot: LocationSnapshot = {
      entityType: 'passenger',
      latitude: coords.latitude,
      longitude: coords.longitude,
      ...(coords.speed != null ? { speed: coords.speed } : {}),
      ...(coords.heading != null ? { heading: coords.heading } : {}),
      ...(coords.accuracy != null ? { accuracy: coords.accuracy } : {}),
      recordedAt: new Date().toISOString(),
      ...(tripIdRef.current != null ? { tripId: tripIdRef.current } : {}),
      ...(rideIdRef.current != null ? { rideId: Number(rideIdRef.current) } : {}),
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

  // Foreground tracking via ONE continuous location subscription, replacing the
  // old 15s setInterval that called getCurrentPositionAsync (a one-shot) every
  // tick. Repeated one-shots made Android's location-use indicator (the dot in
  // the status bar) blink on/off every 15s — the "status bar flickering". A
  // single kept-open subscription holds the indicator steady; timeInterval /
  // distanceInterval pace it to the same ~15s backend cadence.
  const startForegroundWatch = useCallback(async () => {
    if (watchSubRef.current) return; // already watching
    try {
      let fg = (await Location.getForegroundPermissionsAsync()).status;
      if (fg !== 'granted') fg = (await Location.requestForegroundPermissionsAsync()).status;
      if (fg !== 'granted') return;
      // Flush anything buffered offline as soon as foreground tracking resumes.
      await flushOfflineSnapshots();
      watchSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: TRACKING_INTERVAL_MS,
          distanceInterval: 25,
        },
        (loc) => { sendFix(loc.coords); },
      );
    } catch {
      // Best-effort; the background task covers the gap when applicable.
    }
  }, [sendFix]);

  const stopForegroundWatch = useCallback(async () => {
    if (watchSubRef.current) {
      watchSubRef.current.remove();
      watchSubRef.current = null;
    }
    // Flush any remaining offline snapshots now that foreground tracking stops.
    await flushOfflineSnapshots();
  }, []);

  useEffect(() => {
    if (!isActive) {
      stopForegroundWatch();
      // Ensure background task is also stopped when tracking is deactivated.
      (async () => { await stopBackgroundTask(); })();
      return;
    }

    // ── Mode selection: foreground XOR background — never both simultaneously ──
    // The continuous foreground watch and the background task both feed the same
    // /tracking endpoint; running both would double snapshots and waste battery.
    // AppState decides which is appropriate; the change listener swaps them.
    const currentState = AppState.currentState;

    if (currentState === 'active') {
      (async () => { await stopBackgroundTask(); })();
      startForegroundWatch();
    } else {
      stopForegroundWatch();
      (async () => { await startBackgroundTask(); })();
    }

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        // Foreground — stop the background task, start the continuous watch.
        (async () => { await stopBackgroundTask(); })();
        startForegroundWatch();
      } else if (nextState === 'background' || nextState === 'inactive') {
        // Background — stop the watch, hand off to the background task.
        stopForegroundWatch();
        (async () => { await startBackgroundTask(); })();
      }
    });

    return () => {
      sub.remove();
      stopForegroundWatch();
      // Stop background location task on cleanup too. Async IIFE because effect
      // cleanups must return void; a missed stop leaves the task draining battery.
      (async () => { await stopBackgroundTask(); })();
    };
  }, [isActive, startForegroundWatch, stopForegroundWatch]);
}
