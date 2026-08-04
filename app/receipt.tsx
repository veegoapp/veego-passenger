import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { showAppAlert } from '@/components/shared/AppAlertHost';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Star, Wallet, X, Banknote } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { RatingSheet } from '@/components/shared/RatingSheet';
import { FareBreakdownModal } from '@/components/shared/FareBreakdownModal';
import api from '@/src/api/client';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: Spacing.md, gap: Spacing.md },
    successBadge: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#55c49a', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, fontSize: 17, fontWeight: Typography.weight.bold, letterSpacing: -0.3 },
    closeBtn: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' },
    content: { padding: 20, paddingBottom: 0, gap: Spacing.md },
    card: { borderRadius: 20, borderWidth: 1, backgroundColor: c.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)', padding: 18, gap: 10 },
    sectionLabel: { fontSize: 10, fontWeight: Typography.weight.semibold, textTransform: 'uppercase', letterSpacing: 1 },
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    routeDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
    routeLine: { width: 2, height: 16, marginLeft: Spacing.xs, backgroundColor: c.border },
    routeText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.medium, flex: 1 },
    driverRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    driverAvatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    driverInitials: { color: '#fff', fontSize: Typography.size.md, fontWeight: Typography.weight.bold },
    driverName: { fontSize: 15, fontWeight: Typography.weight.semibold },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 3 },
    ratingText: { fontSize: Typography.size.xs },
    fareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    fareLabel: { fontSize: 13 },
    fareValue: { fontSize: 13, fontWeight: Typography.weight.medium },
    fareTotal: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, marginTop: 2,
    },
    fareTotalLabel: { fontSize: 15, fontWeight: Typography.weight.bold },
    fareTotalValue: { fontSize: 17, fontWeight: Typography.weight.bold },
    viewDetailsBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
    viewDetailsBtnText: { fontSize: 13, fontWeight: Typography.weight.semibold, textDecorationLine: 'underline' },
    payRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    payLabel: { fontSize: 13, flex: 1 },
    payValue: { fontSize: 13, fontWeight: Typography.weight.semibold },
    cta: {
      padding: 20, paddingTop: 14, borderTopWidth: 1,
      backgroundColor: c.isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.97)',
      gap: Spacing.sm,
    },
    rateBtn: { height: 54, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    rateBtnText: { fontSize: 15, fontWeight: Typography.weight.bold },
    doneBtn: { alignItems: 'center', paddingVertical: 10 },
    doneBtnText: { fontSize: Typography.size.sm },
    cashBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderRadius: Radius.lg, borderWidth: 1.5, padding: 14,
    },
    cashBannerText: { flex: 1, fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, lineHeight: 20 },
  });
}

export default function ReceiptScreen() {
  const params = useLocalSearchParams<{
    rideId?: string;
    pickup?: string;
    dropoff?: string;
    fare?: string;
    grossFare?: string;
    promoDiscount?: string;
    walletDeduction?: string;
    driverName?: string;
    driverRating?: string;
  }>();

  const { colors: c, t } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(c);

  const [ratingVisible, setRatingVisible] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [rateCheckError, setRateCheckError] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);

  // Check passengerRating from the ride to know if rating was already submitted
  const checkAlreadyRated = useCallback(() => {
    if (!params.rideId) return;
    setRateCheckError(false);
    api.get(`/rides/${params.rideId}`)
      .then((res) => {
        const d = res.data?.data ?? res.data;
        if (d?.passengerRating != null) setAlreadyRated(true);
      })
      .catch(() => {
        // If we can't confirm rating status, fail open (still offer the Rate
        // button) but let the user know the check didn't succeed, with a
        // retry so a stale "already rated" state doesn't linger silently.
        setRateCheckError(true);
      });
  }, [params.rideId]);

  useEffect(() => {
    checkAlreadyRated();
  }, [checkAlreadyRated]);

  // params.fare carries netCashPayable (cash still owed to the driver — 0 for
  // wallet-paid rides), set by CarServiceScreen from rideState.fare. Missing/
  // invalid data stays `null` instead of silently rendering as "0.00 EGP" —
  // callers must show an explicit "unavailable" state so a real backend gap
  // is visible during testing rather than masked as a legitimate zero fare.
  const parseNullableNumber = (raw: string | undefined): number | null => (
    raw != null && raw !== '' && Number.isFinite(parseFloat(raw)) ? parseFloat(raw) : null
  );
  const parsedFare = parseNullableNumber(params.fare);
  const parsedGrossFare = parseNullableNumber(params.grossFare);
  const parsedPromoDiscount = parseNullableNumber(params.promoDiscount);
  const parsedWalletDeduction = parseNullableNumber(params.walletDeduction);
  const parsedRating = parseFloat(params.driverRating ?? '0') || 0;
  const driverInitials = (params.driverName ?? '')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'DR';

  const handleRatingSubmit = useCallback(async (stars: number, comment: string) => {
    if (!params.rideId) {
      // No rideId means there's nothing to submit the rating against —
      // surface the failure instead of silently marking as rated.
      setRatingVisible(false);
      showAppAlert(t('error'), t('rating_submit_failed'));
      router.replace('/(tabs)' as any);
      return;
    }
    try {
      await api.post(`/rides/${params.rideId}/rate-driver`, { rating: stars, comment });
      setAlreadyRated(true);
    } catch {
      showAppAlert(t('error'), t('rating_submit_failed'));
      // Not marking alreadyRated — the rating wasn't actually saved, so the
      // prompt should still offer to retry next time this receipt is seen.
    }
    setRatingVisible(false);
    router.replace('/(tabs)' as any);
  }, [params.rideId, t]);

  const handleRatingSkip = useCallback(() => {
    setRatingVisible(false);
    router.replace('/(tabs)' as any);
  }, []);

  const handleDone = useCallback(() => {
    router.replace('/(tabs)' as any);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <LinearGradient
        colors={['rgba(85,196,154,0.14)', 'rgba(85,196,154,0.03)', 'transparent']}
        style={styles.topGradient}
      />

      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.successBadge}>
          <Check size={16} color="#fff" strokeWidth={3} />
        </View>
        <Text style={[styles.headerTitle, { color: c.ink }]}>{t('receipt_title')}</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={handleDone} activeOpacity={0.7}>
          <X size={18} color={c.inkSoft} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingBottom: 160 }]} showsVerticalScrollIndicator={false}>
        {/* Route */}
        {(params.pickup || params.dropoff) && (
          <View style={[styles.card, { borderColor: c.border }]}>
            {!!params.pickup && (
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: c.ink }]} />
                <Text style={[styles.routeText, { color: c.ink }]} numberOfLines={2}>{params.pickup}</Text>
              </View>
            )}
            {!!params.pickup && !!params.dropoff && <View style={styles.routeLine} />}
            {!!params.dropoff && (
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: '#55c49a' }]} />
                <Text style={[styles.routeText, { color: c.ink }]} numberOfLines={2}>{params.dropoff}</Text>
              </View>
            )}
          </View>
        )}

        {/* Driver info */}
        {!!params.driverName && (
          <View style={[styles.card, { borderColor: c.border }]}>
            <Text style={[styles.sectionLabel, { color: c.inkSoft }]}>{t('driver_label')}</Text>
            <View style={styles.driverRow}>
              <View style={[styles.driverAvatar, { backgroundColor: '#3A7BD5' }]}>
                <Text style={styles.driverInitials}>{driverInitials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.driverName, { color: c.ink }]}>{params.driverName}</Text>
                {parsedRating > 0 && (
                  <View style={styles.ratingRow}>
                    <Star size={12} color="#f5a623" fill="#f5a623" />
                    <Text style={[styles.ratingText, { color: c.inkSoft }]}>{parsedRating.toFixed(1)}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Cash due */}
        <View style={[styles.card, { borderColor: c.border }]}>
          <Text style={[styles.sectionLabel, { color: c.inkSoft }]}>{t('receipt_title')}</Text>
          <View style={styles.fareTotal}>
            <Text style={[styles.fareTotalLabel, { color: c.ink }]}>{t('cash_due')}</Text>
            <Text style={[styles.fareTotalValue, { color: parsedFare == null ? c.inkSoft : c.ink }]}>
              {parsedFare != null ? `${parsedFare.toFixed(2)} ${t('egp')}` : t('fare_unavailable')}
            </Text>
          </View>
          {parsedFare != null && (
            <TouchableOpacity onPress={() => setDetailsVisible(true)} activeOpacity={0.7} style={styles.viewDetailsBtn}>
              <Text style={[styles.viewDetailsBtnText, { color: c.primary }]}>{t('view_details')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Payment method */}
        <View style={[styles.card, { borderColor: c.border }]}>
          <View style={styles.payRow}>
            <Wallet size={15} color={c.inkSoft} />
            <Text style={[styles.payLabel, { color: c.inkSoft }]}>{t('payment_method')}</Text>
            <Text style={[styles.payValue, { color: c.ink }]}>{t('cash_payment')}</Text>
          </View>
        </View>

        {/* Cash payment instruction — parsedFare is netCashPayable, so this only
            shows when there is genuinely cash left to hand over (0 for
            wallet-paid rides, hidden entirely while the amount is unknown). */}
        {parsedFare != null && parsedFare > 0 && (
          <View style={[styles.cashBanner, { backgroundColor: 'rgba(85,196,154,0.12)', borderColor: '#55c49a' }]}>
            <Banknote size={18} color="#55c49a" />
            <Text style={[styles.cashBannerText, { color: c.ink }]}>
              {t('pay_driver_cash').replace('{amount}', parsedFare.toFixed(2))}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom CTAs */}
      <View style={[styles.cta, { paddingBottom: insets.bottom + 12, borderTopColor: c.border }]}>
        {!alreadyRated && (
          <TouchableOpacity
            style={[styles.rateBtn, { backgroundColor: c.ink }]}
            onPress={() => setRatingVisible(true)}
            activeOpacity={0.85}
          >
            <Star size={16} color="#f5a623" fill="#f5a623" />
            <Text style={[styles.rateBtnText, { color: c.isDark ? c.background : '#fff' }]}>
              {t('rate_driver')}
            </Text>
          </TouchableOpacity>
        )}
        {rateCheckError && (
          <TouchableOpacity onPress={checkAlreadyRated} activeOpacity={0.7} style={{ alignItems: 'center', paddingVertical: 4 }}>
            <Text style={[styles.doneBtnText, { color: c.inkSoft }]}>{t('rate_status_check_failed')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.doneBtn} onPress={handleDone} activeOpacity={0.7}>
          <Text style={[styles.doneBtnText, { color: c.inkSoft }]}>{t('done')}</Text>
        </TouchableOpacity>
      </View>

      <RatingSheet
        visible={ratingVisible}
        driverName={params.driverName ?? t('your_driver')}
        driverInitials={driverInitials}
        driverColor="#3A7BD5"
        onSubmit={handleRatingSubmit}
        onSkip={handleRatingSkip}
      />

      <FareBreakdownModal
        visible={detailsVisible}
        onClose={() => setDetailsVisible(false)}
        grossFare={parsedGrossFare}
        promoDiscount={parsedPromoDiscount}
        walletDeduction={parsedWalletDeduction}
        netCashPayable={parsedFare}
      />
    </View>
  );
}
