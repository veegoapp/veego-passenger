import { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Navigation } from 'lucide-react-native';
import { useActiveSession } from '@/context/ActiveSessionContext';
import { selectActiveRide } from '@/src/session/activeRideSelectors';
import { useTabBar } from '@/context/TabBarContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BUBBLE_SIZE = 68;
const EDGE_PADDING = 14;

/**
 * Messenger-style floating bubble shown whenever the passenger has an active
 * ride but is NOT on the home tab (CarServiceScreen already lives there).
 * The bubble is draggable and snaps to the nearest screen edge on release.
 */
export function ActiveRideBanner() {
  const { session } = useActiveSession();
  const activeRide  = useMemo(() => selectActiveRide(session), [session]);
  const router      = useRouter();
  const pathname    = usePathname();
  const { tabBarHeight } = useTabBar();
  const insets      = useSafeAreaInsets();

  const { width: SW, height: SH } = Dimensions.get('window');

  // Start position: right edge, vertically centred-ish
  const INITIAL_X = SW - BUBBLE_SIZE - EDGE_PADDING;
  const INITIAL_Y = SH * 0.38;

  const pan      = useRef(new Animated.ValueXY({ x: INITIAL_X, y: INITIAL_Y })).current;
  const scale    = useRef(new Animated.Value(0)).current;
  const pulse    = useRef(new Animated.Value(1)).current;

  const isDragging = useRef(false);
  const lastTap    = useRef(0);

  // Pulsing ring animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.22, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const onHomeTab =
    pathname === '/' ||
    pathname === '/index' ||
    pathname === '/(tabs)' ||
    pathname === '/(tabs)/index';

  const visible = !!activeRide && !onHomeTab;

  // Pop-in / pop-out
  useEffect(() => {
    Animated.spring(scale, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 120,
      friction: 8,
    }).start();
  }, [visible]);

  const snapToEdge = (x: number, y: number) => {
    const snapX = x + BUBBLE_SIZE / 2 < SW / 2
      ? EDGE_PADDING
      : SW - BUBBLE_SIZE - EDGE_PADDING;

    // Clamp Y inside safe bounds
    const minY = insets.top + 8;
    const maxY = SH - tabBarHeight - insets.bottom - BUBBLE_SIZE - 8;
    const clampedY = Math.max(minY, Math.min(maxY, y));

    Animated.spring(pan, {
      toValue: { x: snapX, y: clampedY },
      useNativeDriver: false,
      tension: 100,
      friction: 10,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,

      onPanResponderGrant: () => {
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
        isDragging.current = false;
        Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 40 }).start();
      },

      onPanResponderMove: (_, gs) => {
        if (Math.abs(gs.dx) > 6 || Math.abs(gs.dy) > 6) isDragging.current = true;
        Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        })(_, gs);
      },

      onPanResponderRelease: (_, gs) => {
        pan.flattenOffset();
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

        if (!isDragging.current) {
          // It was a tap — navigate home
          router.push('/(tabs)' as any);
          return;
        }

        const finalX = (pan.x as any)._value;
        const finalY = (pan.y as any)._value;
        snapToEdge(finalX, finalY);
      },
    }),
  ).current;

  if (!activeRide) return null;

  const pulseRing = { transform: [{ scale: pulse }] };

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ scale }] },
        // translate the whole container via pan
        { left: pan.x, top: pan.y },
      ]}
      {...panResponder.panHandlers}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      {/* Pulsing ring */}
      <Animated.View style={[styles.pulseRing, pulseRing]} />

      {/* Main bubble */}
      <View style={styles.bubble}>
        <Navigation size={26} color="#ffffff" />
      </View>

      {/* Status dot */}
      <View style={styles.statusDot} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width:  BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width:  BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    backgroundColor: 'rgba(60, 201, 122, 0.25)',
  },
  bubble: {
    width:  BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    backgroundColor: '#1e1e28',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 10,
  },
  statusDot: {
    position: 'absolute',
    top:   6,
    right: 6,
    width:  14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3CC97A',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
