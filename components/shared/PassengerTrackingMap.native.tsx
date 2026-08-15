import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline, MarkerAnimated, PROVIDER_GOOGLE } from 'react-native-maps';
import { Navigation } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from '@/constants/mapStyles';
import { estimateEtaMinutes, haversineMeters } from '@/src/utils/geoHelpers';
import { useAnimatedDriverMarker } from '@/hooks/map/useAnimatedDriverMarker';
import { useMapCamera } from '@/hooks/map/useMapCamera';
import { useCameraController } from '@/hooks/map/useCameraController';
import { useGoogleRoute } from '@/hooks/map/useGoogleRoute';
import { useDriverLocationSocket } from '@/hooks/map/useDriverLocationSocket';
import { DriverMarker } from '@/components/shared/DriverMarker';

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
  /** Carried through for callers that pre-filter by direction; unused internally
   *  (this component receives an already direction-scoped list from its caller). */
  direction?: 'outbound' | 'return';
}

export interface TrackingMapProps {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  /** Shuttle path: the live driver position, owned by the caller's own hook.
   *  Standard-ride path: only used as the initial/recovered seed — once
   *  `rideId` is provided, live ticks are read from a socket subscription
   *  owned internally by this component (see useDriverLocationSocket). */
  driverLocation?: DriverLatLng | null;
  /** Standard ride (car/scooter/delivery) id. When set, this component
   *  subscribes to `ride:driver_location` itself so live location ticks
   *  never bubble a state update up to the caller's screen — only this
   *  map/marker subtree re-renders on each tick. Omitted for shuttle. */
  rideId?: string | number | null;
  stations?: Station[];
  passengerStationId?: number | null;
  style?: object;
  /** Driver marker icon. Defaults to 'shuttle' (generic bus fallback) —
   *  callers tracking a shuttle trip should pass the trip's actual
   *  'hiace' (14-seat microbus) or 'minibus' (28-seat) vehicleType instead,
   *  once known, so the correct bus size renders. */
  vehicleType?: 'car' | 'scooter' | 'shuttle' | 'hiace' | 'minibus';
  /** Assigned driver's vehicle body color (hex). Passed through to
   *  DriverMarker's VehicleIcon; falls back safely when absent. */
  driverColorHex?: string | null;
  /** Called whenever the internally-computed ETA changes — lets the parent
   * screen display it without computing its own separate ETA. */
  onEtaChange?: (minutes: number | null) => void;
  /** Current trip phase for car/scooter/delivery rides. Controls route target
   * and ETA reference point. Ignored when stations are present (shuttle path). */
  tripPhase?: 'driver_arriving' | 'trip_started' | null;
  /** Whether the passenger has boarded the shuttle. Controls which stations are
   * visible: before boarding = up to boarding stop; after = remaining stops only.
   * Ignored for car/scooter/delivery (no stations). */
  boarded?: boolean;
  /** Called whenever the shuttle's current target station changes (next stop).
   * Fired only when stations are present; null when no target exists. */
  onTargetStationChange?: (station: Station | null) => void;
}

// DEFAULT_CENTER (Cairo) removed (audit L3) — AnimatedRegion init uses 0/0,
// which is never displayed since the marker requires a real driverLocation.
const FOLLOW_DELTA = { latitudeDelta: 0.015, longitudeDelta: 0.015 };
// How long a one-time overview fit (driver + target) is held before the follow
// camera glides back in.
const OVERVIEW_HOLD_MS = 1500;
// ROUTE_REFRESH_INTERVAL_MS and SIGNIFICANT_MOVE_METERS were inlined here
// previously; they are now owned and exported by useGoogleRoute.
// Throttle for the Haversine ETA fallback — bounds recomputation while the
// Google route hasn't loaded (or failed), independent of GPS tick rate.
const ETA_FALLBACK_THROTTLE_MS = 3000;
const ETA_FALLBACK_MOVE_METERS = 50;

function stationFill(status: Station['status']): string {
  if (status === 'completed') return '#22c55e';
  if (status === 'active')    return '#2563eb';
  return '#94a3b8';
}

// Wrapped in React.memo: the trip-tracking screen re-renders on every
// driver-location socket tick, and without this the map fully re-rendered
// in lockstep even for state changes elsewhere on the screen (top bar,
// status pill, bottom card) that have nothing to do with the map itself.
export const PassengerTrackingMap = React.memo(function PassengerTrackingMap({
  pickup, dropoff, driverLocation: driverLocationSeed, rideId,
  stations = [], passengerStationId, style,
  vehicleType = 'shuttle', driverColorHex, onEtaChange,
  tripPhase = null,
  boarded = false,
  onTargetStationChange,
}: TrackingMapProps) {
  const { t, darkMode } = useTheme();

  // Standard ride: live-subscribes to the socket itself, seeded from
  // `driverLocationSeed` (session recovery / deep-link). Shuttle (no rideId)
  // just mirrors whatever the caller passes in `driverLocation` — unchanged
  // behavior for that path.
  const driverLocation = useDriverLocationSocket({ rideId, seed: driverLocationSeed });

  const sorted = useMemo(() => [...stations].sort((a, b) => a.order - b.order), [stations]);

  // ── Passenger-aware station filtering (shuttle only) ─────────────────────────
  // Before boarding: show stations from the start up to and including the
  // passenger's boarding station — hide irrelevant stops further down the line.
  // After boarding:  show only the remaining stops after the boarding station,
  // dropping completed stops as the bus passes through them.
  const visibleStations = useMemo(() => {
    if (sorted.length === 0 || passengerStationId == null) return sorted;
    const boardingIdx = sorted.findIndex((s) => s.id === passengerStationId);
    if (boardingIdx === -1) return sorted;
    if (!boarded) {
      // Before boarding — clip at (and including) the passenger's stop
      return sorted.slice(0, boardingIdx + 1);
    }
    // After boarding — show remaining stops ahead; hide completed ones behind
    return sorted.slice(boardingIdx + 1).filter((s) => s.status !== 'completed');
  }, [sorted, passengerStationId, boarded]);

  // ── Driver marker animation ──────────────────────────────────────────────────
  // AnimatedRegion creation, stop-before-start guard, and 800 ms timing are
  // all handled by useAnimatedDriverMarker. pickup is passed as initialCoords
  // so the region seeds at the pickup point when driverLocation is not yet
  // available — matching the previous initLat/initLng fallback logic. The
  // hook's own `rotation` output is unused here — the marker is a
  // symmetrical dot (see DriverMarker) that doesn't rotate with heading;
  // heading is still consumed via headingRef below, for the follow camera.
  const {
    animatedCoord,
    headingRef: driverHeadingRef,
    positionRef: driverPositionRef,
  } = useAnimatedDriverMarker({ driverLocation, initialCoords: pickup });

  // ── Camera follow ────────────────────────────────────────────────────────────
  // mapRef, mapReadyRef, pendingCameraRef, and runOrQueueCamera are all
  // provided by useMapCamera. onMapReady is passed directly to <MapView>.
  const { mapRef, mapReadyRef, runOrQueueCamera, onMapReady } = useMapCamera();

  // Phase 3C follow camera — follows the interpolated position + smoothed
  // heading via setCamera (course-up, tilted, fixed zoom). Follow is active
  // while a driver position is known and there's an active phase or shuttle.
  const followActive = !!driverLocation && (!!tripPhase || sorted.length > 0);
  const {
    isSuspended: cameraSuspended,
    onPanDrag: onCameraPan,
    onRegionChangeComplete: onCameraRegionChange,
    recenter: cameraRecenter,
    suspendForOverview,
    resumeFollow,
  } = useCameraController({
    mapRef,
    mapReadyRef,
    positionRef: driverPositionRef,
    headingRef: driverHeadingRef,
    followActive,
  });

  // Edge-padding for fitToCoordinates (used only on initial load / phase change).
  const FIT_PADDING = { top: 120, right: 60, bottom: 280, left: 60 } as const;

  // Once the car image has painted, stop tracking view changes so Android
  // isn't re-rasterising a static-content marker (position/rotation are native
  // Animated props, unaffected by this flag).
  const [carMarkerReady, setCarMarkerReady] = useState(false);
  const onCarMarkerLoad = useCallback(() => setCarMarkerReady(true), []);

  // One-time overview fit → hold → hand back to the follow camera.
  const overviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runOverviewFit = useCallback((fit: () => void) => {
    suspendForOverview();
    runOrQueueCamera(fit);
    if (overviewTimerRef.current) clearTimeout(overviewTimerRef.current);
    overviewTimerRef.current = setTimeout(() => resumeFollow(), OVERVIEW_HOLD_MS);
  }, [suspendForOverview, runOrQueueCamera, resumeFollow]);
  useEffect(() => () => { if (overviewTimerRef.current) clearTimeout(overviewTimerRef.current); }, []);

  // Track whether we've done the initial fit for the current phase so we don't
  // re-fit on every GPS tick (that causes constant re-zooming, unlike Uber).
  const fittedPhaseRef = useRef<string | null>(null);
  const fittedShuttleTargetRef = useRef<number | null>(null);

  // ── ETA/route target station ─────────────────────────────────────────────────
  // Declared here (before the camera effect) because the camera effect uses
  // targetStation to fit the shuttle target. waypointsToTarget is also hoisted
  // so all station-derived values are co-located.
  const targetStation = useMemo(() => {
    const remaining = sorted.filter((s) => s.status !== 'completed');
    if (remaining.length === 0) return null;
    if (passengerStationId != null) {
      const match = remaining.find((s) => s.id === passengerStationId);
      if (match) return match;
    }
    return remaining[0];
  }, [sorted, passengerStationId]);

  const waypointsToTarget = useMemo(() => {
    if (!targetStation) return [];
    const remaining = sorted.filter((s) => s.status !== 'completed');
    const idx = remaining.findIndex((s) => s.id === targetStation.id);
    const upToTarget = idx >= 0 ? remaining.slice(0, idx + 1) : [targetStation];
    return upToTarget.map((s) => ({ latitude: s.latitude, longitude: s.longitude }));
  }, [sorted, targetStation]);

  useEffect(() => {
    if (!driverLocation) return;
    if (cameraSuspended) return;

    // ── Shuttle path ──────────────────────────────────────────────────────────
    if (sorted.length > 0) {
      const shuttleTarget = targetStation
        ? { latitude: targetStation.latitude, longitude: targetStation.longitude }
        : null;
      const targetId = targetStation?.id ?? null;
      // Only re-fit when the target station changes. Between fits the follow
      // camera keeps the driver framed — no per-tick animateToRegion.
      if (fittedShuttleTargetRef.current === targetId) return;
      fittedShuttleTargetRef.current = targetId;
      if (shuttleTarget) {
        runOverviewFit(() => {
          mapRef.current?.fitToCoordinates(
            [driverLocation, shuttleTarget],
            { edgePadding: FIT_PADDING, animated: true },
          );
        });
      }
      // No shuttleTarget → nothing to frame; the follow camera handles it.
      return;
    }

    // ── Car/scooter/delivery: no active phase — leave camera alone ───────────
    if (!tripPhase) return;

    const secondPoint =
      tripPhase === 'driver_arriving' ? (pickup ?? null) :
      tripPhase === 'trip_started'    ? (dropoff ?? null) :
      null;

    // Re-fit only when the phase changes (new destination target). The follow
    // camera handles every subsequent GPS tick.
    if (fittedPhaseRef.current === tripPhase) return;
    fittedPhaseRef.current = tripPhase;

    // No destination point to frame → the follow camera handles it.
    if (!secondPoint) return;

    runOverviewFit(() => {
      mapRef.current?.fitToCoordinates(
        [driverLocation, secondPoint],
        { edgePadding: FIT_PADDING, animated: true },
      );
    });
  }, [driverLocation?.latitude, driverLocation?.longitude, sorted.length, tripPhase, cameraSuspended, pickup, dropoff, targetStation]);

  // Recenter: resume the follow camera and glide back to the driver
  // (course-up, tilted, fixed zoom) rather than re-fitting to a static pair.
  const handleRecenter = useCallback(() => {
    cameraRecenter();
  }, [cameraRecenter]);

  // ── Google Directions — shuttle path (stations present) ─────────────────────
  // Fetches the road-snapped route from the driver through the ordered station
  // waypoints up to and including the target stop. Disabled when no stations
  // are present (car/scooter/delivery path below handles that case).
  const { routeCoords: shuttleRouteCoords, durationSeconds: shuttleDuration } = useGoogleRoute({
    origin:  driverLocation,
    targets: waypointsToTarget,
    enabled: sorted.length > 0 && waypointsToTarget.length > 0,
  });

  // ── Google Directions — car/scooter/delivery path (no stations) ──────────────
  // Route target is phase-aware:
  //   driver_arriving → driverLocation → pickup
  //   trip_started    → driverLocation → dropoff
  //   null / no phase → disabled (hook clears routeCoords immediately)
  //
  // Phase changes automatically change carRouteTarget, which changes the
  // hook's targetsKey, forcing an immediate refetch — equivalent to the
  // prevTripPhaseRef force-refetch that lived in the old car-route effect.
  const carRouteTarget: LatLng | null =
    tripPhase === 'driver_arriving' ? (pickup  ?? null) :
    tripPhase === 'trip_started'    ? (dropoff ?? null) :
    null;

  const { routeCoords: carRouteCoords, durationSeconds: carDuration } = useGoogleRoute({
    origin:  driverLocation,
    targets: carRouteTarget ? [carRouteTarget] : [],
    enabled: sorted.length === 0 && !!tripPhase && !!carRouteTarget,
  });

  // ── Stale-route guard (car/scooter/delivery only) ────────────────────────────
  // useGoogleRoute clears its routeCoords for a new target inside a useEffect,
  // which commits one tick after this render. Without this guard, the render
  // that immediately follows a tripPhase flip (e.g. driver_arriving -> trip_started)
  // would still draw the OLD leg's road-snapped polyline (driver->pickup) for one
  // frame before falling back to the phase-correct fallbackCoords. Tracked via a
  // ref updated synchronously during render so the mask applies immediately.
  const carRouteKeyRef = useRef<string | null>(null);
  const carRouteKey = carRouteTarget
    ? `${tripPhase}:${carRouteTarget.latitude},${carRouteTarget.longitude}`
    : `${tripPhase}:none`;
  const carRouteIsStale =
    sorted.length === 0 &&
    carRouteKeyRef.current !== null &&
    carRouteKeyRef.current !== carRouteKey;
  carRouteKeyRef.current = carRouteKey;

  // Unified view — only one path is active at a time (guarded by sorted.length).
  const routeCoords          = sorted.length > 0 ? shuttleRouteCoords : (carRouteIsStale ? [] : carRouteCoords);
  const routeDurationSeconds = sorted.length > 0 ? shuttleDuration    : carDuration;

  // Reset the camera phase-fit guard when the trip ends so a subsequent ride
  // triggers a fresh camera fit. The old car-route useEffect did this as a
  // side effect inside its !tripPhase branch; now it lives in its own effect.
  useEffect(() => {
    if (!tripPhase && sorted.length === 0) {
      fittedPhaseRef.current = null;
    }
  }, [tripPhase, sorted.length]);

  // ── ETA ─────────────────────────────────────────────────────────────────────
  // Prefer Google Directions duration (more accurate); fall back to distance-based.
  // Shuttle path: falls back to next-station distance (targetStation — unchanged).
  // Car/scooter/delivery path: falls back to a phase-aware pickup or dropoff target.
  // The two paths are fully isolated — shuttle logic is not touched.
  //
  // The Haversine fallback itself is throttled (separately from the useMemo
  // below, which only dedupes *identical* renders): driverLocation changes on
  // every GPS tick, so without this cache the fallback would recompute on
  // every single tick for as long as the Google route hasn't loaded yet.
  const etaFallbackCacheRef = useRef<{ value: number | null; atMs: number; lat: number; lng: number } | null>(null);

  const etaMinutes = useMemo(() => {
    if (routeDurationSeconds !== null) {
      etaFallbackCacheRef.current = null; // invalidate — a real route duration is now available
      return Math.max(1, Math.ceil(routeDurationSeconds / 60));
    }

    // Shuttle fallback target: next station. Car/scooter/delivery fallback
    // target: phase-aware pickup or dropoff. (original logic, untouched)
    const fallbackTarget = sorted.length > 0
      ? targetStation
      : (tripPhase === 'driver_arriving' ? (pickup ?? null) :
         tripPhase === 'trip_started'    ? (dropoff ?? null) :
         null);

    if (!driverLocation || !fallbackTarget) return null;

    const cache = etaFallbackCacheRef.current;
    const now = Date.now();
    if (
      cache &&
      now - cache.atMs < ETA_FALLBACK_THROTTLE_MS &&
      haversineMeters({ latitude: cache.lat, longitude: cache.lng }, driverLocation) < ETA_FALLBACK_MOVE_METERS
    ) {
      return cache.value;
    }

    const value = estimateEtaMinutes(driverLocation, fallbackTarget);
    etaFallbackCacheRef.current = { value, atMs: now, lat: driverLocation.latitude, lng: driverLocation.longitude };
    return value;
  }, [routeDurationSeconds, driverLocation?.latitude, driverLocation?.longitude,
      targetStation, sorted.length, tripPhase, pickup, dropoff]);

  useEffect(() => {
    onEtaChange?.(etaMinutes);
  }, [etaMinutes, onEtaChange]);

  // ── Target station callback (shuttle only) ───────────────────────────────────
  // Fires whenever the computed next stop changes — lets the parent screen show
  // "Next stop: <name>" without duplicating the target-station logic.
  useEffect(() => {
    if (sorted.length === 0) return;
    onTargetStationChange?.(targetStation ?? null);
  }, [targetStation, onTargetStationChange, sorted.length]);

  // ── Straight-line fallback coords (used until Google route loads) ────────────
  const completedCoords = useMemo((): LatLng[] => {
    const done = visibleStations.filter((s) => s.status === 'completed');
    if (done.length < 2) return [];
    return done.map((s) => ({ latitude: s.latitude, longitude: s.longitude }));
  }, [visibleStations]);

  const upcomingCoords = useMemo((): LatLng[] => {
    // Shuttle-only computation — bail before touching driverLocation so this
    // doesn't re-run on every GPS tick for the car/scooter/delivery path.
    if (sorted.length === 0) return [];
    const ahead = visibleStations.filter((s) => s.status !== 'completed');
    if (ahead.length === 0) return [];
    const pts: LatLng[] = [];
    if (driverLocation) pts.push({ latitude: driverLocation.latitude, longitude: driverLocation.longitude });
    ahead.forEach((s) => pts.push({ latitude: s.latitude, longitude: s.longitude }));
    return pts;
  }, [visibleStations, sorted.length, driverLocation?.latitude, driverLocation?.longitude]);

  // Fallback straight-line while Google route is loading.
  // Phase-aware: driver_arriving → driver→pickup, trip_started → driver→dropoff.
  // Never draws pickup→dropoff — that's irrelevant until the trip starts AND
  // we have a driver position.
  const fallbackCoords = useMemo((): LatLng[] => {
    if (sorted.length > 0) return [];
    if (!driverLocation) return [];   // no driver position yet — nothing to draw
    const target =
      tripPhase === 'driver_arriving' ? (pickup ?? null) :
      tripPhase === 'trip_started'    ? (dropoff ?? null) :
      null;
    if (!target) return [];
    return [driverLocation, target];
  }, [sorted, driverLocation, pickup, dropoff, tripPhase]);

  // initLat/initLng were removed with the AnimatedRegion block; derive the
  // initialRegion seed inline from the same fallback priority.
  const initCenter = {
    latitude:  driverLocation?.latitude  ?? pickup?.latitude  ?? 0,
    longitude: driverLocation?.longitude ?? pickup?.longitude ?? 0,
  };

  return (
    <View style={[StyleSheet.absoluteFill, style]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        // Only pass initialRegion when a real seed point is available — avoids
        // briefly showing the map at 0/0 or a hardcoded city before GPS resolves (audit L3).
        {...((driverLocation ?? pickup) ? { initialRegion: { ...initCenter, ...FOLLOW_DELTA } } : {})}
        showsUserLocation={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        scrollEnabled
        zoomEnabled
        pitchEnabled={false}
        showsBuildings={false}
        customMapStyle={darkMode ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
        onMapReady={onMapReady}
        onPanDrag={onCameraPan}
        onRegionChangeComplete={onCameraRegionChange}
      >
        {/* Completed leg — straight line between visited stops (green) */}
        {completedCoords.length >= 2 && (
          <Polyline coordinates={completedCoords} strokeColor="#22c55e" strokeWidth={4} />
        )}

        {/* Upcoming leg — Google road-snapped route, straight-line until loaded */}
        {(routeCoords.length >= 2 ? routeCoords : upcomingCoords).length >= 2 && (
          <Polyline
            coordinates={routeCoords.length >= 2 ? routeCoords : upcomingCoords}
            strokeColor="#1A73E8"
            strokeWidth={5}
          />
        )}

        {/* Fallback line when no stations provided — hidden once Google route loads */}
        {fallbackCoords.length >= 2 && routeCoords.length < 2 && (
          <Polyline coordinates={fallbackCoords} strokeColor="#1A73E8" strokeWidth={5} />
        )}

        {/* Station markers — filtered to passenger-relevant stops only */}
        {visibleStations.map((station) => {
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

        {/* Animated driver marker — symmetrical pill/circle dot, no rotation */}
        {(driverLocation ?? pickup) && (
          <MarkerAnimated
            coordinate={animatedCoord}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={0}
            tracksViewChanges={!carMarkerReady}
            title={t('driver_label')}
          >
            <DriverMarker vehicleType={vehicleType} colorHex={driverColorHex} onImageLoad={onCarMarkerLoad} />
          </MarkerAnimated>
        )}
      </MapView>

      {/* ETA overlay — rendered above the map, not inside MapView */}
      {etaMinutes !== null && (
        <View style={styles.etaBadge} pointerEvents="none">
          <Text style={styles.etaLabel}>{t('eta_label')}</Text>
          <Text style={styles.etaValue}>{etaMinutes} {t('min')}</Text>
        </View>
      )}

      {/* Recenter button — car/scooter/delivery only, shown after manual pan */}
      {sorted.length === 0 && tripPhase !== null && cameraSuspended && (
        <TouchableOpacity
          style={styles.recenterBtn}
          onPress={handleRecenter}
          activeOpacity={0.85}
          accessibilityLabel={t('recenter_map')}
        >
          <Navigation size={18} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
});

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

  // Recenter button — floats above the map, bottom-right, above the bottom card
  recenterBtn: {
    position: 'absolute',
    bottom: 200,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(17,24,39,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    // Translucent bg: Android elevation would draw a square halo, not a circle.
    elevation: 0,
  },
});
