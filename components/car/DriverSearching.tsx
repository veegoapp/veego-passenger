import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { Animation } from '@/constants/animations';

interface DriverSearchingProps {
  visible: boolean;
  onCancel?: () => void;
}

/**
 * Shown while actively searching for a driver. The car-icon radar animation
 * that used to live here has moved to the map itself — SearchingPulse (see
 * CarMap.tsx) layers a water-drop ripple over the passenger's own location
 * pin instead — so this card is just the status line and a Cancel button.
 */
export function DriverSearching({ visible, onCancel }: DriverSearchingProps) {
  const { colors: c, t } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      ...Animation.spring.sheet,
    }).start();
  }, [visible]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] });

  return (
    <Animated.View
      style={[styles.sheet, { opacity: slideAnim, transform: [{ translateY }] }]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View style={[styles.sheetSurface, { backgroundColor: c.white, borderColor: c.border }]}>
        <View style={[styles.handle, { backgroundColor: c.border }]} />

        <Text style={[styles.headline, { color: c.ink }]}>{t('searching_driver')}</Text>

        {onCancel && (
          <TouchableOpacity
            onPress={onCancel}
            activeOpacity={0.85}
            style={[styles.cancelBtn, { backgroundColor: c.surfaceMuted, borderColor: c.gold, marginBottom: insets.bottom }]}
          >
            <Text style={[styles.cancelText, { color: c.gold }]}>{t('cancel')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Floats off the screen edges with rounded corners on all sides, instead
  // of a full-width, top-only-rounded panel — matches the other redesigned
  // ride-cycle cards.
  sheet: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 26,
    zIndex: 999,
  },
  sheetSurface: {
    borderRadius: 28, borderWidth: 1,
    paddingTop: 10, paddingHorizontal: 20, paddingBottom: 20,
    alignItems: 'center',
  },
  handle: {
    width: 40, height: 5, borderRadius: 3,
    alignSelf: 'center', marginBottom: 20,
  },

  headline: {
    fontSize: 18, fontWeight: '700', letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 20,
  },

  cancelBtn: {
    width: '100%', height: 56, borderRadius: 16, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '700' },
});
