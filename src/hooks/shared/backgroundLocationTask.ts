import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const PASSENGER_LOCATION_TASK = 'veego-passenger-bg-location';

const OFFLINE_STORE_KEY = 'veego_offline_location_snapshots';
const MAX_OFFLINE_SNAPSHOTS = 50;

TaskManager.defineTask(
  PASSENGER_LOCATION_TASK,
  async ({
    data,
    error,
  }: TaskManager.TaskManagerTaskBody<{ locations: Location.LocationObject[] }>) => {
    if (error || !data?.locations?.[0]) return;
    const { latitude, longitude, speed, heading, accuracy } = data.locations[0].coords;

    const snapshot = {
      entityType: 'passenger' as const,
      latitude,
      longitude,
      speed: speed ?? null,
      heading: heading ?? null,
      accuracy: accuracy ?? null,
      recordedAt: new Date().toISOString(),
      tripId: null,
      rideId: null,
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
  },
);
