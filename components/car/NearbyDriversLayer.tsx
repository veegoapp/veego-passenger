import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { Car, Bike as ScooterIcon, Package } from 'lucide-react-native';
import type { NearbyDriver } from '@/src/hooks/car/useNearbyDrivers';

interface NearbyDriversLayerProps {
  drivers: NearbyDriver[];
}

function iconForVehicle(vehicleType: string) {
  const normalized = (vehicleType || '').toLowerCase();
  if (normalized === 'scooter') return ScooterIcon;
  if (normalized === 'delivery') return Package;
  return Car;
}

/**
 * Renders nearby-driver markers as children of CarMap's MapView. Kept as a
 * separate component (rather than folding this into CarMap.tsx) so the
 * route/marker/camera logic CarMap already owns stays untouched.
 *
 * Uses Marker's built-in `rotation` prop (not AnimatedRegion/MarkerAnimated,
 * used elsewhere for the single assigned-driver marker) — these markers only
 * move once per poll tick, so animating them would be wasted work for what
 * can be a whole list of drivers.
 */
export function NearbyDriversLayer({ drivers }: NearbyDriversLayerProps) {
  return (
    <>
      {drivers.map((driver) => {
        const Icon = iconForVehicle(driver.vehicleType);
        return (
          <Marker
            key={driver.id}
            coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={driver.heading ?? 0}
          >
            <View style={styles.wrap}>
              <View style={styles.dot}>
                <Icon size={13} color="#ffffff" />
              </View>
              {driver.etaMinutes != null && (
                <View style={styles.etaPill}>
                  <Text style={styles.etaText}>{driver.etaMinutes}m</Text>
                </View>
              )}
            </View>
          </Marker>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  dot: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#ffffff',
  },
  etaPill: {
    marginTop: 2, backgroundColor: 'rgba(17,24,39,0.85)',
    borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1,
  },
  etaText: { color: '#ffffff', fontSize: 9, fontWeight: '700' },
});
