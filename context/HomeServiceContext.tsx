import React, { createContext, useContext, useMemo, useState } from 'react';
import type { ServiceType } from '@/context/ServiceControlContext';

/**
 * HomeServiceContext exposes which ride service screen is currently open on the
 * home tab (app/(tabs)/index.tsx), or null when the home tab is showing the
 * shuttle landing / no service is open.
 *
 * The home tab is a container: its pathname is always '/', but internally it can
 * render the shuttle landing OR a CarServiceScreen for car/scooter/delivery.
 * ActiveRideBanner (mounted globally in the root layout) only knows the
 * pathname, so it needs this to decide whether the home tab is actually
 * displaying the active ride. The banner should stay hidden on home ONLY when
 * the open service screen matches the active ride's type; otherwise the ride is
 * not visible and the floating bubble must be shown so the rider can get back
 * into their trip.
 */
type HomeServiceContextType = {
  /** The ride service currently open on the home tab, or null when none. */
  openServiceType: ServiceType | null;
  setOpenServiceType: (t: ServiceType | null) => void;
};

const HomeServiceContext = createContext<HomeServiceContextType>({
  openServiceType: null,
  setOpenServiceType: () => {},
});

export function HomeServiceProvider({ children }: { children: React.ReactNode }) {
  const [openServiceType, setOpenServiceType] = useState<ServiceType | null>(null);
  // Memoized so consumers don't re-render on every provider render — setter is
  // already stable, so the value only changes when openServiceType changes.
  const value = useMemo(
    () => ({ openServiceType, setOpenServiceType }),
    [openServiceType],
  );
  return (
    <HomeServiceContext.Provider value={value}>
      {children}
    </HomeServiceContext.Provider>
  );
}

export function useHomeService() {
  return useContext(HomeServiceContext);
}
