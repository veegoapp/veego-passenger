import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Ride and shuttle are treated as fully independent flows: each owns its OWN
// background-location task (and therefore its own foreground service), so one
// can never start or stop the other's tracking. They still share the offline
// snapshot buffer below — snapshots carry rideId/tripId, so a single buffer is
// unambiguous and is only a best-effort store-and-forward for lost network.
export const PASSENGER_RIDE_LOCATION_TASK = 'veego-passenger-ride-bg-location';
export const PASSENGER_SHUTTLE_LOCATION_TASK = 'veego-passenger-shuttle-bg-location';

const OFFLINE_STORE_KEY = 'veego_offline_location_snapshots';
const MAX_OFFLINE_SNAPSHOTS = 50;

type LocationTaskBody = TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>;

// Shared handler — both tasks buffer fixes identically for later upload.
async function handleBackgroundFix({ data, error }: LocationTaskBody): Promise<void> {
  if (error || !data?.locations?.[0]) return;
  const { latitude, longitude, speed, heading, accuracy } = data.locations[0].coords;

  const snapshot = {
    entityType: 'passenger' as const,
    latitude,
    longitude,
    // speed/heading/accuracy/tripId/rideId intentionally omitted (not sent
    // as null) when unavailable — the backend schema field is optional,
    // not nullable.
    ...(speed != null ? { speed } : {}),
    ...(heading != null ? { heading } : {}),
    ...(accuracy != null ? { accuracy } : {}),
    recordedAt: new Date().toISOString(),
    isOfflineSync: true,
  };

  try {
    const raw = await AsyncStorage.getItem(OFFLINE_STORE_KEY);
    const existing = (raw ? JSON.parse(raw) : []) as unknown[];
    if (existing.length >= MAX_OFFLINE_SNAPSHOTS) {
      existing.shift();
    }
    existing.push(snapshot);
    await AsyncStorage.setItem(OFFLINE_STORE_KEY, JSON.stringify(existing));
  } catch {
    // AsyncStorage failure in background is non-fatal
  }
}

TaskManager.defineTask(PASSENGER_RIDE_LOCATION_TASK, handleBackgroundFix);
TaskManager.defineTask(PASSENGER_SHUTTLE_LOCATION_TASK, handleBackgroundFix);
