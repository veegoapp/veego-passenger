/**
 * Advisory prompt asking the passenger to exempt VeeGo from OEM battery
 * optimization (Xiaomi/MIUI, Huawei, Oppo/ColorOS, Vivo, Samsung, ...).
 *
 * These OEM battery managers can suspend the app process and throttle FCM/Expo
 * push delivery even when the server sends a high-priority notification-type
 * message — no app code can override that without the user opting the app out
 * of the OEM's battery manager. This is Android-only; iOS has no equivalent
 * per-app battery-optimization concept.
 *
 * Mirrors the driver app's lib/batteryOptimization.ts. Non-blocking: this
 * never prevents any action, it just improves the odds that driver-status
 * alerts (assigned/arrived/started) arrive while the app is backgrounded.
 */
import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showAppAlert } from '@/components/shared/AppAlertHost';

const DONT_ASK_KEY = 'battery_optimization_prompt_dismissed';

export type BatteryOptimizationStrings = {
  title: string;
  message: string;
  openSettingsLabel: string;
  dontAskLabel: string;
  laterLabel: string;
};

function openBatteryOptimizationSettings(): void {
  // Opens the system "Battery Optimization" app list. Deliberately not using
  // ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS (the direct per-app dialog) —
  // that requires declaring the REQUEST_IGNORE_BATTERY_OPTIMIZATIONS manifest
  // permission, which Play Store restricts to apps with a narrow allowed-use
  // justification. The settings-list intent needs no extra permission.
  Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() => {
    Linking.openSettings().catch(() => {});
  });
}

/** Shows the battery-optimization advisory once, unless the user dismissed it for good. */
export async function maybePromptBatteryOptimization(strings: BatteryOptimizationStrings): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const dismissed = await AsyncStorage.getItem(DONT_ASK_KEY);
    if (dismissed === 'true') return;
  } catch {
    return;
  }

  showAppAlert(strings.title, strings.message, [
    { text: strings.openSettingsLabel, onPress: openBatteryOptimizationSettings },
    {
      text: strings.dontAskLabel,
      onPress: () => { AsyncStorage.setItem(DONT_ASK_KEY, 'true').catch(() => {}); },
    },
    { text: strings.laterLabel, style: 'cancel' },
  ]);
}
