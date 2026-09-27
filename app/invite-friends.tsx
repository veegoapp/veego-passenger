import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Share, RefreshControl,
} from 'react-native';
import { AppLoader } from '@/components/ui/AppLoader';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Gift, Share2, Users, CheckCircle2, Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { useSplitColors, type SplitColors } from '@/constants/splitTheme';
import { Spacing } from '@/constants/spacing';
import api from '@/src/api/client';

interface ReferralCodeResponse {
  code: string;
  config: { referrerRewardEgp: number; refereeRewardEgp: number; enabled: boolean };
  stats: { total: number; rewarded: number; pending: number; earned: number };
}

interface ReferralHistoryItem {
  id: number;
  status: 'pending' | 'rewarded' | 'cancelled';
  reward: string | null;
  createdAt: string;
  rewardedAt: string | null;
  refereeName: string;
  refereePhone: string;
}

function makeStyles(S: SplitColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: Spacing.lg, gap: Spacing.md,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
      backgroundColor: S.card, borderWidth: 1, borderColor: S.hair,
    },
    headerText: { flex: 1 },
    headerTitle: { fontSize: 19, color: S.ink, letterSpacing: -0.4, fontWeight: '800' },
    headerSub: { fontSize: 12.5, color: S.inkSoft, marginTop: 1, fontWeight: '600' },

    codeCard: {
      marginHorizontal: 20, marginBottom: Spacing.xl, borderRadius: 24, padding: 22,
      backgroundColor: S.panel, alignItems: 'center', gap: Spacing.md,
    },
    codeLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 1 },
    codeText: { fontSize: 32, fontWeight: '800', color: '#ffffff', letterSpacing: 3 },
    shareBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.18)',
      paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999, marginTop: Spacing.sm,
    },
    shareBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

    kpiRow: { flexDirection: 'row', paddingHorizontal: 20, gap: Spacing.md, marginBottom: Spacing.xl },
    kpiCard: {
      flex: 1, backgroundColor: S.card, borderRadius: 18, borderWidth: 1, borderColor: S.hair,
      padding: Spacing.md, alignItems: 'center', gap: 4,
    },
    kpiValue: { fontSize: 20, fontWeight: '800', color: S.ink },
    kpiLabel: { fontSize: 10.5, fontWeight: '600', color: S.inkSoft, textAlign: 'center' },

    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: S.cap,
      textTransform: 'uppercase', letterSpacing: 1.2,
      paddingHorizontal: 20, marginBottom: Spacing.md,
    },
    howCard: {
      marginHorizontal: 20, marginBottom: Spacing.xl, backgroundColor: S.card, borderRadius: 18,
      borderWidth: 1, borderColor: S.hair, padding: Spacing.lg, gap: Spacing.sm,
    },
    howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    howIndex: {
      width: 22, height: 22, borderRadius: 11, backgroundColor: S.surfaceMuted,
      alignItems: 'center', justifyContent: 'center', marginTop: 1,
    },
    howIndexText: { fontSize: 11, fontWeight: '700', color: S.ink },
    howText: { flex: 1, fontSize: 13, color: S.inkSoft, lineHeight: 19 },

    historyList: { paddingHorizontal: 20, gap: Spacing.sm },
    historyRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: S.card, borderRadius: 16,
      borderWidth: 1, borderColor: S.hair, padding: Spacing.md, gap: Spacing.md,
    },
    historyMeta: { flex: 1 },
    historyName: { fontSize: 13.5, fontWeight: '700', color: S.ink },
    historySub: { fontSize: 11.5, color: S.inkSoft, marginTop: 2 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
    statusText: { fontSize: 10.5, fontWeight: '700' },

    emptyState: { alignItems: 'center', gap: Spacing.md, paddingVertical: 40, paddingHorizontal: Spacing.xxl },
    emptyText: { fontSize: 13.5, color: S.inkSoft, textAlign: 'center', lineHeight: 21 },

    errorText: { fontSize: 13.5, color: S.inkSoft, textAlign: 'center', paddingHorizontal: Spacing.xxl, marginTop: 40 },
  });
}

export default function InviteFriendsScreen() {
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const { t, isRTL } = useTheme();
  const S = useSplitColors();
  const styles = useMemo(() => makeStyles(S), [S]);

  const [data, setData] = useState<ReferralCodeResponse | null>(null);
  const [history, setHistory] = useState<ReferralHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [codeRes, historyRes] = await Promise.all([
        api.get<ReferralCodeResponse>('/users/me/referral-code'),
        api.get<ReferralHistoryItem[]>('/users/me/referrals'),
      ]);
      setData(codeRes.data);
      setHistory(historyRes.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? t('referral_load_error'));
    }
  }, [t]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleShare = async () => {
    if (!data?.code) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: t('referral_share_message').replace('{code}', data.code),
      });
    } catch {
      // Share sheet dismissed/failed — nothing to recover, user can retry.
    }
  };

  const statusStyle = (status: ReferralHistoryItem['status']) => {
    if (status === 'rewarded') return { bg: 'rgba(34,197,94,0.14)', fg: '#16A34A', Icon: CheckCircle2, label: t('referral_status_rewarded') };
    if (status === 'cancelled') return { bg: 'rgba(148,163,184,0.18)', fg: '#64748B', Icon: Clock, label: t('referral_status_cancelled') };
    return { bg: 'rgba(234,179,8,0.16)', fg: '#B45309', Icon: Clock, label: t('referral_status_pending') };
  };

  return (
    <View style={{ flex: 1, backgroundColor: S.bg }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          {isRTL ? <ArrowRight size={18} color={S.ink} /> : <ArrowLeft size={18} color={S.ink} />}
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t('referral_title')}</Text>
          <Text style={styles.headerSub}>{t('referral_subtitle')}</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <AppLoader size={32} />
        </View>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={S.inkSoft} colors={[S.panel]} />}
        >
          <View style={styles.codeCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Gift size={16} color="#ffffff" />
              <Text style={styles.codeLabel}>{t('referral_your_code')}</Text>
            </View>
            <Text style={styles.codeText}>{data?.code}</Text>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
              <Share2 size={16} color="#ffffff" />
              <Text style={styles.shareBtnText}>{t('referral_share_cta')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{data?.stats.total ?? 0}</Text>
              <Text style={styles.kpiLabel}>{t('referral_stat_total')}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{data?.stats.rewarded ?? 0}</Text>
              <Text style={styles.kpiLabel}>{t('referral_stat_rewarded')}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{data?.stats.pending ?? 0}</Text>
              <Text style={styles.kpiLabel}>{t('referral_stat_pending')}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{(data?.stats.earned ?? 0).toFixed(0)}</Text>
              <Text style={styles.kpiLabel}>{t('referral_stat_earned')}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>{t('referral_how_it_works')}</Text>
          <View style={styles.howCard}>
            {[t('referral_how_1'), t('referral_how_2'), t('referral_how_3')].map((line, i) => (
              <View key={i} style={styles.howRow}>
                <View style={styles.howIndex}><Text style={styles.howIndexText}>{i + 1}</Text></View>
                <Text style={styles.howText}>{line}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionLabel}>{t('referral_history_title')}</Text>
          {history.length === 0 ? (
            <View style={styles.emptyState}>
              <Users size={28} color={S.inkSoft} />
              <Text style={styles.emptyText}>{t('referral_history_empty')}</Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {history.map((h) => {
                const st = statusStyle(h.status);
                return (
                  <View key={h.id} style={styles.historyRow}>
                    <View style={styles.historyMeta}>
                      <Text style={styles.historyName}>{h.refereeName}</Text>
                      <Text style={styles.historySub}>{new Date(h.createdAt).toLocaleDateString()}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                      <st.Icon size={11} color={st.fg} />
                      <Text style={[styles.statusText, { color: st.fg }]}>{st.label}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
