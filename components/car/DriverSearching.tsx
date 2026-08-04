import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { Car } from 'lucide-react-native';
import { useTabBar } from '@/context/TabBarContext';
import { useTheme } from '@/context/ThemeContext';
import { Animation } from '@/constants/animations';

interface DriverSearchingProps {
  visible: boolean;
  onCancel?: () => void;
}

/**
 * Shown while actively searching for a driver.
 * Lovable design: centered radar animation with pulsing rings + sweep,
 * car icon in the middle, shimmer dots below, cancel ghost button.
 */
export function DriverSearching({ visible, onCancel }: DriverSearchingProps) {
  const { colors: c, t } = useTheme();
  const { tabBarHeight } = useTabBar();
  const slideAnim  = useRef(new Animated.Value(0)).current;
  const sweepAnim  = useRef(new Animated.Value(0)).current;
  const ring1Anim  = useRef(new Animated.Value(0)).current;
  const ring2Anim  = useRef(new Animated.Value(0)).current;
  const ring3Anim  = useRef(new Animated.Value(0)).current;
  const dot1Anim   = useRef(new Animated.Value(0.35)).current;
  const dot2Anim   = useRef(new Animated.Value(0.35)).current;
  const dot3Anim   = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      ...Animation.spring.sheet,
    }).start();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    /* Radar rings — scale from 0.35→1.6 then fade out */
    const makeRing = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(anim, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          ]),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    const r1 = makeRing(ring1Anim, 0);
    const r2 = makeRing(ring2Anim, 800);
    const r3 = makeRing(ring3Anim, 1600);
    r1.start(); r2.start(); r3.start();

    /* Sweep rotation */
    const sweep = Animated.loop(
      Animated.timing(sweepAnim, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true })
    );
    sweep.start();

    /* Shimmer dots */
    const makeDot = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 450, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.35, duration: 450, useNativeDriver: true }),
        ])
      );
    const d1 = makeDot(dot1Anim, 0);
    const d2 = makeDot(dot2Anim, 250);
    const d3 = makeDot(dot3Anim, 500);
    d1.start(); d2.start(); d3.start();

    return () => {
      r1.stop(); r2.stop(); r3.stop(); sweep.stop();
      d1.stop(); d2.stop(); d3.stop();
      ring1Anim.setValue(0); ring2Anim.setValue(0); ring3Anim.setValue(0);
      sweepAnim.setValue(0);
      dot1Anim.setValue(0.35); dot2Anim.setValue(0.35); dot3Anim.setValue(0.35);
    };
  }, [visible]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] });

  const isDark = c.isDark;
  const cardBg    = c.white;
  const surfaceBg = c.surfaceMuted;
  const borderCol = c.border;
  const primaryCol = c.primary;

  const makeRingStyle = (anim: Animated.Value) => ({
    position: 'absolute' as const,
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(30,30,40,0.07)',
    transform: [
      {
        scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1.6] }),
      },
    ],
    opacity: anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.55, 0.4, 0] }),
  });

  const sweepRotate = sweepAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={[styles.sheet, { opacity: slideAnim, transform: [{ translateY }] }]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View style={[styles.sheetSurface, { backgroundColor: cardBg, paddingBottom: tabBarHeight + 20 }]}>
        <View style={[styles.handle, { backgroundColor: borderCol }]} />

        {/* ── Radar animation ── */}
        <View style={styles.radarWrap}>
          {/* Pulse rings */}
          <Animated.View style={makeRingStyle(ring1Anim)} />
          <Animated.View style={makeRingStyle(ring2Anim)} />
          <Animated.View style={makeRingStyle(ring3Anim)} />

          {/* Static border ring */}
          <View style={[styles.staticRing, { borderColor: borderCol }]} />

          {/* Sweep arc */}
          <Animated.View style={[styles.sweepWrap, { transform: [{ rotate: sweepRotate }] }]}>
            <View style={[styles.sweepArc, { borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(30,30,40,0.22)' }]} />
          </Animated.View>

          {/* Center car icon */}
          <View style={[styles.centerIcon, { backgroundColor: primaryCol }]}>
            <Car size={22} color="#ffffff" strokeWidth={1.8} />
          </View>
        </View>

        {/* ── Status text ── */}
        <Text style={[styles.headline, { color: c.ink }]}>
          {t('searching_driver')}
        </Text>
        <Text style={[styles.subtext, { color: c.inkSoft }]}>
          {'Matching you with the closest driver'}
        </Text>

        {/* ── Shimmer dots ── */}
        <View style={styles.dotsRow}>
          {[dot1Anim, dot2Anim, dot3Anim].map((dot, i) => (
            <Animated.View
              key={i}
              style={[styles.dot, { backgroundColor: primaryCol, opacity: dot }]}
            />
          ))}
        </View>

        {/* ── Wait time info row ── */}
        <View style={[styles.waitRow, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
          <Text style={[styles.waitLabel, { color: c.inkSoft }]}>{'Average wait time'}</Text>
          <Text style={[styles.waitValue, { color: c.ink }]}>~ 2 {t('min')}</Text>
        </View>

        {/* ── Cancel button ── */}
        {onCancel && (
          <TouchableOpacity
            onPress={onCancel}
            activeOpacity={0.78}
            style={[styles.cancelBtn, { borderColor: borderCol, backgroundColor: surfaceBg }]}
          >
            <Text style={[styles.cancelText, { color: c.ink }]}>{t('cancel')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 26,
    zIndex: 999,
  },
  sheetSurface: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  handle: {
    width: 40, height: 5, borderRadius: 3,
    alignSelf: 'center', marginBottom: 24,
  },

  radarWrap: {
    width: 112, height: 112,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  staticRing: {
    position: 'absolute',
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 1,
  },
  sweepWrap: {
    position: 'absolute',
    width: 96, height: 96,
  },
  sweepArc: {
    position: 'absolute',
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 2,
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: 'transparent',
  },
  centerIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 6,
  },

  headline: {
    fontSize: 20, fontWeight: '700', letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 14, textAlign: 'center', marginTop: 4, lineHeight: 20,
  },
  dotsRow: {
    flexDirection: 'row', gap: 6, marginTop: 16, marginBottom: 20,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
  },

  waitRow: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 12,
  },
  waitLabel: { fontSize: 13, fontWeight: '500' },
  waitValue: { fontSize: 13, fontWeight: '600' },

  cancelBtn: {
    width: '100%', height: 56, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600' },
});
