import { useEffect, useRef, useState } from 'react';
import { View, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { Asset } from 'expo-asset';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { BookingProvider } from '@/context/BookingContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { FavoritesProvider } from '@/context/FavoritesContext';
import { TabBarProvider } from '@/context/TabBarContext';
import { TripSheet } from '@/components/TripSheet';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { usePushToken } from '@/src/hooks/usePushToken';

// Keep splash visible until we explicitly hide it
SplashScreen.preventAutoHideAsync();

// All local image assets to cache before first render
const IMAGE_ASSETS = [
  require('../assets/images/icon.png'),
  require('../assets/images/splash-icon.png'),
  require('../assets/images/adaptive-icon.png'),
  require('../assets/images/favicon.png'),
];

async function preloadAssets(): Promise<void> {
  await Promise.all([
    // Download & cache every image asset
    Asset.loadAsync(IMAGE_ASSETS),
  ]);
}

function handleNotificationDeepLink(notification: Notifications.Notification | null) {
  if (!notification) return;
  const data = (notification.request.content.data ?? {}) as Record<string, any>;
  const category = (data.category ?? data.type ?? '').toLowerCase();

  if (category === 'promo' && data.code) {
    router.push(`/promo?code=${encodeURIComponent(String(data.code))}` as any);
  } else if (category === 'booking' || category === 'trip') {
    router.push('/(tabs)/trips' as any);
  } else if (category === 'ride') {
    router.push('/(tabs)/car' as any);
  }
}

function AppShell() {
  const { darkMode } = useTheme();
  usePushToken();

  const notifSubRef = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Tapped while app is in background
    notifSubRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => handleNotificationDeepLink(response.notification),
    );

    // Tapped when app was fully killed (cold start)
    Notifications.getLastNotificationResponseAsync()
      .then((response) => { if (response) handleNotificationDeepLink(response.notification); })
      .catch(() => {});

    return () => { notifSubRef.current?.remove(); };
  }, []);

  return (
    <>
      <StatusBar style={darkMode ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="lang-select" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="stations"     options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="ticket"       options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="promo"        options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="support"      options={{ animation: 'slide_from_right' }} />
      </Stack>
      <TripSheet />
      <ConfirmSheet />
    </>
  );
}

export default function RootLayout() {
  const [assetsReady, setAssetsReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // 1. Preload Google-fonts Inter variants
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // 2. Preload image assets concurrently
  useEffect(() => {
    preloadAssets()
      .catch((e) => console.warn('[Assets] Preload failed (non-fatal):', e))
      .finally(() => setAssetsReady(true));
  }, []);

  // 3. Safety timeout — if fonts/assets stall on web, unblock after 3 s
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(t);
  }, []);

  // 4. On web, SplashScreen is a no-op so render immediately.
  //    On native, wait for fonts+assets or the 3-second fallback.
  const allReady = Platform.OS === 'web' || ((fontsLoaded || !!fontError) && assetsReady) || timedOut;

  useEffect(() => {
    if (allReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [allReady]);

  // 5. Render nothing while loading — prevents flash of unstyled content
  if (!allReady) return null;

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <TabBarProvider>
            <BookingProvider>
              <FavoritesProvider>
                <AppShell />
              </FavoritesProvider>
            </BookingProvider>
          </TabBarProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </View>
  );
}
