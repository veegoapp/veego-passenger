import { Modal, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { VeeGoButton } from '@/components/ui/VeeGoButton';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

interface AppAlertProps {
  visible: boolean;
  title: string;
  message: string;
  onDismiss: () => void;
}

/**
 * Themed drop-in for Alert.alert(title, message) — Alert.alert renders the
 * OS's native dialog, which ignores the app's colors/typography/dark mode
 * entirely. This renders a real themed card instead.
 */
export function AppAlert({ visible, title, message, onDismiss }: AppAlertProps) {
  const { t, colors: c } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: c.isDark ? c.mist : c.white }]}>
          <Text style={[styles.title, { color: c.ink }]}>{title}</Text>
          <Text style={[styles.message, { color: c.inkSoft }]}>{message}</Text>
          <VeeGoButton
            title={t('ok')}
            onPress={onDismiss}
            variant="primary"
            style={styles.btn}
          />
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
  btn: {
    height: 50,
    borderRadius: Radius.lg,
  },
});
