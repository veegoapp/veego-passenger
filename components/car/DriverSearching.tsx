import { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';

interface DriverSearchingProps {
  visible: boolean;
  onCancel?: () => void;
}

export function DriverSearching({ visible, onCancel }: DriverSearchingProps) {
  const { colors: c, t } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const pulseRing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 200,
    }).start();
  }, [visible]);

  useEffect(() => {
    const makeDot = (anim: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.delay(600),
      ]));

    const d1 = makeDot(dot1, 0);
    const d2 = makeDot(dot2, 200);
    const d3 = makeDot(dot3, 400);

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseRing, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseRing, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );

    if (visible) {
      d1.start(); d2.start(); d3.start(); pulse.start();
    } else {
      d1.stop(); d2.stop(); d3.stop(); pulse.stop();
      dot1.setValue(0); dot2.setValue(0); dot3.setValue(0); pulseRing.setValue(0);
    }

    return () => { d1.stop(); d2.stop(); d3.stop(); pulse.stop(); };
  }, [visible]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });
  const scale = pulseRing.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.4] });
  const opacity = pulseRing.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.2, 0] });

  const sheetBg = c.isDark ? 'rgba(16,16,32,0.98)' : 'rgba(250,250,252,0.98)';
  const borderCol = c.isDark ? 'rgba(90,95,160,0.25)' : 'rgba(255,255,255,0.8)';

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          backgroundColor: sheetBg,
          borderTopColor: borderCol,
          paddingBottom: Platform.OS === 'web' ? 20 : insets.bottom + 16,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View style={styles.handle} />

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Animated.View style={[styles.ring, { borderColor: '#55c49a', transform: [{ scale }], opacity }]} />
          <View style={[styles.iconCircle, { backgroundColor: c.isDark ? 'rgba(85,196,154,0.12)' : 'rgba(85,196,154,0.06)' }]}>
            <View style={[styles.iconInner, { backgroundColor: '#55c49a' }]}>
              <Text style={{ fontSize: 24 }}>⚡</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.title, { color: c.ink }]}>{t('searching_driver')}</Text>
        <Text style={[styles.subtitle, { color: c.inkSoft }]}>{t('searching_desc')}</Text>

        <View style={styles.dotsRow}>
          <Animated.View style={[styles.dot, { backgroundColor: '#55c49a', opacity: dot1 }]} />
          <Animated.View style={[styles.dot, { backgroundColor: '#55c49a', opacity: dot2 }]} />
          <Animated.View style={[styles.dot, { backgroundColor: '#55c49a', opacity: dot3 }]} />
        </View>

        {onCancel && (
          <TouchableOpacity style={[styles.cancelBtn, { borderColor: c.border }]} onPress={onCancel} activeOpacity={0.7}>
            <Text style={[styles.cancelTxt, { color: c.inkSoft }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 24,
    paddingTop: 6,
    zIndex: 999,
  },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(150,150,180,0.4)', alignSelf: 'center', marginBottom: 20 },
  content: { alignItems: 'center', paddingHorizontal: 24, gap: 14, paddingBottom: 8 },
  iconWrap: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 90, height: 90, borderRadius: 45, borderWidth: 2 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  iconInner: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 12 },
  dotsRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginVertical: 2 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  cancelBtn: { marginTop: 4, borderWidth: 1, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 10 },
  cancelTxt: { fontSize: 13.5, fontWeight: '600' },
});
