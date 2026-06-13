import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingDown, Plus, ArrowUp, Tag, PlusCircle, CheckCircle, AlertTriangle, Banknote, CreditCard } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors, S } from '@/constants/colors';
import { useWallet } from '@/src/hooks/useWallet';
import { useDebt } from '@/src/hooks/useDebt';

const CHARGE_OPTIONS = [50, 100, 200, 500];

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: 12, gap: 4 },
    headerTitle: { fontSize: 26, fontWeight: '700', color: c.ink, letterSpacing: -0.8, fontFamily: 'Inter_700Bold' },
    headerSub: { fontSize: 13, color: c.inkSoft },
    balanceCard: { marginHorizontal: 20, borderRadius: 28, overflow: 'hidden', marginBottom: 20, ...S.float },
    balanceGrad: { padding: 24, borderRadius: 28 },
    balanceGlow: { position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.06)' },
    balanceLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '500', marginBottom: 8 },
    balanceAmount: { fontSize: 42, fontWeight: '700', color: '#ffffff', letterSpacing: -1.5, fontFamily: 'Inter_700Bold' },
    balanceCurrency: { fontSize: 18, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
    balanceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 20 },
    balanceStats: { flexDirection: 'row', gap: 16, marginTop: 4 },
    balanceStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    balanceStatText: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },
    actionRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 20 },
    actionBtn: { flex: 1, height: 52, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    actionBtnText: { fontSize: 14, fontWeight: '600' },
    section: { marginBottom: 20 },
    sectionLabel: { fontSize: 11, fontWeight: '600', color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 1.2, paddingStart: 24, marginBottom: 10 },
    chargeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20 },
    chargeBtn: { width: '47%', height: 52, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
    chargeBtnText: { fontSize: 15, fontWeight: '600' },
    confirmChargeBtn: {
      marginHorizontal: 20, marginTop: 14, height: 52, borderRadius: 18,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    confirmChargeBtnText: { fontSize: 14, fontWeight: '600' },
    txList: { paddingHorizontal: 20, gap: 10 },
    txCard: { borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.white },
    txIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    txMeta: { flex: 1, gap: 2 },
    txTitle: { fontSize: 13.5, fontWeight: '600', color: c.ink },
    txSub: { fontSize: 11.5, color: c.inkSoft },
    txDate: { fontSize: 10.5, color: c.silver, marginTop: 2 },
    txAmount: { fontSize: 15, fontWeight: '700' },
    pmSection: { marginBottom: 20 },
    pmCard: { borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.white },
    pmIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' },
    pmMeta: { flex: 1, gap: 2 },
    pmName: { fontSize: 14, fontWeight: '600', color: c.ink },
    pmSub: { fontSize: 12, color: c.inkSoft },
    pmBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: 'rgba(85,196,154,0.15)' },
    pmBadgeText: { fontSize: 11, fontWeight: '600', color: '#55c49a' },
    debtBanner: {
      marginHorizontal: 20, marginBottom: 16, borderRadius: 18,
      backgroundColor: '#fff3cd', borderWidth: 1.5, borderColor: '#f59e0b',
      padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    },
    debtBannerDark: {
      backgroundColor: '#2e2100', borderColor: '#f59e0b',
    },
    debtBannerIcon: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: 'rgba(245,158,11,0.15)', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    debtBannerText: { flex: 1, gap: 4 },
    debtBannerTitle: { fontSize: 13.5, fontWeight: '700', color: '#92400e' },
    debtBannerTitleDark: { color: '#fcd34d' },
    debtBannerBody: { fontSize: 12.5, color: '#78350f', lineHeight: 18 },
    debtBannerBodyDark: { color: '#fde68a' },
  });
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? 60 : insets.top;
  const { colors: c, glassStyle: gs, t, language } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [selectedCharge, setSelectedCharge] = useState<number | null>(null);
  const isAr = language === 'ar';

  const { balance, spent, transactions, recharge } = useWallet();
  const { debt } = useDebt();

  const handleConfirmCharge = async () => {
    if (!selectedCharge) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const result = await recharge(selectedCharge);
    setSelectedCharge(null);
    Alert.alert(
      t('recharged_title'),
      t('recharged_body').replace('{amount}', String(selectedCharge)),
    );
    if (!result.success) {
      console.warn('[Wallet] Recharge API error:', result.error);
    }
  };

  const handleTransfer = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    Alert.alert(t('transfer_title'), t('transfer_soon_msg'));
  };

  return (
    <LinearGradient colors={c.luxeGrad} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <Text style={styles.headerTitle}>{t('wallet_title')}</Text>
        <Text style={styles.headerSub}>{t('wallet_subtitle')}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.balanceCard}>
          <LinearGradient colors={[c.ink, c.isDark ? '#2a2a4a' : '#2a2a3a']} style={styles.balanceGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.balanceGlow} />
            <Text style={styles.balanceLabel}>{t('wallet_balance_label')}</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceAmount}>{balance}</Text>
              <Text style={styles.balanceCurrency}>{t('egp')}</Text>
            </View>
            <View style={styles.balanceStats}>
              <View style={styles.balanceStat}>
                <TrendingDown size={14} color="rgba(255,255,255,0.6)" />
                <Text style={styles.balanceStatText}>{spent} {t('egp')} {t('wallet_spent')}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {debt?.hasDebt && (
          <View style={[styles.debtBanner, c.isDark && styles.debtBannerDark]}>
            <View style={styles.debtBannerIcon}>
              <AlertTriangle size={18} color="#f59e0b" />
            </View>
            <View style={styles.debtBannerText}>
              <Text style={[styles.debtBannerTitle, c.isDark && styles.debtBannerTitleDark]}>
                {t('cash_debt')}
              </Text>
              <Text style={[styles.debtBannerBody, c.isDark && styles.debtBannerBodyDark]}>
                {t('debt_owe_msg').replace('{amount}', String(debt.amount))}
              </Text>
              {debt.offenceCount > 1 && (
                <Text style={[styles.debtBannerBody, c.isDark && styles.debtBannerBodyDark, { marginTop: 4 }]}>
                  {t('no_show_offences').replace('{count}', String(debt.offenceCount))}
                </Text>
              )}
            </View>
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: c.ink }]}
            activeOpacity={0.85}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (!selectedCharge) {
                Alert.alert(t('select_amount_title'), t('select_amount_body'));
              } else {
                handleConfirmCharge();
              }
            }}
          >
            <Plus size={20} color={c.isDark ? c.background : c.white} />
            <Text style={[styles.actionBtnText, { color: c.isDark ? c.background : c.white }]}>{t('recharge')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[gs, styles.actionBtn, { borderWidth: 1, borderColor: c.border }]}
            activeOpacity={0.85}
            onPress={handleTransfer}
          >
            <ArrowUp size={20} color={c.ink} />
            <Text style={[styles.actionBtnText, { color: c.ink }]}>{t('transfer')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[gs, styles.actionBtn, { borderWidth: 1, borderColor: c.border }]}
            activeOpacity={0.85}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync();
              router.push('/promo');
            }}
          >
            <Tag size={18} color="#55c49a" />
            <Text style={[styles.actionBtnText, { color: '#55c49a' }]}>{t('promo_title')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('quick_recharge')}</Text>
          <View style={styles.chargeGrid}>
            {CHARGE_OPTIONS.map((amount) => {
              const selected = selectedCharge === amount;
              return (
                <TouchableOpacity
                  key={amount}
                  style={[styles.chargeBtn, { backgroundColor: selected ? c.ink : c.white, borderColor: selected ? c.ink : c.border }]}
                  onPress={() => {
                    setSelectedCharge(selected ? null : amount);
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                  }}
                  activeOpacity={0.8}
                >
                  <PlusCircle size={16} color={selected ? (c.isDark ? c.background : c.white) : c.inkSoft} />
                  <Text style={[styles.chargeBtnText, { color: selected ? (c.isDark ? c.background : c.white) : c.ink }]}>{amount} {t('egp')}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedCharge && (
            <TouchableOpacity
              style={[styles.confirmChargeBtn, { backgroundColor: c.accentMint }]}
              onPress={handleConfirmCharge}
              activeOpacity={0.88}
            >
              <CheckCircle size={18} color="#ffffff" />
              <Text style={[styles.confirmChargeBtnText, { color: '#ffffff' }]}>
                {t('confirm_recharge_btn').replace('{amount}', String(selectedCharge))}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.pmSection}>
          <Text style={styles.sectionLabel}>{t('payment_title')}</Text>
          <View style={{ paddingHorizontal: 20, gap: 10 }}>
            <View style={[styles.pmCard]}>
              <View style={styles.pmIconBox}>
                <Banknote size={20} color={c.ink} />
              </View>
              <View style={styles.pmMeta}>
                <Text style={styles.pmName}>{t('payment_methods_cash')}</Text>
                <Text style={styles.pmSub}>{t('payment_cards_soon')}</Text>
              </View>
              <View style={styles.pmBadge}>
                <Text style={styles.pmBadgeText}>{t('active')}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('tx_history')}</Text>
          <View style={styles.txList}>
            {transactions.map((tx) => (
              <TouchableOpacity key={tx.id} style={[gs, styles.txCard]} activeOpacity={0.85} onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync(); }}>
                <View style={[styles.txIcon, { backgroundColor: tx.type === 'credit' ? 'rgba(85,196,154,0.12)' : c.mist }]}>
                  {React.createElement(tx.icon as React.ComponentType<{size?:number;color?:string}>, { size: 20, color: tx.type === 'credit' ? '#55c49a' : c.inkSoft })}
                </View>
                <View style={styles.txMeta}>
                  <Text style={styles.txTitle}>{isAr ? tx.titleAr : tx.titleEn}</Text>
                  <Text style={styles.txSub}>{isAr ? tx.subtitleAr : tx.subtitleEn}</Text>
                  <Text style={styles.txDate}>{isAr ? tx.dateAr : tx.dateEn}</Text>
                </View>
                <Text style={[styles.txAmount, { color: tx.type === 'credit' ? '#55c49a' : c.ink }]}>
                  {tx.type === 'credit' ? '+' : '-'}{tx.amount} {t('egp')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
