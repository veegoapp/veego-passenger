import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
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
  handleServiceTap: (type: ServiceType, onAllow: () => void) => void;
};

const ServiceControlContext = createContext<ServiceControlContextType>({
  services: {},
  getService: () => null,
  isLoading: true,
  handleServiceTap: (_type, onAllow) => onAllow(),
});

export function ServiceControlProvider({ children }: { children: React.ReactNode }) {
  const [services, setServices] = useState<ServiceControlMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const socketListenerAttached = useRef(false);

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

  const getService = useCallback((type: ServiceType): ServiceControl | null => {
    return services[type] ?? null;
  }, [services]);

  const handleServiceTap = useCallback((type: ServiceType, onAllow: () => void) => {
    const svc = services[type];
    if (!svc) { onAllow(); return; }

    const effectiveAction = !svc.is_enabled ? svc.unavailable_action : null;
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
  }, [services]);

  const value = useMemo(
    () => ({ services, getService, isLoading, handleServiceTap }),
    [services, getService, isLoading, handleServiceTap]
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
