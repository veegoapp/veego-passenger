import { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useTabBar } from '@/context/TabBarContext';
import { useTheme } from '@/context/ThemeContext';
import { GlassView } from '@/components/ui/GlassView';
import { Animation } from '@/constants/animations';
import { Spacing } from '@/constants/spacing';

interface DriverSearchingProps {
  visible: boolean;
  onCancel?: () => void;
}

/**
 * Shown while actively searching for a driver. The searching visual itself
 * (ripple rings + blinking arrow + "searching" label) now lives on the map,
 * layered over the passenger's own-location dot — see SearchingPulse.tsx and
 * CarMap.tsx's `searching` prop. This sheet is just the Cancel action.
 */
export function DriverSearching({ visible, onCancel }: DriverSearchingProps) {
  const { colors: c, t } = useTheme();
  const { tabBarHeight } = useTabBar();
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      ...Animation.spring.sheet,
    }).start();
  }, [visible]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 0] });
  const isDark = c.isDark;

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          opacity: slideAnim,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <GlassView strong borderRadius={28} style={[styles.sheetGlass, { paddingBottom: tabBarHeight + 20 }]}>
      <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)' }]} />

      {onCancel && (
        <TouchableOpacity
          onPress={onCancel}
          activeOpacity={0.75}
          style={[styles.cancelBtn, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
          }]}
        >
          <Text style={[styles.cancelText, { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }]}>
            {t('cancel')}
          </Text>
        </TouchableOpacity>
      )}
      </GlassView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: -14 },
    shadowOpacity: 0.3, shadowRadius: 30, elevation: 26,
    zIndex: 999,
  },
  sheetGlass: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0,
    paddingTop: 14,
    paddingHorizontal: 28,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: Spacing.lg,
  },
  cancelBtn: {
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6,
    // Translucent (rgba) background above means Android elevation can't
    // trace the rounded corners and draws a square shadow instead — off.
    elevation: 0,
  },
  cancelText: {
    fontSize: 15, fontWeight: '600' as any,
  },
});
