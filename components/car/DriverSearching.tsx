import { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { Car, Bike, Package } from 'lucide-react-native';
import { useTabBar } from '@/context/TabBarContext';
import { useTheme } from '@/context/ThemeContext';
import { Animation } from '@/constants/animations';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';

interface DriverSearchingProps {
  visible: boolean;
  onCancel?: () => void;
  serviceType?: 'car' | 'scooter' | 'delivery';
}

function getServiceConfig(serviceType: 'car' | 'scooter' | 'delivery' | undefined) {
  switch (serviceType) {
    case 'scooter':
      return { accentColor: '#10B981', IconComponent: Bike };
    case 'delivery':
      return { accentColor: '#8B5CF6', IconComponent: Package };
    case 'car':
    default:
      return { accentColor: '#3B82F6', IconComponent: Car };
  }
}

const RING_COUNT = 4;
const RING_DURATION = 2200;
const RING_STAGGER = 550;

export function DriverSearching({ visible, onCancel, serviceType }: DriverSearchingProps) {
  const { colors: c, t } = useTheme();
  const { tabBarHeight } = useTabBar();
  const slideAnim = useRef(new Animated.Value(0)).current;

  // One animated value per radar ring
  const rings = useRef(
    Array.from({ length: RING_COUNT }, () => new Animated.Value(0))
  ).current;

  // Scanning bar
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      ...Animation.spring.sheet,
    }).start();
  }, [visible]);

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
          Animated.timing(ring, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      )
    );

    const scan = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );

    if (visible) {
      ringAnims.forEach((a) => a.start());
      scan.start();
    } else {
      ringAnims.forEach((a) => a.stop());
      scan.stop();
      rings.forEach((r) => r.setValue(0));
      scanAnim.setValue(0);
    }

    return () => {
      ringAnims.forEach((a) => a.stop());
      scan.stop();
    };
  }, [visible]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [380, 0] });
  const isDark = c.isDark;
  const { accentColor, IconComponent } = getServiceConfig(serviceType);
  const panelBg = isDark ? 'rgba(10,10,22,0.97)' : 'rgba(250,250,254,0.97)';

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          backgroundColor: panelBg,
          paddingBottom: tabBarHeight + 20,
          opacity: slideAnim,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      {/* Drag handle */}
      <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)' }]} />

      <View style={styles.body}>
        {/* Radar animation */}
        <View style={styles.radarWrap}>
          {rings.map((ring, i) => {
            const scale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1.9] });
            const opacity = ring.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.55, 0] });
            return (
              <Animated.View
                key={i}
                style={[
                  styles.ring,
                  {
                    borderColor: accentColor,
                    transform: [{ scale }],
                    opacity,
                  },
                ]}
              />
            );
          })}

          {/* Centre icon */}
          <View style={[styles.iconOuter, { backgroundColor: isDark ? `${accentColor}1F` : `${accentColor}14` }]}>
            <View style={[styles.iconInner, { backgroundColor: accentColor }]}>
              <IconComponent size={22} color="#ffffff" />
            </View>
          </View>
        </View>

        {/* Status text */}
        <View style={styles.textZone}>
          <Text style={[styles.title, { color: isDark ? '#e8e8f2' : '#1e1e28' }]}>
            {t('searching_driver')}
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.42)' }]}>
            {t('searching_desc')}
          </Text>
        </View>

        {/* Scanning bar */}
        <View style={[styles.scanTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }]}>
          <Animated.View
            style={[
              styles.scanBar,
              {
                backgroundColor: accentColor,
                width: scanAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        {/* Cancel */}
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
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: -14 },
    shadowOpacity: 0.3, shadowRadius: 30, elevation: 26,
    paddingTop: 8, zIndex: 999,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: Spacing.xl,
  },
  body: {
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 20,
    paddingBottom: Spacing.md,
  },

  // Radar
  radarWrap: {
    width: 120, height: 120,
    alignItems: 'center', justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 1.5,
  },
  iconOuter: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: 'center', justifyContent: 'center',
  },
  iconInner: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },

  // Text
  textZone: { alignItems: 'center', gap: 6 },
  title: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    letterSpacing: -0.3,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 16,
  },

  // Scan bar
  scanTrack: {
    width: '80%', height: 3, borderRadius: 2, overflow: 'hidden',
  },
  scanBar: {
    height: '100%', borderRadius: 2,
  },

  // Cancel
  cancelBtn: {
    paddingVertical: 13, paddingHorizontal: 40,
    borderRadius: 14, borderWidth: 1,
  },
  cancelText: {
    fontSize: 14, fontWeight: '600' as any,
  },
});
