import { useEffect, useRef, useCallback } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../api/client';
// Task registration (TaskManager.defineTask) lives in backgroundLocationTask;
// the specific ride/shuttle task name is passed in per caller so the two flows
// never share a foreground service. Importing the constants there also loads
// that module (registering both tasks) even though callers pass the name in.

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
  /** The background-location task this flow owns. Ride and shuttle pass
   *  different tasks so neither can start/stop the other's foreground service. */
  taskName: string;
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

async function startBackgroundTask(taskName: string): Promise<void> {
  try {
    const available = await TaskManager.isAvailableAsync();
    if (!available) return;
    // Foreground permission is granted at first app open; don't re-prompt.
    const fg = (await Location.getForegroundPermissionsAsync()).status;
    if (fg !== 'granted') return;
    // Do NOT request the "Allow all the time" (background) permission here —
    // by the time this runs the app is already backgrounding, and neither
    // platform can show a request UI at that point anyway. On Android 11+ that
    // request can't show a normal dialog even in the foreground — it dumps the
    // rider into the App-Info settings page mid-ride, which is jarring and
    // confusing (they think the app is re-asking for location), so Android
    // never requests it at all; passenger tracking there is best-effort — if
    // background access was already granted we use the background task as a
    // bonus, otherwise we rely on the foreground watch only. iOS gets an actual
    // chance at "Always Allow": see the proactive request in
    // startForegroundWatch below, which runs while the app is still active.
    const bg = (await Location.getBackgroundPermissionsAsync()).status;
    if (bg !== 'granted') return;
    const started = await Location.hasStartedLocationUpdatesAsync(taskName);
    if (!started) {
      await Location.startLocationUpdatesAsync(taskName, {
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

async function stopBackgroundTask(taskName: string): Promise<void> {
  try {
    const available = await TaskManager.isAvailableAsync();
    if (!available) return;
    const started = await Location.hasStartedLocationUpdatesAsync(taskName);
    if (started) await Location.stopLocationUpdatesAsync(taskName);
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
  taskName,
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

      // iOS only: proactively ask for "Always Allow" while the app is still
      // active, so the background location task (see startBackgroundTask)
      // has a real shot at running once the ride backgrounds. iOS can only
      // present the "Change to Always Allow?" dialog while the app is in the
      // foreground — asking at background time is too late (there's no UI to
      // show), which is why this can't just live in startBackgroundTask.
      // Android is deliberately NOT asked here — see the comment in
      // startBackgroundTask for why. Fire-and-forget: the rider may take a
      // while to respond to the system dialog, and that shouldn't delay the
      // foreground watch (which already has everything it needs) from
      // starting. Declining just leaves tracking on this foreground watch,
      // same as today.
      if (Platform.OS === 'ios') {
        Location.getBackgroundPermissionsAsync()
          .then(({ status }) => {
            if (status !== 'granted') return Location.requestBackgroundPermissionsAsync();
          })
          .catch(() => {});
      }

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
      (async () => { await stopBackgroundTask(taskName); })();
      return;
    }

    // ── Mode selection: foreground XOR background — never both simultaneously ──
    // The continuous foreground watch and the background task both feed the same
    // /tracking endpoint; running both would double snapshots and waste battery.
    //
    // CRITICAL: only a REAL 'background' state starts the foreground-service
    // task. 'inactive' is treated as foreground. On Android, AppState rapidly
    // flaps 'active' ↔ 'inactive' during transient moments (screen recording,
    // the notification shade, a permission/overlay) — and the FG-service
    // notification appearing can itself trigger another blip. Treating
    // 'inactive' as background made that flap start/stop the FG service in a
    // tight loop, which is exactly the status-bar + app-icon flicker (the icon
    // appears/disappears as the notification is posted/cancelled). Only real
    // backgrounding ('background') hands off to the service now.
    const isBackground = (s: AppStateStatus) => s === 'background';
    const currentState = AppState.currentState;

    if (isBackground(currentState)) {
      stopForegroundWatch();
      (async () => { await startBackgroundTask(taskName); })();
    } else {
      (async () => { await stopBackgroundTask(taskName); })();
      startForegroundWatch();
    }

    const sub = AppState.addEventListener('change', (nextState) => {
      if (isBackground(nextState)) {
        // Real background — stop the watch, hand off to the background task.
        stopForegroundWatch();
        (async () => { await startBackgroundTask(taskName); })();
      } else {
        // Foreground (including the transient 'inactive') — keep the continuous
        // watch, ensure no FG service is running. Both calls are no-ops when
        // already in this mode, so an active↔inactive flap causes no churn.
        (async () => { await stopBackgroundTask(taskName); })();
        startForegroundWatch();
      }
    });

    return () => {
      sub.remove();
      stopForegroundWatch();
      // Stop background location task on cleanup too. Async IIFE because effect
      // cleanups must return void; a missed stop leaves the task draining battery.
      (async () => { await stopBackgroundTask(taskName); })();
    };
  }, [isActive, taskName, startForegroundWatch, stopForegroundWatch]);
}
