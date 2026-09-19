import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ShieldOff, MessageCircle, Star } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
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

// Reason-specific suspensions (users.suspensionReason, set by
// passenger-rating-suspension.ts / cancelPassengerRide on the backend) get
// their own title/body — everything else (the pre-existing no-show/
// cancellation-penalty ban, which sets no reason) falls back to the generic
// copy this screen always showed.
const LOW_RATING_REASON = 'low_rating_threshold';
const EXCESSIVE_CANCELLATIONS_REASON = 'excessive_cancellations';
const RATING_BAN_THRESHOLD = '4.0';

export default function SuspendedScreen() {
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const { t } = useTheme();
  const S = useSplitColors();
  const styles = useMemo(() => makeStyles(S), [S]);
  // Carried in the redirect itself (see src/api/client.ts's response
  // interceptor) rather than fetched here — every authenticated route,
  // including one that would read the passenger's own profile, rejects
  // with the same 403 once the account is blocked, so there is no other
  // way for this screen to learn why.
  const { reason } = useLocalSearchParams<{ reason?: string }>();

  const title = reason === LOW_RATING_REASON
    ? t('low_rating_suspended_title')
    : reason === EXCESSIVE_CANCELLATIONS_REASON
      ? t('excessive_cancellations_suspended_title')
      : t('suspended_title');
  const body = reason === LOW_RATING_REASON
    ? t('low_rating_suspended_body').replace('{threshold}', RATING_BAN_THRESHOLD)
    : reason === EXCESSIVE_CANCELLATIONS_REASON
      ? t('excessive_cancellations_suspended_body')
      : t('suspended_body');

  // Support is the internal ticket system (admin-dashboard's Support inbox)
  // only — matches the driver app's /suspended screen. No WhatsApp: every
  // admin-facing contact channel in this app goes through in-app messages,
  // WhatsApp is reserved for SOS/emergency-contact location sharing.
  // Deep-links with category=suspension_appeal + a pre-filled message
  // naming the suspension reason, so /support lands with the right issue
  // type and message already in place (see support.tsx).
  const handleContactSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/support',
      params: { category: 'suspension_appeal', prefill: t('suspension_appeal_prefill').replace('{title}', title) },
    } as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: S.bg, paddingTop: top }}>
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          {reason === LOW_RATING_REASON
            ? <Star size={44} color="#D92D20" strokeWidth={1.8} />
            : <ShieldOff size={44} color="#D92D20" strokeWidth={1.8} />}
        </View>

        <Text style={styles.title}>
          {title}
        </Text>

        <Text style={styles.body}>
          {body}
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
