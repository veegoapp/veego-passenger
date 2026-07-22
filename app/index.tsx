import { useEffect, useMemo, useRef } from 'react';
import { Animation } from '@/constants/animations';
import { View, Text, StyleSheet, Dimensions, Animated, Easing, AppState, AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Navigation } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeColors } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';
import { tokenStore } from '@/src/api/client';
import api from '@/src/api/client';
import { clearSession } from '@/src/api/session';
import { getActiveRide } from '@/src/api/rideService';
import { normalizeRideStatus } from '@/src/api/socket';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';

const LANG_KEY = '@veego_lang_selected';
const ONBOARDING_KEY = '@veego_has_seen_onboarding';
const { width } = Dimensions.get('window');

function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

async function markOnboardingSeen(): Promise<void> {
  try { await AsyncStorage.setItem(ONBOARDING_KEY, '1'); } catch {}
}

/**
 * Onboarding is a first-install-only screen. Once a device has seen it (or
 * has ever been authenticated) it must never resurface — logout, expiry, and
 * failed refresh should all land on /auth instead.
 */
async function routeUnauthenticated(): Promise<void> {
  const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
  router.replace(seen === '1' ? '/auth' : '/onboarding');
}

async function attemptTokenRefresh(): Promise<boolean> {
  try {
    const refreshToken = await tokenStore.getToken(tokenStore.REFRESH_KEY);
    if (!refreshToken) return false;
    const { data } = await api.post('/auth/refresh', { refreshToken });
    const newToken = data.accessToken ?? data.access_token ?? data.token;
    if (!newToken) return false;
    await tokenStore.setToken(tokenStore.TOKEN_KEY, newToken);
    return true;
  } catch {
    return false;
  }
}

const RESUMABLE_RIDE_SERVICES = new Set(['car', 'scooter', 'delivery']);

/**
 * F3: checks for an in-progress car/scooter/delivery ride via the existing
 * GET /rides/active endpoint so a cold start can route straight back into
 * that ride's flow instead of defaulting to Home's shuttle mode. Any failure
 * here is treated the same as "no active ride" — this must never block
 * normal navigation.
 */
async function checkActiveRideService(): Promise<string | null> {
  try {
    const data = await getActiveRide();
    const ride = data?.data ?? data;
    if (!ride?.id) return null;
    const status = normalizeRideStatus(ride.status ?? ride.rideStatus);
    if (!status || status === 'completed' || status === 'cancelled') return null;
    const vehicleType = ride.vehicleType ?? ride.type ?? ride.serviceType;
    return RESUMABLE_RIDE_SERVICES.has(vehicleType) ? vehicleType : null;
  } catch {
    return null;
  }
}

async function checkAuthAndNavigate() {
  try {
    const langSelected = await AsyncStorage.getItem(LANG_KEY);
    if (!langSelected) { router.replace('/lang-select'); return; }

    const token = await tokenStore.getToken(tokenStore.TOKEN_KEY);
    if (!token) { await routeUnauthenticated(); return; }

    const payload = decodeJwtPayload(token);
    if (!payload) { await routeUnauthenticated(); return; }

    if ((payload.exp ?? 0) <= Math.floor(Date.now() / 1000)) {
      const refreshed = await attemptTokenRefresh();
      if (!refreshed) {
        await tokenStore.removeToken(tokenStore.TOKEN_KEY);
        await tokenStore.removeToken(tokenStore.REFRESH_KEY);
        await clearSession();
        await routeUnauthenticated();
        return;
      }
    }

    // A device that reaches the app with a valid session has clearly moved
    // past first-run — make sure a later logout on this device skips onboarding too.
    await markOnboardingSeen();
    const resumeService = await checkActiveRideService();
    router.replace((resumeService ? `/(tabs)?resumeService=${resumeService}` : '/(tabs)') as any);
  } catch {
    router.replace('/lang-select');
  }
}

export function useAuthOnResume() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        const token = await tokenStore.getToken(tokenStore.TOKEN_KEY);
        if (!token) { await routeUnauthenticated(); return; }
        const payload = decodeJwtPayload(token);
        if (!payload || (payload.exp ?? 0) <= Math.floor(Date.now() / 1000)) {
          const refreshed = await attemptTokenRefresh();
          if (!refreshed) {
            await tokenStore.removeToken(tokenStore.TOKEN_KEY);
            await tokenStore.removeToken(tokenStore.REFRESH_KEY);
            await clearSession();
            await routeUnauthenticated();
          }
        }
      }
    });
    return () => subscription.remove();
  }, []);
}

export default function SplashPage() {
  const { colors: c, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(new Animated.Value(0)).current;
  const barOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(opacity, { toValue: 1, damping: 22, stiffness: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, damping: 22, stiffness: 100, useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(logoRotate, { toValue: 8, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(logoRotate, { toValue: -8, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(logoRotate, { toValue: 0, duration: Animation.duration.slower, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(barOpacity, { toValue: 1, duration: Animation.duration.normal, useNativeDriver: false }),
      ]),
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(barWidth, { toValue: width * 0.55, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    ]).start();

    const t = setTimeout(() => { checkAuthAndNavigate(); }, 2200);
    return () => clearTimeout(t);
  }, []);

  const rotateDeg = logoRotate.interpolate({ inputRange: [-8, 8], outputRange: ['-8deg', '8deg'] });

  return (
    <LinearGradient colors={c.luxeGrad} style={styles.root}>
      <Animated.View style={[styles.content, { opacity, transform: [{ scale }] }]}>
        <Animated.View style={[styles.iconWrap, { transform: [{ rotate: rotateDeg }] }]}>
          <View style={styles.iconInner}>
            <Navigation size={32} color={c.white} />
          </View>
          <View style={styles.iconGlow} />
        </Animated.View>
        <Text style={styles.wordmark}>VeeGo</Text>
        <Text style={styles.tagline}>{t('tagline')}</Text>
        <View style={styles.barWrap}>
          <Animated.View style={[styles.bar, { width: barWidth, opacity: barOpacity }]} />
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { alignItems: 'center', gap: Spacing.lg },
    iconWrap: { position: 'relative', width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
    iconInner: {
      width: 80, height: 80, borderRadius: 28, backgroundColor: c.ink,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: c.ink, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.25, shadowRadius: 32, elevation: 10,
    },
    iconGlow: {
      position: 'absolute', width: 100, height: 100, borderRadius: 50,
      backgroundColor: 'rgba(30,30,40,0.08)',
    },
    wordmark: { fontSize: 46, fontWeight: Typography.weight.bold, color: c.ink, letterSpacing: -2.5, fontFamily: 'Inter_700Bold' },
    tagline: { fontSize: 13, color: c.inkSoft, letterSpacing: 0.2, fontFamily: 'Inter_400Regular' },
    barWrap: {
      width: 220, height: 4, borderRadius: 2, backgroundColor: c.border, overflow: 'hidden', marginTop: Spacing.sm,
    },
    bar: { height: 4, borderRadius: 2, backgroundColor: c.ink },
  });
}
