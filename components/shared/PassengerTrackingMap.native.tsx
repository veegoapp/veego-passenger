import React, { useRef, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Polyline, AnimatedRegion, MarkerAnimated, PROVIDER_GOOGLE } from 'react-native-maps';
import { Car, Bike as ScooterIcon } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { fetchGoogleRoute } from '@/src/utils/googleDirections';
import { estimateEtaMinutes, haversineMeters } from '@/src/utils/geoHelpers';

interface LatLng {
  latitude: number;
  longitude: number;
}

// Driver location extends LatLng with optional heading from socket
interface DriverLatLng extends LatLng {
  heading?: number;
}

export interface Station {
  id: number;
  name: string;
  order: number;
  latitude: number;
  longitude: number;
  status: 'completed' | 'active' | 'pending';
}

export interface TrackingMapProps {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  driverLocation?: DriverLatLng | null;
  stations?: Station[];
  passengerStationId?: number | null;
  style?: object;
  /** Driver marker icon. Defaults to 'shuttle' (bus) — preserves existing behavior for shuttle tracking. */
  vehicleType?: 'car' | 'scooter' | 'shuttle';
  /** Called whenever the internally-computed ETA changes — lets the parent
   * screen display it without computing its own separate ETA. */
  onEtaChange?: (minutes: number | null) => void;
}

const DEFAULT_CENTER: LatLng = { latitude: 30.0444, longitude: 31.2357 };
const FOLLOW_DELTA = { latitudeDelta: 0.015, longitudeDelta: 0.015 };
// Directions route/ETA refresh cadence — refetch at most this often, or
// sooner if the driver has moved a meaningful distance since the last fetch.
const ROUTE_REFRESH_INTERVAL_MS = 75_000;
const SIGNIFICANT_MOVE_METERS = 300;

function stationFill(status: Station['status']): string {
  if (status === 'completed') return '#22c55e';
  if (status === 'active')    return '#2563eb';
  return '#94a3b8';
}

export function PassengerTrackingMap({
  pickup, dropoff, driverLocation,
  stations = [], passengerStationId, style,
  vehicleType = 'shuttle', onEtaChange,
}: TrackingMapProps) {
  const { t } = useTheme();

  const sorted = useMemo(() => [...stations].sort((a, b) => a.order - b.order), [stations]);

  // ── Driver marker animation ──────────────────────────────────────────────────
  const initLat = driverLocation?.latitude ?? pickup?.latitude ?? DEFAULT_CENTER.latitude;
  const initLng = driverLocation?.longitude ?? pickup?.longitude ?? DEFAULT_CENTER.longitude;

  const animatedCoord = useRef(
    new AnimatedRegion({ latitude: initLat, longitude: initLng, latitudeDelta: 0, longitudeDelta: 0 }),
  ).current;

  useEffect(() => {
    if (!driverLocation) return;
    // Cast: AnimatedRegion.timing()'s type incorrectly requires Animated's
    // `toValue` field (from Animated.TimingAnimationConfig); the actual runtime
    // API takes the region-shaped config below. Preserves existing behavior.
    animatedCoord.timing({
      latitude:        driverLocation.latitude,
      longitude:       driverLocation.longitude,
      latitudeDelta:   0,
      longitudeDelta:  0,
      duration:        800,
      useNativeDriver: false,
    } as any).start();
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  // ── Camera follow ────────────────────────────────────────────────────────────
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!driverLocation) return;
    mapRef.current?.animateToRegion(
      { latitude: driverLocation.latitude, longitude: driverLocation.longitude, ...FOLLOW_DELTA },
      100,
    );
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  // ── ETA/route target station ─────────────────────────────────────────────────
  // The passenger's own boarding station if it's still upcoming; otherwise the
  // next station the bus will reach. Both the Directions route below and the
  // ETA are scoped to "how long until MY stop", not "until the end of the line".
  const targetStation = useMemo(() => {
    const remaining = sorted.filter((s) => s.status !== 'completed');
    if (remaining.length === 0) return null;
    if (passengerStationId != null) {
      const match = remaining.find((s) => s.id === passengerStationId);
      if (match) return match;
    }
    return remaining[0];
  }, [sorted, passengerStationId]);

  const waypointsToTarget = useMemo(() => {
    if (!targetStation) return [];
    const remaining = sorted.filter((s) => s.status !== 'completed');
    const idx = remaining.findIndex((s) => s.id === targetStation.id);
    const upToTarget = idx >= 0 ? remaining.slice(0, idx + 1) : [targetStation];
    return upToTarget.map((s) => ({ latitude: s.latitude, longitude: s.longitude }));
  }, [sorted, targetStation]);

  // ── Google Directions route — refreshed periodically while the trip is live ──
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [routeDurationSeconds, setRouteDurationSeconds] = useState<number | null>(null);
  const lastFetchOriginRef = useRef<LatLng | null>(null);
  const lastFetchAtRef = useRef(0);

  useEffect(() => {
    if (!driverLocation || waypointsToTarget.length === 0) return;

    const now = Date.now();
    const elapsed = now - lastFetchAtRef.current;
    const movedSignificantly = lastFetchOriginRef.current
      ? haversineMeters(lastFetchOriginRef.current, driverLocation) >= SIGNIFICANT_MOVE_METERS
      : true; // always fetch the first time

    if (elapsed < ROUTE_REFRESH_INTERVAL_MS && !movedSignificantly) return;

    lastFetchOriginRef.current = { latitude: driverLocation.latitude, longitude: driverLocation.longitude };
    lastFetchAtRef.current = now;

    fetchGoogleRoute(driverLocation, waypointsToTarget).then((result) => {
      if (result) {
        setRouteCoords(result.coords);
        // Only overwrite the duration when a real one comes back — preserves
        // the previous valid ETA rather than dropping to the haversine
        // fallback if a refresh returns coords but no duration.
        if (result.durationSeconds !== null) {
          setRouteDurationSeconds(result.durationSeconds);
        }
      }
      // On failure, keep whatever route/duration is already in state — the
      // existing straight-line fallback below still renders regardless.
    });
  }, [driverLocation?.latitude, driverLocation?.longitude, waypointsToTarget]);

  // ── ETA ─────────────────────────────────────────────────────────────────────
  // Prefer Google Directions duration (more accurate); fall back to distance-based
  const etaMinutes = useMemo(() => {
    if (routeDurationSeconds !== null) {
      return Math.max(1, Math.ceil(routeDurationSeconds / 60));
    }
    if (!driverLocation || !targetStation) return null;
    return estimateEtaMinutes(driverLocation, targetStation);
  }, [routeDurationSeconds, driverLocation?.latitude, driverLocation?.longitude, targetStation]);

  useEffect(() => {
    onEtaChange?.(etaMinutes);
  }, [etaMinutes, onEtaChange]);

  // ── Straight-line fallback coords (used until Google route loads) ────────────
  const completedCoords = useMemo((): LatLng[] => {
    const done = sorted.filter((s) => s.status === 'completed');
    if (done.length < 2) return [];
    return done.map((s) => ({ latitude: s.latitude, longitude: s.longitude }));
  }, [sorted]);

  const upcomingCoords = useMemo((): LatLng[] => {
    const ahead = sorted.filter((s) => s.status !== 'completed');
    if (ahead.length === 0) return [];
    const pts: LatLng[] = [];
    if (driverLocation) pts.push(driverLocation);
    ahead.forEach((s) => pts.push({ latitude: s.latitude, longitude: s.longitude }));
    return pts;
  }, [sorted, driverLocation]);

  const fallbackCoords = useMemo((): LatLng[] => {
    if (sorted.length > 0) return [];
    const pts: LatLng[] = [];
    if (driverLocation) pts.push(driverLocation);
    if (pickup)         pts.push(pickup);
    if (dropoff)        pts.push(dropoff);
    return pts;
  }, [sorted, driverLocation, pickup, dropoff]);

  const initCenter = { latitude: initLat, longitude: initLng };

  // Heading from socket payload (degrees clockwise from north)
  const heading = driverLocation?.heading ?? 0;

  return (
    <View style={[StyleSheet.absoluteFill, style]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...initCenter, ...FOLLOW_DELTA }}
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        scrollEnabled
        zoomEnabled
        pitchEnabled={false}
      >
        {/* Completed leg — straight line between visited stops (green) */}
        {completedCoords.length >= 2 && (
          <Polyline coordinates={completedCoords} strokeColor="#22c55e" strokeWidth={4} />
        )}

        {/* Upcoming leg — Google road-snapped route, straight-line until loaded */}
        {(routeCoords.length >= 2 ? routeCoords : upcomingCoords).length >= 2 && (
          <Polyline
            coordinates={routeCoords.length >= 2 ? routeCoords : upcomingCoords}
            strokeColor="#2563eb"
            strokeWidth={4}
          />
        )}

        {/* Fallback line when no stations provided */}
        {fallbackCoords.length >= 2 && (
          <Polyline coordinates={fallbackCoords} strokeColor="#2563eb" strokeWidth={3.5} />
        )}

        {/* Station markers */}
        {sorted.map((station) => {
          const isPassenger = passengerStationId != null && station.id === passengerStationId;
          const fill = stationFill(station.status);
          return (
            <Marker
              key={station.id}
              coordinate={{ latitude: station.latitude, longitude: station.longitude }}
              title={station.name}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View
                style={[
                  styles.stationDot,
                  { backgroundColor: fill },
                  isPassenger && styles.passengerRing,
                ]}
              >
                <Text style={styles.stationNum}>{station.order}</Text>
              </View>
            </Marker>
          );
        })}

        {/* Fallback pickup/dropoff markers when no stations */}
        {sorted.length === 0 && pickup && (
          <Marker coordinate={pickup} anchor={{ x: 0.5, y: 1 }} title={t('pickup')}>
            <View style={styles.pickupMarker}><View style={styles.markerDot} /></View>
          </Marker>
        )}
        {sorted.length === 0 && dropoff && (
          <Marker coordinate={dropoff} anchor={{ x: 0.5, y: 1 }} title={t('dropoff')}>
            <View style={styles.dropoffMarker}><View style={styles.markerDot} /></View>
          </Marker>
        )}

        {/* Animated driver marker — rotates according to socket heading */}
        {(driverLocation ?? pickup) && (
          <MarkerAnimated
            coordinate={animatedCoord}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={heading}
            title={t('driver_label')}
          >
            {/* Arrow + body: arrow tip always points in the direction of travel */}
            <View style={styles.busWrapper}>
              <View style={styles.busArrowHead} />
              <View style={styles.busBody}>
                {vehicleType === 'car' ? (
                  <Car size={18} color="#fff" />
                ) : vehicleType === 'scooter' ? (
                  <ScooterIcon size={18} color="#fff" />
                ) : (
                  <Text style={styles.busTxt}>🚌</Text>
                )}
              </View>
            </View>
          </MarkerAnimated>
        )}
      </MapView>

      {/* ETA overlay — rendered above the map, not inside MapView */}
      {etaMinutes !== null && (
        <View style={styles.etaBadge} pointerEvents="none">
          <Text style={styles.etaLabel}>ETA</Text>
          <Text style={styles.etaValue}>{etaMinutes} min</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stationDot: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2.5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  passengerRing: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 3, borderColor: '#f59e0b',
  },
  stationNum: { fontSize: 10, fontWeight: '800', color: '#fff' },

  pickupMarker: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#22c55e', borderWidth: 2.5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  dropoffMarker: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#ef4444', borderWidth: 2.5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  markerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },

  // Bus marker: arrow tip (top) + body (bottom), entire marker rotates with heading
  busWrapper: { alignItems: 'center' },
  busArrowHead: {
    width: 0, height: 0,
    borderLeftWidth: 7, borderRightWidth: 7, borderBottomWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: '#1e293b',
  },
  busBody: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#1e293b', borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
  busTxt: { fontSize: 18, lineHeight: 22 },

  // ETA badge — floats above the map
  etaBadge: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(17,24,39,0.88)',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 24,
  },
  etaLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  etaValue: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});
