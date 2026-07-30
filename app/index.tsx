import { useEffect, useMemo, useRef, useState } from 'react';
import { Animation } from '@/constants/animations';
import { View, Text, StyleSheet, Dimensions, Animated, Easing, AppState, AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Navigation } from 'lucide-react-native';
import type { ThemeColors } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';
import { tokenStore } from '@/src/api/client';
import api from '@/src/api/client';
import { clearSession } from '@/src/api/session';
import { useActiveSession } from '@/context/ActiveSessionContext';
import { getActiveSessionRecoveryDestination } from '@/src/session/activeSessionNavigation';
import type { NormalizedPassengerActiveSession } from '@/src/session/activeSessionTypes';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';

const { width } = Dimensions.get('window');

function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

async function routeUnauthenticated(): Promise<void> {
  router.replace('/auth');
}

// Return value distinguishes a genuine rejection from a transient failure:
//   true      — refreshed successfully
//   false     — the refresh token itself was rejected (or none exists) —
//               the session is genuinely over, safe to log out
//   undefined — network error, timeout, or a server/5xx hiccup — we don't
//               know whether the refresh token is still good, so callers
//               must NOT log the user out over this (a server outage used
//               to force every session back to the login screen the
//               instant an access token expired)
async function attemptTokenRefresh(): Promise<boolean | undefined> {
  try {
    const refreshToken = await tokenStore.getToken(tokenStore.REFRESH_KEY);
    if (!refreshToken) return false;
    const { data } = await api.post('/auth/refresh', { refreshToken });
    const newToken = data.accessToken ?? data.access_token ?? data.token;
    if (!newToken) return undefined;
    await tokenStore.setToken(tokenStore.TOKEN_KEY, newToken);
    return true;
  } catch (err: any) {
    const status = err?.response?.status;
    // 401/403 = the refresh token itself was rejected. Anything else
    // (no response at all, 5xx, timeout, ...) is a connectivity/server
    // hiccup, not a verdict on the token.
    return (status === 401 || status === 403) ? false : undefined;
  }
}

async function checkAuthAndNavigate(onAuthenticated: () => Promise<void>) {
  try {
    const token = await tokenStore.getToken(tokenStore.TOKEN_KEY);
    if (!token) { await routeUnauthenticated(); return; }

    const payload = decodeJwtPayload(token);
    if (!payload) { await routeUnauthenticated(); return; }

    if ((payload.exp ?? 0) <= Math.floor(Date.now() / 1000)) {
      const refreshed = await attemptTokenRefresh();
      if (refreshed === false) {
        await tokenStore.removeToken(tokenStore.TOKEN_KEY);
        await tokenStore.removeToken(tokenStore.REFRESH_KEY);
        await clearSession();
        await routeUnauthenticated();
        return;
      }
      // true or undefined (transient failure) — proceed either way; a
      // dropped connection or server hiccup shouldn't force a logout, and
      // any subsequent API call retries the refresh via the client's own
      // 401 interceptor.
    }

    await onAuthenticated();
  } catch {
    // /auth is the safe fallback on unexpected errors (expired token,
    // network failure, initializeActiveSession throw, etc.) — it handles
    // all unauthenticated states.
    router.replace('/auth');
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
          if (refreshed === false) {
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
  const {
    session: activeSession,
    initialized: activeSessionInitialized,
    error: activeSessionError,
    initializeActiveSession,
  } = useActiveSession();
  const styles = useMemo(() => makeStyles(c), [c]);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(new Animated.Value(0)).current;
  const barOpacity = useRef(new Animated.Value(0)).current;
  const startupAuthStarted = useRef(false);
  const startupNavigationCompleted = useRef(false);
  const [authenticationReady, setAuthenticationReady] = useState(false);

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

    const t = setTimeout(() => {
      if (startupAuthStarted.current) return;
      startupAuthStarted.current = true;
      checkAuthAndNavigate(async () => {
        setAuthenticationReady(true);
        await initializeActiveSession();
      }).catch(() => {});
    }, 2200);
    return () => clearTimeout(t);
  }, [initializeActiveSession]);

  useEffect(() => {
    if (!authenticationReady || !activeSessionInitialized || startupNavigationCompleted.current) {
      return;
    }

    startupNavigationCompleted.current = true;
    if (activeSessionError && __DEV__) {
      console.warn('[ActiveSession] cold-start fetch failed; using normal startup fallback:', activeSessionError);
    }

    const destination = getActiveSessionRecoveryDestination(
      activeSession as NormalizedPassengerActiveSession | null,
    );
    router.replace(destination as any);
  }, [
    activeSession,
    activeSessionError,
    activeSessionInitialized,
    authenticationReady,
  ]);

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
        <Text style={styles.wordmark}>Vee<Text style={{ color: '#507BE9' }}>Go</Text></Text>
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
