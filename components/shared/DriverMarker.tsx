/**
 * DriverMarker
 *
 * Canonical driver-location marker icon used on the map in both CarMap.tsx
 * and PassengerTrackingMap.native.tsx: a white halo/shadow disc containing a
 * flat, color-driven VehicleIcon silhouette. Symmetrical container, so the
 * parent <MarkerAnimated> should keep passing rotation={0} — the icon never
 * needs to rotate with heading.
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
import { VehicleIcon, mapServiceTypeToVehicleType } from './VehicleIcon';

export type DriverVehicleType = 'car' | 'scooter' | 'delivery' | 'shuttle';

interface DriverMarkerProps {
  /** CarMap / PassengerTrackingMap key their anchor/rotation props off this.
   *  Mapped onto the VehicleIcon vocabulary (car/scooter/van/minibus) via
   *  mapServiceTypeToVehicleType — this is the ride's service type, not the
   *  driver's vehicles.vehicleType row, since that isn't available in the
   *  map flow today. */
  vehicleType: DriverVehicleType;
  /** Vehicle body color hex, e.g. from driver.vehicleColorHex. Optional —
   *  VehicleIcon falls back to a safe default when missing/invalid. */
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
  vehicleType,
  colorHex,
  onImageLoad,
}: DriverMarkerProps): React.JSX.Element {
  // VehicleIcon (react-native-svg) still paints synchronously like the
  // previous plain View did, but the small delay is kept so the parent's
  // tracksViewChanges-off flip still lands after react-native-maps has taken
  // at least one snapshot on Android — same contract callers already rely on.
  React.useEffect(() => {
    if (!onImageLoad) return;
    const id = setTimeout(onImageLoad, 300);
    return () => clearTimeout(id);
  }, [onImageLoad]);

  return (
    <View style={styles.dot}>
      <VehicleIcon vehicleType={mapServiceTypeToVehicleType(vehicleType)} colorHex={colorHex} size={16} />
    </View>
  );
});

const styles = StyleSheet.create({
  // Same halo/shadow envelope as the previous plain dot (22px + 3px border)
  // so marker footprint/anchor math on the map is unchanged — only the
  // content inside now varies by vehicle type/color instead of a flat fill.
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
