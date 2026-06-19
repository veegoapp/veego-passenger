import React, { useRef, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, UrlTile, AnimatedRegion, MarkerAnimated } from 'react-native-maps';

interface LatLng {
  latitude: number;
  longitude: number;
}

export interface TrackingMapProps {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  driverLocation?: LatLng | null;
  style?: object;
}

const DEFAULT_CENTER: LatLng = { latitude: 25.4529, longitude: 30.5523 };
const DELTA = { latitudeDelta: 0.04, longitudeDelta: 0.04 };
const OSM_TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

function centroid(points: LatLng[]): LatLng {
  const n = points.length;
  return {
    latitude: points.reduce((s, p) => s + p.latitude, 0) / n,
    longitude: points.reduce((s, p) => s + p.longitude, 0) / n,
  };
}

export function PassengerTrackingMap({ pickup, dropoff, driverLocation, style }: TrackingMapProps) {
  const animatedCoord = useRef(
    new AnimatedRegion({
      latitude: driverLocation?.latitude ?? pickup?.latitude ?? DEFAULT_CENTER.latitude,
      longitude: driverLocation?.longitude ?? pickup?.longitude ?? DEFAULT_CENTER.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current;

  useEffect(() => {
    if (!driverLocation) return;
    animatedCoord.timing({
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  const center = useMemo(() => {
    const pts = [driverLocation, pickup, dropoff].filter(Boolean) as LatLng[];
    return pts.length > 0 ? centroid(pts) : DEFAULT_CENTER;
  }, [pickup, dropoff, driverLocation]);

  const routeCoords = useMemo(() => {
    const pts: LatLng[] = [];
    if (driverLocation) pts.push(driverLocation);
    if (pickup) pts.push(pickup);
    if (dropoff) pts.push(dropoff);
    return pts;
  }, [pickup, dropoff, driverLocation]);

  return (
    <View style={[StyleSheet.absoluteFill, style]}>
      <MapView
        style={StyleSheet.absoluteFill}
        region={{ ...center, ...DELTA }}
        mapType="none"
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        scrollEnabled={true}
        zoomEnabled={true}
        pitchEnabled={false}
      >
        <UrlTile urlTemplate={OSM_TILE} maximumZ={19} flipY={false} />

        {pickup && (
          <Marker coordinate={pickup} anchor={{ x: 0.5, y: 1 }} title="Pickup">
            <View style={styles.pickupMarker}>
              <View style={styles.markerDot} />
            </View>
          </Marker>
        )}

        {dropoff && (
          <Marker coordinate={dropoff} anchor={{ x: 0.5, y: 1 }} title="Dropoff">
            <View style={styles.dropoffMarker}>
              <View style={styles.markerDot} />
            </View>
          </Marker>
        )}

        {(driverLocation ?? pickup) && (
          <MarkerAnimated
            coordinate={animatedCoord}
            anchor={{ x: 0.5, y: 1 }}
            title="Driver"
          >
            <View style={styles.driverMarker}>
              <View style={styles.driverDot} />
            </View>
          </MarkerAnimated>
        )}

        {routeCoords.length >= 2 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#2563eb"
            strokeWidth={3.5}
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  pickupMarker: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#22c55e',
    borderWidth: 2.5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  dropoffMarker: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#ef4444',
    borderWidth: 2.5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  driverMarker: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#2563eb',
    borderWidth: 2.5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  driverDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#fff',
  },
  markerDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#fff',
  },
});
