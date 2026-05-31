import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useCallback } from 'react';
import { MOCK_DESTINATIONS, USER_LOCATION, DRIVER_LOCATION } from './carMapData';
import { WebMap, makeSvgEl, MarkerSpec } from '@/components/shared/WebMap.web';

export { MOCK_DESTINATIONS, USER_LOCATION, DRIVER_LOCATION };

const PICKUP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
  <circle cx="9" cy="9" r="7" fill="#22c55e" stroke="white" stroke-width="2"/>
</svg>`;

const DROPOFF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
  <circle cx="14" cy="14" r="12" fill="#ef4444" stroke="white" stroke-width="2.5"/>
  <text x="14" y="18.5" text-anchor="middle" fill="white" font-size="11"
    font-family="sans-serif" font-weight="bold">D</text>
  <line x1="14" y1="26" x2="14" y2="34" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
</svg>`;

const DRIVER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="46" viewBox="0 0 38 46">
  <circle cx="19" cy="19" r="17" fill="#2563eb" opacity="0.18"/>
  <circle cx="19" cy="19" r="13" fill="#2563eb" stroke="white" stroke-width="2.5"/>
  <path d="M12 17.5 h14 M15 14 l4 3.5 l4-3.5 M13 21 c0 2.5 2.8 4.5 6 4.5s6-2 6-4.5"
    stroke="white" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <line x1="19" y1="32" x2="19" y2="44" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round"/>
</svg>`;

type Phase = 'idle' | 'selecting' | 'ride_options' | 'searching' | 'driver_assigned' | 'arrived' | 'started' | 'completed';

interface DriverLocation {
  latitude: number;
  longitude: number;
  heading?: number;
}

interface CarMapProps {
  phase: Phase;
  destination: string | null;
  driverLocation?: DriverLocation | null;
}

export function CarMap({ destination, driverLocation }: CarMapProps) {
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const lastUpdateRef = useRef(0);

  const pickupCoords: [number, number] = [USER_LOCATION.longitude, USER_LOCATION.latitude];

  const destCoords: [number, number] | null =
    destination && MOCK_DESTINATIONS[destination]
      ? [MOCK_DESTINATIONS[destination].longitude, MOCK_DESTINATIONS[destination].latitude]
      : null;

  const driverCoords: [number, number] = driverLocation
    ? [driverLocation.longitude, driverLocation.latitude]
    : [DRIVER_LOCATION.longitude, DRIVER_LOCATION.latitude];

  const markers: MarkerSpec[] = [
    {
      lngLat: pickupCoords,
      svg: PICKUP_SVG,
      anchor: 'center',
      popupText: 'Your location',
    },
    ...(destCoords
      ? [{
          lngLat: destCoords,
          svg: DROPOFF_SVG,
          anchor: 'bottom' as const,
          popupText: destination ?? 'Dropoff',
          popupOffset: 22,
        }]
      : []),
  ];

  const routePoints: [number, number][] = [
    driverCoords,
    pickupCoords,
    ...(destCoords ? [destCoords] : []),
  ];

  const handleLoad = useCallback((map: maplibregl.Map) => {
    const el = makeSvgEl(DRIVER_SVG);
    const mk = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat(driverCoords)
      .addTo(map);
    driverMarkerRef.current = mk;
  }, []); // runs once when map loads

  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdateRef.current < 1500) return;
    lastUpdateRef.current = now;
    if (!driverLocation || !driverMarkerRef.current) return;
    driverMarkerRef.current.setLngLat([
      driverLocation.longitude,
      driverLocation.latitude,
    ]);
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  return (
    <WebMap
      center={pickupCoords}
      zoom={13}
      markers={markers}
      routePoints={routePoints}
      routeColor="#2563eb"
      onLoad={handleLoad}
    />
  );
}
