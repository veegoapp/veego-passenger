import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated,  TextInput } from 'react-native';
import { Calendar, Clock, Users, Check, Tag, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors, S } from '@/constants/colors';
import { useBooking } from '@/context/BookingContext';
import { usePromos } from '@/src/hooks/shared/usePromos';

function makeStyles(c: ThemeColors, gs: object) {
  const cardBg = c.isDark ? 'rgba(30,32,54,0.9)' : 'rgba(255,255,255,0.8)';
  return StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, ...gs, borderTopLeftRadius: 32, borderTopRightRadius: 32, ...S.float, backgroundColor: c.white },
    handle: { width: 48, height: 6, borderRadius: 3, backgroundColor: c.isDark ? 'rgba(120,120,160,0.4)' : 'rgba(195,195,204,0.7)', alignSelf: 'center', marginTop: 12 },
    content: { padding: 24, gap: 12 },
    reviewHeader: { alignItems: 'center', marginBottom: 4 },
    reviewLabel: { fontSize: 10, fontWeight: '600', color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 1.4 },
    reviewRoute: { fontSize: 20, fontWeight: '600', color: c.ink, letterSpacing: -0.4, marginTop: 4 },
    reviewCode: { fontSize: 11.5, color: c.inkSoft, marginTop: 2 },
    infoCard: { backgroundColor: cardBg, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center' },
    infoHalf: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    infoDivider: { width: 1, height: 40, backgroundColor: c.border, marginHorizontal: 4 },
    infoIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' },
    infoLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: c.inkSoft },
    infoValue: { fontSize: 13, fontWeight: '600', color: c.ink, marginTop: 1 },
    routeCard: { backgroundColor: cardBg, borderRadius: 20, padding: 16, flexDirection: 'row', gap: 16 },
    routeTimeline: { alignItems: 'center', paddingTop: 4 },
    rtDotTop: { width: 12, height: 12, borderRadius: 6, backgroundColor: c.ink },
    rtLine: { width: 2, flex: 1, backgroundColor: c.silver, marginVertical: 4, minHeight: 20 },
    rtDotBottom: { width: 12, height: 12, borderRadius: 6, backgroundColor: c.ink },
    routeStation: { fontSize: 13.5, fontWeight: '600', color: c.ink, marginTop: 2 },
    routeArea: { fontSize: 11, color: c.inkSoft, marginTop: 1 },
    paxCard: { backgroundColor: cardBg, borderRadius: 20, padding: 16, gap: 12 },
    paxRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    thinDivider: { height: 1, backgroundColor: c.border, opacity: 0.6 },
    totalRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    totalLabel: { fontSize: 12, color: c.inkSoft },
    totalValue: { fontSize: 24, fontWeight: '600', color: c.ink, letterSpacing: -0.5 },
    totalValueStruck: { fontSize: 18, fontWeight: '400', color: c.inkSoft, textDecorationLine: 'line-through', marginBottom: 2 },
    totalValueDiscounted: { fontSize: 24, fontWeight: '700', color: '#22a06b', letterSpacing: -0.5 },
    promoSection: { backgroundColor: cardBg, borderRadius: 20, padding: 16, gap: 10 },
    promoInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    promoInput: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, fontSize: 14, color: c.ink, backgroundColor: c.isDark ? 'rgba(255,255,255,0.05)' : '#fafafa' },
    promoApplyBtn: { height: 44, paddingHorizontal: 18, borderRadius: 12, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
    promoApplyBtnDisabled: { opacity: 0.4 },
    promoApplyText: { fontSize: 13, fontWeight: '700', color: c.isDark ? c.background : c.white },
    promoSuccess: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(34,160,107,0.12)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
    promoSuccessText: { fontSize: 13, fontWeight: '600', color: '#22a06b', flex: 1 },
    promoError: { fontSize: 12.5, color: '#e0584a', paddingHorizontal: 2 },
    confirmBtn: { height: 56, borderRadius: 20, backgroundColor: c.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...S.float, marginTop: 4 },
    confirmBtnText: { color: c.isDark ? c.background : c.white, fontSize: 15, fontWeight: '600' },
    editBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
    editBtnText: { fontSize: 13, color: c.inkSoft, fontWeight: '500' },
  });
}

export function ConfirmSheet() {
  const { confirmSheetOpen, closeConfirmSheet, pendingBooking, handleConfirm } = useBooking();
  const { colors: c, glassStyle: gs, t } = useTheme();
  const styles = useMemo(() => makeStyles(c, gs), [c]);
  const { validateCode } = usePromos();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  const [promoInput, setPromoInput] = useState('');
  const [promoStatus, setPromoStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');
  const [promoDiscount, setPromoDiscount] = useState('');
  const [promoError, setPromoError] = useState('');
  const [appliedCode, setAppliedCode] = useState('');

  useEffect(() => {
    if (confirmSheetOpen) {
      setPromoInput('');
      setPromoStatus('idle');
      setPromoDiscount('');
      setPromoError('');
      setAppliedCode('');
      setVisible(true);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setVisible(false));
    }
  }, [confirmSheetOpen]);

  const handleApplyPromo = useCallback(async () => {
    const code = promoInput.trim();
    if (!code || !pendingBooking) return;
    setPromoStatus('loading');
    setPromoError('');
    const result = await validateCode(code, pendingBooking.price);
    if (result.valid) {
      setPromoStatus('valid');
      setPromoDiscount(result.discount ?? '');
      setAppliedCode(code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setPromoStatus('invalid');
      setPromoError(result.message ?? 'Invalid promo code');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [promoInput, pendingBooking, validateCode]);

  const clearPromo = useCallback(() => {
    setPromoInput('');
    setPromoStatus('idle');
    setPromoDiscount('');
    setPromoError('');
    setAppliedCode('');
  }, []);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [700, 0] });
  if (!visible || !pendingBooking) return null;
  const booking = pendingBooking;

  const isApplyDisabled = promoInput.trim().length === 0 || promoStatus === 'loading' || promoStatus === 'valid';

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 9998, pointerEvents: 'box-none' as any }]}>
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closeConfirmSheet} activeOpacity={1} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.handle} />
        <View style={styles.content}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewLabel}>{t('review_confirm')}</Text>
              <Text style={styles.reviewRoute}>{booking.route.name}</Text>
              <Text style={styles.reviewCode}>Line {booking.route.code}</Text>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoHalf}>
                <View style={styles.infoIcon}><Calendar size={16} color={c.ink} /></View>
                <View>
                  <Text style={styles.infoLabel}>{t('date')}</Text>
                  <Text style={styles.infoValue}>{booking.date}</Text>
                </View>
              </View>
              <View style={styles.infoDivider} />
              <View style={[styles.infoHalf, { paddingLeft: 12 }]}>
                <View style={styles.infoIcon}><Clock size={16} color={c.ink} /></View>
                <View>
                  <Text style={styles.infoLabel}>{t('time_label')}</Text>
                  <Text style={styles.infoValue}>{booking.time}</Text>
                </View>
              </View>
            </View>

            <View style={styles.routeCard}>
              <View style={styles.routeTimeline}>
                <View style={styles.rtDotTop} />
                <View style={styles.rtLine} />
                <View style={styles.rtDotBottom} />
              </View>
              <View style={{ flex: 1, gap: 12 }}>
                <View>
                  <Text style={styles.infoLabel}>{t('from')}</Text>
                  <Text style={styles.routeStation}>{booking.route.path[booking.fromIdx].name}</Text>
                  <Text style={styles.routeArea}>{booking.route.path[booking.fromIdx].area}</Text>
                </View>
                <View style={styles.thinDivider} />
                <View>
                  <Text style={styles.infoLabel}>{t('to')}</Text>
                  <Text style={styles.routeStation}>{booking.route.path[booking.toIdx].name}</Text>
                  <Text style={styles.routeArea}>{booking.route.path[booking.toIdx].area}</Text>
                </View>
              </View>
            </View>

            <View style={styles.paxCard}>
              <View style={styles.paxRow}>
                <View style={styles.infoIcon}><Users size={16} color={c.ink} /></View>
                <View>
                  <Text style={styles.infoLabel}>{t('passengers')}</Text>
                  <Text style={styles.infoValue}>{booking.passengers}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={styles.infoLabel}>{t('base_fare')}</Text>
                  <Text style={styles.infoValue}>{Math.round(booking.price / booking.passengers)} {t('egp')} × {booking.passengers}</Text>
                </View>
              </View>
              <View style={styles.thinDivider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('total')}</Text>
                {promoStatus === 'valid' ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.totalValueStruck}>{booking.price} {t('egp')}</Text>
                    <Text style={styles.totalValueDiscounted}>-{promoDiscount}</Text>
                  </View>
                ) : (
                  <Text style={styles.totalValue}>{booking.price} {t('egp')}</Text>
                )}
              </View>
            </View>

            <View style={styles.promoSection}>
              <View style={styles.promoInputRow}>
                <Tag size={16} color={c.inkSoft} />
                <TextInput
                  style={styles.promoInput}
                  placeholder={t('enter_promo')}
                  placeholderTextColor={c.inkSoft}
                  value={promoInput}
                  onChangeText={(v) => { setPromoInput(v); if (promoStatus === 'invalid') setPromoStatus('idle'); }}
                  autoCapitalize="characters"
                  editable={promoStatus !== 'valid' && promoStatus !== 'loading'}
                  returnKeyType="done"
                  onSubmitEditing={handleApplyPromo}
                />
                <TouchableOpacity
                  style={[styles.promoApplyBtn, isApplyDisabled && styles.promoApplyBtnDisabled]}
                  onPress={handleApplyPromo}
                  disabled={isApplyDisabled}
                  activeOpacity={0.8}
                >
                  <Text style={styles.promoApplyText}>
                    {promoStatus === 'loading' ? '...' : t('promo_apply')}
                  </Text>
                </TouchableOpacity>
              </View>
              {promoStatus === 'valid' && (
                <View style={styles.promoSuccess}>
                  <Text style={styles.promoSuccessText}>{t('discount_applied').replace('{amount}', promoDiscount)}</Text>
                  <TouchableOpacity onPress={clearPromo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <X size={16} color="#22a06b" />
                  </TouchableOpacity>
                </View>
              )}
              {promoStatus === 'invalid' && (
                <Text style={styles.promoError}>{promoError}</Text>
              )}
            </View>

            <TouchableOpacity style={styles.confirmBtn} activeOpacity={0.9} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); handleConfirm(appliedCode || undefined); }}>
              <Check size={16} color={c.isDark ? c.background : c.white} />
              <Text style={styles.confirmBtnText}>{t('confirm_booking')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={closeConfirmSheet} style={styles.editBtn} activeOpacity={0.7}>
              <Text style={styles.editBtnText}>{t('edit_details')}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
    </View>
  );
}
