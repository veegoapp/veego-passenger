import React, { useRef, useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Marker, MarkerAnimated, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { MapPin, Navigation } from 'lucide-react-native';
import * as Location from 'expo-location';
import { NearbyDriversLayer } from './NearbyDriversLayer';
import { SearchingPulse, SEARCHING_PULSE_ANCHOR_Y } from './SearchingPulse';
import type { NearbyDriver } from '@/src/hooks/car/useNearbyDrivers';
import { useTheme } from '@/context/ThemeContext';
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from '@/constants/mapStyles';
import { useAnimatedDriverMarker } from '@/hooks/map/useAnimatedDriverMarker';
import { useMapCamera } from '@/hooks/map/useMapCamera';
import { useGoogleRoute } from '@/hooks/map/useGoogleRoute';
import { DriverMarker } from '@/components/shared/DriverMarker';

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

// CAIRO_DEFAULT removed (audit L3) — AnimatedRegion still needs finite init
// numbers, so 0/0 is used below; the marker is never visible without a real
// driverLocation, so these coordinates are never shown to the user.
const ANIMATED_INIT: Coords = { latitude: 0, longitude: 0 };
const ROUTE_REFRESH_INTERVAL_MS = 75_000;
const SIGNIFICANT_MOVE_METERS = 300;

// Wrapped in React.memo: CarServiceScreen re-renders on every driver-location
// tick (from both a 5s REST poll and a live socket writing into one shared
// rideState object), and without this CarMap fully re-rendered in lockstep
// even for state changes that have nothing to do with the map (fare, forms,
// sheets, etc.) since it wasn't memoized at all.
export const CarMap = React.memo(function CarMap({ driverLocation, destCoords, showDriverMarker, onUserLocation, nearbyDrivers, serviceType, searching }: CarMapProps) {
  const { darkMode } = useTheme();

  // mapRef, mapReadyRef, pendingCameraRef, and runOrQueueCamera are provided
  // by useMapCamera. onMapReady is passed directly to <MapView>.
  const { mapRef, runOrQueueCamera, onMapReady } = useMapCamera();

  // null until the first GPS fix arrives — prevents the map from briefly
  // centering on Cairo before the real position is known (audit: L3).
  const [userLocation, setUserLocation] = useState<Coords | null>(null);
  const onUserLocationRef = useRef(onUserLocation);
  onUserLocationRef.current = onUserLocation;

  // Tracks whether the initial fit-to-driver has been done for the current
  // driver-visible session. Cleared when showDriverMarker becomes false so
  // re-assignment after a cancel triggers a fresh fit.
  const driverFittedRef = useRef(false);

  // Animated driver marker — glides between GPS ticks instead of snapping,
  // and rotates to match heading. AnimatedRegion creation, stop-before-start
  // guard, and 800 ms timing are handled by useAnimatedDriverMarker.
  // No initialCoords needed — the marker only renders when driverLocation is
  // non-null (guarded by showDriverMarker && driverLocation in JSX).
  const { animatedCoord: animatedDriverCoord } = useAnimatedDriverMarker({ driverLocation });

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
      if (userLocation) {
        runOrQueueCamera(() => {
          mapRef.current?.animateToRegion(
            { ...userLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 },
            600,
          );
        });
      }
      return;
    }

    if (showDriverMarker && driverLocation) {
      if (!driverFittedRef.current) {
        // First time the driver is visible — fit driver + user + destination.
        driverFittedRef.current = true;
        // userLocation may still be null if GPS hasn't resolved; include it
        // only when available rather than letting a null slip into the array.
        const pts: Coords[] = ([userLocation, driverLocation] as (Coords | null)[])
          .filter((p): p is Coords => p !== null);
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

    // Cannot fit without a known user position — wait for GPS to resolve.
    if (!userLocation) return;
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

  // ── Route fetching ───────────────────────────────────────────────────────────
  //
  // A) Pre-booking: userLocation → destCoords.
  //    Fetches once per origin/destination pair. userLocation is set once by
  //    the GPS effect below and doesn't continuously drift like driverLocation,
  //    so the hook's 300 m movement threshold and targetsKey destination-change
  //    detection are functionally equivalent to the original routeFetchKeyRef
  //    one-time-per-pair guard.
  const { routeCoords: preBookingRouteCoords } = useGoogleRoute({
    origin:  userLocation,
    targets: destCoords ? [destCoords] : [],
    enabled: !showDriverMarker && !!userLocation && !!destCoords,
  });

  // B) Active ride: driverLocation → destCoords.
  //    The hook applies the 75 s / 300 m throttle and detects destination
  //    changes via targetsKey — equivalent to the original
  //    activeDestinationKeyRef + elapsed + movedSignificantly guards.
  const { routeCoords: activeRideRouteCoords } = useGoogleRoute({
    origin:  driverLocation,
    targets: destCoords ? [destCoords] : [],
    enabled: !!showDriverMarker && !!driverLocation && !!destCoords,
  });

  // Unified route — only one path is enabled at a time.
  const hookRouteCoords: Coords[] = showDriverMarker && driverLocation
    ? activeRideRouteCoords
    : preBookingRouteCoords;

  // CarMap-specific straight-line fallback: when Directions returns no coords
  // (fetch in-flight or API failure), always render origin → destination so
  // the passenger never sees a bare map without any route indicator.
  // This preserves the original setRouteCoords([routeOrigin, destCoords]) fallback.
  const routeOrigin: Coords | null = showDriverMarker && driverLocation
    ? driverLocation
    : (userLocation ?? null);
  const routeCoords: Coords[] = hookRouteCoords.length > 0
    ? hookRouteCoords
    : (routeOrigin && destCoords ? [routeOrigin, destCoords] : []);

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        // No initialRegion — map waits for the real GPS fix (animateToRegion fires
        // once location resolves). Avoids briefly centering on Cairo (audit L3).
        showsUserLocation={false}
        customMapStyle={darkMode ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
        // @ts-expect-error react-native-maps@1.20.1 types no longer declare
        // compassEnabled, but the native view still supports and uses it.
        compassEnabled={false}
        onMapReady={onMapReady}
      >
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor={darkMode ? '#e5e7eb' : '#111827'} strokeWidth={4} />
        )}

        {userLocation && (searching ? (
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: SEARCHING_PULSE_ANCHOR_Y }} tracksViewChanges>
            <SearchingPulse />
          </Marker>
        ) : (
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.userDot}>
              <View style={styles.userDotInner} />
            </View>
          </Marker>
        ))}

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
            <DriverMarker vehicleType={serviceType ?? 'car'} />
          </MarkerAnimated>
        )}

        {nearbyDrivers && nearbyDrivers.length > 0 && (
          <NearbyDriversLayer drivers={nearbyDrivers} />
        )}
      </MapView>

      <TouchableOpacity
        style={styles.locBtn}
        onPress={() => {
          if (userLocation) {
            mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 600);
          }
        }}
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
  carMarkerImage: { width: 48, height: 48 },
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
