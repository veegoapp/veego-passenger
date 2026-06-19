import { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Bike, Radio } from 'lucide-react-native';

type ScooterPhase = 'idle' | 'selecting' | 'ride_options' | 'searching' | 'driver_assigned' | 'completed';

interface ScooterMapProps {
  phase: ScooterPhase;
  destination: string | null;
}

export function ScooterMap({ phase, destination }: ScooterMapProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const scooterX = useRef(new Animated.Value(0.6)).current;
  const scooterY = useRef(new Animated.Value(0.4)).current;

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

    const m = Animated.loop(Animated.sequence([
      Animated.timing(scooterX, { toValue: 0.52, duration: 3800, useNativeDriver: false }),
      Animated.timing(scooterY, { toValue: 0.47, duration: 3200, useNativeDriver: false }),
      Animated.timing(scooterX, { toValue: 0.67, duration: 2900, useNativeDriver: false }),
      Animated.timing(scooterY, { toValue: 0.36, duration: 3600, useNativeDriver: false }),
      Animated.timing(scooterX, { toValue: 0.6, duration: 3800, useNativeDriver: false }),
      Animated.timing(scooterY, { toValue: 0.4, duration: 2800, useNativeDriver: false }),
    ]));
    m.start();

    return () => { p.stop(); r1.stop(); r2.stop(); m.stop(); };
  }, []);

  const ringStyle = (anim: Animated.Value) => ({
    position: 'absolute' as const,
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: '#55c49a',
    opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 0.2, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.8] }) }],
  });

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <LinearGradient colors={['#0d0f24', '#090b16']} style={StyleSheet.absoluteFillObject} />

      {[0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map(r => (
        <View key={`v${r}`} style={{ position: 'absolute', left: `${r * 100}%` as any, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(85,196,154,0.07)' }} />
      ))}
      {[0.2, 0.35, 0.5, 0.65, 0.8].map(r => (
        <View key={`h${r}`} style={{ position: 'absolute', top: `${r * 100}%` as any, left: 0, right: 0, height: 1, backgroundColor: 'rgba(85,196,154,0.07)' }} />
      ))}

      <View style={{ position: 'absolute', top: '45%', left: 0, right: 0, height: 8, backgroundColor: 'rgba(60,130,100,0.3)', borderRadius: 2 }} />
      <View style={{ position: 'absolute', left: '40%', top: 0, bottom: 0, width: 8, backgroundColor: 'rgba(60,130,100,0.3)', borderRadius: 2 }} />
      <View style={{ position: 'absolute', top: '68%', left: 0, right: 0, height: 4, backgroundColor: 'rgba(50,110,80,0.18)', borderRadius: 2 }} />

      {destination && (
        <View style={{ position: 'absolute', right: '28%', top: '28%', alignItems: 'center' }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#e07055', alignItems: 'center', justifyContent: 'center' }}>
            <MapPin size={14} color="#ffffff" />
          </View>
          <View style={{ width: 3, height: 10, backgroundColor: '#e07055', borderRadius: 2, marginTop: -1 }} />
        </View>
      )}

      <View style={{ position: 'absolute', left: '30%', top: '55%', alignItems: 'center' }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#4d9ef6', borderWidth: 3, borderColor: '#ffffff' }} />
      </View>

      <Animated.View style={{
        position: 'absolute',
        left: scooterX.interpolate({ inputRange: [0, 1], outputRange: ['5%', '92%'] }),
        top: scooterY.interpolate({ inputRange: [0, 1], outputRange: ['10%', '85%'] }),
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Animated.View style={ringStyle(ring1)} />
        <Animated.View style={ringStyle(ring2)} />
        <Animated.View style={{
          transform: [{ scale: pulse }],
          width: 38, height: 38, borderRadius: 19,
          backgroundColor: 'rgba(85,196,154,0.2)',
          alignItems: 'center', justifyContent: 'center', zIndex: 1,
        }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#55c49a', alignItems: 'center', justifyContent: 'center' }}>
            <Bike size={13} color="#ffffff" />
          </View>
        </Animated.View>
      </Animated.View>

      {phase === 'driver_assigned' && (
        <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(85,196,154,0.9)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#ffffff' }} />
          <Radio size={12} color="#ffffff" />
        </View>
      )}
    </View>
  );
}
