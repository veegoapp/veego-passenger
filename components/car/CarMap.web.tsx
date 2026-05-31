import { WebMap, MarkerSpec } from '@/components/shared/WebMap.web';

const USER_LOCATION: [number, number] = [31.2357, 30.0444];
const DRIVER_LOCATION: [number, number] = [31.2290, 30.0390];

const PICKUP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
  <circle cx="9" cy="9" r="7" fill="#22c55e" stroke="white" stroke-width="2"/>
</svg>`;

const DROPOFF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
  <circle cx="14" cy="14" r="12" fill="#ef4444" stroke="white" stroke-width="2.5"/>
  <text x="14" y="18.5" text-anchor="middle" fill="white" font-size="10"
    font-family="sans-serif" font-weight="bold">D</text>
  <line x1="14" y1="26" x2="14" y2="34" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
</svg>`;

const CAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="46" viewBox="0 0 38 46">
  <circle cx="19" cy="19" r="17" fill="#1e1e2e" opacity="0.18"/>
  <circle cx="19" cy="19" r="13" fill="#1e1e2e" stroke="white" stroke-width="2.5"/>
  <rect x="10" y="15" width="18" height="9" rx="3" fill="white" opacity="0.9"/>
  <rect x="12" y="13" width="14" height="5" rx="2" fill="white" opacity="0.7"/>
  <circle cx="13" cy="25" r="2" fill="#1e1e2e"/>
  <circle cx="25" cy="25" r="2" fill="#1e1e2e"/>
  <line x1="19" y1="32" x2="19" y2="44" stroke="#1e1e2e" stroke-width="2.2" stroke-linecap="round"/>
</svg>`;

interface CarMapProps {
  destination?: string | null;
  onClose?: () => void;
}

export function CarMap({ destination }: CarMapProps) {
  const destCoords: [number, number] = [
    USER_LOCATION[0] + 0.004,
    USER_LOCATION[1] + 0.006,
  ];

  const markers: MarkerSpec[] = [
    {
      lngLat: USER_LOCATION,
      svg: PICKUP_SVG,
      anchor: 'center',
      popupText: 'Your location',
    },
    {
      lngLat: DRIVER_LOCATION,
      svg: CAR_SVG,
      anchor: 'bottom',
      popupText: 'Your driver',
      popupOffset: 22,
    },
    ...(destination
      ? [{
          lngLat: destCoords,
          svg: DROPOFF_SVG,
          anchor: 'bottom' as const,
          popupText: destination,
          popupOffset: 22,
        }]
      : []),
  ];

  const routePoints: [number, number][] = destination
    ? [DRIVER_LOCATION, USER_LOCATION, destCoords]
    : [DRIVER_LOCATION, USER_LOCATION];

  return (
    <WebMap
      center={USER_LOCATION}
      zoom={14}
      markers={markers}
      routePoints={routePoints}
      routeColor="#1e1e2e"
    />
  );
}
