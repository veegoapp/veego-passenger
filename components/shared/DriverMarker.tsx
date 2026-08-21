/**
 * DriverMarker
 *
 * Canonical driver-location marker icon used on the map in both CarMap.tsx
 * and PassengerTrackingMap.native.tsx: a top-down car image that rotates to
 * face the direction of travel. The image's own front (windshield/mirrors)
 * points straight up at 0deg, so the parent <MarkerAnimated> should pass the
 * live heading as `rotation` (see useAnimatedDriverMarker's `rotation`
 * output) and anchor={{x:0.5,y:0.5}} so it pivots around its own center.
 *
 * This component renders only the marker content (the inner view). It is
 * intended to be placed inside a <MarkerAnimated> in the caller:
 *
 *   <MarkerAnimated
 *     coordinate={animatedCoord}
 *     anchor={{ x: 0.5, y: 0.5 }}
 *     rotation={rotation}
 *     flat
 *   >
 *     <DriverMarker vehicleType="car" onImageLoad={onCarMarkerLoad} />
 *   </MarkerAnimated>
 */

import React from 'react';
import { Image, StyleSheet } from 'react-native';

// Source asset is a cropped top-down car photo, front pointing up, at its
// native aspect ratio (294 x 635).
const CAR_TOP_IMAGE = require('../../assets/images/vehicles/driver-marker-car-top.png');
const CAR_TOP_ASPECT = 294 / 635; // width / height

// Rendered height in map points — kept close to the old dot's footprint
// (22px) while reading as a real car rather than a dot. Width follows from
// the source image's aspect ratio.
const MARKER_HEIGHT = 34;
const MARKER_WIDTH = MARKER_HEIGHT * CAR_TOP_ASPECT;

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
  return (
    <Image
      source={CAR_TOP_IMAGE}
      style={styles.car}
      resizeMode="contain"
      onLoad={onImageLoad}
    />
  );
});

const styles = StyleSheet.create({
  car: {
    width: MARKER_WIDTH,
    height: MARKER_HEIGHT,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
