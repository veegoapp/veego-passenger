import { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

export interface AppAlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface AppAlertState {
  title: string;
  message?: string;
  buttons: AppAlertButton[];
}

type Listener = (state: AppAlertState | null) => void;
let listener: Listener | null = null;

/**
 * Drop-in themed replacement for React Native's Alert.alert(title, message,
 * buttons) — Alert.alert renders the OS's native dialog, which ignores the
 * app's colors, dark mode, and typography entirely. Same call signature, so
 * existing call sites just swap the import.
 *
 * Mount <AppAlertHost /> once near the app root (see app/_layout.tsx); call
 * showAppAlert(...) from anywhere, no local state or JSX needed at the call site.
 */
export function showAppAlert(title: string, message?: string, buttons?: AppAlertButton[]) {
  const resolvedButtons = buttons && buttons.length > 0 ? buttons : [{ text: '' }];
  listener?.({ title, message, buttons: resolvedButtons });
}

export function AppAlertHost() {
  const { t, colors: c } = useTheme();
  const [state, setState] = useState<AppAlertState | null>(null);

  useEffect(() => {
    listener = setState;
    return () => { listener = null; };
  }, []);

  const dismiss = (btn: AppAlertButton) => {
    setState(null);
    btn.onPress?.();
  };

  if (!state) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setState(null)}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: c.isDark ? c.mist : c.white }]}>
          <Text style={[styles.title, { color: c.ink }]}>{state.title}</Text>
          {!!state.message && (
            <Text style={[styles.message, { color: c.inkSoft }]}>{state.message}</Text>
          )}
          <View style={styles.btnCol}>
            {state.buttons.map((btn, i) => {
              const label = btn.text || t('ok');
              const bg =
                btn.style === 'destructive'
                  ? (c.isDark ? 'rgba(239,68,68,0.16)' : 'rgba(239,68,68,0.10)')
                  : btn.style === 'cancel'
                  ? (c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)')
                  : c.ink;
              const fg =
                btn.style === 'destructive'
                  ? c.badge
                  : btn.style === 'cancel'
                  ? c.ink
                  : (c.isDark ? c.background : c.white);
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => dismiss(btn)}
                  activeOpacity={0.8}
                  style={[styles.btn, { backgroundColor: bg }]}
                >
                  <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  title: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    fontFamily: 'Inter_700Bold',
  },
  message: {
    fontSize: Typography.size.sm,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  btnCol: { gap: Spacing.sm },
  btn: {
    height: 50,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 15,
    fontWeight: Typography.weight.semibold,
    fontFamily: 'Inter_600SemiBold',
  },
});
