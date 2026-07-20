/**
 * Web/non-native fallback for PassengerTrackingMap.
 * react-native-maps has no web implementation, so this stub satisfies the
 * import on web while the full map lives in PassengerTrackingMap.native.tsx
 * for iOS/Android.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';

export interface Station {
  id: number;
  name: string;
  order: number;
  latitude: number;
  longitude: number;
  status: 'completed' | 'active' | 'pending';
}

export interface TrackingMapProps {
  pickup?: { latitude: number; longitude: number } | null;
  dropoff?: { latitude: number; longitude: number } | null;
  driverLocation?: { latitude: number; longitude: number; heading?: number } | null;
  stations?: Station[];
  passengerStationId?: number | null;
  style?: object;
}

export function PassengerTrackingMap(_props: TrackingMapProps) {
  return <View style={[StyleSheet.absoluteFill, _props.style]} />;
}
