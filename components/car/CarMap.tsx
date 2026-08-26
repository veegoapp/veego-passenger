import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import MapView, { Marker, MarkerAnimated, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { MapPin, Navigation } from 'lucide-react-native';
import * as Location from 'expo-location';
import { SearchingPulse } from './SearchingPulse';
import { useTheme } from '@/context/ThemeContext';
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from '@/constants/mapStyles';
import { useAnimatedDriverMarker } from '@/hooks/map/useAnimatedDriverMarker';
import { useMapCamera } from '@/hooks/map/useMapCamera';
import { useCameraController } from '@/hooks/map/useCameraController';
import { useGoogleRoute } from '@/hooks/map/useGoogleRoute';
import { useDriverLocationSocket } from '@/hooks/map/useDriverLocationSocket';
import { DriverMarker } from '@/components/shared/DriverMarker';
import { trimRouteToPosition, haversineMeters, estimateEtaMinutes, snapPointToRoute } from '@/src/utils/geoHelpers';

interface Coords { latitude: number; longitude: number }

// How long a one-time overview fit (driver + destination) is held before the
// follow camera glides back in. Long enough to read the context, short enough
// to feel responsive.
const OVERVIEW_HOLD_MS = 1500;

// Horizontal accuracy (metres) below which the passenger's own-location watch
// is considered "settled" — see the userLocation effect below.
const GOOD_ENOUGH_ACCURACY_M = 15;

// Max distance (metres) between the raw GPS fix and the drawn route before
// the rendered dot stops snapping to it — see displayUserLocation below.
const SNAP_TO_ROUTE_MAX_M = 15;

// Same idea for the driver's vehicle marker, but a wider tolerance: a moving
// car's fix drifts more than a standing passenger's, and the route it rides is
// a real road, so we allow a larger sideways correction before giving up and
// showing the raw fix — see displayDriverLocation below.
const DRIVER_SNAP_TO_ROUTE_MAX_M = 30;

// Throttle for the Haversine ETA fallback — mirrors PassengerTrackingMap's
// same constant so the two ETA implementations behave identically.
const ETA_FALLBACK_THROTTLE_MS = 3000;
const ETA_FALLBACK_MOVE_METERS = 50;

interface CarMapProps {
  /** Initial/recovered seed only (e.g. rideState.driverLocation from a REST
   *  poll or ActiveSession snapshot). Once `rideId` is set, live ticks are
   *  read from an internal socket subscription (see useDriverLocationSocket)
   *  — useRide no longer forwards live driver:ride:location ticks itself. */
  driverLocation?: (Coords & { heading?: number }) | null;
  /** Standard ride id — enables the internal live-location subscription. */
  rideId?: string | number | null;
  destCoords?: Coords | null;
  showDriverMarker?: boolean;
  onUserLocation?: (loc: Coords) => void;
  serviceType?: 'car' | 'scooter' | 'delivery';
  /** Assigned driver's vehicle body color (hex), e.g. rideState.driver?.vehicleColorHex.
   *  Passed through to DriverMarker's VehicleIcon; falls back safely when absent. */
  driverColorHex?: string | null;
  /** True while actively searching for a driver — layers the ripple/arrow
   *  pulse over the passenger's own-location dot instead of the plain dot. */
  searching?: boolean;
  /** True once the trip has actually started (passenger is in the vehicle).
   *  Hides the passenger's own-GPS dot so only the driver's vehicle marker
   *  shows — the two are redundant once the passenger is inside the car,
   *  and can visibly drift apart (raw phone GPS vs. the driver's device). */
  hideOwnLocationDot?: boolean;
  /** Called whenever the internally-computed ETA changes — lets the parent
   *  screen display it without computing its own separate ETA. Mirrors
   *  PassengerTrackingMap's onEtaChange so both live-tracking surfaces stay
   *  consistent. */
  onEtaChange?: (minutes: number | null) => void;
}


// Wrapped in React.memo: CarServiceScreen still re-renders on its own state
// changes (fare, forms, sheets, the 5s REST poll, etc.) that have nothing to
// do with the map. Live driver:ride:location ticks no longer flow through
// rideState at all — they're read directly by useDriverLocationSocket below,
// scoped to this component — but the memo still matters for everything else
// CarServiceScreen re-renders on.
export const CarMap = React.memo(function CarMap({ driverLocation: driverLocationSeed, rideId, destCoords, showDriverMarker, onUserLocation, serviceType, driverColorHex, searching, hideOwnLocationDot, onEtaChange }: CarMapProps) {
  const { darkMode, t } = useTheme();

  // CarServiceScreen lives on the home tab and stays mounted (native-stack
  // doesn't unmount screens behind a push) whenever another screen is pushed
  // on top of it — without this guard the map would keep running its live
  // socket subscription, Directions polling, and follow-camera loop while not
  // even visible. Pausing on blur instead of unmounting keeps camera/scroll
  // state intact for when the passenger comes back to this tab.
  const isFocused = useIsFocused();

  // Live-subscribes to the socket itself (seeded from driverLocationSeed) so
  // GPS ticks never bubble a state update up through CarServiceScreen's
  // rideState — only this map/marker subtree re-renders per tick.
  const driverLocation = useDriverLocationSocket({ rideId, seed: driverLocationSeed, enabled: isFocused });

  // mapRef, mapReadyRef, pendingCameraRef, and runOrQueueCamera are provided
  // by useMapCamera. onMapReady is passed directly to <MapView>.
  const { mapRef, mapReadyRef, runOrQueueCamera, onMapReady } = useMapCamera();

  // null until the first GPS fix arrives — prevents the map from briefly
  // centering on Cairo before the real position is known (audit: L3).
  const [userLocation, setUserLocation] = useState<Coords | null>(null);
  const onUserLocationRef = useRef(onUserLocation);
  onUserLocationRef.current = onUserLocation;

  // Tracks whether the initial fit-to-driver has been done for the current
  // driver-visible session. Cleared when showDriverMarker becomes false so
  // re-assignment after a cancel triggers a fresh fit.
  const driverFittedRef = useRef(false);

  // Animated driver marker — glides between GPS ticks instead of snapping.
  // AnimatedRegion creation, stop-before-start guard, and 800 ms timing are
  // handled by useAnimatedDriverMarker. No initialCoords needed — the marker
  // only renders when driverLocation is non-null (guarded by
  // showDriverMarker && driverLocation in JSX). `rotation` drives the
  // MarkerAnimated's heading directly — DriverMarker now renders a top-down
  // car image (front pointing up at 0deg) instead of a symmetrical dot.
  // Active-ride route (driverLocation → destCoords), hoisted above the marker
  // hook so the marker can be snapped onto it. The hook applies the 75 s /
  // 300 m throttle and detects destination changes via targetsKey — equivalent
  // to the original activeDestinationKeyRef + elapsed + movedSignificantly
  // guards. Also consumed by the ETA / route-drawing logic further down.
  const { routeCoords: activeRideRouteCoords, durationSeconds: activeRideDurationSeconds } = useGoogleRoute({
    origin:  driverLocation,
    targets: destCoords ? [destCoords] : [],
    enabled: !!showDriverMarker && !!driverLocation && !!destCoords && isFocused,
  });

  // Snap the driver's live fix onto the road-snapped route so the vehicle icon
  // rides ON the line instead of beside it (raw urban GPS drifts sideways).
  // Falls back to the raw fix when off-route or before a route exists. This
  // feeds the marker + follow camera; the raw driverLocation still drives ETA,
  // route fetching, and camera fits below.
  const displayDriverLocation = useMemo(() => {
    if (!driverLocation) return driverLocation ?? null;
    if (!showDriverMarker || activeRideRouteCoords.length < 2) return driverLocation;
    const snapped = snapPointToRoute(activeRideRouteCoords, driverLocation, DRIVER_SNAP_TO_ROUTE_MAX_M);
    return snapped === driverLocation ? driverLocation : { ...driverLocation, ...snapped };
  }, [driverLocation, showDriverMarker, activeRideRouteCoords]);

  const {
    animatedCoord: animatedDriverCoord,
    rotation: driverRotation,
    headingRef: driverHeadingRef,
    positionRef: driverPositionRef,
  } = useAnimatedDriverMarker({ driverLocation: displayDriverLocation });

  // Phase 3C camera controller — follows the interpolated position + smoothed
  // heading via setCamera (course-up, tilted, fixed zoom). Follow is active
  // only while a driver is visible, we're not in the searching state, and
  // this screen is actually the one on screen.
  const followActive = !!showDriverMarker && !!driverLocation && !searching && isFocused;
  const {
    onPanDrag: onCameraPan,
    onRegionChangeComplete: onCameraRegionChange,
    suspendForOverview,
    resumeFollow,
  } = useCameraController({
    mapRef,
    mapReadyRef,
    positionRef: driverPositionRef,
    headingRef: driverHeadingRef,
    followActive,
  });

  // Once the car image has painted, stop tracking view changes so Android
  // isn't re-rasterising a static-content marker (position/rotation are native
  // Animated props, unaffected by this flag).
  const [carMarkerReady, setCarMarkerReady] = useState(false);
  const onCarMarkerLoad = useCallback(() => setCarMarkerReady(true), []);

  // Holds the timer that resumes follow after a one-time overview fit.
  const overviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runOverviewFit = useCallback((fit: () => void) => {
    suspendForOverview();
    runOrQueueCamera(fit);
    if (overviewTimerRef.current) clearTimeout(overviewTimerRef.current);
    overviewTimerRef.current = setTimeout(() => resumeFollow(), OVERVIEW_HOLD_MS);
  }, [suspendForOverview, runOrQueueCamera, resumeFollow]);
  useEffect(() => () => { if (overviewTimerRef.current) clearTimeout(overviewTimerRef.current); }, []);

  useEffect(() => {
    let cancelled = false;
    let watchSub: Location.LocationSubscription | null = null;
    // Best (lowest) horizontal accuracy in metres seen so far. Until a fix at
    // or under GOOD_ENOUGH_ACCURACY_M has been seen, a later tick is only
    // applied if it improves on the best seen so far — protects against the
    // GPS chip's noisy "cold" first readings (commonly 50m+ off) visibly
    // snapping the dot backward. Once settled, every subsequent tick is
    // applied unconditionally: normal continuous tracking.
    let bestAccuracyM = Infinity;
    let settled = false;

    const applyCoords = (coords: Coords) => {
      if (cancelled) return;
      setUserLocation(coords);
      onUserLocationRef.current?.(coords);
    };

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
        if (cancelled) return;
        const coords: Coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        bestAccuracyM = loc.coords.accuracy ?? Infinity;
        settled = bestAccuracyM <= GOOD_ENOUGH_ACCURACY_M;
        applyCoords(coords);
        runOrQueueCamera(() => {
          mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 800);
        });

        // ── Continuous idle / pre-ride tracking ──────────────────────────
        // This used to be a bounded "refinement window" that stopped itself
        // after 8 seconds (or once accuracy was good enough) — so the
        // passenger's own position froze for the rest of the session the
        // instant that window closed, even while they kept moving. CarMap
        // stays mounted behind other screens pushed on top of the home tab
        // (see the component doc comment above), so in practice that could
        // be most of a session.
        // The subscription now runs for the component's full lifetime,
        // stopped only on unmount below — real continuous tracking, matching
        // how the driver app's own idle-map GPS subscription behaves
        // (useGPSProvider.tsx).
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 5 },
          (update) => {
            const acc = update.coords.accuracy ?? Infinity;
            const next: Coords = { latitude: update.coords.latitude, longitude: update.coords.longitude };
            if (!settled) {
              if (acc > bestAccuracyM) return; // not an improvement yet — ignore
              bestAccuracyM = acc;
              if (acc <= GOOD_ENOUGH_ACCURACY_M) settled = true;
            }
            applyCoords(next);
          },
        );
        // The component may have unmounted while this await was in flight.
        if (cancelled) { sub.remove(); return; }
        watchSub = sub;
      } catch (err: any) {
        console.error('[car map] initial location fetch failed', err?.message);
      }
    })();

    return () => {
      cancelled = true;
      watchSub?.remove();
      watchSub = null;
    };
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
        // First time the driver is visible — one-time overview fit of
        // driver + user + destination, then hand off to the follow camera.
        driverFittedRef.current = true;
        // userLocation may still be null if GPS hasn't resolved; include it
        // only when available rather than letting a null slip into the array.
        const pts: Coords[] = ([userLocation, driverLocation] as (Coords | null)[])
          .filter((p): p is Coords => p !== null);
        if (destCoords) pts.push(destCoords);
        runOverviewFit(() => {
          mapRef.current?.fitToCoordinates(pts, {
            edgePadding: { top: 80, right: 60, bottom: 340, left: 60 },
            animated: true,
          });
        });
      }
      // Subsequent ticks: the camera controller follows the interpolated
      // position + smoothed heading (no per-tick animateToRegion here).
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
    enabled: !showDriverMarker && !!userLocation && !!destCoords && isFocused,
  });

  // ── ETA ─────────────────────────────────────────────────────────────────────
  // Prefer the Google Directions route duration; fall back to a throttled
  // Haversine distance/speed estimate. Mirrors PassengerTrackingMap's ETA
  // logic exactly (driverLocation → destCoords, which is already phase-aware
  // — pickup during driver_assigned/arrived, dropoff during started).
  const etaFallbackCacheRef = useRef<{ value: number | null; atMs: number; lat: number; lng: number } | null>(null);

  const etaMinutes = useMemo(() => {
    if (!showDriverMarker) return null;
    if (activeRideDurationSeconds !== null) {
      etaFallbackCacheRef.current = null; // invalidate — a real route duration is now available
      return Math.max(1, Math.ceil(activeRideDurationSeconds / 60));
    }
    if (!driverLocation || !destCoords) return null;

    const cache = etaFallbackCacheRef.current;
    const now = Date.now();
    if (
      cache &&
      now - cache.atMs < ETA_FALLBACK_THROTTLE_MS &&
      haversineMeters({ latitude: cache.lat, longitude: cache.lng }, driverLocation) < ETA_FALLBACK_MOVE_METERS
    ) {
      return cache.value;
    }

    const value = estimateEtaMinutes(driverLocation, destCoords);
    etaFallbackCacheRef.current = { value, atMs: now, lat: driverLocation.latitude, lng: driverLocation.longitude };
    return value;
  }, [showDriverMarker, activeRideDurationSeconds, driverLocation?.latitude, driverLocation?.longitude, destCoords]);

  useEffect(() => {
    onEtaChange?.(etaMinutes);
  }, [etaMinutes, onEtaChange]);

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

  // Trim the already-traveled segment behind the current position so the
  // drawn line shortens as it moves, instead of staying frozen as the full
  // origin->destination polyline between Directions refetches. Recomputed on
  // every position tick (routeOrigin), independent of the route's own throttle.
  const displayRouteCoords: Coords[] = useMemo(() => {
    if (!routeOrigin || routeCoords.length < 2) return routeCoords;
    return trimRouteToPosition(routeCoords, routeOrigin);
  }, [routeCoords, routeOrigin?.latitude, routeOrigin?.longitude]);

  // Visual-only: when the drawn route starts at the passenger's own position
  // (pre-booking, walking toward the pickup point — no driver assigned yet),
  // snap the RENDERED dot onto the route line if the raw GPS fix is close
  // enough to it. Ordinary urban GPS drift (multipath off buildings) can
  // offset a fix 10-30m sideways, which reads as the dot walking beside the
  // path instead of on it. This never touches `userLocation` itself — the
  // raw fix still drives onUserLocation / the pickup point unmodified; only
  // where the dot is drawn changes.
  const displayUserLocation: Coords | null = useMemo(() => {
    if (!userLocation) return null;
    const routeStartsAtUser = !(showDriverMarker && driverLocation);
    if (!routeStartsAtUser || displayRouteCoords.length < 2) return userLocation;
    const snapped = displayRouteCoords[0];
    return haversineMeters(userLocation, snapped) <= SNAP_TO_ROUTE_MAX_M ? snapped : userLocation;
  }, [userLocation, displayRouteCoords, showDriverMarker, driverLocation]);

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
        pitchEnabled={false}
        showsBuildings={false}
        onMapReady={onMapReady}
        // Follow-camera suspension on user interaction (pan / pinch / rotate).
        onPanDrag={onCameraPan}
        onRegionChangeComplete={onCameraRegionChange}
      >
        {displayRouteCoords.length > 0 && (
          <Polyline coordinates={displayRouteCoords} strokeColor="#4285F4" strokeWidth={4} />
        )}

        {displayUserLocation && !hideOwnLocationDot && (
          <Marker coordinate={displayUserLocation} anchor={{ x: 0.5, y: 0.5 }}>
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
            rotation={driverRotation}
            flat
            tracksViewChanges={!carMarkerReady}
          >
            <DriverMarker vehicleType={serviceType ?? 'car'} colorHex={driverColorHex} onImageLoad={onCarMarkerLoad} />
          </MarkerAnimated>
        )}

      </MapView>

      {/* ETA overlay — rendered above the map, not inside MapView. Same
          badge styling as PassengerTrackingMap's ETA overlay. */}
      {etaMinutes !== null && (
        <View style={styles.etaBadge} pointerEvents="none">
          <Text style={styles.etaLabel}>{t('eta_label')}</Text>
          <Text style={styles.etaValue}>{etaMinutes} {t('min')}</Text>
        </View>
      )}

      {/* Water-drop ripple while searching for a driver. Rendered as a plain
          absolute-positioned overlay (not a MapView Marker) — the "searching"
          camera effect above always centers the map exactly on userLocation,
          so a screen-centered overlay lines up with it without needing a
          continuously self-animating custom Marker view, which react-native-
          maps doesn't render reliably (unlike DriverMarker, whose position is
          animated externally via MarkerAnimated and whose own content is
          static once tracksViewChanges flips off — this needed content that
          animates itself, which the Marker snapshot pipeline doesn't support). */}
      {searching && <SearchingPulse />}

      <TouchableOpacity
        style={styles.locBtn}
        onPress={() => {
          if (!userLocation) return;
          // Manual recenter-on-self: treat as user control so the follow
          // camera yields (it auto-resumes after the idle window).
          if (followActive) onCameraPan();
          // Routed through runOrQueueCamera (like every other camera action in
          // this file) instead of calling mapRef.current?.animateToRegion
          // directly: react-native-maps silently discards camera calls made
          // before the native MapView has finished initialising (see
          // useMapCamera's doc comment), and this button renders and is
          // tappable immediately — a tap in that window previously did
          // nothing, with no feedback, reading as "unresponsive".
          runOrQueueCamera(() => {
            mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 600);
          });
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
  locBtn: {
    position: 'absolute', bottom: 240, right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6,
  },
  // ETA badge — floats above the map. Matches PassengerTrackingMap's styling.
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
