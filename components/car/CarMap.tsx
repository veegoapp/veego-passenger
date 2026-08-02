import React, { useRef, useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Marker, MarkerAnimated, AnimatedRegion, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { MapPin, Car, Bike, Package, Navigation } from 'lucide-react-native';
import * as Location from 'expo-location';
import { fetchGoogleRoute } from '@/src/utils/googleDirections';
import { haversineMeters } from '@/src/utils/geoHelpers';
import { NearbyDriversLayer } from './NearbyDriversLayer';
import { SearchingPulse, SEARCHING_PULSE_ANCHOR_Y } from './SearchingPulse';
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
  /** True while actively searching for a driver — layers the ripple/arrow
   *  pulse over the passenger's own-location dot instead of the plain dot. */
  searching?: boolean;
}

const CAIRO_DEFAULT: Coords = { latitude: 30.0444, longitude: 31.2357 };
const ROUTE_REFRESH_INTERVAL_MS = 75_000;
const SIGNIFICANT_MOVE_METERS = 300;

// Wrapped in React.memo: CarServiceScreen re-renders on every driver-location
// tick (from both a 5s REST poll and a live socket writing into one shared
// rideState object), and without this CarMap fully re-rendered in lockstep
// even for state changes that have nothing to do with the map (fare, forms,
// sheets, etc.) since it wasn't memoized at all.
export const CarMap = React.memo(function CarMap({ driverLocation, destCoords, showDriverMarker, onUserLocation, nearbyDrivers, serviceType, searching }: CarMapProps) {
  const { darkMode } = useTheme();
  const mapRef = useRef<MapView>(null);
  // null until the first GPS fix arrives — prevents the map from briefly
  // centering on Cairo before the real position is known (audit: L3).
  const [userLocation, setUserLocation] = useState<Coords | null>(null);
  const onUserLocationRef = useRef(onUserLocation);
  onUserLocationRef.current = onUserLocation;

  // Track map readiness so camera calls are never issued before the native
  // MapView has initialised (silent discards). pendingCameraRef holds the
  // most-recent queued action; a new intent always overwrites the previous
  // one so only the latest camera position fires on map-ready.
  const mapReadyRef = useRef(false);
  const pendingCameraRef = useRef<(() => void) | null>(null);

  // Tracks whether the initial fit-to-driver has been done for the current
  // driver-visible session. Cleared when showDriverMarker becomes false so
  // re-assignment after a cancel triggers a fresh fit.
  const driverFittedRef = useRef(false);

  // Run a camera action immediately if the map is ready; otherwise store it
  // for onMapReady. Later calls overwrite earlier ones — no stale actions.
  const runOrQueueCamera = (action: () => void) => {
    if (mapReadyRef.current) {
      action();
    } else {
      pendingCameraRef.current = action;
    }
  };

  // Animated driver marker — glides between GPS ticks instead of snapping,
  // and rotates to match heading. Mirrors the pattern already used for the
  // shuttle driver marker in PassengerTrackingMap.native.tsx.
  const animatedDriverCoord = useRef(
    new AnimatedRegion({
      latitude: driverLocation?.latitude ?? CAIRO_DEFAULT.latitude,
      longitude: driverLocation?.longitude ?? CAIRO_DEFAULT.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    }),
  ).current;

  // Holds the currently-running marker animation so it can be stopped before
  // the next one starts — prevents skipping caused by queued 800ms animations.
  const driverMarkerAnimRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (!driverLocation) return;
    driverMarkerAnimRef.current?.stop();
    // Cast: AnimatedRegion.timing()'s type incorrectly requires Animated's
    // `toValue` field (from Animated.TimingAnimationConfig); the actual runtime
    // API takes the region-shaped config below. Preserves existing behavior.
    const anim = animatedDriverCoord.timing({
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
      duration: 800,
      useNativeDriver: false,
    } as any);
    driverMarkerAnimRef.current = anim;
    anim.start(() => { driverMarkerAnimRef.current = null; });
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  useEffect(() => {
    (async () => {
      try {
        let status = (await Location.getForegroundPermissionsAsync()).status;
        if (status !== 'granted') {
          status = (await Location.requestForegroundPermissionsAsync()).status;
        }
        if (status !== 'granted') return;
        // High (not Balanced): Balanced accuracy on Android is allowed to
        // resolve from cell/WiFi positioning rather than the GPS chip, which
        // for a whole city commonly collapses to a coarse city-centre point
        // (for Cairo, right around Tahrir) — arrives fast, but wrong enough
        // that a ride can get booked with it as the pickup point before a
        // real GPS fix ever comes in.
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const coords: Coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(coords);
        onUserLocationRef.current?.(coords);
        runOrQueueCamera(() => {
          mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 800);
        });
      } catch (err: any) {
        console.error('[car map] initial location fetch failed', err?.message);
      }
    })();
  }, []);

  useEffect(() => {
    // Searching: tightly frame the passenger's own position; no destination needed.
    if (searching) {
      driverFittedRef.current = false;
      runOrQueueCamera(() => {
        mapRef.current?.animateToRegion(
          { ...userLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 },
          600,
        );
      });
      return;
    }

    if (showDriverMarker && driverLocation) {
      if (!driverFittedRef.current) {
        // First time the driver is visible — fit driver + user + destination.
        driverFittedRef.current = true;
        const pts: Coords[] = [userLocation, driverLocation];
        if (destCoords) pts.push(destCoords);
        runOrQueueCamera(() => {
          mapRef.current?.fitToCoordinates(pts, {
            edgePadding: { top: 80, right: 60, bottom: 340, left: 60 },
            animated: true,
          });
        });
      } else {
        // Already fitted — smoothly follow the driver on subsequent ticks.
        runOrQueueCamera(() => {
          mapRef.current?.animateToRegion(
            { latitude: driverLocation.latitude, longitude: driverLocation.longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 },
            600,
          );
        });
      }
      return;
    }

    // Driver not visible — reset so re-assignment triggers a fresh fit.
    driverFittedRef.current = false;

    const pts: Coords[] = [userLocation];
    if (destCoords) pts.push(destCoords);
    if (pts.length < 2) return;
    runOrQueueCamera(() => {
      mapRef.current?.fitToCoordinates(pts, {
        edgePadding: { top: 80, right: 60, bottom: 340, left: 60 },
        animated: true,
      });
    });
  }, [destCoords, showDriverMarker, driverLocation?.latitude, driverLocation?.longitude, userLocation, searching]);

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
        initialRegion={{ ...CAIRO_DEFAULT, latitudeDelta: 0.015, longitudeDelta: 0.015 }}
        showsUserLocation={false}
        customMapStyle={darkMode ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
        // @ts-expect-error react-native-maps@1.20.1 types no longer declare
        // compassEnabled, but the native view still supports and uses it.
        compassEnabled={false}
        onMapReady={() => {
          mapReadyRef.current = true;
          // Drain any camera action that queued before the map was ready.
          if (pendingCameraRef.current) {
            pendingCameraRef.current();
            pendingCameraRef.current = null;
          }
        }}
      >
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor={darkMode ? '#e5e7eb' : '#111827'} strokeWidth={4} />
        )}

        {searching ? (
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: SEARCHING_PULSE_ANCHOR_Y }} tracksViewChanges>
            <SearchingPulse />
          </Marker>
        ) : (
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.userDot}>
              <View style={styles.userDotInner} />
            </View>
          </Marker>
        )}

        {destCoords && (
          <Marker coordinate={destCoords} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.destPin}>
              <MapPin size={13} color="#ffffff" />
            </View>
          </Marker>
        )}

        {showDriverMarker && driverLocation && (
          <MarkerAnimated
            coordinate={animatedDriverCoord}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={driverLocation.heading ?? 0}
          >
            <View style={styles.driverMarker}>
              <View style={styles.driverArrowHead} />
              <View style={styles.driverDot}>
                {serviceType === 'scooter' ? (
                  <Bike size={14} color="#ffffff" />
                ) : serviceType === 'delivery' ? (
                  <Package size={14} color="#ffffff" />
                ) : (
                  <Car size={14} color="#ffffff" />
                )}
              </View>
            </View>
          </MarkerAnimated>
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
  driverMarker: { alignItems: 'center' },
  driverArrowHead: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: '#2d2d42',
  },
  driverDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2d2d42', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  locBtn: {
    position: 'absolute', bottom: 240, right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6,
  },
});
