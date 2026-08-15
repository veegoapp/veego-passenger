/**
 * DriverMarker
 *
 * Canonical driver-location marker icon used on the map in both CarMap.tsx
 * and PassengerTrackingMap.native.tsx: a route-blue (#1A73E8, matching the
 * Polyline stroke) pill/circle dot with a solid white halo ring. Symmetrical,
 * so the parent <MarkerAnimated> should keep passing rotation={0} and
 * anchor={{x:0.5,y:0.5}} — the dot never needs to rotate with heading, and
 * because it's centered exactly on the coordinate it always reads as sitting
 * right on the route polyline instead of a directional icon that can look
 * off-axis from it.
 *
 * This component renders only the marker content (the inner view). It is
 * intended to be placed inside a <MarkerAnimated> in the caller:
 *
 *   <MarkerAnimated
 *     coordinate={animatedCoord}
 *     anchor={{ x: 0.5, y: 0.5 }}
 *     rotation={0}
 *   >
 *     <DriverMarker vehicleType="car" onImageLoad={onCarMarkerLoad} />
 *   </MarkerAnimated>
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

// 'car'/'scooter'/'delivery'/'shuttle' are ride-level service types.
// 'hiace'/'minibus' are specific shuttle trip vehicle types
// (PassengerShuttleTrip.vehicleType) — pass these directly when known,
// instead of the generic 'shuttle', so the marker shows the correct bus size.
export type DriverVehicleType = 'car' | 'scooter' | 'delivery' | 'shuttle' | 'hiace' | 'minibus';

interface DriverMarkerProps {
  /** Kept for caller API compatibility — CarMap / PassengerTrackingMap key
   *  their anchor/rotation props off this. The marker's own visual doesn't
   *  vary by vehicle type. */
  vehicleType: DriverVehicleType;
  /** Kept for caller API compatibility — the marker's own visual doesn't
   *  vary by vehicle color. */
  colorHex?: string | null;
  /** Fired shortly after mount so the parent can flip the marker's
   *  tracksViewChanges to false (static content — no need to keep
   *  re-rasterising the bitmap on Android). */
  onImageLoad?: () => void;
}

// Memoized: position is driven by native Animated props on the parent
// MarkerAnimated, so this view only needs to render once — not on every
// parent re-render.
export const DriverMarker = React.memo(function DriverMarker({
  onImageLoad,
}: DriverMarkerProps): React.JSX.Element {
  // A plain View (no Svg/image content) paints synchronously, but the small
  // delay is kept so the parent's tracksViewChanges-off flip still lands
  // after react-native-maps has taken at least one snapshot on Android —
  // same contract callers already rely on.
  React.useEffect(() => {
    if (!onImageLoad) return;
    const id = setTimeout(onImageLoad, 300);
    return () => clearTimeout(id);
  }, [onImageLoad]);

  return <View style={styles.dot} />;
});

const styles = StyleSheet.create({
  // Pill/circle dot — route-blue fill (matches the Polyline's #1A73E8
  // stroke), solid white halo ring, subtle shadow so it reads as sitting
  // slightly above the route line.
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1A73E8',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
