import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useMemo, useRef,
} from 'react';
import { Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import api from '@/src/api/client';
import { getSocket } from '@/src/api/socket';

export type ServiceType = 'car' | 'shuttle' | 'motorcycle' | 'delivery';
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
  isLoading: true,
  userZoneId: null,
  isServiceVisibleForZone: () => true,
  handleServiceTap: (_type, onAllow) => onAllow(),
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
    // Web uses the browser Geolocation API via expo-location
    if (Platform.OS === 'web') {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 8000,
          maximumAge: 60_000,
        }),
      );
      return resolveUserZoneId(pos.coords.latitude, pos.coords.longitude);
    }

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
  const [isLoading, setIsLoading] = useState(true);
  const [userZoneId, setUserZoneId] = useState<number | null>(null);
  const socketListenerAttached = useRef(false);

  // ── Fetch service control list on mount (with exponential-backoff retry) ──
  useEffect(() => {
    let cancelled = false;

    async function loadWithRetry(attempt = 0): Promise<void> {
      try {
        const { data } = await api.get('/services/control', { timeout: 10_000 });
        if (cancelled) return;
        const raw = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
        const map: ServiceControlMap = {};
        (raw as ServiceControl[]).forEach((svc) => { map[svc.serviceType] = svc; });
        setServices(map);
      } catch (e: any) {
        if (cancelled) return;
        if (attempt < 3) {
          // Retry with backoff: 2s, 4s, 8s
          const delay = 2000 * Math.pow(2, attempt);
          console.warn(`[ServiceControl] Fetch failed (attempt ${attempt + 1}/4), retrying in ${delay}ms…`);
          setTimeout(() => { if (!cancelled) loadWithRetry(attempt + 1); }, delay);
          return;
        }
        console.warn('[ServiceControl] Failed to load service statuses after 4 attempts:', e?.message ?? e);
      } finally {
        if (!cancelled && attempt === 0) {
          // Clear loading state after first attempt regardless of success/fail
          // Retries happen silently in background
          setIsLoading(false);
        }
      }
    }

    loadWithRetry();
    return () => { cancelled = true; };
  }, []);

  // ── Resolve user zone on mount (fail open) ───────────────────────
  useEffect(() => {
    let cancelled = false;

    fetchUserZoneId()
      .then((id) => { if (!cancelled) setUserZoneId(id); })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  // ── Real-time socket updates ─────────────────────────────────────
  const applyUpdate = useCallback((payload: ServiceControl) => {
    setServices((prev) => ({
      ...prev,
      [payload.serviceType]: payload,
    }));
  }, []);

  useEffect(() => {
    if (socketListenerAttached.current) return;
    socketListenerAttached.current = true;

    getSocket().then((socket) => {
      socket.on('service:control:changed', applyUpdate);
    }).catch((e) => {
      console.warn('[ServiceControl] Socket listener setup failed:', e?.message ?? e);
    });

    return () => {
      getSocket().then((socket) => {
        socket.off('service:control:changed', applyUpdate);
      }).catch(() => {});
      socketListenerAttached.current = false;
    };
  }, [applyUpdate]);

  // ── Zone visibility check ────────────────────────────────────────
  // Rules:
  //   - activeZoneIds is empty  → visible in all zones
  //   - activeZoneIds non-empty + userZoneId unknown → fail open (visible)
  //   - activeZoneIds non-empty + userZoneId known   → visible only if in list
  const isServiceVisibleForZone = useCallback((type: ServiceType): boolean => {
    const svc = services[type];
    if (!svc) return true;
    if (!svc.activeZoneIds || svc.activeZoneIds.length === 0) return true;
    if (userZoneId === null) return true;
    return svc.activeZoneIds.includes(userZoneId);
  }, [services, userZoneId]);

  // ── Helpers ──────────────────────────────────────────────────────
  const getService = useCallback((type: ServiceType): ServiceControl | null => {
    return services[type] ?? null;
  }, [services]);

  const handleServiceTap = useCallback((type: ServiceType, onAllow: () => void) => {
    // Zone check first — if not in an active zone, silently block
    if (!isServiceVisibleForZone(type)) return;

    const svc = services[type];
    if (!svc) { onAllow(); return; }

    // isEnabled = false → hidden completely, should never be tappable
    if (!svc.isEnabled) return;

    const mode = svc.displayMode;

    // live → fully available
    if (mode === 'live') {
      onAllow();
      return;
    }

    // coming_soon → disabled, no action
    if (mode === 'coming_soon') return;

    // maintenance → blocked
    if (mode === 'maintenance') return;

    // unavailable → block booking + always show unavailableMessage if present
    if (mode === 'unavailable') {
      if (svc.unavailableMessage) {
        Alert.alert('Service Unavailable', svc.unavailableMessage);
      }
      return;
    }

    onAllow();
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
