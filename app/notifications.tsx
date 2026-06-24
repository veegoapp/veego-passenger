import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet,  ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ArrowRight, CheckCheck, Navigation, Sparkles, Settings, Bell } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { useNotifications } from '@/src/hooks/shared/useNotifications';

const CATEGORY_ICONS = {
  trip: Navigation, promo: Sparkles, system: Settings,
} as const;

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: '600', color: c.ink, letterSpacing: -0.4, fontFamily: 'Inter_600SemiBold' },
    unreadCount: { fontSize: 11, color: c.inkSoft, marginTop: 1 },
    list: { paddingHorizontal: 20, gap: 10 },
    notifCard: { borderRadius: 22, padding: 16, backgroundColor: c.white, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    notifCardUnread: { borderStartWidth: 3, borderStartColor: c.ink },
    notifIconWrap: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    notifContent: { flex: 1, gap: 4 },
    notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    notifTitle: { fontSize: 13.5, fontWeight: '600', color: c.ink, flex: 1 },
    unreadDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.ink, flexShrink: 0 },
    notifBody: { fontSize: 12, color: c.inkSoft, lineHeight: 17 },
    notifTime: { fontSize: 10.5, color: c.silver, marginTop: 2 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
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
  const { notifications, unreadCount, loading, markAllRead } = useNotifications();

  return (
    <LinearGradient colors={c.luxeGrad} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <TouchableOpacity style={[gs, styles.backBtn]} onPress={() => router.back()} activeOpacity={0.8}>
          {isRTL ? <ArrowRight size={18} color={c.ink} /> : <ArrowLeft size={18} color={c.ink} />}
        </TouchableOpacity>
        <View style={{ flex: 1, paddingHorizontal: 12 }}>
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
          <ActivityIndicator color={c.ink} />
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
