import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, Modal, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { TrendingDown, AlertTriangle, Banknote, CreditCard, Clock, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { useTabBar } from '@/context/TabBarContext';
import { useWallet, type Transaction } from '@/src/hooks/shared/useWallet';
import { useMyDebt } from '@/src/hooks/shared/useMyDebt';
import { usePaymentConfig } from '@/context/PaymentConfigContext';
import { Spacing } from '@/constants/spacing';

// ── C · Split Panel — fixed palette, independent of the app's light/dark theme.
const C_BG = '#EEF0F2';
const C_PANEL = '#14151A';
const C_INK = '#14151A';
const C_INK_SOFT = '#6B7178';
const C_CAP = '#9AA0A6';
const C_HAIR = '#EEF0F1';
const C_MIST = '#F0F2F3';
const C_TEAL = '#0E9F8E';

function makeStyles() {
  return StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: Spacing.md, gap: Spacing.xs },
    headerTitle: { fontSize: 24, fontWeight: '800', color: C_INK, letterSpacing: -0.7 },
    headerSub: { fontSize: 13, color: C_INK_SOFT, fontWeight: '600' },
    balanceCard: {
      marginHorizontal: 20, borderRadius: 28, marginBottom: 20,
      backgroundColor: C_PANEL, padding: Spacing.xl, overflow: 'hidden',
    },
    balanceGlow: { position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.05)' },
    balanceLabel: { fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '600', marginBottom: Spacing.sm },
    balanceAmount: { fontSize: 42, fontWeight: '800', color: '#ffffff', letterSpacing: -1.5 },
    balanceCurrency: { fontSize: 17, color: 'rgba(255,255,255,0.65)', fontWeight: '600' },
    balanceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 20 },
    balanceStats: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.xs },
    balanceStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    balanceStatText: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
    section: { marginBottom: 20 },
    sectionLabel: { fontSize: 11, fontWeight: '700', color: C_CAP, textTransform: 'uppercase', letterSpacing: 1.2, paddingStart: 24, marginBottom: 10 },
    txList: { paddingHorizontal: 20, gap: 10 },
    txCard: {
      padding: 14, flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: C_HAIR,
    },
    txEmpty: { marginHorizontal: 20, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: C_HAIR },
    txEmptyText: { fontSize: 13.5, color: C_INK_SOFT, textAlign: 'center' },
    txIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    txMeta: { flex: 1, gap: 2 },
    txTitle: { fontSize: 13.5, fontWeight: '700', color: C_INK },
    txSub: { fontSize: 11.5, color: C_INK_SOFT },
    txDate: { fontSize: 10.5, color: C_INK_SOFT, marginTop: 2 },
    txAmount: { fontSize: 15, fontWeight: '800' },
    pmSection: { marginBottom: 20 },
    pmCard: {
      padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: C_HAIR,
    },
    pmIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: C_MIST, alignItems: 'center', justifyContent: 'center' },
    pmMeta: { flex: 1, gap: 2 },
    pmName: { fontSize: 14, fontWeight: '700', color: C_INK },
    pmSub: { fontSize: 12, color: C_INK_SOFT },
    pmBadge: { paddingHorizontal: 10, paddingVertical: Spacing.xs, borderRadius: 99, backgroundColor: 'rgba(14,159,142,0.12)' },
    pmBadgeText: { fontSize: 11, fontWeight: '700', color: C_TEAL },
    debtBanner: {
      marginHorizontal: 20, marginBottom: Spacing.lg, borderRadius: 18,
      backgroundColor: '#FFF8EC', borderWidth: 1.5, borderColor: '#FDE7C0',
      padding: Spacing.lg, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    },
    debtBannerIcon: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: '#FDE7C0', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    debtBannerText: { flex: 1, gap: Spacing.xs },
    debtBannerTitle: { fontSize: 13.5, fontWeight: '700', color: '#92400e' },
    debtBannerBody: { fontSize: 12.5, color: '#78350f', lineHeight: 18 },
    debtCheckErrorBanner: {
      marginHorizontal: 20, marginBottom: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C_HAIR, padding: Spacing.md,
    },
    debtCheckErrorText: { flex: 1, fontSize: 12, lineHeight: 17, color: C_INK_SOFT },
    debtCheckErrorRetry: { fontSize: 12, fontWeight: '700', color: C_INK },
    walletErrorBanner: {
      marginHorizontal: 20, marginBottom: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: '#FEF2F1', borderRadius: 14, borderWidth: 1, borderColor: '#F3C6C2', padding: Spacing.md,
    },
    walletErrorText: { flex: 1, fontSize: 12, lineHeight: 17, color: '#D92D20' },
    walletErrorRetry: { fontSize: 12, fontWeight: '700', color: '#D92D20' },

    /* Transaction detail modal */
    txDetailBackdrop: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    },
    txDetailCard: {
      padding: Spacing.xl, alignItems: 'center', width: '100%', maxWidth: 400, alignSelf: 'center',
      backgroundColor: '#fff', borderRadius: 24,
    },
    txDetailIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
    txDetailTitle: { fontSize: 15.5, fontWeight: '700', color: C_INK, textAlign: 'center', marginBottom: 4 },
    txDetailAmount: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginBottom: Spacing.lg },
    txDetailDivider: { height: 1, width: '100%', backgroundColor: C_HAIR, marginBottom: Spacing.md },
    txDetailRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      width: '100%', paddingVertical: 7,
    },
    txDetailLabel: { fontSize: 12.5, color: C_INK_SOFT },
    txDetailValue: { fontSize: 13, fontWeight: '700', color: C_INK },
    txDetailCloseBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      marginTop: Spacing.lg, paddingVertical: 12, paddingHorizontal: 24,
      borderRadius: 14, borderWidth: 1.5, borderColor: C_HAIR,
      alignSelf: 'stretch',
    },
    txDetailCloseText: { fontSize: 13.5, fontWeight: '700', color: C_INK },
  });
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const { tabBarHeight } = useTabBar();
  const { t, language } = useTheme();
  const styles = useMemo(() => makeStyles(), []);
  const isAr = language === 'ar';

  const { balance, spent, transactions, loading: walletLoading, error: walletError, refresh: refreshWallet } = useWallet();
  const [hasLoadedWalletOnce, setHasLoadedWalletOnce] = useState(false);
  useEffect(() => {
    if (!walletLoading) setHasLoadedWalletOnce(true);
  }, [walletLoading]);
  const { debt, error: debtError, refresh: refreshDebt } = useMyDebt();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const { walletFeature, paymentMethods } = usePaymentConfig();
  const paymobEnabled = paymentMethods.some((m) => m.key === 'paymob');
  const walletUnavailable = !walletFeature.isEnabled || walletFeature.displayMode !== 'live';

  if (walletUnavailable) {
    return (
      <View style={{ flex: 1, backgroundColor: C_BG }}>
        <View style={[styles.header, { paddingTop: top + 12 }]}>
          <Text style={styles.headerTitle}>{t('wallet_title')}</Text>
          <Text style={styles.headerSub}>{t('wallet_subtitle')}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl, gap: Spacing.lg }}>
          <View style={{
            width: 80, height: 80, borderRadius: 24,
            backgroundColor: C_MIST,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Clock size={36} color={C_CAP} />
          </View>
          <View style={{ alignItems: 'center', gap: Spacing.sm }}>
            <View style={{
              paddingHorizontal: 14, paddingVertical: 5, borderRadius: 99,
              backgroundColor: '#f59e0b',
            }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#ffffff', letterSpacing: 0.5 }}>
                {t('soon')}
              </Text>
            </View>
            <Text style={{ fontSize: 19, fontWeight: '800', color: C_INK, letterSpacing: -0.4, textAlign: 'center' }}>
              {t('wallet_title')}
            </Text>
            <Text style={{ fontSize: 13.5, color: C_INK_SOFT, textAlign: 'center', lineHeight: 20 }}>
              {walletFeature.unavailableMessage || t('wallet_coming_soon_msg')}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C_BG }}>
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
            tintColor={C_INK_SOFT}
            colors={[C_PANEL]}
          />
        }
      >
        <View style={styles.balanceCard}>
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
        </View>

        {walletError && (
          <View style={styles.walletErrorBanner}>
            <AlertTriangle size={16} color="#D92D20" />
            <Text style={styles.walletErrorText}>{t('wallet_load_error')}</Text>
            <TouchableOpacity onPress={refreshWallet} activeOpacity={0.75}>
              <Text style={styles.walletErrorRetry}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {debt?.hasDebt && (
          <View style={styles.debtBanner}>
            <View style={styles.debtBannerIcon}>
              <AlertTriangle size={18} color="#f59e0b" />
            </View>
            <View style={styles.debtBannerText}>
              <Text style={styles.debtBannerTitle}>
                {t('cash_debt')}
              </Text>
              <Text style={styles.debtBannerBody}>
                {t('debt_owe_msg').replace('{amount}', String(debt.debtAmount))}
              </Text>
              {debt.offenceCount > 1 && (
                <Text style={[styles.debtBannerBody, { marginTop: Spacing.xs }]}>
                  {t('no_show_offences').replace('{count}', String(debt.offenceCount))}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Debt check failed — distinct from "no debt" / "has debt" states, with retry */}
        {!debt?.hasDebt && debtError && (
          <View style={styles.debtCheckErrorBanner}>
            <AlertTriangle size={16} color={C_INK_SOFT} />
            <Text style={styles.debtCheckErrorText}>{t('debt_check_failed')}</Text>
            <TouchableOpacity onPress={refreshDebt} activeOpacity={0.75}>
              <Text style={styles.debtCheckErrorRetry}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.pmSection}>
          <Text style={styles.sectionLabel}>{t('payment_title')}</Text>
          <View style={{ paddingHorizontal: 20, gap: 10 }}>
            <View style={styles.pmCard}>
              <View style={styles.pmIconBox}>
                <Banknote size={20} color={C_INK} />
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
                <CreditCard size={20} color={paymobEnabled ? C_INK : C_INK_SOFT} />
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
                <View style={[styles.pmBadge, { backgroundColor: C_MIST }]}>
                  <Text style={[styles.pmBadgeText, { color: C_INK_SOFT }]}>{t('soon')}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('tx_history')}</Text>
          {walletLoading && !hasLoadedWalletOnce ? (
            <View style={styles.txEmpty}>
              <ActivityIndicator size="small" color={C_INK_SOFT} />
            </View>
          ) : transactions.length === 0 ? (
            <View style={styles.txEmpty}>
              <Clock size={22} color={C_INK_SOFT} />
              <Text style={styles.txEmptyText}>{t('no_transactions')}</Text>
            </View>
          ) : (
          <View style={styles.txList}>
            {transactions.map((tx) => (
              <TouchableOpacity key={tx.id} activeOpacity={0.85} onPress={() => { Haptics.selectionAsync(); setSelectedTx(tx); }}>
                <View style={styles.txCard}>
                  <View style={[styles.txIcon, { backgroundColor: tx.type === 'credit' ? 'rgba(14,159,142,0.1)' : C_MIST }]}>
                    {React.createElement(tx.icon as React.ComponentType<{size?:number;color?:string}>, { size: 20, color: tx.type === 'credit' ? C_TEAL : C_INK_SOFT })}
                  </View>
                  <View style={styles.txMeta}>
                    <Text style={styles.txTitle}>{isAr ? tx.titleAr : tx.titleEn}</Text>
                    <Text style={styles.txSub}>{isAr ? tx.subtitleAr : tx.subtitleEn}</Text>
                    <Text style={styles.txDate}>{isAr ? tx.dateAr : tx.dateEn}</Text>
                  </View>
                  <Text style={[styles.txAmount, { color: tx.type === 'credit' ? C_TEAL : C_INK }]}>
                    {tx.type === 'credit' ? '+' : '-'}{tx.amount} {t('egp')}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={!!selectedTx}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTx(null)}
      >
        <Pressable style={styles.txDetailBackdrop} onPress={() => setSelectedTx(null)}>
          <Pressable onPress={() => {}} style={{ width: '100%' }}>
            {selectedTx && (
              <View style={styles.txDetailCard}>
                <View style={[styles.txDetailIcon, { backgroundColor: selectedTx.type === 'credit' ? 'rgba(14,159,142,0.1)' : C_MIST }]}>
                  {React.createElement(selectedTx.icon as React.ComponentType<{ size?: number; color?: string }>, {
                    size: 26, color: selectedTx.type === 'credit' ? C_TEAL : C_INK_SOFT,
                  })}
                </View>
                <Text style={styles.txDetailTitle}>{isAr ? selectedTx.titleAr : selectedTx.titleEn}</Text>
                <Text style={[styles.txDetailAmount, { color: selectedTx.type === 'credit' ? C_TEAL : C_INK }]}>
                  {selectedTx.type === 'credit' ? '+' : '-'}{selectedTx.amount} {t('egp')}
                </Text>

                <View style={styles.txDetailDivider} />

                <View style={styles.txDetailRow}>
                  <Text style={styles.txDetailLabel}>{t('tx_detail_type')}</Text>
                  <Text style={styles.txDetailValue}>{t(`tx_kind_${selectedTx.kind}`)}</Text>
                </View>
                <View style={styles.txDetailRow}>
                  <Text style={styles.txDetailLabel}>{t('tx_detail_date')}</Text>
                  <Text style={styles.txDetailValue}>{isAr ? selectedTx.dateAr : selectedTx.dateEn}</Text>
                </View>
                <View style={styles.txDetailRow}>
                  <Text style={styles.txDetailLabel}>{t('tx_detail_reference')}</Text>
                  <Text style={styles.txDetailValue}>#{selectedTx.id}</Text>
                </View>
                {!!(isAr ? selectedTx.subtitleAr : selectedTx.subtitleEn) && (
                  <View style={[styles.txDetailRow, { alignItems: 'flex-start' }]}>
                    <Text style={styles.txDetailLabel}>{t('tx_history')}</Text>
                    <Text style={[styles.txDetailValue, { flex: 1, textAlign: isAr ? 'left' : 'right' }]}>
                      {isAr ? selectedTx.subtitleAr : selectedTx.subtitleEn}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.txDetailCloseBtn}
                  activeOpacity={0.8}
                  onPress={() => setSelectedTx(null)}
                >
                  <X size={16} color={C_INK} strokeWidth={2.2} />
                  <Text style={styles.txDetailCloseText}>{t('close')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
