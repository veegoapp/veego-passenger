import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet,  Linking } from 'react-native';
import { ShieldOff, MessageCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { Spacing } from '@/constants/spacing';
import { useSplitColors, type SplitColors } from '@/constants/splitTheme';

// ── C · Split Panel — fixed palette, independent of the app's light/dark theme.

function makeStyles(S: SplitColors) {
  return StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl },
    iconCircle: {
      width: 96, height: 96, borderRadius: 32,
      backgroundColor: 'rgba(217,45,32,0.1)', alignItems: 'center', justifyContent: 'center',
      marginBottom: Spacing.xl,
    },
    title: {
      fontSize: 20, fontWeight: '800', color: S.ink, textAlign: 'center',
      letterSpacing: -0.4, marginBottom: 14, lineHeight: 28,
    },
    body: {
      fontSize: 13.5, color: S.inkSoft, textAlign: 'center', lineHeight: 21, marginBottom: Spacing.xxl,
    },
    primaryBtn: {
      width: '100%', height: 56, borderRadius: 20, backgroundColor: S.panel,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      marginBottom: Spacing.md,
    },
    primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    secondaryBtn: { paddingVertical: Spacing.md },
    secondaryBtnText: { fontSize: 13.5, color: S.inkSoft },
  });
}

const SUPPORT_URL = 'https://wa.me/201000000000';

export default function SuspendedScreen() {
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const { t } = useTheme();
  const S = useSplitColors();
  const styles = useMemo(() => makeStyles(S), [S]);

  const handleContactSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(SUPPORT_URL).catch(() => {
      router.push('/support' as any);
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: S.bg, paddingTop: top }}>
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <ShieldOff size={44} color="#D92D20" strokeWidth={1.8} />
        </View>

        <Text style={styles.title}>
          {t('suspended_title')}
        </Text>

        <Text style={styles.body}>
          {t('suspended_body')}
        </Text>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleContactSupport}
          activeOpacity={0.88}
        >
          <MessageCircle size={20} color="#fff" />
          <Text style={styles.primaryBtnText}>{t('contact_support')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
