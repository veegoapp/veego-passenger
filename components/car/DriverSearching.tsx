import { useRef, useEffect, useMemo} from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { Animation } from '@/constants/animations';
import { useSplitColors, type SplitColors } from '@/constants/splitTheme';

interface DriverSearchingProps {
  visible: boolean;
  onCancel?: () => void;
}

const C_STRIP = '#111318';
const C_MINT = '#3DDC97';

/**
 * Shown while actively searching for a driver. The car-icon radar animation
 * that used to live here has moved to the map itself — SearchingPulse (see
 * CarMap.tsx) layers a water-drop ripple over the passenger's own location
 * pin instead — so this card is just the status line and a Cancel button.
 *
 * F · Minimal Bar — a thin dark status strip over a white row, matching the
 * in-trip card's language, fixed-palette regardless of the app's theme.
 */
export function DriverSearching({ visible, onCancel }: DriverSearchingProps) {
  const { t } = useTheme();
  const S = useSplitColors();
  const styles = useMemo(() => makeStyles(S), [S]);
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      ...Animation.spring.sheet,
    }).start();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    spinAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] });
  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={[styles.sheet, { bottom: 16 + insets.bottom, opacity: slideAnim, transform: [{ translateY }] }]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View style={styles.strip}>
        <View style={styles.stripDot} />
        <Text style={styles.stripText} numberOfLines={1}>{t('status_finding_driver')}</Text>
      </View>

      <View style={styles.mainBar}>
        <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]} />
        <Text style={styles.headline} numberOfLines={1}>{t('searching_driver')}</Text>

        {onCancel && (
          <TouchableOpacity onPress={onCancel} activeOpacity={0.85} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>{t('cancel')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

function makeStyles(S: SplitColors) {
  return StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    zIndex: 999,
  },
  strip: {
    backgroundColor: C_STRIP, borderRadius: 18, borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
    paddingHorizontal: 16, paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  stripDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C_MINT },
  stripText: { flex: 1, fontSize: 10, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase', color: S.cap },

  mainBar: {
    backgroundColor: S.card, borderRadius: 20, borderTopLeftRadius: 0, borderTopRightRadius: 0,
    paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.18, shadowRadius: 56, elevation: 12,
  },
  spinner: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 2.5,
    borderColor: S.hair, borderTopColor: S.ink, flexShrink: 0,
  },
  headline: { flex: 1, fontSize: 14, fontWeight: '800', color: S.ink },

  cancelBtn: {
    height: 36, borderRadius: 999, borderWidth: 1.5, borderColor: S.hair,
    paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: 12, fontWeight: '700', color: S.ink },
  });
}
