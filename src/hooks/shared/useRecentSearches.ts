import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_RECENTS = 5;

type RecentService = 'car' | 'scooter' | 'delivery';

export interface RecentLocation {
  address: string;
  latitude?: number;
  longitude?: number;
}

function key(service: RecentService) {
  return `@veego_recent_${service}_v1`;
}

// Earlier versions persisted a plain string[] (address text only, no
// coordinates) — coerce those into RecentLocation objects so existing saved
// recents keep working unchanged after this upgrade.
function normalize(raw: unknown): RecentLocation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === 'string' ? { address: item } : item))
    .filter((item): item is RecentLocation => !!item && typeof item.address === 'string');
}

export function useRecentSearches(service: RecentService) {
  const [recents, setRecents] = useState<RecentLocation[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(key(service)).then((raw) => {
      if (raw) {
        try { setRecents(normalize(JSON.parse(raw))); } catch {}
      }
    });
  }, [service]);

  const addRecent = useCallback(async (address: string, coords?: { latitude: number; longitude: number }) => {
    setRecents((prev) => {
      const deduped = [
        { address, ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}) },
        ...prev.filter((r) => r.address !== address),
      ].slice(0, MAX_RECENTS);
      AsyncStorage.setItem(key(service), JSON.stringify(deduped));
      return deduped;
    });
  }, [service]);

  const clearRecents = useCallback(async () => {
    setRecents([]);
    await AsyncStorage.removeItem(key(service));
  }, [service]);

  return { recents, addRecent, clearRecents };
}
