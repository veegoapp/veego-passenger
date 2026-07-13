import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { AppLoader } from '@/components/ui/AppLoader';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ArrowRight, CheckCheck, Navigation, Sparkles, Settings, Bell, TriangleAlert } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { useNotifications } from '@/src/hooks/shared/useNotifications';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

const CATEGORY_ICONS = {
  trip: Navigation, promo: Sparkles, system: Settings,
} as const;

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: Spacing.lg },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: Typography.size.lg, fontWeight: Typography.weight.semibold, color: c.ink, letterSpacing: -0.4, fontFamily: 'Inter_600SemiBold' },
    unreadCount: { fontSize: 11, color: c.inkSoft, marginTop: 1 },
    list: { paddingHorizontal: 20, gap: 10 },
    notifCard: { borderRadius: 22, padding: Spacing.lg, backgroundColor: c.white, flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
    notifCardUnread: { borderStartWidth: 3, borderStartColor: c.ink },
    notifIconWrap: { width: 44, height: 44, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    notifContent: { flex: 1, gap: Spacing.xs },
    notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    notifTitle: { fontSize: 13.5, fontWeight: Typography.weight.semibold, color: c.ink, flex: 1 },
    unreadDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.ink, flexShrink: 0 },
    notifBody: { fontSize: Typography.size.xs, color: c.inkSoft, lineHeight: 17 },
    notifTime: { fontSize: 10.5, color: c.silver, marginTop: 2 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
    stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 40, gap: Spacing.md },
    stateText: { fontSize: Typography.size.sm, color: c.inkSoft, textAlign: 'center' },
    retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.md, backgroundColor: c.ink },
    retryBtnText: { color: c.isDark ? c.background : c.white, fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold },
  });
}

const ICON_BG_LIGHT: Record<string, string> = {
  trip: '#d8ecf7', promo: '#d5f0e5', system: '#f2f2f5',
};
const ICON_BG_DARK: Record<string, string> = {
  trip: '#1a2a38', promo: '#1a2e26', system: '#1e1e32',
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const { colors: c, glassStyle: gs, t, isRTL } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const iconBg = c.isDark ? ICON_BG_DARK : ICON_BG_LIGHT;
  const { notifications, unreadCount, loading, error, markAllRead, refresh } = useNotifications();

  return (
    <LinearGradient colors={c.luxeGrad} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <TouchableOpacity style={[gs, styles.backBtn]} onPress={() => router.back()} activeOpacity={0.8}>
          {isRTL ? <ArrowRight size={18} color={c.ink} /> : <ArrowLeft size={18} color={c.ink} />}
        </TouchableOpacity>
        <View style={{ flex: 1, paddingHorizontal: Spacing.md }}>
          <Text style={styles.title}>{t('notifications')}</Text>
          {unreadCount > 0 && (
            <Text style={styles.unreadCount}>{unreadCount} {t('new_notif')}</Text>
          )}
        </View>
        <TouchableOpacity style={[gs, styles.backBtn]} activeOpacity={0.7} onPress={markAllRead}>
          <CheckCheck size={16} color={c.ink} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <AppLoader size={80} />
        </View>
      ) : error ? (
        <View style={styles.stateWrap}>
          <TriangleAlert size={28} color={c.inkSoft} />
          <Text style={styles.stateText}>{t('notif_load_error')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.stateWrap}>
          <Bell size={28} color={c.inkSoft} />
          <Text style={styles.stateText}>{t('no_notifications')}</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {notifications.map((n) => {
            const NotifIcon = CATEGORY_ICONS[n.type as keyof typeof CATEGORY_ICONS] ?? Bell;
            const isTermsNotif = n.type === 'system' && /terms/i.test(`${n.title} ${n.body}`);
            return (
            <TouchableOpacity
              key={n.id}
              style={[gs, styles.notifCard, n.unread && styles.notifCardUnread]}
              activeOpacity={0.88}
              onPress={isTermsNotif ? () => router.push('/(tabs)/profile?openTerms=1' as any) : undefined}
            >
              <View style={[styles.notifIconWrap, { backgroundColor: iconBg[n.type] ?? c.mist }]}>
                <NotifIcon size={16} color={c.ink} />
              </View>
              <View style={styles.notifContent}>
                <View style={styles.notifTitleRow}>
                  <Text style={styles.notifTitle} numberOfLines={1}>{n.title}</Text>
                  {n.unread && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>
                <Text style={styles.notifTime}>{n.createdAt}</Text>
              </View>
            </TouchableOpacity>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </LinearGradient>
  );
}
