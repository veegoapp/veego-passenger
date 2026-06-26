import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useMemo, useRef,
} from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import api from '@/src/api/client';
import { tokenStore } from '@/src/api/client';
import { getSocket, disconnectSocket } from '@/src/api/socket';
import { onAuthEvent } from '@/src/api/authEvents';

export type ServiceType = 'car' | 'shuttle' | 'scooter' | 'delivery';
export type DisplayMode = 'live' | 'coming_soon' | 'unavailable' | 'maintenance';
export type UnavailableAction = 'none' | 'show_message' | 'hide_service';

export interface ServiceControl {
  serviceType: ServiceType;
  isEnabled: boolean;
  displayMode: DisplayMode;
  unavailableMessage: string | null;
  unavailableAction: UnavailableAction;
  activeZoneIds: number[];
  maintenanceEta: string | null;
}

type ServiceControlMap = Partial<Record<ServiceType, ServiceControl>>;

type ServiceControlContextType = {
  services: ServiceControlMap;
  getService: (type: ServiceType) => ServiceControl | null;
  isLoading: boolean;
  userZoneId: number | null;
  isServiceVisibleForZone: (type: ServiceType) => boolean;
  handleServiceTap: (type: ServiceType, onAllow: () => void) => void;
};

const ServiceControlContext = createContext<ServiceControlContextType>({
  services: {},
  getService: () => null,
  isLoading: false,
  userZoneId: null,
  isServiceVisibleForZone: () => true,
  handleServiceTap: () => {},
});

// ─── Zone resolution ──────────────────────────────────────────────────────────

async function resolveUserZoneId(
  latitude: number,
  longitude: number,
): Promise<number | null> {
  try {
    const { data } = await api.get('/zones/locate', {
      params: { lat: latitude, lng: longitude },
      timeout: 8000,
    });
    const id = data?.data?.id ?? data?.id ?? data?.zone_id ?? data?.zoneId ?? null;
    return typeof id === 'number' ? id : null;
  } catch {
    return null;
  }
}

async function fetchUserZoneId(): Promise<number | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return resolveUserZoneId(loc.coords.latitude, loc.coords.longitude);
  } catch {
    return null;
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function ServiceControlProvider({ children }: { children: React.ReactNode }) {
  const [services, setServices] = useState<ServiceControlMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [userZoneId, setUserZoneId] = useState<number | null>(null);

  const socketListenerAttached = useRef(false);
  const isInitializing = useRef(false);
  const isMounted = useRef(true);

  // ── Stable update handler for socket events ───────────────────────────────
  const applyUpdate = useCallback((payload: ServiceControl) => {
    setServices((prev) => ({ ...prev, [payload.serviceType]: payload }));
  }, []);

  // ── Socket lifecycle ──────────────────────────────────────────────────────
  function attachSocket() {
    if (socketListenerAttached.current) return;
    socketListenerAttached.current = true;

    getSocket().then((sock) => {
      sock.on('service:control:changed', applyUpdate);
      console.log('[ServiceControl] socket authenticated successfully');
    }).catch((e) => {
      console.warn('[ServiceControl] socket listener setup failed:', e?.message ?? e);
    });
  }

  function detachSocket() {
    if (!socketListenerAttached.current) return;
    socketListenerAttached.current = false;

    getSocket().then((sock) => {
      sock.off('service:control:changed', applyUpdate);
    }).catch(() => {});
    disconnectSocket();
    console.log('[ServiceControl] socket disconnected');
  }

  // ── Fetch with exponential-backoff retry ──────────────────────────────────
  async function loadWithRetry(attempt = 0): Promise<void> {
    if (!isMounted.current) return;

    if (attempt === 0) {
      console.log('[ServiceControl] service control fetch started');
    }

    try {
      const { data } = await api.get('/services/control', { timeout: 10_000 });
      if (!isMounted.current) return;

      const raw = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
      const map: ServiceControlMap = {};
      (raw as ServiceControl[]).forEach((svc) => { map[svc.serviceType] = svc; });
      setServices(map);
      console.log(`[ServiceControl] service control fetch succeeded — ${raw.length} service(s) loaded`);

      if (isMounted.current) {
        setIsLoading(false);
        isInitializing.current = false;
        attachSocket();
      }
    } catch (e: any) {
      if (!isMounted.current) return;

      if (attempt < 3) {
        const delay = 2000 * Math.pow(2, attempt);
        console.warn(`[ServiceControl] fetch failed (attempt ${attempt + 1}/4), retrying in ${delay}ms…`);
        setTimeout(() => { if (isMounted.current) loadWithRetry(attempt + 1); }, delay);
      } else {
        console.warn('[ServiceControl] failed to load service statuses after 4 attempts:', e?.message ?? e);
        if (isMounted.current) {
          setIsLoading(false);
          isInitializing.current = false;
          attachSocket();
        }
      }
    }
  }

  // ── Public init: call after authentication is confirmed ───────────────────
  function initServiceControl() {
    if (isInitializing.current) return;
    isInitializing.current = true;
    setIsLoading(true);
    loadWithRetry(0);
  }

  // ── Public reset: call on logout ──────────────────────────────────────────
  function resetServiceControl() {
    detachSocket();
    setServices({});
    isInitializing.current = false;
    console.log('[ServiceControl] service control cleared on logout');
  }

  // ── Mount: check for existing token; subscribe to auth events ────────────
  useEffect(() => {
    isMounted.current = true;

    // Returning user — token already in storage from a previous session
    tokenStore.getToken(tokenStore.TOKEN_KEY).then((token) => {
      if (!isMounted.current) return;
      if (token) {
        console.log('[ServiceControl] token detected on mount, initializing…');
        initServiceControl();
      } else {
        console.log('[ServiceControl] no token on mount, waiting for authentication…');
      }
    }).catch(() => {});

    const unsubLogin = onAuthEvent('auth:login', () => {
      if (!isMounted.current) return;
      console.log('[ServiceControl] auth:login received, initializing service control…');
      initServiceControl();
    });

    const unsubLogout = onAuthEvent('auth:logout', () => {
      if (!isMounted.current) return;
      console.log('[ServiceControl] auth:logout received, clearing service control…');
      resetServiceControl();
    });

    return () => {
      isMounted.current = false;
      unsubLogin();
      unsubLogout();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Foreground refresh — single shot, no retry, no socket/auth side-effects ─
  useEffect(() => {
    const appStateRef = { prev: AppState.currentState };
    let isRefreshing = false;

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const wasBackground = appStateRef.prev === 'background' || appStateRef.prev === 'inactive';
      appStateRef.prev = next;

      if (next !== 'active' || !wasBackground) return;
      if (isRefreshing || isInitializing.current || !isMounted.current) return;

      tokenStore.getToken(tokenStore.TOKEN_KEY).then((token) => {
        if (!token || !isMounted.current || isRefreshing || isInitializing.current) return;
        isRefreshing = true;
        console.log('[ServiceControl] app foregrounded — refreshing state');

        api.get('/services/control', { timeout: 10_000 })
          .then(({ data }) => {
            if (!isMounted.current) return;
            const raw = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
            const map: ServiceControlMap = {};
            (raw as ServiceControl[]).forEach((svc) => { map[svc.serviceType] = svc; });
            setServices(map);
            console.log('[ServiceControl] foreground refresh completed');
          })
          .catch(() => {})
          .finally(() => { isRefreshing = false; });
      }).catch(() => {});
    });

    return () => { sub.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resolve user zone on mount (fail open) ────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    fetchUserZoneId()
      .then((id) => { if (!cancelled) setUserZoneId(id); })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  // ── Zone visibility check ─────────────────────────────────────────────────
  const isServiceVisibleForZone = useCallback((type: ServiceType): boolean => {
    const svc = services[type];
    if (!svc) return true;
    if (!svc.activeZoneIds || svc.activeZoneIds.length === 0) return true;
    if (userZoneId === null) return true;
    return svc.activeZoneIds.includes(userZoneId);
  }, [services, userZoneId]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getService = useCallback((type: ServiceType): ServiceControl | null => {
    return services[type] ?? null;
  }, [services]);

  const handleServiceTap = useCallback((type: ServiceType, onAllow: () => void) => {
    if (!isServiceVisibleForZone(type)) return;

    const svc = services[type];
    // No backend data for this service → block (fail closed, never allow without explicit backend permission)
    if (!svc) return;

    if (!svc.isEnabled) return;

    const mode = svc.displayMode;

    if (mode === 'live') {
      onAllow();
      return;
    }

    if (mode === 'coming_soon') return;

    if (mode === 'maintenance') return;

    if (mode === 'unavailable') {
      if (svc.unavailableMessage) {
        Alert.alert('Service Unavailable', svc.unavailableMessage);
      }
      return;
    }

    // Unknown displayMode — fail closed
    console.warn(`[ServiceControl] unknown displayMode "${mode}" for ${type} — blocking tap`);
  }, [services, isServiceVisibleForZone]);

  const value = useMemo(
    () => ({ services, getService, isLoading, userZoneId, isServiceVisibleForZone, handleServiceTap }),
    [services, getService, isLoading, userZoneId, isServiceVisibleForZone, handleServiceTap],
  );

  return (
    <ServiceControlContext.Provider value={value}>
      {children}
    </ServiceControlContext.Provider>
  );
}

export function useServiceControl() {
  return useContext(ServiceControlContext);
}
