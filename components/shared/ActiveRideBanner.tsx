import { useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Navigation } from 'lucide-react-native';
import { useActiveSession } from '@/context/ActiveSessionContext';
import { selectActiveRide } from '@/src/session/activeRideSelectors';
import { useTheme } from '@/context/ThemeContext';
import { useTabBar } from '@/context/TabBarContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RideStatus } from '@/src/api/socket';
import type { ThemeColors } from '@/constants/colors';

/**
 * Floating banner that appears whenever the passenger has an active car/scooter/
 * delivery ride but is NOT on the home tab (where CarServiceScreen already lives).
 * Tapping it navigates back to the home tab so the ride UI resumes.
 */

function statusLabel(status: RideStatus, t: (key: any) => string): string {
  switch (status) {
    case 'searching':       return t('active_ride_banner_searching');
    case 'driver_assigned': return t('active_ride_banner_assigned');
    case 'arrived':         return t('active_ride_banner_arrived');
    case 'started':         return t('active_ride_banner_started');
    default:                return t('active_ride_banner_assigned');
  }
}

export function ActiveRideBanner() {
  const { session } = useActiveSession();
  const activeRide  = useMemo(() => selectActiveRide(session), [session]);
  const router      = useRouter();
  const pathname    = usePathname();
  const { colors: c, t } = useTheme();
  const { tabBarHeight } = useTabBar();
  const insets      = useSafeAreaInsets();
  const styles      = useMemo(() => makeStyles(c), [c]);

  // Slide-up / slide-down animation
  const translateY = useRef(new Animated.Value(120)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  // Hide banner on home tab — CarServiceScreen owns that screen.
  // usePathname returns '/' or '/index' for the tabs index route.
  const onHomeTab = pathname === '/' || pathname === '/index' || pathname === '/(tabs)' || pathname === '/(tabs)/index';
  const visible   = !!activeRide && !onHomeTab;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: visible ? 0 : 120,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  if (!activeRide) return null;

  const label    = statusLabel(activeRide.status, t);
  const subLabel = activeRide.driver?.name ?? t('active_ride_banner_tap');

  const BOTTOM = tabBarHeight + insets.bottom + 12;

  return (
    <Animated.View
      style={[styles.wrapper, { bottom: BOTTOM, opacity, transform: [{ translateY }] }]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <TouchableOpacity
        style={styles.pill}
        onPress={() => router.push('/(tabs)' as any)}
        activeOpacity={0.88}
      >
        <View style={styles.iconWrap}>
          <Navigation size={16} color="#fff" />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>{label}</Text>
          <Text style={styles.sub} numberOfLines={1}>{subLabel}</Text>
        </View>
        <View style={styles.dot} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      position: 'absolute',
      left: 16,
      right: 16,
      zIndex: 200,
      alignItems: 'center',
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.ink,
      borderRadius: 20,
      paddingVertical: 10,
      paddingHorizontal: 14,
      width: '100%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 14,
      elevation: 8,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#3CC97A',
      alignItems: 'center',
      justifyContent: 'center',
    },
    textWrap: {
      flex: 1,
    },
    title: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    sub: {
      color: 'rgba(255,255,255,0.55)',
      fontSize: 11,
      fontWeight: '500',
      marginTop: 1,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#3CC97A',
    },
  });
}
