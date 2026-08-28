import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { AppLoader } from '@/components/ui/AppLoader';
import { ArrowLeft, ArrowRight, CheckCheck, Navigation, Sparkles, Settings, Bell, TriangleAlert } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useNotifications } from '@/src/hooks/shared/useNotifications';
import { useNotificationsBadge } from '@/context/NotificationsBadgeContext';
import { Spacing } from '@/constants/spacing';
import { useSplitColors, type SplitColors } from '@/constants/splitTheme';

const CATEGORY_ICONS = {
  trip: Navigation, promo: Sparkles, system: Settings,
} as const;

// ── C · Split Panel — fixed palette, independent of the app's light/dark theme.

const ICON_BG: Record<string, string> = {
  trip: '#E3F1FB', promo: '#E2F5EB', system: '#F0F2F3',
};

function makeStyles(S: SplitColors) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: Spacing.lg },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: S.card, borderWidth: 1, borderColor: S.hair },
    title: { fontSize: 18, fontWeight: '800', color: S.ink, letterSpacing: -0.3 },
    unreadCount: { fontSize: 11, color: S.inkSoft, marginTop: 1, fontWeight: '600' },
    list: { paddingHorizontal: 20, gap: 10 },
    notifCard: {
      padding: Spacing.lg, flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start',
      backgroundColor: S.card, borderRadius: 22, borderWidth: 1, borderColor: S.hair,
    },
    notifCardUnread: { borderStartWidth: 3, borderStartColor: S.panel },
    notifIconWrap: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    notifContent: { flex: 1, gap: Spacing.xs },
    notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    notifTitle: { fontSize: 13.5, fontWeight: '700', color: S.ink, flex: 1 },
    unreadDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: S.panel, flexShrink: 0 },
    notifBody: { fontSize: 12.5, color: S.inkSoft, lineHeight: 17 },
    notifTime: { fontSize: 10.5, color: S.inkSoft, marginTop: 2 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
    stateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 40, gap: Spacing.md },
    stateText: { fontSize: 13.5, color: S.inkSoft, textAlign: 'center' },
    retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: S.panel },
    retryBtnText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  });
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const { t, isRTL } = useTheme();
  const S = useSplitColors();
  const styles = useMemo(() => makeStyles(S), [S]);
  const { notifications, unreadCount, loading, error, markAllRead, refresh } = useNotifications();
  const { refresh: refreshBadge } = useNotificationsBadge();

  return (
    <View style={{ flex: 1, backgroundColor: S.bg }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          {isRTL ? <ArrowRight size={18} color={S.ink} /> : <ArrowLeft size={18} color={S.ink} />}
        </TouchableOpacity>
        <View style={{ flex: 1, paddingHorizontal: Spacing.md }}>
          <Text style={styles.title}>{t('notifications')}</Text>
          {unreadCount > 0 && (
            <Text style={styles.unreadCount}>{unreadCount} {t('new_notif')}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7} onPress={() => { markAllRead(); refreshBadge(); }}>
          <CheckCheck size={16} color={S.ink} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <AppLoader size={80} />
        </View>
      ) : error ? (
        <View style={styles.stateWrap}>
          <TriangleAlert size={28} color={S.inkSoft} />
          <Text style={styles.stateText}>{t('notif_load_error')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.stateWrap}>
          <Bell size={28} color={S.inkSoft} />
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
              activeOpacity={0.88}
              onPress={isTermsNotif ? () => router.push('/(tabs)/profile?openTerms=1' as any) : undefined}
            >
              <View style={[styles.notifCard, n.unread && styles.notifCardUnread]}>
                <View style={[styles.notifIconWrap, { backgroundColor: ICON_BG[n.type] ?? '#F0F2F3' }]}>
                  <NotifIcon size={16} color="#14151A" />
                </View>
                <View style={styles.notifContent}>
                  <View style={styles.notifTitleRow}>
                    <Text style={styles.notifTitle} numberOfLines={1}>{n.title}</Text>
                    {n.unread && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>
                  <Text style={styles.notifTime}>{n.createdAt}</Text>
                </View>
              </View>
            </TouchableOpacity>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}
