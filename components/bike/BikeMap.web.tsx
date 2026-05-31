import { WebMap, MarkerSpec } from '@/components/shared/WebMap.web';
import { BIKE_DESTINATIONS, BIKE_USER_LOCATION } from './bikeMapData';

const PICKUP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
  <circle cx="9" cy="9" r="7" fill="#22c55e" stroke="white" stroke-width="2"/>
</svg>`;

const DROPOFF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
  <circle cx="14" cy="14" r="12" fill="#55c49a" stroke="white" stroke-width="2.5"/>
  <text x="14" y="18.5" text-anchor="middle" fill="white" font-size="10"
    font-family="sans-serif" font-weight="bold">B</text>
  <line x1="14" y1="26" x2="14" y2="34" stroke="#55c49a" stroke-width="2" stroke-linecap="round"/>
</svg>`;

const BIKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="46" viewBox="0 0 38 46">
  <circle cx="19" cy="19" r="17" fill="#55c49a" opacity="0.18"/>
  <circle cx="19" cy="19" r="13" fill="#55c49a" stroke="white" stroke-width="2.5"/>
  <circle cx="12" cy="22" r="4" fill="none" stroke="white" stroke-width="1.5"/>
  <circle cx="26" cy="22" r="4" fill="none" stroke="white" stroke-width="1.5"/>
  <path d="M12 22 L17 14 L22 22 M17 14 L22 14 M22 22 L26 22"
    stroke="white" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="19" cy="12" r="2.5" fill="white"/>
  <line x1="19" y1="32" x2="19" y2="44" stroke="#55c49a" stroke-width="2.2" stroke-linecap="round"/>
</svg>`;

type BikePhase = 'idle' | 'selecting' | 'ride_options' | 'searching' | 'driver_assigned' | 'completed';

interface BikeMapProps {
  phase: BikePhase;
  destination: string | null;
}

export function BikeMap({ destination }: BikeMapProps) {
  const pickupCoords: [number, number] = [
    BIKE_USER_LOCATION.longitude,
    BIKE_USER_LOCATION.latitude,
  ];

  const destEntry = destination ? BIKE_DESTINATIONS[destination] : null;
  const destCoords: [number, number] | null = destEntry
    ? [destEntry.longitude, destEntry.latitude]
    : null;

  const mockBikerCoords: [number, number] = [
    BIKE_USER_LOCATION.longitude + 0.004,
    BIKE_USER_LOCATION.latitude + 0.003,
  ];

  const markers: MarkerSpec[] = [
    {
      lngLat: pickupCoords,
      svg: PICKUP_SVG,
      anchor: 'center',
      popupText: 'Your location',
    },
    {
      lngLat: mockBikerCoords,
      svg: BIKER_SVG,
      anchor: 'bottom',
      popupText: 'Your rider',
      popupOffset: 22,
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

  const routePoints: [number, number][] = destCoords
    ? [mockBikerCoords, pickupCoords, destCoords]
    : [mockBikerCoords, pickupCoords];

  return (
    <WebMap
      center={pickupCoords}
      zoom={14}
      markers={markers}
      routePoints={routePoints}
      routeColor="#55c49a"
    />
  );
}
