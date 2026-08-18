import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import api from '../../api/client';
import { useTheme } from '@/context/ThemeContext';
import { maybePromptBatteryOptimization } from './batteryOptimization';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    // Newer expo-notifications types require these; kept true to match the
    // existing "always show" behavior of shouldShowAlert above.
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerPushToken(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Permission not granted');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch (err) {
    console.warn('[Push] Failed to get token:', err);
    return null;
  }
}

export function usePushToken() {
  const registered = useRef(false);
  const { t } = useTheme();

  useEffect(() => {
    if (registered.current) return;
    registered.current = true;

    registerPushToken().then(async (token) => {
      if (!token) return;
      try {
        await api.post('/users/me/push-token', { token, platform: Platform.OS });
        console.log('[Push] Token registered successfully');
        // Only prompt once we know push actually works for this device —
        // no point asking the user to fix OEM battery settings otherwise.
        maybePromptBatteryOptimization({
          title: t('battery_optimization_title'),
          message: t('battery_optimization_message'),
          openSettingsLabel: t('battery_optimization_open_settings'),
          dontAskLabel: t('battery_optimization_dont_ask'),
          laterLabel: t('battery_optimization_later'),
        });
      } catch (e: any) {
        console.warn('[Push] Failed to register token:', e?.response?.data?.message ?? e?.message);
      }
    });

    // Foreground notification listener — shows alert even when app is open
    const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Push] Foreground notification:', notification.request.content.title);
    });

    return () => {
      foregroundSub.remove();
    };
  }, []);
}
