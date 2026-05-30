import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';

interface LatLng {
  latitude: number;
  longitude: number;
}

interface StationMarker extends LatLng {
  id: string;
  name: string;
}

interface RealMapProps {
  style?: object;
  pickup?: LatLng;
  dropoff?: LatLng;
  driverLocation?: LatLng;
  stationMarkers?: StationMarker[];
  defaultCenter?: LatLng;
}

const CAIRO: LatLng = { latitude: 30.0444, longitude: 31.2357 };
const DELTA = { latitudeDelta: 0.04, longitudeDelta: 0.04 };
const OSM_TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

function centroid(points: LatLng[]): LatLng {
  const n = points.length;
  return {
    latitude: points.reduce((s, p) => s + p.latitude, 0) / n,
    longitude: points.reduce((s, p) => s + p.longitude, 0) / n,
  };
}

export function RealMap({
  style,
  pickup,
  dropoff,
  driverLocation,
  stationMarkers = [],
  defaultCenter,
}: RealMapProps) {
  const center = useMemo(() => {
    const pts = [pickup, dropoff, driverLocation, ...stationMarkers].filter(Boolean) as LatLng[];
    if (pts.length > 0) return centroid(pts);
    return defaultCenter ?? CAIRO;
  }, [pickup, dropoff, driverLocation, stationMarkers, defaultCenter]);

  const routeCoords = useMemo(() => {
    const pts: LatLng[] = [];
    if (driverLocation) pts.push(driverLocation);
    if (pickup) pts.push(pickup);
    if (dropoff) pts.push(dropoff);
    return pts;
  }, [pickup, dropoff, driverLocation]);

  return (
    <View style={[StyleSheet.absoluteFillObject, style]}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={{ ...center, ...DELTA }}
        region={{ ...center, ...DELTA }}
        mapType="none"
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
      >
        <UrlTile
          urlTemplate={OSM_TILE}
          maximumZ={19}
          flipY={false}
        />

        {stationMarkers.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.latitude, longitude: s.longitude }}
            title={s.name}
            pinColor="#2563eb"
          />
        ))}

        {pickup && (
          <Marker coordinate={pickup} title="Pickup" pinColor="#22c55e" />
        )}

        {dropoff && (
          <Marker coordinate={dropoff} title="Dropoff" pinColor="#ef4444" />
        )}

        {driverLocation && (
          <Marker coordinate={driverLocation} title="Driver" pinColor="#f59e0b" />
        )}

        {routeCoords.length >= 2 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#2563eb"
            strokeWidth={3}
            lineDashPattern={[8, 4]}
          />
        )}
      </MapView>
    </View>
  );
}
