import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_RECENTS = 5;

type RecentService = 'car' | 'scooter' | 'delivery';

function key(service: RecentService) {
  return `@veego_recent_${service}_v1`;
}

export function useRecentSearches(service: RecentService) {
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(key(service)).then((raw) => {
      if (raw) {
        try { setRecents(JSON.parse(raw)); } catch {}
      }
    });
  }, [service]);

  const addRecent = useCallback(async (location: string) => {
    setRecents((prev) => {
      const deduped = [location, ...prev.filter((r) => r !== location)].slice(0, MAX_RECENTS);
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
