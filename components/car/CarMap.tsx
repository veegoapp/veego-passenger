import React, { useRef, useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { MapPin, Car, Navigation } from 'lucide-react-native';
import * as Location from 'expo-location';
import { fetchGoogleRoute } from '@/src/utils/googleDirections';

interface Coords { latitude: number; longitude: number }

interface CarMapProps {
  driverLocation?: (Coords & { heading?: number }) | null;
  destCoords?: Coords | null;
  showDriverMarker?: boolean;
  onUserLocation?: (loc: Coords) => void;
}

const CAIRO_DEFAULT: Coords = { latitude: 30.0444, longitude: 31.2357 };

export function CarMap({ driverLocation, destCoords, showDriverMarker, onUserLocation }: CarMapProps) {
  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<Coords>(CAIRO_DEFAULT);
  const onUserLocationRef = useRef(onUserLocation);
  onUserLocationRef.current = onUserLocation;

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords: Coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(coords);
        onUserLocationRef.current?.(coords);
        mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 1000);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const pts: Coords[] = [userLocation];
    if (destCoords) pts.push(destCoords);
    if (showDriverMarker && driverLocation) pts.push(driverLocation);
    if (pts.length < 2) return;
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(pts, {
        edgePadding: { top: 80, right: 60, bottom: 340, left: 60 },
        animated: true,
      });
    }, 400);
  }, [destCoords, showDriverMarker, userLocation]);

  const [routeCoords, setRouteCoords] = useState<Coords[]>([]);
  const routeFetchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!destCoords) {
      setRouteCoords([]);
      routeFetchKeyRef.current = null;
      return;
    }

    // Fetch once per pickup/destination pair (mirrors the shuttle map's
    // "fetch once per trip" behavior) — avoids re-requesting on every
    // unrelated re-render.
    const key = `${userLocation.latitude},${userLocation.longitude}->${destCoords.latitude},${destCoords.longitude}`;
    if (routeFetchKeyRef.current === key) return;
    routeFetchKeyRef.current = key;

    let cancelled = false;
    fetchGoogleRoute(userLocation, [destCoords]).then((result) => {
      if (cancelled) return;
      // Fall back to a straight line if the backend directions request fails
      // or returns no path — keeps the polyline rendering without crashing.
      setRouteCoords(result?.coords?.length ? result.coords : [userLocation, destCoords]);
    });

    return () => { cancelled = true; };
  }, [destCoords, userLocation]);

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{ ...userLocation, latitudeDelta: 0.015, longitudeDelta: 0.015 }}
        showsUserLocation={false}
        // @ts-expect-error react-native-maps@1.20.1 types no longer declare
        // compassEnabled, but the native view still supports and uses it.
        compassEnabled={false}
      >
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor="#111827" strokeWidth={4} />
        )}

        <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.userDot}>
            <View style={styles.userDotInner} />
          </View>
        </Marker>

        {destCoords && (
          <Marker coordinate={destCoords} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.destPin}>
              <MapPin size={13} color="#ffffff" />
            </View>
          </Marker>
        )}

        {showDriverMarker && driverLocation && (
          <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverDot}>
              <Car size={14} color="#ffffff" />
            </View>
          </Marker>
        )}
      </MapView>

      <TouchableOpacity
        style={styles.locBtn}
        onPress={() => mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 600)}
      >
        <Navigation size={18} color="#111827" fill="#111827" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  userDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(17,24,39,0.15)', alignItems: 'center', justifyContent: 'center' },
  userDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#111827' },
  destPin: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
  driverDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  locBtn: {
    position: 'absolute', bottom: 200, right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6,
  },
});
