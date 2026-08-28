import { useRef, useEffect, useState, useCallback, useMemo} from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Animated, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Star } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useSplitColors, type SplitColors } from '@/constants/splitTheme';

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
  driverName, pickup, dropoff, onDone,
}: TripCompletedSheetProps) {
  const { t } = useTheme();
  const S = useSplitColors();
  const styles = useMemo(() => makeStyles(S), [S]);
  const insets = useSafeAreaInsets();
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const [step, setStep] = useState<'fare' | 'rating'>('fare');
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
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
      Animated.timing(overlayAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } else {
      overlayAnim.setValue(0);
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
            <Pressable onPress={() => { Haptics.selectionAsync(); setStep('rating'); }} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnTxt}>{'Done'}</Text>
            </Pressable>
          </View>
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
    marginTop: 22, backgroundColor: '#F6F7F8', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, fontWeight: '500', color: S.cap,
  },
  commentInput: {
    borderWidth: 1, borderColor: S.hair, borderRadius: 14, backgroundColor: '#F6F7F8',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginTop: 22, minHeight: 60, textAlignVertical: 'top', color: S.ink,
  },
  skipBtn: { alignSelf: 'center', marginTop: 14, paddingVertical: 6 },
  skipTxt: { fontSize: 13, fontWeight: '700', color: S.cap },
  });
}
