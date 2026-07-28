import { useEffect, useMemo, useRef, useState } from 'react';
import { Animation } from '@/constants/animations';
import { View, Text, StyleSheet, Animated, Easing, AppState, AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Navigation } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const LANG_KEY = '@veego_lang_selected';
const ONBOARDING_KEY = '@veego_has_seen_onboarding';

// Icon card is 80x80 (see iconInner). The arrow travels the card's own
// bottom-left-to-top-right diagonal, extended past both corners; iconInner's
// overflow:hidden + borderRadius clips it, so it isn't drawn at all until it
// crosses the bottom edge and is gone again once it clears the top edge.
const FLY_ICON_SIZE = 35;
const FLY_TRANSLATE_X = [-57.1, 102.1];
const FLY_TRANSLATE_Y = [102.1, -57.1];
const FLY_DURATION = 2370;

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

async function checkAuthAndNavigate(onAuthenticated: () => Promise<void>) {
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
    await onAuthenticated();
  } catch {
    // Do not fall back to /lang-select on unexpected errors (expired token,
    // network failure, initializeActiveSession throw, etc.). The user likely
    // already selected a language — routing them to lang-select resets the
    // first-launch flow incorrectly. /auth is the safe fallback: it handles
    // all unauthenticated states and never re-shows the language screen.
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
  const flyProgress = useRef(new Animated.Value(0)).current;
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
      Animated.loop(
        Animated.timing(flyProgress, { toValue: 1, duration: FLY_DURATION, easing: Easing.linear, useNativeDriver: true })
      ),
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
  const flyTranslateX = flyProgress.interpolate({ inputRange: [0, 1], outputRange: FLY_TRANSLATE_X });
  const flyTranslateY = flyProgress.interpolate({ inputRange: [0, 1], outputRange: FLY_TRANSLATE_Y });

  return (
    <LinearGradient colors={c.luxeGrad} style={styles.root}>
      <Animated.View style={[styles.content, { opacity, transform: [{ scale }] }]}>
        <Animated.View style={[styles.iconWrap, { transform: [{ rotate: rotateDeg }] }]}>
          <View style={styles.iconInner}>
            <View style={styles.iconClip}>
              <Animated.View
                style={[
                  styles.flyIcon,
                  { transform: [{ translateX: flyTranslateX }, { translateY: flyTranslateY }] },
                ]}
              >
                <Navigation size={FLY_ICON_SIZE} color={c.white} />
              </Animated.View>
            </View>
          </View>
          <View style={styles.iconGlow} />
        </Animated.View>
        <Text style={styles.wordmark}>VeeGo</Text>
        <Text style={styles.tagline}>{t('tagline')}</Text>
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
    // Separate from iconInner: overflow:hidden here (not on the shadow-casting
    // view above) so clipping the flying icon doesn't also clip the card's own
    // drop shadow.
    iconClip: { width: 80, height: 80, borderRadius: 28, overflow: 'hidden' },
    flyIcon: { position: 'absolute', left: 0, top: 0 },
    iconGlow: {
      position: 'absolute', width: 100, height: 100, borderRadius: 50,
      backgroundColor: 'rgba(30,30,40,0.08)',
    },
    wordmark: { fontSize: 46, fontWeight: Typography.weight.bold, color: c.ink, letterSpacing: -2.5, fontFamily: 'Inter_700Bold' },
    tagline: { fontSize: 13, color: c.inkSoft, letterSpacing: 0.2, fontFamily: 'Inter_400Regular' },
  });
}
