import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useTabBar } from '@/context/TabBarContext';
import { useTheme } from '@/context/ThemeContext';
import { Animation } from '@/constants/animations';

interface DriverSearchingProps {
  visible: boolean;
  onCancel?: () => void;
}

/**
 * Shown while actively searching for a driver. The searching visual itself
 * (ripple rings + blinking arrow + "searching" label) lives on the map via
 * SearchingPulse.tsx. This sheet shows the status text and Cancel action.
 */
export function DriverSearching({ visible, onCancel }: DriverSearchingProps) {
  const { colors: c, t } = useTheme();
  const { tabBarHeight } = useTabBar();
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Animated dots for "Searching..." label
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      ...Animation.spring.sheet,
    }).start();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const pulse = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      );
    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 180);
    const a3 = pulse(dot3, 360);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); dot1.setValue(0); dot2.setValue(0); dot3.setValue(0); };
  }, [visible]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 0] });
  const isDark = c.isDark;
  const sheetBg = isDark ? '#16162a' : '#ffffff';
  const borderColor = isDark ? '#2c2c46' : '#e5e5ea';
  const mutedText = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.4)';

  return (
    <Animated.View
      style={[
        styles.sheet,
        { opacity: slideAnim, transform: [{ translateY }] },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View style={[styles.sheetSurface, { backgroundColor: sheetBg, paddingBottom: tabBarHeight + 20 }]}>
        <View style={[styles.handle, { backgroundColor: borderColor }]} />

        {/* Status row */}
        <View style={styles.statusRow}>
          {/* Pulsing indicator dot */}
          <View style={[styles.pulsingDotWrap, { backgroundColor: c.accent + '1F' }]}>
            <View style={[styles.pulsingDot, { backgroundColor: c.accent }]} />
          </View>

          <View style={styles.statusTextWrap}>
            <Text style={[styles.statusTitle, { color: c.ink }]}>
              {t('searching_driver')}
            </Text>
            <Text style={[styles.statusSub, { color: mutedText }]}>
              Finding the nearest driver for you
            </Text>
          </View>

          {/* Animated dots */}
          <View style={styles.dotsWrap}>
            {[dot1, dot2, dot3].map((dot, i) => (
              <Animated.View
                key={i}
                style={[styles.dot, { backgroundColor: c.accent, opacity: dot }]}
              />
            ))}
          </View>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: borderColor }]} />

        {/* Cancel button */}
        {onCancel && (
          <TouchableOpacity
            onPress={onCancel}
            activeOpacity={0.75}
            style={[styles.cancelBtn, {
              borderColor,
              backgroundColor: isDark ? '#1e1e32' : '#f8f8fb',
            }]}
          >
            <Text style={[styles.cancelText, { color: mutedText }]}>
              {t('cancel')}
            </Text>
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
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 26,
    zIndex: 999,
  },
  sheetSurface: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20,
  },
  pulsingDotWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  pulsingDot: {
    width: 14, height: 14, borderRadius: 7,
  },
  statusTextWrap: { flex: 1 },
  statusTitle: {
    fontSize: 16, fontWeight: '700' as any, letterSpacing: -0.3,
  },
  statusSub: {
    fontSize: 12.5, fontWeight: '500' as any, marginTop: 3,
  },
  dotsWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingRight: 4,
  },
  dot: {
    width: 7, height: 7, borderRadius: 3.5,
  },
  divider: {
    height: 1, marginBottom: 16,
  },
  cancelBtn: {
    height: 52, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15, fontWeight: '600' as any,
  },
});
