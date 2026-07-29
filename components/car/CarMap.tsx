import React, { useRef, useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { MapPin, Car, Bike, Package, Navigation } from 'lucide-react-native';
import * as Location from 'expo-location';
import { fetchGoogleRoute } from '@/src/utils/googleDirections';
import { haversineMeters } from '@/src/utils/geoHelpers';
import { NearbyDriversLayer } from './NearbyDriversLayer';
import type { NearbyDriver } from '@/src/hooks/car/useNearbyDrivers';
import { useTheme } from '@/context/ThemeContext';
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from '@/constants/mapStyles';

interface Coords { latitude: number; longitude: number }

interface CarMapProps {
  driverLocation?: (Coords & { heading?: number }) | null;
  destCoords?: Coords | null;
  showDriverMarker?: boolean;
  onUserLocation?: (loc: Coords) => void;
  /** Pre-booking nearby-driver markers — pass undefined/empty once a real driver is assigned. */
  nearbyDrivers?: NearbyDriver[];
  serviceType?: 'car' | 'scooter' | 'delivery';
}

const CAIRO_DEFAULT: Coords = { latitude: 30.0444, longitude: 31.2357 };
const ROUTE_REFRESH_INTERVAL_MS = 75_000;
const SIGNIFICANT_MOVE_METERS = 300;

// Wrapped in React.memo: CarServiceScreen re-renders on every driver-location
// tick (from both a 5s REST poll and a live socket writing into one shared
// rideState object), and without this CarMap fully re-rendered in lockstep
// even for state changes that have nothing to do with the map (fare, forms,
// sheets, etc.) since it wasn't memoized at all.
export const CarMap = React.memo(function CarMap({ driverLocation, destCoords, showDriverMarker, onUserLocation, nearbyDrivers, serviceType }: CarMapProps) {
  const { darkMode } = useTheme();
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
      } catch (err: any) {
        console.error('[car map] initial location fetch failed', err?.message);
      }
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
  const lastActiveFetchOriginRef = useRef<Coords | null>(null);
  const lastActiveFetchAtRef = useRef(0);
  const activeDestinationKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!destCoords) {
      setRouteCoords([]);
      routeFetchKeyRef.current = null;
      lastActiveFetchOriginRef.current = null;
      lastActiveFetchAtRef.current = 0;
      activeDestinationKeyRef.current = null;
      return;
    }

    // During an active ride, the driver's live position is the route origin.
    // Before a driver is assigned, preserve the existing passenger-origin route.
    const routeOrigin = showDriverMarker && driverLocation ? driverLocation : userLocation;
    const destinationKey = `${destCoords.latitude},${destCoords.longitude}`;

    if (showDriverMarker && driverLocation) {
      const now = Date.now();
      const elapsed = now - lastActiveFetchAtRef.current;
      const movedSignificantly = lastActiveFetchOriginRef.current
        ? haversineMeters(lastActiveFetchOriginRef.current, driverLocation) >= SIGNIFICANT_MOVE_METERS
        : true;
      const destinationChanged = activeDestinationKeyRef.current !== destinationKey;

      // Keep active-ride refreshes bounded while still following meaningful
      // driver movement or a changed destination.
      if (!destinationChanged && elapsed < ROUTE_REFRESH_INTERVAL_MS && !movedSignificantly) return;

      activeDestinationKeyRef.current = destinationKey;
      lastActiveFetchOriginRef.current = { ...driverLocation };
      lastActiveFetchAtRef.current = now;
    } else {
      // Fetch once per pickup/destination pair before a driver is assigned.
      const key = `${userLocation.latitude},${userLocation.longitude}->${destinationKey}`;
      if (routeFetchKeyRef.current === key) return;
      routeFetchKeyRef.current = key;
      activeDestinationKeyRef.current = null;
      lastActiveFetchOriginRef.current = null;
      lastActiveFetchAtRef.current = 0;
    }

    let cancelled = false;
    fetchGoogleRoute(routeOrigin, [destCoords]).then((result) => {
      if (cancelled) return;
      if (result?.coords?.length) {
        setRouteCoords(result.coords);
      } else {
        // Directions fetch failed or returned no coords — fall back to a
        // straight line so the polyline still renders. Log in dev so failures
        // are visible instead of silently drawing a wrong route.
        if (__DEV__) {
          console.warn('[CarMap] fetchGoogleRoute returned no coords — falling back to straight line');
        }
        setRouteCoords([routeOrigin, destCoords]);
      }
    });

    return () => { cancelled = true; };
  }, [destCoords, userLocation, showDriverMarker, driverLocation?.latitude, driverLocation?.longitude]);

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{ ...userLocation, latitudeDelta: 0.015, longitudeDelta: 0.015 }}
        showsUserLocation={false}
        customMapStyle={darkMode ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
        // @ts-expect-error react-native-maps@1.20.1 types no longer declare
        // compassEnabled, but the native view still supports and uses it.
        compassEnabled={false}
      >
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor={darkMode ? '#e5e7eb' : '#111827'} strokeWidth={4} />
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
              {serviceType === 'scooter' ? (
                <Bike size={14} color="#ffffff" />
              ) : serviceType === 'delivery' ? (
                <Package size={14} color="#ffffff" />
              ) : (
                <Car size={14} color="#ffffff" />
              )}
            </View>
          </Marker>
        )}

        {nearbyDrivers && nearbyDrivers.length > 0 && (
          <NearbyDriversLayer drivers={nearbyDrivers} />
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
});

const styles = StyleSheet.create({
  userDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(17,24,39,0.15)', alignItems: 'center', justifyContent: 'center' },
  userDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#111827' },
  destPin: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
  driverDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2d2d42', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  locBtn: {
    position: 'absolute', bottom: 240, right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6,
  },
});
