/**
 * Web/non-native fallback for RealMap.
 * react-native-maps has no web implementation, so this stub satisfies the
 * import on web while the full map lives in RealMap.native.tsx for iOS/Android.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';

interface LatLng {
  latitude: number;
  longitude: number;
}

interface StationMarker extends LatLng {
  id: string;
  name: string;
}

interface RealMapProps {
  style?: object;
  pickup?: LatLng;
  dropoff?: LatLng;
  driverLocation?: LatLng;
  stationMarkers?: StationMarker[];
  defaultCenter?: LatLng;
}

export function RealMap(_props: RealMapProps) {
  return <View style={[StyleSheet.absoluteFillObject, _props.style]} />;
}
