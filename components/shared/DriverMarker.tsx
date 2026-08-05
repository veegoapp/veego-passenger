/**
 * DriverMarker
 *
 * A single canonical component for all driver vehicle marker icons used on
 * the map.  Consolidates the duplicated inline JSX from CarMap.tsx and
 * PassengerTrackingMap.native.tsx into one place.
 *
 * Supported vehicle types:
 *   'car'      — car-marker.png image (rotated by MarkerAnimated's rotation prop)
 *   'scooter'  — arrow tip + filled circle with Bike icon
 *   'delivery' — arrow tip + filled circle with Package icon
 *   'shuttle'  — arrow tip + rounded square with bus emoji
 *
 * This component renders only the marker content (the inner icon/image).
 * It is intended to be placed inside a <MarkerAnimated> in the caller:
 *
 *   <MarkerAnimated
 *     coordinate={animatedCoord}
 *     anchor={{ x: 0.5, y: 0.5 }}
 *     rotation={heading}
 *   >
 *     <DriverMarker vehicleType="car" />
 *   </MarkerAnimated>
 *
 * Style notes / design decisions:
 *   CarMap used slightly smaller arrow+body dimensions (#2d2d42 fill, 28×28 dot)
 *   than PassengerTrackingMap (#1e293b fill, 36×36 body).  DriverMarker unifies
 *   on the PassengerTrackingMap geometry as the canonical size since that
 *   component handles the broader set of vehicle types.  The scooter and
 *   delivery markers gain a slightly larger icon area (18 px vs 14 px) to
 *   match the shuttle body's proportions.  These dimensions are intentionally
 *   NOT applied to CarMap or PassengerTrackingMap yet — Phase 1 is additive
 *   only; style alignment happens in Phase 2 when the components are migrated.
 */

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Bike, Package } from 'lucide-react-native';

export type DriverVehicleType = 'car' | 'scooter' | 'delivery' | 'shuttle';

interface DriverMarkerProps {
  vehicleType: DriverVehicleType;
  /** Fired once the car image has painted, so the parent can flip the marker's
   *  tracksViewChanges to false (static content — no need to keep re-rasterising
   *  the bitmap on Android). Only meaningful for the 'car' image marker. */
  onImageLoad?: () => void;
}

// Memoized (parity with the driver app's AnimatedDriverMarker): position and
// rotation are driven by native Animated props on the parent MarkerAnimated, so
// this view only needs to re-render when vehicleType actually changes — not on
// every parent re-render.
export const DriverMarker = React.memo(function DriverMarker({
  vehicleType,
  onImageLoad,
}: DriverMarkerProps): React.JSX.Element {
  if (vehicleType === 'car') {
    // Square container so the marker's layout box (used for the anchor) matches
    // the vehicle's visual footprint after the base-orientation correction.
    // The source art is a top-down car pointing LEFT; the static 90° image
    // rotation re-orients it "nose-up" so MarkerAnimated.rotation={heading}
    // (course-up) then points the front in the direction of travel. The image
    // file itself is never rotated — only this view transform.
    return (
      <View style={styles.carMarkerBox}>
        <Image
          source={require('@/assets/images/car-marker.png')}
          style={styles.carMarkerImage}
          resizeMode="contain"
          onLoad={onImageLoad}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {/* Arrow tip — points forward in the direction of travel.
          MarkerAnimated.rotation rotates the whole marker so this always
          faces the direction of movement. */}
      <View style={styles.arrowHead} />

      {/* Body — coloured circle/square with vehicle icon */}
      <View style={styles.body}>
        {vehicleType === 'scooter' && <Bike size={18} color="#fff" />}
        {vehicleType === 'delivery' && <Package size={18} color="#fff" />}
        {vehicleType === 'shuttle' && <Text style={styles.shuttleEmoji}>🚌</Text>}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  // Realistic on-road vehicle size (~54 dp long); tune within 42–64 dp.
  carMarkerBox: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carMarkerImage: {
    width: 54,
    height: 54,
    // Base-orientation correction: source art points LEFT → rotate nose-up.
    transform: [{ rotate: '90deg' }],
  },

  wrapper: {
    alignItems: 'center',
  },

  // Triangular arrow tip rendered via zero-size border trick.
  arrowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#1e293b',
  },

  // Circular body containing the vehicle icon.
  body: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },

  shuttleEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
});
