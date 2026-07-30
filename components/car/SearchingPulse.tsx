import { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { Navigation } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';

const RING_COUNT = 3;
const RING_DURATION = 2200;
const RING_STAGGER = 550;
const RING_HOST = 200;
const RING_BASE = 100;
const BLINK_DURATION = 700;

const LABEL_WRAP_HEIGHT = 26;
const LABEL_MARGIN_TOP = 6;

/** Total marker footprint — used by CarMap to compute the anchor fraction so
 *  the ring/arrow centre (not the label below it) stays pinned to the
 *  passenger's real coordinate. */
export const SEARCHING_PULSE_WIDTH = RING_HOST;
export const SEARCHING_PULSE_HEIGHT = RING_HOST + LABEL_MARGIN_TOP + LABEL_WRAP_HEIGHT;
export const SEARCHING_PULSE_ANCHOR_Y = (RING_HOST / 2) / SEARCHING_PULSE_HEIGHT;

/**
 * Layered over the passenger's own-location dot on the map while the app is
 * searching for a driver: water-drop ripple rings expanding/fading from the
 * point, a bigger Navigation arrow blinking on top of it, and a blinking
 * "searching for driver" label underneath. Replaces the old bottom-sheet
 * radar animation (DriverSearching.tsx), which now only shows a Cancel button.
 */
export function SearchingPulse() {
  const { colors: c, t } = useTheme();

  const rings = useRef(
    Array.from({ length: RING_COUNT }, () => new Animated.Value(0))
  ).current;
  const blink = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // useNativeDriver: false throughout — this view is a react-native-maps
    // custom marker with tracksViewChanges enabled, which re-snapshots the
    // view from the JS-measured layout on Android. Native-driven animations
    // update transforms on the native side directly, outside that snapshot
    // pipeline, which can leave the captured marker bitmap frozen or blank.
    const ringAnims = rings.map((ring, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * RING_STAGGER),
          Animated.timing(ring, {
            toValue: 1,
            duration: RING_DURATION,
            easing: Easing.out(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: false }),
        ])
      )
    );

    const blinkAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 1, duration: BLINK_DURATION, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(blink, { toValue: 0, duration: BLINK_DURATION, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    );

    ringAnims.forEach((a) => a.start());
    blinkAnim.start();

    return () => {
      ringAnims.forEach((a) => a.stop());
      blinkAnim.stop();
    };
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.ringHost}>
        {rings.map((ring, i) => {
          const scale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1.9] });
          const opacity = ring.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.5, 0] });
          return (
            <Animated.View
              key={i}
              style={[styles.ring, { borderColor: c.accent, transform: [{ scale }], opacity }]}
            />
          );
        })}

        {/* Existing own-location dot stays underneath, unchanged */}
        <View style={styles.dot}>
          <View style={styles.dotInner} />
        </View>

        {/* Bigger blinking arrow, layered on top of the dot at the same point */}
        <Animated.View style={[styles.arrowWrap, { opacity: blink, backgroundColor: c.ink }]}>
          <Navigation size={30} color="#ffffff" />
        </Animated.View>
      </View>

      <Animated.View style={[styles.labelWrap, { opacity: blink, backgroundColor: c.isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.9)' }]}>
        <Text style={[styles.label, { color: c.ink }]} numberOfLines={1}>
          {t('searching_driver')}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SEARCHING_PULSE_WIDTH,
    // react-native-maps needs an explicit height on a custom marker's root
    // view to snapshot it correctly on Android — without one, the height is
    // only known after the child layout pass, and the very first snapshot
    // (before that pass lands) can be captured at zero height, i.e. invisible.
    height: SEARCHING_PULSE_HEIGHT,
    alignItems: 'center',
  },
  ringHost: {
    width: RING_HOST, height: RING_HOST,
    alignItems: 'center', justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_BASE, height: RING_BASE, borderRadius: RING_BASE / 2,
    borderWidth: 1.5,
  },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(17,24,39,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  dotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#111827' },
  arrowWrap: {
    position: 'absolute',
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  labelWrap: {
    marginTop: LABEL_MARGIN_TOP, height: LABEL_WRAP_HEIGHT,
    paddingHorizontal: 10, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 12, fontWeight: '600' as any },
});
