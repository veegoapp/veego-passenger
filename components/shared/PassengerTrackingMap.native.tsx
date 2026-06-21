import React, { useRef, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Polyline, AnimatedRegion, MarkerAnimated, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTheme } from '@/context/ThemeContext';
import { fetchGoogleRoute } from '@/src/utils/googleDirections';
import { estimateEtaMinutes } from '@/src/utils/geoHelpers';

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
}

const DEFAULT_CENTER: LatLng = { latitude: 30.0444, longitude: 31.2357 };
const FOLLOW_DELTA = { latitudeDelta: 0.015, longitudeDelta: 0.015 };

function stationFill(status: Station['status']): string {
  if (status === 'completed') return '#22c55e';
  if (status === 'active')    return '#2563eb';
  return '#94a3b8';
}

export function PassengerTrackingMap({
  pickup, dropoff, driverLocation,
  stations = [], passengerStationId, style,
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
    animatedCoord.timing({
      latitude:        driverLocation.latitude,
      longitude:       driverLocation.longitude,
      latitudeDelta:   0,
      longitudeDelta:  0,
      duration:        800,
      useNativeDriver: false,
    }).start();
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

  // ── Google Directions route — fetched ONCE when trip initialises ─────────────
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [routeDurationSeconds, setRouteDurationSeconds] = useState<number | null>(null);
  const hasFetchedRouteRef = useRef(false);

  useEffect(() => {
    if (hasFetchedRouteRef.current) return;
    if (!driverLocation || sorted.length === 0) return;

    const remaining = sorted
      .filter((s) => s.status !== 'completed')
      .map((s) => ({ latitude: s.latitude, longitude: s.longitude }));

    if (remaining.length === 0) return;

    hasFetchedRouteRef.current = true;

    fetchGoogleRoute(driverLocation, remaining).then((result) => {
      if (result) {
        setRouteCoords(result.coords);
        if (result.durationSeconds !== null) {
          setRouteDurationSeconds(result.durationSeconds);
        }
      }
    });
  }, [driverLocation?.latitude, driverLocation?.longitude, sorted.length]);

  // ── ETA ─────────────────────────────────────────────────────────────────────
  // Prefer Google Directions duration (more accurate); fall back to distance-based
  const etaMinutes = useMemo(() => {
    if (routeDurationSeconds !== null) {
      return Math.max(1, Math.ceil(routeDurationSeconds / 60));
    }
    if (!driverLocation) return null;
    const nextStation = sorted.find((s) => s.status !== 'completed');
    if (!nextStation) return null;
    return estimateEtaMinutes(driverLocation, nextStation);
  }, [routeDurationSeconds, driverLocation?.latitude, driverLocation?.longitude, sorted]);

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

        {/* Animated bus marker — rotates according to socket heading */}
        {(driverLocation ?? pickup) && (
          <MarkerAnimated
            coordinate={animatedCoord}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={heading}
            title={t('driver_label')}
          >
            {/* Arrow + bus body: arrow tip always points in the direction of travel */}
            <View style={styles.busWrapper}>
              <View style={styles.busArrowHead} />
              <View style={styles.busBody}>
                <Text style={styles.busTxt}>🚌</Text>
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
