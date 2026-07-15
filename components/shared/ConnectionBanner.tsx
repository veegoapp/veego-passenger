import { useMemo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useSocketConnectionState } from '@/src/hooks/shared/useSocketConnectionState';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';

/**
 * Slim "reconnecting" strip shown while the realtime socket is not connected,
 * so live-tracking screens don't look silently frozen during a network drop.
 * Renders nothing when connected — safe to mount unconditionally.
 */
export function ConnectionBanner({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTheme();
  const state = useSocketConnectionState();
  const styles = useMemo(() => makeStyles(), []);

  if (state === 'connected') return null;

  return (
    <View style={[styles.banner, style]}>
      <WifiOff size={13} color="#fff" />
      <Text style={styles.text}>{t('reconnecting')}</Text>
    </View>
  );
}

function makeStyles() { return StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#d97706',
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: 99,
    alignSelf: 'center',
  },
  text: {
    color: '#fff',
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.bold,
  },
}); }
