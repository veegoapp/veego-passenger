import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import api from '../api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

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

  useEffect(() => {
    if (registered.current) return;
    registered.current = true;

    registerPushToken().then(async (token) => {
      if (!token) return;
      try {
        await api.post('/users/me/push-token', { token, platform: Platform.OS });
        console.log('[Push] Token registered successfully');
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
