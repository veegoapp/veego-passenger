# Google Maps Migration Plan — veego-passenger (Mobile Only)

> **Scope**: Android + iOS (React Native / Expo)
> **Target**: Full Google Maps provider switch + Live ETA + Bus Heading Rotation + Real Route
> **Constraint**: No backend changes. No refactor of unrelated code.

---

## Current State Summary

| File | Current Stack | Issue |
|---|---|---|
| `PassengerTrackingMap.native.tsx` | react-native-maps + CARTO UrlTile | No provider, straight lines, no ETA, no heading |
| `RealMap.native.tsx` | react-native-maps + OSM UrlTile | No provider |
| `CarMap.tsx` | react-native-maps + CARTO UrlTile | No provider |

**All three use `mapType="none"` with custom tile URLs — Google Maps provider is not configured anywhere.**

---

## Phase 0 — Infrastructure (Before Any Code)

### Google Cloud Console — Enable These APIs

```
✅ Maps SDK for Android
✅ Maps SDK for iOS
✅ Directions API
✅ Billing account active
```

### Restrict the API Key

On Google Cloud → Credentials → restrict the key to:
- **Android**: package name + SHA-1 certificate fingerprint
- **iOS**: iOS bundle ID

Never leave the key unrestricted.

### `app.json` — Expo Plugin Config

```json
{
  "expo": {
    "plugins": [
      [
        "expo-maps",
        {
          "android": { "googleMapsApiKey": "AIza..." },
          "ios":     { "googleMapsApiKey": "AIza..." }
        }
      ]
    ]
  }
}
```

This plugin auto-injects the key into `AndroidManifest.xml` and `AppDelegate.mm`.
Do NOT hardcode the key anywhere in source files.

---

## Phase 1 — Provider Switch (Lowest Risk, Start Here)

**Same change in all 3 map files.**

### Before

```tsx
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';

<MapView mapType="none">
  <UrlTile urlTemplate="https://a.basemaps.cartocdn.com/..." />
</MapView>
```

### After

```tsx
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

<MapView provider={PROVIDER_GOOGLE} mapType="standard">
  {/* UrlTile removed — Google provides tiles */}
</MapView>
```

**Files changed in Phase 1:**
- `components/shared/PassengerTrackingMap.native.tsx`
- `components/shared/RealMap.native.tsx`
- `components/car/CarMap.tsx`

**Test after Phase 1**: Map renders with Google tiles, existing markers and polylines still work.

---

## Phase 2 — New Utility Files

### `src/utils/geoHelpers.ts` (~50 lines, new file)

```ts
interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6_371_000;

// Straight-line distance between two coordinates (meters)
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(sin2));
}

// Estimated ETA in minutes — assumes 25 km/h urban average
export function estimateEtaMinutes(driver: LatLng, nextStation: LatLng): number {
  const distanceM = haversineMeters(driver, nextStation);
  const speedMps = 25_000 / 3600; // 25 km/h in m/s
  return Math.ceil(distanceM / speedMps / 60);
}

// Check if driver has deviated from cached route beyond threshold
export function isOffRoute(
  driver: LatLng,
  routeCoords: LatLng[],
  thresholdMeters = 150,
): boolean {
  if (routeCoords.length === 0) return true;
  const minDist = Math.min(
    ...routeCoords.map((pt) => haversineMeters(driver, pt)),
  );
  return minDist > thresholdMeters;
}
```

---

### `src/utils/googleDirections.ts` (~80 lines, new file)

```ts
import { GOOGLE_MAPS_API_KEY } from '@/src/constants/config'; // store key here

interface LatLng {
  latitude: number;
  longitude: number;
}

interface CacheEntry {
  coords: LatLng[];
  fetchedAt: number;
}

const routeCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheKey(origin: LatLng, waypoints: LatLng[]): string {
  const fmt = (p: LatLng) =>
    `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`;
  return [origin, ...waypoints].map(fmt).join('|');
}

// Google encoded polyline decoder
function decodePolyline(encoded: string): LatLng[] {
  const coords: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return coords;
}

export async function fetchGoogleRoute(
  origin: LatLng,
  waypoints: LatLng[],
): Promise<LatLng[] | null> {
  if (waypoints.length === 0) return null;

  const key = cacheKey(origin, waypoints);
  const cached = routeCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.coords;
  }

  const destination = waypoints[waypoints.length - 1];
  const middle = waypoints.slice(0, -1);

  const originStr = `${origin.latitude},${origin.longitude}`;
  const destStr = `${destination.latitude},${destination.longitude}`;
  const waypointsStr = middle
    .map((p) => `${p.latitude},${p.longitude}`)
    .join('|');

  const url =
    `https://maps.googleapis.com/maps/api/directions/json` +
    `?origin=${originStr}` +
    `&destination=${destStr}` +
    (waypointsStr ? `&waypoints=${waypointsStr}` : '') +
    `&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'OK' || !data.routes?.length) return null;

    const encoded = data.routes[0].overview_polyline.points;
    const coords = decodePolyline(encoded);

    routeCache.set(key, { coords, fetchedAt: Date.now() });
    return coords;
  } catch {
    return null;
  }
}
```

---

## Phase 3 — PassengerTrackingMap.native.tsx (Main Target)

### 3.1 — Update TrackingMapProps

```ts
// Before
export interface TrackingMapProps {
  driverLocation?: { latitude: number; longitude: number } | null;
  // ...
}

// After — add heading
export interface TrackingMapProps {
  driverLocation?: { latitude: number; longitude: number; heading?: number } | null;
  // rest unchanged
}
```

### 3.2 — Bus Heading Rotation

```tsx
// Before — no rotation, emoji marker
<MarkerAnimated coordinate={animatedCoord} anchor={{ x: 0.5, y: 0.5 }}>
  <View style={styles.busMarker}>
    <Text style={styles.busTxt}>🚌</Text>
  </View>
</MarkerAnimated>

// After — rotation + directional icon asset
<MarkerAnimated
  coordinate={animatedCoord}
  anchor={{ x: 0.5, y: 0.5 }}
  rotation={driverLocation?.heading ?? 0}
>
  <View style={styles.busMarker}>
    <Image
      source={require('@/assets/bus-arrow.png')}
      style={{ width: 36, height: 36 }}
    />
  </View>
</MarkerAnimated>
```

> **Required asset**: `assets/bus-arrow.png` — top-down bus/arrow icon, transparent background,
> pointing **north (upward)** at 0°. PNG, 72×72px minimum.

### 3.3 — Real Route from Google Directions

Add inside the component:

```tsx
import { fetchGoogleRoute } from '@/src/utils/googleDirections';
import { isOffRoute } from '@/src/utils/geoHelpers';

// New state
const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
const lastFetchRef = useRef<number>(0);
const cachedRouteRef = useRef<LatLng[]>([]);

useEffect(() => {
  if (!driverLocation || sorted.length === 0) return;

  const remaining = sorted
    .filter((s) => s.status !== 'completed')
    .map((s) => ({ latitude: s.latitude, longitude: s.longitude }));

  if (remaining.length === 0) return;

  const now = Date.now();
  const elapsed = now - lastFetchRef.current;

  // Throttle: max one API call per 30 seconds
  if (elapsed < 30_000) return;

  // Skip if driver is still on the cached route
  if (
    cachedRouteRef.current.length > 0 &&
    !isOffRoute(driverLocation, cachedRouteRef.current, 150)
  ) return;

  lastFetchRef.current = now;

  fetchGoogleRoute(driverLocation, remaining).then((coords) => {
    if (coords) {
      setRouteCoords(coords);
      cachedRouteRef.current = coords;
    }
  });
}, [driverLocation?.latitude, driverLocation?.longitude]);
```

Replace the upcoming polyline in JSX:

```tsx
{/* Real routed path — falls back to straight line if API hasn't responded yet */}
{(routeCoords.length >= 2 ? routeCoords : upcomingCoords).length >= 2 && (
  <Polyline
    coordinates={routeCoords.length >= 2 ? routeCoords : upcomingCoords}
    strokeColor="#2563eb"
    strokeWidth={4}
  />
)}
```

### 3.4 — Live ETA Display

```tsx
import { estimateEtaMinutes } from '@/src/utils/geoHelpers';

// Computed ETA — updates with each driver location change
const etaMinutes = useMemo(() => {
  if (!driverLocation) return null;
  const nextStation = sorted.find((s) => s.status !== 'completed');
  if (!nextStation) return null;
  return estimateEtaMinutes(driverLocation, nextStation);
}, [driverLocation?.latitude, driverLocation?.longitude, sorted]);
```

Add ETA badge overlay in JSX (above the MapView, using `position: absolute`):

```tsx
{etaMinutes !== null && (
  <View style={styles.etaBadge} pointerEvents="none">
    <Text style={styles.etaLabel}>ETA</Text>
    <Text style={styles.etaValue}>{etaMinutes} min</Text>
  </View>
)}
```

Add to StyleSheet:

```ts
etaBadge: {
  position: 'absolute',
  top: 16,
  alignSelf: 'center',
  backgroundColor: 'rgba(17,24,39,0.85)',
  borderRadius: 20,
  paddingHorizontal: 18,
  paddingVertical: 8,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  zIndex: 10,
},
etaLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '600' },
etaValue: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
```

---

## Full File Change Summary

| File | Change Type | Lines Affected |
|---|---|---|
| `app.json` | Add Google Maps Expo plugin + API key | ~8 lines |
| `src/utils/geoHelpers.ts` | **New file** | ~50 lines |
| `src/utils/googleDirections.ts` | **New file** | ~80 lines |
| `src/constants/config.ts` | Add `GOOGLE_MAPS_API_KEY` export | ~3 lines |
| `assets/bus-arrow.png` | **New asset** | PNG file |
| `PassengerTrackingMap.native.tsx` | heading + route + ETA | ~60 lines added |
| `RealMap.native.tsx` | provider switch + remove UrlTile | ~5 lines |
| `CarMap.tsx` | provider switch + remove UrlTile | ~5 lines |

**No changes to**: socket layer, BookingContext, useRide, backend, any other screen.

---

## Risks and Limitations

| Risk | Details |
|---|---|
| **Google Play Services** | `PROVIDER_GOOGLE` does not work on Android devices without Google Play Services (e.g. Huawei GMS-free). If your market includes these devices, keep a fallback provider. |
| **Directions API cost** | Each call has a cost. With the 30-second throttle + deviation check, calls are minimized. Monitor usage in the first week post-launch. |
| **ETA accuracy** | Distance-based ETA assumes 25 km/h constant. It will not reflect real traffic. For higher accuracy, use the `duration.value` field from the Directions API response instead of the haversine estimate. |
| **iOS build step** | After adding the Expo plugin, run `npx expo prebuild` and `pod install` before building. |
| **API Key in bundle** | The key is embedded in the app binary. Restrict it on Google Cloud Console to your Android package name + iOS bundle ID immediately after setup. |
| **Heading = 0 on startup** | When `heading` is `undefined` (no movement yet), `rotation` defaults to 0° (north). This is correct behavior. |

---

## Recommended Execution Order

```
Phase 0 → Google Cloud: enable APIs, create key, set restrictions
Phase 1 → Provider switch in all 3 files + test map renders correctly
Phase 2 → Create geoHelpers.ts and googleDirections.ts + unit test independently
Phase 3a → Add heading rotation to PassengerTrackingMap (5 min change, test immediately)
Phase 3b → Add live ETA display
Phase 3c → Add Google Directions route with cache + throttle
```

Each phase is independently testable and deployable.
Phases 1–2 carry zero risk of breaking existing functionality.
Phase 3 changes are scoped entirely to one component file.
