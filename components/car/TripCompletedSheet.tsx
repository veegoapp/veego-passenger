import { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Animated, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Star } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { FareBreakdownModal } from '@/components/shared/FareBreakdownModal';

interface TripCompletedSheetProps {
  visible: boolean;
  /** netCashPayable from the ride:completed payload — cash still owed to the
   *  driver (0 for wallet-paid rides). Left `null` (never coerced to 0) until
   *  the backend value actually arrives, so the amount line stays hidden
   *  below rather than misreporting "0.00 EGP". */
  fare: number | null;
  /** Original trip price before any promo discount — feeds the "View Details" breakdown. */
  grossFare?: number | null;
  /** EGP amount knocked off by a promo code — feeds the "View Details" breakdown. */
  promoDiscount?: number | null;
  /** Portion of the fare paid from the passenger's wallet — feeds the "View Details" breakdown. */
  walletDeduction?: number | null;
  paymentMethodLabel: string;
  driverName?: string | null;
  /** Driver's existing rating (e.g. 4.8) — distinct from the star rating the
   *  passenger is submitting below. Omitted (or <= 0) hides the row. */
  driverRating?: number | null;
  /** Pickup address — omitted/empty hides the route section. */
  pickup?: string | null;
  /** Dropoff address — omitted/empty hides the route section. */
  dropoff?: string | null;
  /** Called once, with stars === 0 if the passenger skipped rating. */
  onDone: (stars: number, comment: string) => void;
}

/**
 * Structural/visual port of the Driver app's post-trip "completed" overlay
 * (app/ride/[rideId].tsx, phase === 'completed'): full-screen scrim, animated
 * checkmark badge, big fare amount, a single payment-method note line, a
 * glass rating card (avatar + label + 5-star row + optional comment), and a
 * Skip / Submit action row — instead of the previous bottom sheet.
 */
export function TripCompletedSheet({
  visible, fare, grossFare, promoDiscount, walletDeduction, paymentMethodLabel,
  driverName, driverRating, pickup, dropoff, onDone,
}: TripCompletedSheetProps) {
  const { colors: c, t } = useTheme();
  const insets = useSafeAreaInsets();
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0.5)).current;
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

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(checkScale, { toValue: 1, stiffness: 250, useNativeDriver: true }),
      ]).start();
    } else {
      overlayAnim.setValue(0);
      checkScale.setValue(0.5);
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

  const ratingLabel = driverName ? `${t('rate_your_ride')} ${driverName}?` : t('rate_your_ride');

  return (
    <Animated.View
      style={[
        styles.overlay,
        { opacity: overlayAnim, backgroundColor: c.background + 'CC', paddingBottom: insets.bottom },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }] }]}>
        <LinearGradient colors={['#2d2d42', '#1e1e28']} style={styles.checkCircleGrad}>
          <Check size={48} color="#ffffff" strokeWidth={3} />
        </LinearGradient>
      </Animated.View>

      <Text style={[styles.completedTitle, { color: c.ink }]}>{t('trip_complete')}</Text>

      {fare != null && (
        <Text style={[styles.fareLabel, { color: c.inkSoft }]}>{t('cash_to_pay')}</Text>
      )}
      {fare != null && (
        <Text style={[styles.fareEarned, { color: c.gold }]}>
          {fare.toFixed(2)} {t('egp')}
        </Text>
      )}
      {fare != null && (
        <Text style={[styles.fareNote, { color: c.inkSoft }]}>{paymentMethodLabel}</Text>
      )}

      {fare != null && (
        <Pressable onPress={() => setDetailsVisible(true)} style={styles.viewDetailsBtn} accessibilityLabel={t('view_details')}>
          <Text style={[styles.viewDetailsBtnText, { color: c.gold }]}>{t('view_details')}</Text>
        </Pressable>
      )}

      {!!(pickup || dropoff) && (
        <View style={[styles.routeCard, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}>
          {!!pickup && (
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: c.ink }]} />
              <Text style={[styles.routeText, { color: c.ink }]} numberOfLines={2}>{pickup}</Text>
            </View>
          )}
          {!!pickup && !!dropoff && <View style={[styles.routeLine, { backgroundColor: c.border }]} />}
          {!!dropoff && (
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: c.gold }]} />
              <Text style={[styles.routeText, { color: c.ink }]} numberOfLines={2}>{dropoff}</Text>
            </View>
          )}
        </View>
      )}

      <View style={[styles.ratingCard, { backgroundColor: c.white, borderColor: c.border }]}>
        <View style={styles.ratingCardHeader}>
          <View style={[styles.ratingAvatar, { backgroundColor: c.surfaceMuted }]}>
            <Text style={[styles.ratingAvatarText, { color: c.ink }]}>{driverInitials}</Text>
          </View>
          <Text style={[styles.ratingCardLabel, { color: c.inkSoft }]} numberOfLines={1}>{ratingLabel}</Text>
          {driverRating != null && driverRating > 0 && (
            <View style={styles.driverRatingRow}>
              <Star size={11} color={c.gold} fill={c.gold} />
              <Text style={[styles.driverRatingText, { color: c.inkSoft }]}>{driverRating.toFixed(1)}</Text>
            </View>
          )}
        </View>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setStars(n)} hitSlop={6}>
              <Star size={36} color={n <= stars ? c.gold : c.silver} fill={n <= stars ? c.gold : 'transparent'} strokeWidth={2} />
            </Pressable>
          ))}
        </View>
        {stars > 0 && (
          <TextInput
            style={[styles.commentInput, { borderColor: c.border, backgroundColor: c.surfaceMuted, color: c.ink }]}
            placeholder={t('leave_comment')}
            placeholderTextColor={c.inkSoft}
            value={comment}
            onChangeText={setComment}
            maxLength={200}
            multiline
          />
        )}
      </View>

      <View style={styles.ratingActionsRow}>
        <Pressable
          onPress={handleSkip}
          disabled={submitting}
          style={[styles.skipBtn, { borderColor: c.border, opacity: submitting ? 0.5 : 1 }]}
        >
          <Text style={[styles.skipBtnText, { color: c.ink }]}>{t('skip')}</Text>
        </Pressable>
        <Pressable
          onPress={handleSubmit}
          disabled={stars === 0 || submitting}
          style={[styles.doneBtn, { opacity: stars === 0 || submitting ? 0.5 : 1 }]}
        >
          <LinearGradient colors={['#2d2d42', '#1e1e28']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.doneBtnGrad}>
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.doneBtnText}>{t('submit_rating')}</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>

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
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 1000,
  },
  checkCircle: {
    width: 96, height: 96, borderRadius: 48, overflow: 'hidden',
    elevation: 8, shadowColor: '#2d2d42',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 16,
  },
  checkCircleGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  completedTitle: { fontSize: 24, fontWeight: '700', marginTop: 24 },
  fareLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 20 },
  fareEarned: { fontSize: 48, lineHeight: 52, fontWeight: '800', marginTop: 4 },
  fareNote: { fontSize: 14, marginTop: 8, textAlign: 'center' },

  viewDetailsBtn: { marginTop: 4, paddingVertical: 6, paddingHorizontal: 10 },
  viewDetailsBtnText: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },

  routeCard: {
    width: '100%', borderRadius: 16, borderWidth: 1,
    padding: 14, gap: 8, marginTop: 16,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeDot: { width: 9, height: 9, borderRadius: 4.5, flexShrink: 0 },
  routeLine: { width: 2, height: 14, marginLeft: 3.5 },
  routeText: { flex: 1, fontSize: 13, fontWeight: '500' },

  ratingCard: { padding: 16, marginTop: 24, width: '100%', borderRadius: 16, borderWidth: 1 },
  ratingCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ratingAvatar: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  ratingAvatarText: { fontSize: 11, fontWeight: '700' },
  ratingCardLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase',
    flexShrink: 1, flex: 1,
  },
  driverRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  driverRatingText: { fontSize: 12, fontWeight: '600' },
  starsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },

  commentInput: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, marginTop: 12, minHeight: 60, textAlignVertical: 'top',
  },

  ratingActionsRow: { flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' },
  skipBtn: {
    flex: 1, height: 56, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  skipBtnText: { fontSize: 16, fontWeight: '600' },
  doneBtn: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  doneBtnGrad: { height: 56, alignItems: 'center', justifyContent: 'center' },
  doneBtnText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
});
