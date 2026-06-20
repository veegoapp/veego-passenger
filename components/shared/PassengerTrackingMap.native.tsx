import React, { useRef, useEffect, useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Polyline, UrlTile, AnimatedRegion, MarkerAnimated } from 'react-native-maps';
import { useTheme } from '@/context/ThemeContext';

interface LatLng {
  latitude: number;
  longitude: number;
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
  driverLocation?: LatLng | null;
  stations?: Station[];
  passengerStationId?: number | null;
  style?: object;
}

const DEFAULT_CENTER: LatLng = { latitude: 30.0444, longitude: 31.2357 };
const FOLLOW_DELTA = { latitudeDelta: 0.015, longitudeDelta: 0.015 };
const TILE_URL = 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';

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
      latitude:       driverLocation.latitude,
      longitude:      driverLocation.longitude,
      latitudeDelta:  0,
      longitudeDelta: 0,
      duration:       800,
      useNativeDriver: false,
    }).start();
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  // ── Camera follow ────────────────────────────────────────────────────────────
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!driverLocation) return;
    mapRef.current?.animateToRegion(
      { latitude: driverLocation.latitude, longitude: driverLocation.longitude, ...FOLLOW_DELTA },
      800,
    );
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  // ── Route polylines ──────────────────────────────────────────────────────────
  const completedCoords = useMemo((): LatLng[] => {
    const done = sorted.filter((s) => s.status === 'completed');
    if (done.length === 0) return [];
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

  // Initial region: start at driver position (or first station / default)
  const initCenter = {
    latitude:  initLat,
    longitude: initLng,
  };

  return (
    <View style={[StyleSheet.absoluteFill, style]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...initCenter, ...FOLLOW_DELTA }}
        mapType="none"
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        scrollEnabled
        zoomEnabled
        pitchEnabled={false}
      >
        <UrlTile urlTemplate={TILE_URL} maximumZ={19} flipY={false} />

        {/* Completed leg — green */}
        {completedCoords.length >= 2 && (
          <Polyline coordinates={completedCoords} strokeColor="#22c55e" strokeWidth={4} />
        )}

        {/* Upcoming leg — blue */}
        {upcomingCoords.length >= 2 && (
          <Polyline coordinates={upcomingCoords} strokeColor="#2563eb" strokeWidth={4} />
        )}

        {/* Fallback line (no stations) */}
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

        {/* Fallback pickup/dropoff when no stations */}
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

        {/* Animated driver / bus marker */}
        {(driverLocation ?? pickup) && (
          <MarkerAnimated
            coordinate={animatedCoord}
            anchor={{ x: 0.5, y: 0.5 }}
            title={t('driver_label')}
          >
            <View style={styles.busMarker}>
              <Text style={styles.busTxt}>🚌</Text>
            </View>
          </MarkerAnimated>
        )}
      </MapView>
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

  busMarker: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#1e293b', borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
  busTxt: { fontSize: 18, lineHeight: 22 },
});
