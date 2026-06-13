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
import Constants from 'expo-constants';
import { BookingProvider } from '@/context/BookingContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { FavoritesProvider } from '@/context/FavoritesContext';
import { TabBarProvider } from '@/context/TabBarContext';
import { ServiceControlProvider } from '@/context/ServiceControlContext';
import { TripSheet } from '@/components/TripSheet';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { usePushToken } from '@/src/hooks/usePushToken';

SplashScreen.preventAutoHideAsync();

const IMAGE_ASSETS = [
  require('../assets/images/icon.png'),
  require('../assets/images/splash-icon.png'),
  require('../assets/images/adaptive-icon.png'),
  require('../assets/images/favicon.png'),
];

async function preloadAssets(): Promise<void> {
  await Promise.all([
    Asset.loadAsync(IMAGE_ASSETS),
  ]);
}

function handleNotificationDeepLink(notification: Notifications.Notification | null) {
  if (!notification) return;
  const data = (notification.request.content.data ?? {}) as Record<string, any>;
  const category = (data.category ?? data.type ?? '').toLowerCase();
  const deepLink: string = data.deep_link ?? data.deepLink ?? '';

  // Fix 7: Handle invite/share deep link: veego://shuttle/trip/{tripId}
  if (deepLink.startsWith('veego://shuttle/trip/')) {
    const tripId = deepLink.replace('veego://shuttle/trip/', '').split('?')[0];
    if (tripId) {
      router.push(`/trip-detail?id=${tripId}` as any);
      return;
    }
  }

  // Task 6: veego://ride/{id} → trip tracking screen
  if (deepLink.startsWith('veego://ride/')) {
    const rideId = deepLink.replace('veego://ride/', '').split('?')[0];
    if (rideId) {
      router.push(`/trip-tracking?id=${rideId}` as any);
      return;
    }
  }

  // Task 6: veego://promo/{code} → promo screen with code pre-filled
  if (deepLink.startsWith('veego://promo/')) {
    const promoCode = deepLink.replace('veego://promo/', '').split('?')[0];
    if (promoCode) {
      router.push(`/promo?code=${encodeURIComponent(promoCode)}` as any);
      return;
    }
  }

  // Fix 6: Booking confirmation notification — navigate to trip detail
  if (category === 'booking' || category === 'trip') {
    const tripId = data.tripId ?? data.trip_id ?? data.bookingId ?? data.booking_id ?? null;
    if (tripId) {
      router.push(`/trip-detail?id=${tripId}` as any);
    } else {
      router.push('/(tabs)/trips' as any);
    }
    return;
  }

  if (category === 'promo' && data.code) {
    router.push(`/promo?code=${encodeURIComponent(String(data.code))}` as any);
    return;
  }

  if (category === 'ride') {
    router.push('/(tabs)/car' as any);
    return;
  }
}

const isExpoGo = Constants.appOwnership === 'expo';

function AppShell() {
  const { darkMode } = useTheme();

  if (!isExpoGo) {
    usePushToken();
  }

  const notifSubRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === 'web' || isExpoGo) return;

    try {
      notifSubRef.current = Notifications.addNotificationResponseReceivedListener(
        (response) => handleNotificationDeepLink(response.notification),
      );

      Notifications.getLastNotificationResponseAsync()
        .then((response) => { if (response) handleNotificationDeepLink(response.notification); })
        .catch(() => {});
    } catch (e) {
      console.warn('[Notifications] Setup bypassed or failed:', e);
    }

    return () => {
      if (notifSubRef.current && typeof notifSubRef.current.remove === 'function') {
        notifSubRef.current.remove();
      }
    };
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
        <Stack.Screen name="ticket"        options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="trip-detail"   options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="promo"         options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="support"       options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="suspended"     options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="receipt"       options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
      </Stack>
      <TripSheet />
      <ConfirmSheet />
    </>
  );
}

export default function RootLayout() {
  const [assetsReady, setAssetsReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    preloadAssets()
      .catch((e) => console.warn('[Assets] Preload failed (non-fatal):', e))
      .finally(() => setAssetsReady(true));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const allReady = Platform.OS === 'web' || ((fontsLoaded || !!fontError) && assetsReady) || timedOut;

  useEffect(() => {
    if (allReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [allReady]);

  if (!allReady) return null;

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <TabBarProvider>
            <ServiceControlProvider>
              <BookingProvider>
                <FavoritesProvider>
                  <AppShell />
                </FavoritesProvider>
              </BookingProvider>
            </ServiceControlProvider>
          </TabBarProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </View>
  );
}
