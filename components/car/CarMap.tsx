import { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Car, Radio } from 'lucide-react-native';
import { USER_LOCATION, DRIVER_LOCATION, MOCK_DESTINATIONS } from './carMapData';

export { USER_LOCATION, DRIVER_LOCATION, MOCK_DESTINATIONS };

// Bounding box for Wadi El Gedid map area
const MAP_BOUNDS = {
  minLat: 25.440,
  maxLat: 25.465,
  minLon: 30.545,
  maxLon: 30.570,
};

function coordsToNormalized(lat: number, lon: number): { x: number; y: number } {
  const x = Math.max(0.05, Math.min(0.95, (lon - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon)));
  const y = Math.max(0.05, Math.min(0.95, 1 - (lat - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)));
  return { x, y };
}

type Phase = 'idle' | 'selecting' | 'ride_options' | 'searching' | 'driver_assigned' | 'arrived' | 'started' | 'completed';

interface DriverLocation {
  latitude: number;
  longitude: number;
  heading?: number;
}

interface CarMapProps {
  phase: Phase;
  destination: string | null;
  driverLocation?: DriverLocation | null;
}

export function CarMap({ phase, destination, driverLocation }: CarMapProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const carX = useRef(new Animated.Value(0.6)).current;
  const carY = useRef(new Animated.Value(0.4)).current;
  const mockAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Start mock animation when no real location is provided
  useEffect(() => {
    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.2, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]));
    p.start();

    const ripple = (anim: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]));
    const r1 = ripple(ring1, 0);
    const r2 = ripple(ring2, 800);
    r1.start();
    r2.start();

    return () => { p.stop(); r1.stop(); r2.stop(); };
  }, []);

  // Mock animation loop — only runs when no real driver location
  useEffect(() => {
    if (driverLocation) {
      if (mockAnimRef.current) {
        mockAnimRef.current.stop();
        mockAnimRef.current = null;
      }
      return;
    }

    const m = Animated.loop(Animated.sequence([
      Animated.timing(carX, { toValue: 0.55, duration: 4000, useNativeDriver: false }),
      Animated.timing(carY, { toValue: 0.45, duration: 3500, useNativeDriver: false }),
      Animated.timing(carX, { toValue: 0.65, duration: 3200, useNativeDriver: false }),
      Animated.timing(carY, { toValue: 0.38, duration: 3800, useNativeDriver: false }),
      Animated.timing(carX, { toValue: 0.6, duration: 4000, useNativeDriver: false }),
      Animated.timing(carY, { toValue: 0.4, duration: 3000, useNativeDriver: false }),
    ]));
    mockAnimRef.current = m;
    m.start();

    return () => { m.stop(); mockAnimRef.current = null; };
  }, [!!driverLocation]);

  // Animate to real driver location when it changes
  useEffect(() => {
    if (!driverLocation) return;
    const { x, y } = coordsToNormalized(driverLocation.latitude, driverLocation.longitude);
    Animated.parallel([
      Animated.timing(carX, { toValue: x, duration: 1200, useNativeDriver: false }),
      Animated.timing(carY, { toValue: y, duration: 1200, useNativeDriver: false }),
    ]).start();
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  const ringStyle = (anim: Animated.Value) => ({
    position: 'absolute' as const,
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: '#55c49a',
    opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.2, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.8] }) }],
  });

  const isActiveRide = phase === 'arrived' || phase === 'started';

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <LinearGradient colors={['#16182e', '#0b0c18']} style={StyleSheet.absoluteFillObject} />

      {[0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map(r => (
        <View key={`v${r}`} style={{ position: 'absolute', left: `${r * 100}%` as any, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(70,80,160,0.12)' }} />
      ))}
      {[0.2, 0.35, 0.5, 0.65, 0.8].map(r => (
        <View key={`h${r}`} style={{ position: 'absolute', top: `${r * 100}%` as any, left: 0, right: 0, height: 1, backgroundColor: 'rgba(70,80,160,0.12)' }} />
      ))}

      <View style={{ position: 'absolute', top: '45%', left: 0, right: 0, height: 8, backgroundColor: 'rgba(70,82,150,0.35)', borderRadius: 2 }} />
      <View style={{ position: 'absolute', left: '40%', top: 0, bottom: 0, width: 8, backgroundColor: 'rgba(70,82,150,0.35)', borderRadius: 2 }} />
      <View style={{ position: 'absolute', top: '68%', left: 0, right: 0, height: 4, backgroundColor: 'rgba(60,70,130,0.2)', borderRadius: 2 }} />

      {destination && (
        <View style={{ position: 'absolute', right: '28%', top: '28%', alignItems: 'center' }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#d95c35', alignItems: 'center', justifyContent: 'center' }}>
            <MapPin size={14} color="#ffffff" />
          </View>
          <View style={{ width: 3, height: 10, backgroundColor: '#d95c35', borderRadius: 2, marginTop: -1 }} />
        </View>
      )}

      {/* User location dot */}
      <View style={{ position: 'absolute', left: '30%', top: '55%', alignItems: 'center' }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#4d9ef6', borderWidth: 3, borderColor: '#ffffff' }} />
      </View>

      {/* Driver marker */}
      <Animated.View style={{
        position: 'absolute',
        left: carX.interpolate({ inputRange: [0, 1], outputRange: ['5%', '92%'] }),
        top: carY.interpolate({ inputRange: [0, 1], outputRange: ['10%', '85%'] }),
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Animated.View style={ringStyle(ring1)} />
        <Animated.View style={ringStyle(ring2)} />
        <Animated.View style={{
          transform: [{ scale: pulse }],
          width: 38, height: 38, borderRadius: 19,
          backgroundColor: isActiveRide ? 'rgba(77,158,246,0.2)' : 'rgba(85,196,154,0.2)',
          alignItems: 'center', justifyContent: 'center', zIndex: 1,
        }}>
          <View style={{
            width: 24, height: 24, borderRadius: 12,
            backgroundColor: isActiveRide ? '#4d9ef6' : '#55c49a',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Car size={13} color="#ffffff" />
          </View>
        </Animated.View>
      </Animated.View>

      {(phase === 'driver_assigned' || phase === 'arrived' || phase === 'started') && (
        <View style={{
          position: 'absolute', top: 8, left: 8,
          backgroundColor: isActiveRide ? 'rgba(77,158,246,0.9)' : 'rgba(85,196,154,0.9)',
          borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5,
          flexDirection: 'row', alignItems: 'center', gap: 5,
        }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#ffffff' }} />
          <Radio size={12} color="#ffffff" />
        </View>
      )}
    </View>
  );
}
