import { useState, useEffect, useRef } from 'react';
import { getEnabledTripRequestRoutes } from '@/src/api/shuttleService';

interface Result {
  enabledIds: Set<number>;
  loading: boolean;
}

/**
 * Fetches the list of routes where trip requests are enabled
 * (GET /api/trip-requests/enabled-routes) and exposes them as a Set
 * of numeric IDs for O(1) lookup.
 *
 * The fetch runs once on mount. Errors are swallowed silently — the
 * button simply won't appear if the call fails.
 */
export function useEnabledTripRequestRoutes(): Result {
  const [enabledIds, setEnabledIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    getEnabledTripRequestRoutes()
      .then(setEnabledIds)
      .catch(() => setEnabledIds(new Set()))
      .finally(() => setLoading(false));
  }, []);

  return { enabledIds, loading };
}
