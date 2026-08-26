import { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Animated, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Check, Star } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { FareBreakdownModal } from '@/components/shared/FareBreakdownModal';

interface TripCompletedSheetProps {
  visible: boolean;
  /** netCashPayable from the ride:completed payload — cash still owed to the
   *  driver (0 for wallet-paid rides). */
  fare: number | null;
  /** Original trip price before any promo discount — feeds the breakdown. */
  grossFare?: number | null;
  /** EGP amount knocked off by a promo code — feeds the breakdown. */
  promoDiscount?: number | null;
  /** Portion of the fare paid from the passenger's wallet — feeds the breakdown. */
  walletDeduction?: number | null;
  paymentMethodLabel: string;
  driverName?: string | null;
  /** Driver's existing rating (e.g. 4.8) shown on the rating card. */
  driverRating?: number | null;
  /** Pickup address — omitted/empty hides the route section. */
  pickup?: string | null;
  /** Dropoff address — omitted/empty hides the route section. */
  dropoff?: string | null;
  /** Called once, with stars === 0 if the passenger skipped rating. */
  onDone: (stars: number, comment: string) => void;
}

// ── "C" fixed palette ────────────────────────────────────────────────────────
const C_BG = '#EEF0F2';
const C_SURF = '#FFFFFF';
const C_INK = '#14151A';
const C_INK_SOFT = '#6B7178';
const C_CAP = '#9AA0A6';
const C_HAIR = '#EEF0F1';
const C_TEAL = '#0E9F8E';
const C_STAR = '#F5A623';
const C_GREEN = '#12B76A';
const C_PANEL = '#14151A';

/**
 * Post-trip flow, split into two steps (approved design):
 *   1. a full-screen Fare Details page (C) — complete breakdown, big amount;
 *   2. a Rating card (C) shown after the rider taps Continue.
 * The public API (onDone) is unchanged — it fires once from the rating step.
 */
export function TripCompletedSheet({
  visible, fare, grossFare, promoDiscount, walletDeduction, paymentMethodLabel,
  driverName, driverRating, pickup, dropoff, onDone,
}: TripCompletedSheetProps) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0.5)).current;
  const [step, setStep] = useState<'fare' | 'rating'>('fare');
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const driverInitials = (driverName ?? '')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'DR';

  // Passenger-facing amount: cash owed for cash rides, else the wallet charge.
  const amountToPay = fare != null && fare > 0 ? fare : (walletDeduction ?? null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(checkScale, { toValue: 1, stiffness: 250, useNativeDriver: true }),
      ]).start();
    } else {
      overlayAnim.setValue(0);
      checkScale.setValue(0.5);
      setStep('fare');
      setStars(0);
      setComment('');
      setSubmitting(false);
    }
  }, [visible]);

  const handleSkip = useCallback(() => {
    if (submitting) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDone(0, '');
  }, [submitting, onDone]);

  const handleSubmit = useCallback(async () => {
    if (stars === 0 || submitting) return;
    setSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await onDone(stars, comment);
    setSubmitting(false);
  }, [stars, comment, submitting, onDone]);

  return (
    <Animated.View
      style={[styles.overlay, { opacity: overlayAnim, paddingTop: insets.top }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {step === 'fare' ? (
        /* ═══════════ STEP 1 · FARE DETAILS (full-screen page) ═══════════ */
        <View style={styles.page}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 40, paddingBottom: 24 }}
          >
            <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}>
              <Check size={40} color="#ffffff" strokeWidth={3} />
            </Animated.View>
            <Text style={styles.pageTitle}>{t('trip_complete')}</Text>

            {amountToPay != null && (
              <>
                <Text style={styles.heroCap}>{t('cash_to_pay')}</Text>
                <View style={styles.heroAmountRow}>
                  <Text style={styles.heroAmount}>{amountToPay.toFixed(2)}</Text>
                  <Text style={styles.heroCur}>{t('egp')}</Text>
                </View>
                <Text style={styles.heroNote}>{paymentMethodLabel}</Text>
                <Pressable onPress={() => setDetailsVisible(true)} style={styles.viewDetailsBtn}>
                  <Text style={styles.viewDetailsTxt}>{t('view_details')}</Text>
                </Pressable>
              </>
            )}

            {/* breakdown */}
            {(grossFare != null || promoDiscount != null || walletDeduction != null) && (
              <View style={styles.breakdown}>
                {grossFare != null && (
                  <View style={styles.bRow}>
                    <Text style={styles.bLabel}>{t('gross_fare')}</Text>
                    <Text style={styles.bVal}>{grossFare.toFixed(2)}</Text>
                  </View>
                )}
                {promoDiscount != null && promoDiscount > 0 && (
                  <>
                    <View style={styles.bHair} />
                    <View style={styles.bRow}>
                      <Text style={styles.bLabel}>{t('promo_discount_line')}</Text>
                      <Text style={[styles.bVal, { color: C_GREEN }]}>-{promoDiscount.toFixed(2)}</Text>
                    </View>
                  </>
                )}
                {walletDeduction != null && walletDeduction > 0 && (
                  <>
                    <View style={styles.bHair} />
                    <View style={styles.bRow}>
                      <Text style={styles.bLabel}>{t('wallet_deduction_line')}</Text>
                      <Text style={styles.bVal}>-{walletDeduction.toFixed(2)}</Text>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* route */}
            {!!(pickup || dropoff) && (
              <View style={styles.routeRowWrap}>
                <View style={styles.routeRail}>
                  <View style={styles.routeDotO} />
                  <View style={styles.routeRailLine} />
                  <View style={styles.routeDotSq} />
                </View>
                <View style={{ flex: 1 }}>
                  {!!pickup && (
                    <View style={{ paddingBottom: 14 }}>
                      <Text style={styles.routeCap}>{t('pickup') ?? 'Pickup'}</Text>
                      <Text style={styles.routeAddr} numberOfLines={2}>{pickup}</Text>
                    </View>
                  )}
                  {!!dropoff && (
                    <View>
                      <Text style={styles.routeCap}>{t('dropoff') ?? 'Drop-off'}</Text>
                      <Text style={styles.routeAddr} numberOfLines={2}>{dropoff}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
            <Pressable onPress={() => { Haptics.selectionAsync(); setStep('rating'); }} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnTxt}>{'Continue'}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        /* ═══════════ STEP 2 · RATING CARD ═══════════ */
        <View style={styles.ratingWrap}>
          <View style={styles.ratingCard}>
            <View style={styles.ratingAvatar}>
              <Text style={styles.ratingAvatarTxt}>{driverInitials}</Text>
            </View>
            <Text style={styles.ratingCap}>{t('trip_complete')}</Text>
            <Text style={styles.ratingTitle}>{t('rate_your_ride')}</Text>
            {driverName ? <Text style={styles.ratingSub}>{driverName}</Text> : null}
            {driverRating != null && driverRating > 0 && (
              <View style={styles.driverRatingRow}>
                <Star size={11} color={C_STAR} fill={C_STAR} strokeWidth={0} />
                <Text style={styles.driverRatingTxt}>{driverRating.toFixed(1)}</Text>
              </View>
            )}

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setStars(n)} hitSlop={6}>
                  <Star size={38} color={n <= stars ? C_STAR : '#D3D6DA'} fill={n <= stars ? C_STAR : 'transparent'} strokeWidth={n <= stars ? 0 : 1.4} />
                </Pressable>
              ))}
            </View>

            {stars > 0 && (
              <TextInput
                style={styles.commentInput}
                placeholder={t('leave_comment')}
                placeholderTextColor={C_CAP}
                value={comment}
                onChangeText={setComment}
                maxLength={200}
                multiline
              />
            )}

            <Pressable
              onPress={handleSubmit}
              disabled={stars === 0 || submitting}
              style={[styles.primaryBtn, { marginTop: 20, opacity: stars === 0 || submitting ? 0.5 : 1 }]}
            >
              {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryBtnTxt}>{t('submit_rating')}</Text>}
            </Pressable>
            <Pressable onPress={handleSkip} disabled={submitting} style={styles.skipBtn}>
              <Text style={styles.skipTxt}>{t('skip')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <FareBreakdownModal
        visible={detailsVisible}
        onClose={() => setDetailsVisible(false)}
        grossFare={grossFare ?? null}
        promoDiscount={promoDiscount ?? null}
        walletDeduction={walletDeduction ?? null}
        netCashPayable={fare}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: C_BG,
    zIndex: 1000,
  },
  page: { flex: 1 },

  checkCircle: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: C_PANEL,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  pageTitle: { fontSize: 24, fontWeight: '800', color: C_INK, textAlign: 'center', marginTop: 18, letterSpacing: -0.3 },

  heroCap: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: C_CAP, textAlign: 'center', marginTop: 26 },
  heroAmountRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8, marginTop: 6 },
  heroAmount: { fontSize: 52, fontWeight: '800', color: C_TEAL, letterSpacing: -1, lineHeight: 54 },
  heroCur: { fontSize: 19, fontWeight: '700', color: C_TEAL },
  heroNote: { fontSize: 13, color: C_INK_SOFT, textAlign: 'center', marginTop: 8, fontWeight: '600' },
  viewDetailsBtn: { alignSelf: 'center', marginTop: 6, paddingVertical: 4, paddingHorizontal: 8 },
  viewDetailsTxt: { fontSize: 13, fontWeight: '700', color: C_TEAL, textDecorationLine: 'underline' },

  breakdown: { backgroundColor: C_SURF, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 4, marginTop: 28 },
  bRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  bLabel: { fontSize: 14, color: C_INK_SOFT, fontWeight: '600' },
  bVal: { fontSize: 16, fontWeight: '800', color: C_INK },
  bHair: { height: 1, backgroundColor: C_HAIR },

  routeRowWrap: { flexDirection: 'row', gap: 14, marginTop: 24, paddingHorizontal: 4 },
  routeRail: { alignItems: 'center', paddingTop: 4 },
  routeDotO: { width: 9, height: 9, borderRadius: 4.5, borderWidth: 1.5, borderColor: C_INK },
  routeRailLine: { width: 1.5, flex: 1, backgroundColor: '#DDE0E3', marginVertical: 4 },
  routeDotSq: { width: 9, height: 9, borderRadius: 2, backgroundColor: C_TEAL },
  routeCap: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: C_CAP, marginBottom: 3 },
  routeAddr: { fontSize: 14, fontWeight: '700', color: C_INK },

  footer: { paddingHorizontal: 26, paddingTop: 12, backgroundColor: C_BG },
  primaryBtn: { height: 54, borderRadius: 15, backgroundColor: C_PANEL, alignItems: 'center', justifyContent: 'center' },
  primaryBtnTxt: { color: '#ffffff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },

  /* ── Rating step ── */
  ratingWrap: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 34 },
  ratingCard: { backgroundColor: C_SURF, borderRadius: 28, padding: 24, alignItems: 'center' },
  ratingAvatar: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#EEEADF', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  ratingAvatarTxt: { fontSize: 22, fontWeight: '800', color: '#4A463D' },
  ratingCap: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: C_CAP, marginTop: 14 },
  ratingTitle: { fontSize: 24, fontWeight: '800', color: C_INK, marginTop: 6, letterSpacing: -0.3 },
  ratingSub: { fontSize: 14, color: C_INK_SOFT, fontWeight: '600', marginTop: 4 },
  driverRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  driverRatingTxt: { fontSize: 12, fontWeight: '700', color: C_INK_SOFT },
  starsRow: { flexDirection: 'row', gap: 14, marginTop: 22 },
  commentInput: {
    alignSelf: 'stretch', borderWidth: 1, borderColor: C_HAIR, borderRadius: 14, backgroundColor: '#F6F7F8',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginTop: 18, minHeight: 60, textAlignVertical: 'top', color: C_INK,
  },
  skipBtn: { marginTop: 14, paddingVertical: 6 },
  skipTxt: { fontSize: 13, fontWeight: '700', color: C_CAP },
});
