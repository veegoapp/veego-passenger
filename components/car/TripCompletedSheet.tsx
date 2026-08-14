import { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Banknote, Star } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { Animation } from '@/constants/animations';
import { Stars } from '@/components/ui/Stars';
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
  /** Called once, with stars === 0 if the passenger tapped Done without rating. */
  onDone: (stars: number, comment: string) => void;
}

/**
 * Lovable's `CompletedSheet` behavior: fare + payment method and the inline
 * 5-star rating live in a single sheet instead of a separate post-trip screen.
 */
export function TripCompletedSheet({
  visible, fare, grossFare, promoDiscount, walletDeduction, paymentMethodLabel,
  driverName, driverRating, pickup, dropoff, onDone,
}: TripCompletedSheetProps) {
  const { colors: c, t } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [detailsVisible, setDetailsVisible] = useState(false);
  const submittingRef = useRef(false);

  const driverInitials = (driverName ?? '')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'DR';

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      ...Animation.spring.sheet,
      mass: 0.85,
    }).start();
    if (!visible) {
      setStars(0);
      setComment('');
      submittingRef.current = false;
    }
  }, [visible]);

  const handleDone = useCallback(() => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Keyboard.dismiss();
    onDone(stars, comment);
  }, [stars, comment, onDone]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });

  return (
    <Animated.View
      style={[styles.sheet, { opacity: slideAnim, transform: [{ translateY }] }]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View style={[styles.sheetSurface, { backgroundColor: c.white, paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.handle, { backgroundColor: c.border }]} />

        <View style={styles.inner}>
          <Text style={[styles.completedLabel, { color: c.inkSoft }]}>{t('trip_complete')}</Text>

          {!!(pickup || dropoff) && (
            <View style={[styles.routeCard, { borderColor: c.border }]}>
              {!!pickup && (
                <View style={styles.routeRow}>
                  <View style={[styles.routeDot, { backgroundColor: c.ink }]} />
                  <Text style={[styles.routeText, { color: c.ink }]} numberOfLines={2}>{pickup}</Text>
                </View>
              )}
              {!!pickup && !!dropoff && <View style={[styles.routeLine, { backgroundColor: c.border }]} />}
              {!!dropoff && (
                <View style={styles.routeRow}>
                  <View style={[styles.routeDot, { backgroundColor: c.accent }]} />
                  <Text style={[styles.routeText, { color: c.ink }]} numberOfLines={2}>{dropoff}</Text>
                </View>
              )}
            </View>
          )}

          {!!driverName && (
            <View style={[styles.driverCard, { borderColor: c.border }]}>
              <View style={styles.driverAvatar}>
                <Text style={styles.driverInitials}>{driverInitials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.driverName, { color: c.ink }]} numberOfLines={1}>{driverName}</Text>
                {driverRating != null && driverRating > 0 && (
                  <View style={styles.driverRatingRow}>
                    <Star size={11} color="#f5a623" fill="#f5a623" />
                    <Text style={[styles.driverRatingText, { color: c.inkSoft }]}>{driverRating.toFixed(1)}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {fare != null && (
            <Text style={[styles.fareAmount, { color: c.ink }]}>
              {fare.toFixed(2)} <Text style={[styles.fareCurrency, { color: c.inkSoft }]}>{t('egp')}</Text>
            </Text>
          )}

          {fare != null && (
            <TouchableOpacity onPress={() => setDetailsVisible(true)} activeOpacity={0.7} style={styles.viewDetailsBtn}>
              <Text style={[styles.viewDetailsBtnText, { color: c.primary }]}>{t('view_details')}</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.paymentChip, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}>
            <Text style={[styles.paymentChipText, { color: c.ink }]}>{paymentMethodLabel}</Text>
          </View>

          {/* Cash payment instruction — fare is netCashPayable, so this only
              shows when there is genuinely cash left to hand over (0 for
              wallet-paid rides). */}
          {fare != null && fare > 0 && (
            <View style={[styles.cashBanner, { backgroundColor: 'rgba(85,196,154,0.12)', borderColor: c.accent }]}>
              <Banknote size={18} color={c.accent} />
              <Text style={[styles.cashBannerText, { color: c.ink }]}>
                {t('pay_driver_cash').replace('{amount}', fare.toFixed(2))}
              </Text>
            </View>
          )}

          <View style={[styles.ratingSection, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}>
            <Text style={[styles.ratingPrompt, { color: c.ink }]}>
              {driverName ? `${t('rate_your_ride')} ${driverName}?` : t('rate_your_ride')}
            </Text>
            <Stars value={stars} size={32} gap={10} onRate={setStars} />
            <TextInput
              style={[styles.commentInput, { borderColor: c.border, backgroundColor: c.white, color: c.ink }]}
              placeholder={t('leave_comment')}
              placeholderTextColor={c.inkSoft}
              multiline
              maxLength={200}
              value={comment}
              onChangeText={setComment}
              numberOfLines={2}
            />
          </View>

          <TouchableOpacity
            onPress={handleDone}
            activeOpacity={0.88}
            style={[styles.primaryBtn, { backgroundColor: c.primary }]}
          >
            <Text style={styles.primaryBtnText}>{t('done')}</Text>
          </TouchableOpacity>
        </View>
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
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 28,
    zIndex: 1000,
  },
  sheetSurface: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
  },
  handle: {
    width: 40, height: 5, borderRadius: 3,
    alignSelf: 'center', marginBottom: 24,
  },

  inner: {
    paddingHorizontal: 20, alignItems: 'center', gap: 14,
  },
  completedLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  fareAmount: {
    fontSize: 32, fontWeight: '800', letterSpacing: -1, marginTop: 2,
  },
  fareCurrency: { fontSize: 15, fontWeight: '600' },

  viewDetailsBtn: { paddingVertical: 4, paddingHorizontal: 8, marginTop: -4 },
  viewDetailsBtnText: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },

  routeCard: {
    width: '100%', borderRadius: 16, borderWidth: 1,
    padding: 14, gap: 8,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeDot: { width: 9, height: 9, borderRadius: 4.5, flexShrink: 0 },
  routeLine: { width: 2, height: 14, marginLeft: 3.5 },
  routeText: { flex: 1, fontSize: 13, fontWeight: '500' },

  driverCard: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 12,
  },
  driverAvatar: {
    width: 40, height: 40, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#3A7BD5',
  },
  driverInitials: { color: '#fff', fontSize: 15, fontWeight: '700' },
  driverName: { fontSize: 14.5, fontWeight: '600' },
  driverRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  driverRatingText: { fontSize: 12 },

  cashBanner: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1.5, padding: 12,
  },
  cashBannerText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },

  paymentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 99, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  paymentChipText: { fontSize: 13, fontWeight: '500' },

  ratingSection: {
    width: '100%', borderRadius: 16, borderWidth: 1,
    padding: 16, alignItems: 'center', gap: 12, marginTop: 4,
  },
  ratingPrompt: { fontSize: 15, fontWeight: '600' },

  commentInput: {
    width: '100%', borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, lineHeight: 20, minHeight: 68,
    textAlignVertical: 'top',
  },

  primaryBtn: {
    width: '100%', height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 6,
  },
  primaryBtnText: { fontSize: 15.5, fontWeight: '600', color: '#ffffff', letterSpacing: -0.15 },
});
