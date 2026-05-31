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
  service_type: ServiceType;
  is_enabled: boolean;
  display_mode: DisplayMode;
  unavailable_message: string | null;
  unavailable_action: UnavailableAction;
  active_zone_ids: number[];
  maintenance_eta: string | null;
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

  // ── Fetch service control list on mount ──────────────────────────
  useEffect(() => {
    let cancelled = false;

    api.get('/services/control')
      .then(({ data }) => {
        if (cancelled) return;
        const list: ServiceControl[] = Array.isArray(data.data) ? data.data : [];
        const map: ServiceControlMap = {};
        list.forEach((svc) => { map[svc.service_type] = svc; });
        setServices(map);
      })
      .catch((e) => {
        console.warn('[ServiceControl] Failed to load service statuses:', e?.message ?? e);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

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
  const applyUpdate = useCallback((payload: {
    serviceType: ServiceType;
    isEnabled: boolean;
    displayMode: DisplayMode;
    unavailableMessage: string | null;
    unavailableAction: UnavailableAction;
    activeZoneIds: number[];
    maintenanceEta: string | null;
  }) => {
    setServices((prev) => ({
      ...prev,
      [payload.serviceType]: {
        service_type: payload.serviceType,
        is_enabled: payload.isEnabled,
        display_mode: payload.displayMode,
        unavailable_message: payload.unavailableMessage,
        unavailable_action: payload.unavailableAction,
        active_zone_ids: payload.activeZoneIds,
        maintenance_eta: payload.maintenanceEta,
      },
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
  //   - active_zone_ids is empty  → visible in all zones
  //   - active_zone_ids non-empty + userZoneId unknown → fail open (visible)
  //   - active_zone_ids non-empty + userZoneId known   → visible only if in list
  const isServiceVisibleForZone = useCallback((type: ServiceType): boolean => {
    const svc = services[type];
    if (!svc) return true;
    if (!svc.active_zone_ids || svc.active_zone_ids.length === 0) return true;
    if (userZoneId === null) return true;
    return svc.active_zone_ids.includes(userZoneId);
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

    const mode = svc.display_mode;

    if (mode === 'live' && svc.is_enabled) {
      onAllow();
      return;
    }

    if (mode === 'coming_soon') return;
    if (mode === 'maintenance') return;

    if (mode === 'unavailable' || !svc.is_enabled) {
      const action = svc.unavailable_action;
      if (action === 'hide_service') return;
      if (action === 'none') return;
      if (action === 'show_message' && svc.unavailable_message) {
        Alert.alert('Service Unavailable', svc.unavailable_message);
        return;
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
