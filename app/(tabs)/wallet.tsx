import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { AppLoader } from '@/components/ui/AppLoader';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingDown, Plus, ArrowUp, Tag, PlusCircle, CheckCircle, AlertTriangle, Banknote, CreditCard, Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { useTabBar } from '@/context/TabBarContext';
import { ThemeColors, S } from '@/constants/colors';
import { useWallet } from '@/src/hooks/shared/useWallet';
import { useMyDebt } from '@/src/hooks/shared/useMyDebt';
import { usePaymentConfig } from '@/context/PaymentConfigContext';
import { useWalletRecharge } from '@/src/hooks/shared/useWalletRecharge';
import { PaymobCheckoutModal } from '@/components/wallet/PaymobCheckoutModal';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

const CHARGE_OPTIONS = [50, 100, 200, 500];

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: Spacing.md, gap: Spacing.xs },
    headerTitle: { fontSize: 26, fontWeight: Typography.weight.bold, color: c.ink, letterSpacing: -0.8, fontFamily: 'Inter_700Bold' },
    headerSub: { fontSize: 13, color: c.inkSoft },
    balanceCard: { marginHorizontal: 20, borderRadius: 28, overflow: 'hidden', marginBottom: 20, ...S.float },
    balanceGrad: { padding: Spacing.xl, borderRadius: 28 },
    balanceGlow: { position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.06)' },
    balanceLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: Typography.weight.medium, marginBottom: Spacing.sm },
    balanceAmount: { fontSize: 42, fontWeight: Typography.weight.bold, color: '#ffffff', letterSpacing: -1.5, fontFamily: 'Inter_700Bold' },
    balanceCurrency: { fontSize: Typography.size.lg, color: 'rgba(255,255,255,0.7)', fontWeight: Typography.weight.medium },
    balanceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 20 },
    balanceStats: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.xs },
    balanceStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    balanceStatText: { fontSize: Typography.size.xs, color: 'rgba(255,255,255,0.65)' },
    actionRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 20 },
    actionBtn: { flex: 1, height: 52, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    actionBtnText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold },
    section: { marginBottom: 20 },
    sectionLabel: { fontSize: 11, fontWeight: Typography.weight.semibold, color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 1.2, paddingStart: 24, marginBottom: 10 },
    chargeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20 },
    chargeBtn: { width: '47%', height: 52, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
    chargeBtnText: { fontSize: 15, fontWeight: Typography.weight.semibold },
    confirmChargeBtn: {
      marginHorizontal: 20, marginTop: 14, height: 52, borderRadius: 18,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    },
    confirmChargeBtnText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold },
    txList: { paddingHorizontal: 20, gap: 10 },
    txCard: { borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: c.white },
    txEmpty: { marginHorizontal: 20, borderRadius: 20, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm, backgroundColor: c.white },
    txEmptyText: { fontSize: Typography.size.sm, color: c.inkSoft, textAlign: 'center' },
    txIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    txMeta: { flex: 1, gap: 2 },
    txTitle: { fontSize: 13.5, fontWeight: Typography.weight.semibold, color: c.ink },
    txSub: { fontSize: 11.5, color: c.inkSoft },
    txDate: { fontSize: 10.5, color: c.silver, marginTop: 2 },
    txAmount: { fontSize: 15, fontWeight: Typography.weight.bold },
    pmSection: { marginBottom: 20 },
    pmCard: { borderRadius: 20, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: c.white },
    pmIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' },
    pmMeta: { flex: 1, gap: 2 },
    pmName: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: c.ink },
    pmSub: { fontSize: Typography.size.xs, color: c.inkSoft },
    pmBadge: { paddingHorizontal: 10, paddingVertical: Spacing.xs, borderRadius: 99, backgroundColor: 'rgba(85,196,154,0.15)' },
    pmBadgeText: { fontSize: 11, fontWeight: Typography.weight.semibold, color: '#55c49a' },
    debtBanner: {
      marginHorizontal: 20, marginBottom: Spacing.lg, borderRadius: 18,
      backgroundColor: '#fff3cd', borderWidth: 1.5, borderColor: '#f59e0b',
      padding: Spacing.lg, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    },
    debtBannerDark: {
      backgroundColor: '#2e2100', borderColor: '#f59e0b',
    },
    debtBannerIcon: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: 'rgba(245,158,11,0.15)', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    debtBannerText: { flex: 1, gap: Spacing.xs },
    debtBannerTitle: { fontSize: 13.5, fontWeight: Typography.weight.bold, color: '#92400e' },
    debtBannerTitleDark: { color: '#fcd34d' },
    debtBannerBody: { fontSize: 12.5, color: '#78350f', lineHeight: 18 },
    debtBannerBodyDark: { color: '#fde68a' },
    debtCheckErrorBanner: {
      marginHorizontal: 20, marginBottom: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 14, padding: Spacing.md,
    },
    debtCheckErrorBannerDark: { backgroundColor: 'rgba(255,255,255,0.06)' },
    debtCheckErrorText: { flex: 1, fontSize: Typography.size.xs, lineHeight: 17 },
    debtCheckErrorRetry: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold },
    walletErrorBanner: {
      marginHorizontal: 20, marginBottom: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: 'rgba(224,88,74,0.1)', borderRadius: 14, padding: Spacing.md,
    },
    walletErrorText: { flex: 1, fontSize: Typography.size.xs, lineHeight: 17, color: '#e0584a' },
    walletErrorRetry: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold, color: '#e0584a' },
    rechargeStatusBanner: {
      marginHorizontal: 20, marginTop: Spacing.xs, marginBottom: Spacing.lg, borderRadius: 18,
      paddingHorizontal: Spacing.lg, paddingVertical: 14,
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: c.white,
    },
    rechargeStatusText: { flex: 1, fontSize: 13, color: c.inkSoft, lineHeight: 18 },
  });
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const { tabBarHeight } = useTabBar();
  const { colors: c, glassStyle: gs, t, language } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [selectedCharge, setSelectedCharge] = useState<number | null>(null);
  const isAr = language === 'ar';

  const { balance, spent, transactions, loading: walletLoading, error: walletError, refresh: refreshWallet } = useWallet();
  const [hasLoadedWalletOnce, setHasLoadedWalletOnce] = useState(false);
  useEffect(() => {
    if (!walletLoading) setHasLoadedWalletOnce(true);
  }, [walletLoading]);
  const { debt, error: debtError, refresh: refreshDebt } = useMyDebt();
  const { walletFeature, paymentMethods } = usePaymentConfig();
  const paymobEnabled = paymentMethods.some((m) => m.key === 'paymob');
  const walletUnavailable = !walletFeature.isEnabled || walletFeature.displayMode !== 'live';

  const recharge = useWalletRecharge();
  const rechargeBusy = recharge.status !== 'idle';

  // Reacts to the Paymob checkout outcome exactly once per attempt. The
  // "Recharged!" alert only ever fires from the 'confirmed' branch, which is
  // reached solely via useWalletRecharge polling GET /wallet after checkout —
  // never immediately on submit and never on the checkout redirect alone.
  useEffect(() => {
    if (recharge.status === 'confirmed') {
      refreshWallet();
      Alert.alert(
        t('recharged_title'),
        t('recharged_body').replace('{amount}', String(recharge.amountEGP ?? '')),
      );
      recharge.reset();
    } else if (recharge.status === 'failed') {
      // errorMessage is only set when session creation itself failed (e.g.
      // Paymob disabled, network error) — a checkout that opened and was
      // then declined/failed by Paymob carries no errorMessage here.
      if (recharge.errorMessage) {
        Alert.alert(t('recharge_start_error_title'), recharge.errorMessage);
      } else {
        Alert.alert(t('recharge_failed_title'), t('recharge_failed_body'));
      }
      recharge.reset();
    } else if (recharge.status === 'cancelled') {
      Alert.alert(t('recharge_cancelled_title'), t('recharge_cancelled_body'));
      recharge.reset();
    } else if (recharge.status === 'timeout') {
      refreshWallet();
      Alert.alert(t('recharge_timeout_title'), t('recharge_timeout_body'));
      recharge.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recharge.status]);

  const handleConfirmCharge = () => {
    if (!selectedCharge || rechargeBusy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    recharge.startRecharge(selectedCharge);
    setSelectedCharge(null);
  };

  if (walletUnavailable) {
    return (
      <LinearGradient colors={c.luxeGrad} style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: top + 12 }]}>
          <Text style={styles.headerTitle}>{t('wallet_title')}</Text>
          <Text style={styles.headerSub}>{t('wallet_subtitle')}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl, gap: Spacing.lg }}>
          <View style={{
            width: 80, height: 80, borderRadius: Radius.xl,
            backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Clock size={36} color={c.silver} />
          </View>
          <View style={{ alignItems: 'center', gap: Spacing.sm }}>
            <View style={{
              paddingHorizontal: 14, paddingVertical: 5, borderRadius: 99,
              backgroundColor: '#f59e0b',
            }}>
              <Text style={{ fontSize: 11, fontWeight: Typography.weight.bold, color: '#ffffff', letterSpacing: 0.5 }}>
                {t('soon')}
              </Text>
            </View>
            <Text style={{ fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, color: c.ink, letterSpacing: -0.5, textAlign: 'center' }}>
              {t('wallet_title')}
            </Text>
            <Text style={{ fontSize: Typography.size.sm, color: c.inkSoft, textAlign: 'center', lineHeight: 20 }}>
              {walletFeature.unavailableMessage || t('wallet_coming_soon_msg')}
            </Text>
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={c.luxeGrad} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <Text style={styles.headerTitle}>{t('wallet_title')}</Text>
        <Text style={styles.headerSub}>{t('wallet_subtitle')}</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight }}
        refreshControl={
          <RefreshControl
            refreshing={walletLoading && hasLoadedWalletOnce}
            onRefresh={refreshWallet}
            tintColor={c.inkSoft}
            colors={[c.ink]}
          />
        }
      >
        <View style={styles.balanceCard}>
          <LinearGradient colors={[c.ink, c.isDark ? '#2a2a4a' : '#2a2a3a']} style={styles.balanceGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.balanceGlow} />
            <Text style={styles.balanceLabel}>{t('wallet_balance_label')}</Text>
            {walletLoading && !hasLoadedWalletOnce ? (
              <View style={[styles.balanceRow, { height: 42 }]}>
                <ActivityIndicator size="small" color="#ffffff" />
              </View>
            ) : (
              <View style={styles.balanceRow}>
                <Text style={[styles.balanceAmount, balance < 0 && { color: '#f87171' }]}>{balance}</Text>
                <Text style={styles.balanceCurrency}>{t('egp')}</Text>
              </View>
            )}
            <View style={styles.balanceStats}>
              <View style={styles.balanceStat}>
                <TrendingDown size={14} color="rgba(255,255,255,0.6)" />
                <Text style={styles.balanceStatText}>{spent} {t('egp')} {t('wallet_spent')}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {walletError && (
          <View style={styles.walletErrorBanner}>
            <AlertTriangle size={16} color="#e0584a" />
            <Text style={styles.walletErrorText}>{t('wallet_load_error')}</Text>
            <TouchableOpacity onPress={refreshWallet} activeOpacity={0.75}>
              <Text style={styles.walletErrorRetry}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

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
                {t('debt_owe_msg').replace('{amount}', String(debt.debtAmount))}
              </Text>
              {debt.offenceCount > 1 && (
                <Text style={[styles.debtBannerBody, c.isDark && styles.debtBannerBodyDark, { marginTop: Spacing.xs }]}>
                  {t('no_show_offences').replace('{count}', String(debt.offenceCount))}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Debt check failed — distinct from "no debt" / "has debt" states, with retry */}
        {!debt?.hasDebt && debtError && (
          <View style={[styles.debtCheckErrorBanner, c.isDark && styles.debtCheckErrorBannerDark]}>
            <AlertTriangle size={16} color={c.inkSoft} />
            <Text style={[styles.debtCheckErrorText, { color: c.inkSoft }]}>{t('debt_check_failed')}</Text>
            <TouchableOpacity onPress={refreshDebt} activeOpacity={0.75}>
              <Text style={[styles.debtCheckErrorRetry, { color: c.ink }]}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: c.ink, opacity: rechargeBusy ? 0.7 : 1 }]}
            activeOpacity={0.85}
            disabled={rechargeBusy}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (!selectedCharge) {
                Alert.alert(t('select_amount_title'), t('select_amount_body'));
              } else {
                handleConfirmCharge();
              }
            }}
          >
            {rechargeBusy ? (
              <AppLoader size={24} />
            ) : (
              <Plus size={20} color={c.isDark ? c.background : c.white} />
            )}
            <Text style={[styles.actionBtnText, { color: c.isDark ? c.background : c.white }]}>{t('recharge')}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, gap: Spacing.xs }}>
            <TouchableOpacity
              style={[gs, styles.actionBtn, { borderWidth: 1, borderColor: c.border, opacity: 0.45 }]}
              activeOpacity={1}
              disabled
            >
              <ArrowUp size={20} color={c.ink} />
              <Text style={[styles.actionBtnText, { color: c.ink }]}>{t('transfer')}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 10, color: c.inkSoft, textAlign: 'center', fontWeight: Typography.weight.semibold }}>Coming Soon</Text>
          </View>
          <TouchableOpacity
            style={[gs, styles.actionBtn, { borderWidth: 1, borderColor: c.border }]}
            activeOpacity={0.85}
            onPress={() => {
              Haptics.selectionAsync();
              router.push('/promo');
            }}
          >
            <Tag size={18} color="#55c49a" />
            <Text style={[styles.actionBtnText, { color: '#55c49a' }]}>{t('promo_title')}</Text>
          </TouchableOpacity>
        </View>

        {(recharge.status === 'initiating' || recharge.status === 'confirming') && (
          <View style={[gs, styles.rechargeStatusBanner]}>
            <ActivityIndicator size="small" color={c.ink} />
            <Text style={styles.rechargeStatusText}>
              {recharge.status === 'initiating' ? t('recharge_starting') : t('recharge_confirming_body')}
            </Text>
          </View>
        )}

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
                    Haptics.selectionAsync();
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
            <View style={[styles.pmCard, !paymobEnabled && { opacity: 0.6 }]}>
              <View style={styles.pmIconBox}>
                <CreditCard size={20} color={paymobEnabled ? c.ink : c.inkSoft} />
              </View>
              <View style={styles.pmMeta}>
                <Text style={styles.pmName}>{t('payment_methods_online')}</Text>
                {!paymobEnabled && <Text style={styles.pmSub}>{t('payment_cards_soon')}</Text>}
              </View>
              {paymobEnabled ? (
                <View style={styles.pmBadge}>
                  <Text style={styles.pmBadgeText}>{t('active')}</Text>
                </View>
              ) : (
                <View style={[styles.pmBadge, { backgroundColor: 'rgba(148,163,184,0.18)' }]}>
                  <Text style={[styles.pmBadgeText, { color: c.inkSoft }]}>{t('soon')}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('tx_history')}</Text>
          {walletLoading && !hasLoadedWalletOnce ? (
            <View style={[gs, styles.txEmpty]}>
              <ActivityIndicator size="small" color={c.inkSoft} />
            </View>
          ) : transactions.length === 0 ? (
            <View style={[gs, styles.txEmpty]}>
              <Clock size={22} color={c.inkSoft} />
              <Text style={styles.txEmptyText}>{t('no_transactions')}</Text>
            </View>
          ) : (
          <View style={styles.txList}>
            {transactions.map((tx) => (
              <TouchableOpacity key={tx.id} style={[gs, styles.txCard]} activeOpacity={0.85} onPress={() => { Haptics.selectionAsync(); }}>
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
          )}
        </View>
      </ScrollView>

      <PaymobCheckoutModal
        visible={recharge.status === 'checkout'}
        iframeUrl={recharge.iframeUrl}
        merchantOrderId={recharge.merchantOrderId}
        onClose={recharge.handleCheckoutClose}
      />
    </LinearGradient>
  );
}
