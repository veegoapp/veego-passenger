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

/**
 * Water-drop ripple layered over the map while the app is searching for a
 * driver: rings expanding/fading out from the passenger's own location,
 * a bigger Navigation arrow blinking on top, and a blinking "searching for
 * driver" label underneath.
 *
 * Rendered as a plain absolute-fill overlay CENTERED on the CarMap
 * container — not a MapView Marker. The "searching" camera effect in
 * CarMap.tsx always centers the map exactly on the passenger's own
 * location while this is visible, so a screen-centered overlay lines up
 * with the real coordinate without depending on a continuously
 * self-animating custom Marker view, which react-native-maps' native
 * snapshot pipeline (tracksViewChanges) doesn't reliably render — that
 * pipeline is built for markers whose CONTENT is static and whose
 * POSITION moves (see DriverMarker), not the reverse.
 */
export function SearchingPulse() {
  const { colors: c, t } = useTheme();

  const rings = useRef(
    Array.from({ length: RING_COUNT }, () => new Animated.Value(0))
  ).current;
  const blink = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ringAnims = rings.map((ring, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * RING_STAGGER),
          Animated.timing(ring, {
            toValue: 1,
            duration: RING_DURATION,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );

    const blinkAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 1, duration: BLINK_DURATION, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(blink, { toValue: 0, duration: BLINK_DURATION, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
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
    <View style={styles.overlay} pointerEvents="none">
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

        {/* The real own-location dot is CarMap's own Marker, geo-positioned
            independently — this overlay just needs to visually line up with
            it, not duplicate it. */}

        {/* Bigger blinking arrow, layered on top of the location dot */}
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
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
  arrowWrap: {
    position: 'absolute',
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  labelWrap: {
    marginTop: 6, height: 26,
    paddingHorizontal: 10, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 12, fontWeight: '600' as any },
});
