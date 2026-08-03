import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline, MarkerAnimated, PROVIDER_GOOGLE } from 'react-native-maps';
import { Navigation } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from '@/constants/mapStyles';
import { estimateEtaMinutes } from '@/src/utils/geoHelpers';
import { useAnimatedDriverMarker } from '@/hooks/map/useAnimatedDriverMarker';
import { useMapCamera } from '@/hooks/map/useMapCamera';
import { useGoogleRoute } from '@/hooks/map/useGoogleRoute';
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
  driverLocation?: DriverLatLng | null;
  stations?: Station[];
  passengerStationId?: number | null;
  style?: object;
  /** Driver marker icon. Defaults to 'shuttle' (bus) — preserves existing behavior for shuttle tracking. */
  vehicleType?: 'car' | 'scooter' | 'shuttle';
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
// ROUTE_REFRESH_INTERVAL_MS and SIGNIFICANT_MOVE_METERS were inlined here
// previously; they are now owned and exported by useGoogleRoute.

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
  pickup, dropoff, driverLocation,
  stations = [], passengerStationId, style,
  vehicleType = 'shuttle', onEtaChange,
  tripPhase = null,
  boarded = false,
  onTargetStationChange,
}: TrackingMapProps) {
  const { t, darkMode } = useTheme();

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
  // available — matching the previous initLat/initLng fallback logic.
  const { animatedCoord } = useAnimatedDriverMarker({ driverLocation, initialCoords: pickup });

  // ── Camera follow ────────────────────────────────────────────────────────────
  // mapRef, mapReadyRef, pendingCameraRef, and runOrQueueCamera are all
  // provided by useMapCamera. onMapReady is passed directly to <MapView>.
  const { mapRef, runOrQueueCamera, onMapReady } = useMapCamera();

  // True while the passenger is manually panning — pauses auto-camera updates.
  // Cleared when the recenter button is pressed.
  const [isUserPanning, setIsUserPanning] = useState(false);

  // Edge-padding for fitToCoordinates (used only on initial load / phase change).
  const FIT_PADDING = { top: 120, right: 60, bottom: 280, left: 60 } as const;

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
    if (isUserPanning) return;

    // ── Shuttle path ──────────────────────────────────────────────────────────
    if (sorted.length > 0) {
      const shuttleTarget = targetStation
        ? { latitude: targetStation.latitude, longitude: targetStation.longitude }
        : null;
      const targetId = targetStation?.id ?? null;
      // Only re-fit when the target station changes, not on every GPS tick.
      if (fittedShuttleTargetRef.current === targetId) {
        // Just follow driver smoothly between fits.
        runOrQueueCamera(() => {
          mapRef.current?.animateToRegion(
            { latitude: driverLocation.latitude, longitude: driverLocation.longitude, ...FOLLOW_DELTA },
            600,
          );
        });
        return;
      }
      fittedShuttleTargetRef.current = targetId;
      if (shuttleTarget) {
        runOrQueueCamera(() => {
          mapRef.current?.fitToCoordinates(
            [driverLocation, shuttleTarget],
            { edgePadding: FIT_PADDING, animated: true },
          );
        });
      } else {
        runOrQueueCamera(() => {
          mapRef.current?.animateToRegion(
            { latitude: driverLocation.latitude, longitude: driverLocation.longitude, ...FOLLOW_DELTA },
            600,
          );
        });
      }
      return;
    }

    // ── Car/scooter/delivery: no active phase — leave camera alone ───────────
    if (!tripPhase) return;

    const secondPoint =
      tripPhase === 'driver_arriving' ? (pickup ?? null) :
      tripPhase === 'trip_started'    ? (dropoff ?? null) :
      null;

    // Re-fit only when the phase changes (new destination target); on every
    // subsequent GPS tick just animate the camera to follow the driver.
    if (fittedPhaseRef.current === tripPhase) {
      if (secondPoint) {
        // Smooth follow — keep driver in frame without re-zooming.
        runOrQueueCamera(() => {
          mapRef.current?.animateToRegion(
            { latitude: driverLocation.latitude, longitude: driverLocation.longitude, ...FOLLOW_DELTA },
            600,
          );
        });
      }
      return;
    }

    // Phase changed (or first load) — do the full fit.
    fittedPhaseRef.current = tripPhase;

    if (!secondPoint) {
      runOrQueueCamera(() => {
        mapRef.current?.animateToRegion(
          { latitude: driverLocation.latitude, longitude: driverLocation.longitude, ...FOLLOW_DELTA },
          600,
        );
      });
      return;
    }

    runOrQueueCamera(() => {
      mapRef.current?.fitToCoordinates(
        [driverLocation, secondPoint],
        { edgePadding: FIT_PADDING, animated: true },
      );
    });
  }, [driverLocation?.latitude, driverLocation?.longitude, sorted.length, tripPhase, isUserPanning, pickup, dropoff, targetStation]);

  // Recenter: fit the same phase-appropriate pair and clear the pan flag.
  const handleRecenter = useCallback(() => {
    if (!driverLocation || !tripPhase) return;
    const secondPoint =
      tripPhase === 'driver_arriving' ? (pickup ?? null) :
      tripPhase === 'trip_started'    ? (dropoff ?? null) :
      null;
    if (!secondPoint) return;
    setIsUserPanning(false);
    mapRef.current?.fitToCoordinates(
      [driverLocation, secondPoint],
      { edgePadding: FIT_PADDING, animated: true },
    );
  }, [driverLocation, tripPhase, pickup, dropoff]);

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

  // Unified view — only one path is active at a time (guarded by sorted.length).
  const routeCoords       = sorted.length > 0 ? shuttleRouteCoords : carRouteCoords;
  const routeDurationSeconds = sorted.length > 0 ? shuttleDuration   : carDuration;

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
  const etaMinutes = useMemo(() => {
    if (routeDurationSeconds !== null) {
      return Math.max(1, Math.ceil(routeDurationSeconds / 60));
    }
    if (sorted.length > 0) {
      // Shuttle fallback — distance to next station (original logic, untouched)
      if (!driverLocation || !targetStation) return null;
      return estimateEtaMinutes(driverLocation, targetStation);
    }
    // Car/scooter/delivery fallback — phase-aware distance target
    const nonShuttleTarget =
      tripPhase === 'driver_arriving' ? (pickup ?? null) :
      tripPhase === 'trip_started'    ? (dropoff ?? null) :
      null;
    if (!driverLocation || !nonShuttleTarget) return null;
    return estimateEtaMinutes(driverLocation, nonShuttleTarget);
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
    const ahead = visibleStations.filter((s) => s.status !== 'completed');
    if (ahead.length === 0) return [];
    const pts: LatLng[] = [];
    if (driverLocation) pts.push(driverLocation);
    ahead.forEach((s) => pts.push({ latitude: s.latitude, longitude: s.longitude }));
    return pts;
  }, [visibleStations, driverLocation]);

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

  // Heading from socket payload (degrees clockwise from north)
  const heading = driverLocation?.heading ?? 0;

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
        customMapStyle={darkMode ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
        onMapReady={onMapReady}
        onPanDrag={() => setIsUserPanning(true)}
      >
        {/* Completed leg — straight line between visited stops (green) */}
        {completedCoords.length >= 2 && (
          <Polyline coordinates={completedCoords} strokeColor="#22c55e" strokeWidth={4} />
        )}

        {/* Upcoming leg — Google road-snapped route, straight-line until loaded */}
        {(routeCoords.length >= 2 ? routeCoords : upcomingCoords).length >= 2 && (
          <Polyline
            coordinates={routeCoords.length >= 2 ? routeCoords : upcomingCoords}
            strokeColor="#2563eb"
            strokeWidth={4}
          />
        )}

        {/* Fallback line when no stations provided — hidden once Google route loads */}
        {fallbackCoords.length >= 2 && routeCoords.length < 2 && (
          <Polyline coordinates={fallbackCoords} strokeColor="#2563eb" strokeWidth={3.5} />
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

        {/* Animated driver marker — rotates according to socket heading */}
        {(driverLocation ?? pickup) && (
          <MarkerAnimated
            coordinate={animatedCoord}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={heading}
            title={t('driver_label')}
          >
            <DriverMarker vehicleType={vehicleType} />
          </MarkerAnimated>
        )}
      </MapView>

      {/* ETA overlay — rendered above the map, not inside MapView */}
      {etaMinutes !== null && (
        <View style={styles.etaBadge} pointerEvents="none">
          <Text style={styles.etaLabel}>ETA</Text>
          <Text style={styles.etaValue}>{etaMinutes} min</Text>
        </View>
      )}

      {/* Recenter button — car/scooter/delivery only, shown after manual pan */}
      {sorted.length === 0 && tripPhase !== null && isUserPanning && (
        <TouchableOpacity
          style={styles.recenterBtn}
          onPress={handleRecenter}
          activeOpacity={0.85}
          accessibilityLabel="Re-center map"
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
