import { useRef, useEffect, useState, useCallback, useMemo} from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Animated, ActivityIndicator, Image, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Star } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useSplitColors, type SplitColors } from '@/constants/splitTheme';
import { getInstapayInfo, markInstapayPaid } from '@/src/api/rideService';

type InstapayPaymentStatus = 'not_required' | 'awaiting_payment' | 'awaiting_confirmation' | 'confirmed';

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
  /** The payment method actually in effect for this ride. When 'instapay',
   *  an extra step is inserted between 'fare' and 'rating'. */
  paymentMethod?: 'cash' | 'wallet' | 'instapay';
  /** Needed to call the InstaPay fallback-fetch/mark-paid endpoints. */
  rideId?: string | null;
  /** Current InstaPay payment status, as last known from the ride:completed
   *  payload or the INSTAPAY_PAYMENT_CONFIRMED socket event. */
  paymentStatus?: InstapayPaymentStatus | null;
  /** InstaPay link/QR for this ride, present only when paymentMethod === 'instapay'. */
  instapay?: { link: string; qrDataUrl: string } | null;
  driverName?: string | null;
  /** Pickup address — omitted/empty hides the route section. */
  pickup?: string | null;
  /** Dropoff address — omitted/empty hides the route section. */
  dropoff?: string | null;
  /** Called once, with stars === 0 if the passenger skipped rating. */
  onDone: (stars: number, comment: string) => void;
}

// ── "C · Split Panel" fixed palette (matches the approved design) ────────────
const C_STAR = '#F5A623';
const C_GREEN = '#12B76A';

/**
 * Post-trip flow, split into two steps (approved "C" design):
 *   1. a Fare Details page — dark hero band (amount) + white breakdown body;
 *   2. a Rating card shown after the rider taps Done.
 * The public API (onDone) is unchanged — it fires once from the rating step.
 */
export function TripCompletedSheet({
  visible, fare, grossFare, promoDiscount, walletDeduction, paymentMethodLabel,
  paymentMethod, rideId, paymentStatus, instapay,
  driverName, pickup, dropoff, onDone,
}: TripCompletedSheetProps) {
  const { t } = useTheme();
  const S = useSplitColors();
  const styles = useMemo(() => makeStyles(S), [S]);
  const insets = useSafeAreaInsets();
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const [step, setStep] = useState<'fare' | 'instapay' | 'rating'>('fare');
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── InstaPay sub-state ──────────────────────────────────────────────────
  const [instapayStatus, setInstapayStatus] = useState<InstapayPaymentStatus | null>(paymentStatus ?? null);
  const [instapayData, setInstapayData] = useState<{ link: string; qrDataUrl: string } | null>(instapay ?? null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [fetchingInstapay, setFetchingInstapay] = useState(false);

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
      Animated.timing(overlayAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      // App-resume / re-mount: render whatever InstaPay sub-state is already
      // known instead of always replaying "awaiting_payment" UI.
      setStep('fare');
      setInstapayStatus(paymentStatus ?? null);
      setInstapayData(instapay ?? null);
    } else {
      overlayAnim.setValue(0);
      setStep('fare');
      setStars(0);
      setComment('');
      setSubmitting(false);
    }
    // Only react to visibility flipping — paymentStatus/instapay are read at
    // that moment, not on every subsequent change (those are handled by the
    // dedicated effects below so a live socket update still lands).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Fallback fetch: the completion payload may have missed the InstaPay
  // link/QR/status (e.g. app was backgrounded) — GET /rides/:id/instapay fills
  // it in whenever we don't already have a usable QR to show.
  useEffect(() => {
    if (!visible || paymentMethod !== 'instapay' || !rideId) return;
    if (instapayData?.qrDataUrl) return;
    let cancelled = false;
    setFetchingInstapay(true);
    getInstapayInfo(rideId)
      .then((info) => {
        if (cancelled) return;
        if (info.link || info.qrDataUrl) {
          setInstapayData({ link: info.link, qrDataUrl: info.qrDataUrl });
        }
        setInstapayStatus((prev) => prev ?? (info.paymentStatus as InstapayPaymentStatus | undefined) ?? null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFetchingInstapay(false); });
    return () => { cancelled = true; };
  }, [visible, paymentMethod, rideId, instapayData?.qrDataUrl]);

  // Auto-advance: driver confirmed receipt (INSTAPAY_PAYMENT_CONFIRMED,
  // surfaced here via the paymentStatus prop) moves the passenger straight to
  // the rating step.
  useEffect(() => {
    if (paymentStatus === 'confirmed') {
      setInstapayStatus('confirmed');
      setStep((prev) => (prev === 'instapay' ? 'rating' : prev));
    }
  }, [paymentStatus]);

  const handleFareDone = useCallback(() => {
    Haptics.selectionAsync();
    if (paymentMethod === 'instapay' && instapayStatus !== 'confirmed' && instapayStatus !== 'not_required') {
      setStep('instapay');
    } else {
      setStep('rating');
    }
  }, [paymentMethod, instapayStatus]);

  const handleOpenInstapay = useCallback(() => {
    if (!instapayData?.link) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(instapayData.link).catch(() => {});
  }, [instapayData]);

  const handleMarkPaid = useCallback(async () => {
    if (!rideId || markingPaid || instapayStatus === 'awaiting_confirmation' || instapayStatus === 'confirmed') return;
    setMarkingPaid(true);
    try {
      await markInstapayPaid(rideId);
      setInstapayStatus('awaiting_confirmation');
    } catch {
      // Best-effort — leave status as-is so the passenger can retry the tap.
    } finally {
      setMarkingPaid(false);
    }
  }, [rideId, markingPaid, instapayStatus]);

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
      style={[styles.overlay, { opacity: overlayAnim }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {step === 'fare' ? (
        /* ═══════════ STEP 1 · FARE DETAILS ═══════════ */
        <View style={styles.page}>
          {/* dark hero */}
          <View style={[styles.hero, { paddingTop: insets.top + 24 }]}>
            <Text style={styles.heroTopCap}>{t('trip_complete')}</Text>
            {amountToPay != null && (
              <>
                <Text style={styles.heroCap}>{t('cash_to_pay')}</Text>
                <View style={styles.heroAmountRow}>
                  <Text style={styles.heroAmount}>{amountToPay.toFixed(2)}</Text>
                  <Text style={styles.heroCur}>{t('egp')}</Text>
                </View>
                <Text style={styles.heroNote}>{paymentMethodLabel}</Text>
              </>
            )}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 22, paddingBottom: 24 }}
          >
            {/* breakdown */}
            {(grossFare != null || promoDiscount != null || walletDeduction != null) && (
              <>
                <Text style={styles.sectionCap}>{t('fare_breakdown_title')}</Text>
                <View style={{ marginTop: 2 }}>
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
                  {amountToPay != null && (
                    <>
                      <View style={[styles.bHair, styles.bHairThick]} />
                      <View style={[styles.bRow, { paddingTop: 15 }]}>
                        <Text style={styles.bTotalLabel}>{t('net_cash_payable')}</Text>
                        <Text style={styles.bTotalVal}>{amountToPay.toFixed(2)} {t('egp')}</Text>
                      </View>
                    </>
                  )}
                </View>
              </>
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
            <Pressable onPress={handleFareDone} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnTxt}>{'Done'}</Text>
            </Pressable>
          </View>
        </View>
      ) : step === 'instapay' ? (
        /* ═══════════ STEP 1.5 · INSTAPAY ═══════════ */
        <View style={styles.page}>
          <View style={[styles.hero, { paddingTop: insets.top + 24 }]}>
            <Text style={styles.heroTopCap}>{t('instapay_title')}</Text>
            {amountToPay != null && (
              <>
                <View style={styles.heroAmountRow}>
                  <Text style={styles.heroAmount}>{amountToPay.toFixed(2)}</Text>
                  <Text style={styles.heroCur}>{t('egp')}</Text>
                </View>
              </>
            )}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 22, paddingBottom: 24, alignItems: 'center' }}
          >
            {fetchingInstapay && !instapayData?.qrDataUrl ? (
              <ActivityIndicator color={S.teal} style={{ marginTop: 40 }} />
            ) : instapayData?.qrDataUrl ? (
              <>
                <Text style={styles.sectionCap}>{t('instapay_scan_or_tap')}</Text>
                <Image source={{ uri: instapayData.qrDataUrl }} style={styles.qrImage} resizeMode="contain" />
              </>
            ) : null}

            {instapayStatus === 'awaiting_confirmation' || instapayStatus === 'confirmed' ? (
              <View style={styles.waitingRow}>
                <ActivityIndicator color={S.teal} />
                <Text style={styles.waitingText}>{t('instapay_waiting_confirmation')}</Text>
              </View>
            ) : (
              <>
                <Pressable
                  onPress={handleOpenInstapay}
                  disabled={!instapayData?.link}
                  style={[styles.primaryBtn, { marginTop: 20, width: '100%', opacity: instapayData?.link ? 1 : 0.5 }]}
                >
                  <Text style={styles.primaryBtnTxt}>{t('instapay_open_app')}</Text>
                </Pressable>
                <Pressable
                  onPress={handleMarkPaid}
                  disabled={markingPaid || !rideId}
                  style={[styles.secondaryBtn, { marginTop: 12, opacity: markingPaid || !rideId ? 0.6 : 1 }]}
                >
                  {markingPaid ? <ActivityIndicator color={S.teal} /> : <Text style={styles.secondaryBtnTxt}>{t('instapay_ive_paid')}</Text>}
                </Pressable>
              </>
            )}
          </ScrollView>
        </View>
      ) : (
        /* ═══════════ STEP 2 · RATING CARD ═══════════ */
        <View style={styles.ratingWrap}>
          <View style={styles.ratingCard}>
            {/* dark header row */}
            <View style={styles.ratingHeader}>
              <View style={styles.ratingAvatar}>
                <Text style={styles.ratingAvatarTxt}>{driverInitials}</Text>
              </View>
              <View>
                <Text style={styles.ratingCap}>{t('trip_complete')}</Text>
                <Text style={styles.ratingTitle}>{t('rate_your_ride')}</Text>
                {driverName ? <Text style={styles.ratingSub}>{driverName}</Text> : null}
              </View>
            </View>

            {/* white body */}
            <View style={styles.ratingBody}>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => setStars(n)} hitSlop={6}>
                    <Star size={40} color={n <= stars ? C_STAR : '#D3D6DA'} fill={n <= stars ? C_STAR : 'transparent'} strokeWidth={n <= stars ? 0 : 1.4} />
                  </Pressable>
                ))}
              </View>

              {stars > 0 ? (
                <TextInput
                  style={styles.commentInput}
                  placeholder={t('leave_comment')}
                  placeholderTextColor={S.cap}
                  value={comment}
                  onChangeText={setComment}
                  maxLength={200}
                  multiline
                />
              ) : (
                <Text style={styles.commentPlaceholder}>{t('leave_comment')}</Text>
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
        </View>
      )}
    </Animated.View>
  );
}

function makeStyles(S: SplitColors) {
  return StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: S.bg,
    zIndex: 1000,
  },
  page: { flex: 1 },

  /* ── Fare: dark hero ── */
  hero: {
    backgroundColor: S.panel,
    paddingHorizontal: 26, paddingBottom: 22,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  heroTopCap: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: S.capOnDark },
  heroCap: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: S.capOnDark, marginTop: 22 },
  heroAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  heroAmount: { fontSize: 52, fontWeight: '800', color: '#ffffff', letterSpacing: -1, lineHeight: 54 },
  heroCur: { fontSize: 18, fontWeight: '700', color: S.capOnDark },
  heroNote: { fontSize: 13, color: '#B7BBC2', marginTop: 10, fontWeight: '600' },

  /* ── Fare: white body ── */
  sectionCap: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: S.cap, marginBottom: 2 },
  bRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  bLabel: { fontSize: 14, color: S.inkSoft, fontWeight: '600' },
  bVal: { fontSize: 16, fontWeight: '800', color: S.ink },
  bHair: { height: 1, backgroundColor: S.hair },
  bHairThick: { height: 2, backgroundColor: S.panel },
  bTotalLabel: { fontSize: 16, fontWeight: '800', color: S.ink },
  bTotalVal: { fontSize: 22, fontWeight: '800', color: S.teal },

  routeRowWrap: { flexDirection: 'row', gap: 14, marginTop: 20, paddingHorizontal: 4 },
  routeRail: { alignItems: 'center', paddingTop: 4 },
  routeDotO: { width: 9, height: 9, borderRadius: 4.5, borderWidth: 1.5, borderColor: S.ink },
  routeRailLine: { width: 1.5, flex: 1, backgroundColor: '#DDE0E3', marginVertical: 4 },
  routeDotSq: { width: 9, height: 9, borderRadius: 2, backgroundColor: S.teal },
  routeCap: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: S.cap, marginBottom: 3 },
  routeAddr: { fontSize: 14, fontWeight: '700', color: S.ink },

  footer: { paddingHorizontal: 26, paddingTop: 12, backgroundColor: S.bg },
  primaryBtn: { height: 54, borderRadius: 15, backgroundColor: S.panel, alignItems: 'center', justifyContent: 'center' },
  primaryBtnTxt: { color: '#ffffff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },

  /* ── InstaPay step ── */
  qrImage: { width: 220, height: 220, marginTop: 14, borderRadius: 12, backgroundColor: '#ffffff' },
  secondaryBtn: {
    height: 54, borderRadius: 15, width: '100%', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: S.teal,
  },
  secondaryBtnTxt: { color: S.teal, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22 },
  waitingText: { fontSize: 13.5, fontWeight: '600', color: S.inkSoft, flexShrink: 1 },

  /* ── Rating step ── */
  ratingWrap: { flex: 1, justifyContent: 'flex-end' },
  ratingCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  ratingHeader: {
    backgroundColor: S.panel, flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 24, paddingVertical: 24,
  },
  ratingAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#26272E', alignItems: 'center', justifyContent: 'center' },
  ratingAvatarTxt: { fontSize: 18, fontWeight: '800', color: '#ffffff' },
  ratingCap: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: S.capOnDark },
  ratingTitle: { fontSize: 20, fontWeight: '800', color: '#ffffff', marginTop: 4 },
  ratingSub: { fontSize: 13, fontWeight: '600', color: '#B7BBC2', marginTop: 2 },
  ratingBody: { backgroundColor: S.card, padding: 24 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 14 },
  commentPlaceholder: {
    marginTop: 22, backgroundColor: S.surfaceMuted, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, fontWeight: '500', color: S.cap,
  },
  commentInput: {
    borderWidth: 1, borderColor: S.hair, borderRadius: 14, backgroundColor: S.surfaceMuted,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginTop: 22, minHeight: 60, textAlignVertical: 'top', color: S.ink,
  },
  skipBtn: { alignSelf: 'center', marginTop: 14, paddingVertical: 6 },
  skipTxt: { fontSize: 13, fontWeight: '700', color: S.cap },
  });
}
