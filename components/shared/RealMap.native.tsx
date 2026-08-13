import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTheme } from '@/context/ThemeContext';
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from '@/constants/mapStyles';
import { fetchGoogleRoute } from '@/src/utils/googleDirections';

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

const DELTA = { latitudeDelta: 0.04, longitudeDelta: 0.04 };

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
  const { t, darkMode } = useTheme();
  const center = useMemo((): LatLng | null => {
    const pts = [pickup, dropoff, driverLocation, ...stationMarkers].filter(Boolean) as LatLng[];
    if (pts.length > 0) return centroid(pts);
    // No Cairo fallback (audit L3) — when no real points are available, omit
    // initialRegion entirely rather than forcing the map to center on Cairo.
    return defaultCenter ?? null;
  }, [pickup, dropoff, driverLocation, stationMarkers, defaultCenter]);

  // Straight line between the available points — shown immediately, then
  // replaced by the real road-following route once fetchGoogleRoute resolves.
  const straightLine = useMemo(() => {
    const pts: LatLng[] = [];
    if (driverLocation) pts.push(driverLocation);
    if (pickup) pts.push(pickup);
    if (dropoff) pts.push(dropoff);
    return pts;
  }, [pickup, dropoff, driverLocation]);

  const [routeCoords, setRouteCoords] = useState<LatLng[]>(straightLine);

  // Fit the visible region to pickup/dropoff (+ driver, when live) so the full
  // route is always framed, instead of relying on a fixed-delta initialRegion.
  const mapRef = useRef<MapView>(null);
  const fitPoints = useMemo(
    () => [pickup, dropoff, driverLocation].filter(Boolean) as LatLng[],
    [pickup, dropoff, driverLocation],
  );
  const fitMap = useCallback(() => {
    if (fitPoints.length < 2) return;
    mapRef.current?.fitToCoordinates(fitPoints, {
      edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
      animated: true,
    });
  }, [fitPoints]);
  useEffect(() => {
    fitMap();
  }, [fitMap]);

  useEffect(() => {
    const origin = driverLocation ?? pickup;
    const dest = driverLocation ? pickup : dropoff;
    if (!origin || !dest) {
      setRouteCoords(straightLine);
      return;
    }
    const waypoints = driverLocation && dropoff ? [dest, dropoff] : [dest];
    let cancelled = false;
    setRouteCoords(straightLine);
    fetchGoogleRoute(origin, waypoints).then((result) => {
      if (cancelled) return;
      if (result?.coords?.length) setRouteCoords(result.coords);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.latitude, pickup?.longitude, dropoff?.latitude, dropoff?.longitude, driverLocation?.latitude, driverLocation?.longitude]);

  return (
    <View style={[StyleSheet.absoluteFillObject, style]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        // Only set initialRegion when we have a real centroid — avoids briefly
        // centering on a hardcoded fallback before real coordinates are available (audit L3).
        {...(center ? { initialRegion: { ...center, ...DELTA } } : {})}
        onMapReady={fitMap}
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        showsBuildings={false}
        customMapStyle={darkMode ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
      >

        {stationMarkers.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.latitude, longitude: s.longitude }}
            title={s.name}
            pinColor="#2563eb"
          />
        ))}

        {pickup && (
          <Marker coordinate={pickup} title={t('pickup')} pinColor="#22c55e" />
        )}

        {dropoff && (
          <Marker coordinate={dropoff} title={t('dropoff')} pinColor="#ef4444" />
        )}

        {driverLocation && (
          <Marker coordinate={driverLocation} title={t('driver_label')} pinColor="#f59e0b" />
        )}

        {routeCoords.length >= 2 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#1A73E8"
            strokeWidth={5}
            lineDashPattern={[8, 4]}
          />
        )}
      </MapView>
    </View>
  );
}
