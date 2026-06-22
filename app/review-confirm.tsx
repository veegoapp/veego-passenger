import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator, TextInput,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft, ArrowLeft, MapPin, Clock, Users, Ticket,
  Tag, X, Check, AlertCircle, CalendarDays,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { useBooking } from '@/context/BookingContext';
import { usePromos } from '@/src/hooks/shared/usePromos';
import { S, makeGlassStyle } from '@/constants/colors';

/* ─────────────────────────────────────────────────────────── */
/*  Helpers                                                     */
/* ─────────────────────────────────────────────────────────── */

type Params = {
  routeId: string;
  routeName: string;
  routeCode: string;
  tripId: string;
  date: string;
  time: string;
  boardingStation: string;
  dropOffStation: string;
  price: string;
  seatCount: string;
};

/** Parse "20%" or "15 EGP" into a numeric EGP deduction */
function parseDiscountAmount(discountStr: string, base: number): number {
  if (!discountStr) return 0;
  const s = discountStr.trim();
  if (s.endsWith('%')) {
    const pct = parseFloat(s);
    return isNaN(pct) ? 0 : Math.round(base * pct / 100);
  }
  const egp = parseFloat(s);
  return isNaN(egp) ? 0 : Math.min(egp, base);
}

/* ─────────────────────────────────────────────────────────── */
/*  Component                                                   */
/* ─────────────────────────────────────────────────────────── */

export default function ReviewConfirmScreen() {
  const insets     = useSafeAreaInsets();
  const { colors: c, t, isRTL } = useTheme();
  const gs         = useMemo(() => makeGlassStyle(c), [c]);
  const { handleConfirm, bookingError, clearBookingError } = useBooking();
  const { validateCode } = usePromos();

  const [confirming, setConfirming]   = useState(false);
  const [promoInput, setPromoInput]   = useState('');
  const [promoStatus, setPromoStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');
  const [promoDiscount, setPromoDiscount] = useState('');
  const [promoError, setPromoError]   = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [inputFocused, setInputFocused] = useState(false);

  /* Params */
  const params = useLocalSearchParams<Params>();
  const {
    routeName = '', routeCode = '', date = '', time = '',
    boardingStation = '', dropOffStation = '',
    price = '0', seatCount = '1',
  } = params;

  const baseTotal   = Number(price) || 0;
  const seats       = Number(seatCount) || 1;
  const perSeat     = seats > 0 ? Math.round(baseTotal / seats) : baseTotal;
  const discountAmt = useMemo(() => parseDiscountAmount(promoDiscount, baseTotal), [promoDiscount, baseTotal]);
  const finalTotal  = Math.max(0, baseTotal - discountAmt);
  const hasDiscount = promoStatus === 'valid' && discountAmt > 0;

  /* Promo handlers */
  const handleApplyPromo = useCallback(async () => {
    const code = promoInput.trim();
    if (!code || promoStatus === 'loading' || promoStatus === 'valid') return;
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setPromoStatus('loading');
    setPromoError('');

    const result = await validateCode(code, baseTotal);
    if (result.valid) {
      setPromoStatus('valid');
      setPromoDiscount(result.discount ?? '');
      setAppliedCode(code);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setPromoStatus('invalid');
      setPromoError(result.message ?? t('promo_invalid'));
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [promoInput, promoStatus, baseTotal, validateCode, t]);

  const clearPromo = useCallback(() => {
    setPromoInput(''); setPromoStatus('idle');
    setPromoDiscount(''); setPromoError(''); setAppliedCode('');
  }, []);

  const onConfirm = useCallback(async () => {
    if (confirming) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearBookingError();
    setConfirming(true);
    await handleConfirm(appliedCode || undefined);
    setConfirming(false);
  }, [confirming, appliedCode, handleConfirm, clearBookingError]);

  const isApplyDisabled = promoInput.trim().length === 0
    || promoStatus === 'loading'
    || promoStatus === 'valid';

  /* ── Styles ─────────────────────────────────────────────── */
  const styles = useMemo(() => StyleSheet.create({

    root:   { flex: 1, backgroundColor: c.isDark ? c.background : '#f2f2f7' },

    /* Header */
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingTop: insets.top + 10, paddingBottom: 12, paddingHorizontal: 16,
      backgroundColor: c.isDark ? c.background : '#f2f2f7',
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 13,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.white,
      borderWidth: 1, borderColor: c.border,
      ...S.luxe,
    },
    headerTitle: {
      flex: 1, fontSize: 18, fontWeight: '700', color: c.ink,
      letterSpacing: -0.5,
    },

    scroll:        { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 140 },

    /* ── Hero card (dark) ── */
    heroCard: {
      borderRadius: 26, overflow: 'hidden',
      marginBottom: 20, ...S.float,
    },
    heroGrad:  { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 22 },
    heroGlow:  {
      position: 'absolute', top: -50, right: -50,
      width: 200, height: 200, borderRadius: 100,
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    heroGlow2: {
      position: 'absolute', bottom: -40, left: -40,
      width: 150, height: 150, borderRadius: 75,
      backgroundColor: 'rgba(85,196,154,0.07)',
    },
    heroTopRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    heroCodePill: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    },
    heroCodeDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: c.accentMint },
    heroCodeText: { color: '#ffffff', fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
    heroRouteName: {
      color: '#ffffff', fontSize: 22, fontWeight: '800',
      letterSpacing: -0.6, marginBottom: 16,
    },
    heroTimeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
    heroTime:    { color: '#ffffff', fontSize: 38, fontWeight: '800', letterSpacing: -1.5 },
    heroDate:    {
      color: 'rgba(255,255,255,0.55)', fontSize: 14,
      fontWeight: '500', marginBottom: 6,
    },

    /* ── Section label ── */
    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: c.inkSoft,
      textTransform: 'uppercase' as any, letterSpacing: 1.4,
      marginBottom: 10, marginTop: 2, paddingHorizontal: 2,
    },

    /* ── Trip card (glass) ── */
    tripCard: {
      ...gs,
      borderRadius: 22,
      marginBottom: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
    },

    /* Vertical timeline inside trip card */
    timelineWrap:  { flexDirection: 'row', gap: 16, padding: 18, paddingBottom: 12 },
    timelineLeft:  { alignItems: 'center', width: 18, paddingTop: 3 },
    tlDotTop: {
      width: 14, height: 14, borderRadius: 7,
      backgroundColor: c.ink,
      borderWidth: 2.5, borderColor: c.isDark ? 'rgba(255,255,255,0.2)' : '#1e1e28',
    },
    tlLine:   { width: 2, flex: 1, backgroundColor: c.border, marginVertical: 4, minHeight: 28, borderRadius: 1 },
    tlDotBottom: {
      width: 14, height: 14, borderRadius: 7,
      backgroundColor: c.accentMint,
      borderWidth: 2.5, borderColor: c.isDark ? 'rgba(85,196,154,0.35)' : 'rgba(85,196,154,0.4)',
    },
    timelineRight: { flex: 1, justifyContent: 'space-between' },

    stationBlock: { gap: 3 },
    stationBadge: {
      alignSelf: 'flex-start',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : c.mist,
      borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
      marginBottom: 4,
    },
    stationBadgeText: { fontSize: 9, fontWeight: '700', color: c.inkSoft, letterSpacing: 0.8, textTransform: 'uppercase' as any },
    stationName: { fontSize: 14.5, fontWeight: '700', color: c.ink, letterSpacing: -0.3 },

    /* Info chips row */
    infoDivider: { height: 1, backgroundColor: c.isDark ? 'rgba(255,255,255,0.07)' : '#ebebf0', marginHorizontal: 18 },
    infoChipsRow: {
      flexDirection: 'row', paddingHorizontal: 18, paddingVertical: 14, gap: 0,
    },
    infoChip: { flex: 1, alignItems: 'center', gap: 4 },
    infoChipDivider: { width: 1, backgroundColor: c.border, marginHorizontal: 4 },
    infoChipIconBox: {
      width: 30, height: 30, borderRadius: 9,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.mist,
      alignItems: 'center', justifyContent: 'center',
    },
    infoChipLabel: { fontSize: 9.5, color: c.inkSoft, letterSpacing: 0.3 },
    infoChipValue: { fontSize: 12.5, fontWeight: '700', color: c.ink, letterSpacing: -0.2 },

    /* ── Promo card ── */
    promoCard: {
      ...gs,
      borderRadius: 22,
      marginBottom: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: c.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
    },
    promoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    promoIconBox: {
      width: 42, height: 42, borderRadius: 13,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : c.white,
      borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    promoInput: {
      flex: 1, height: 42, borderRadius: 13,
      borderWidth: 1.5, borderColor: c.border,
      paddingHorizontal: 12, fontSize: 13.5, fontWeight: '600',
      color: c.ink, letterSpacing: 0.6,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : c.white,
    },
    promoInputActive: { borderColor: c.ink },
    promoApplyBtn: {
      height: 42, paddingHorizontal: 16, borderRadius: 13,
      backgroundColor: c.ink,
      alignItems: 'center', justifyContent: 'center',
      ...S.luxe,
    },
    promoApplyBtnDisabled: { backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : c.mist },
    promoApplyText:         { fontSize: 13, fontWeight: '700', color: c.isDark ? c.background : '#ffffff' },
    promoApplyTextDisabled: { color: c.inkSoft },

    promoSuccessRow: {
      flexDirection: 'row', alignItems: 'center',
      marginTop: 12,
      backgroundColor: 'rgba(85,196,154,0.1)',
      borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
      borderWidth: 1, borderColor: 'rgba(85,196,154,0.2)',
    },
    promoSuccessText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#22a06b', marginStart: 6 },
    promoErrorText:   { fontSize: 12.5, color: '#e0584a', marginTop: 10, paddingHorizontal: 2 },

    /* ── Fare card ── */
    fareCard: {
      ...gs,
      borderRadius: 22,
      marginBottom: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
    },
    fareRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 18, paddingVertical: 13,
    },
    fareRowLabel:  { fontSize: 11, fontWeight: '600', color: c.inkSoft, textTransform: 'uppercase' as any, letterSpacing: 0.8 },
    fareRowValue:  { fontSize: 14, fontWeight: '600', color: c.ink },
    fareDivider:   { height: 1, backgroundColor: c.isDark ? 'rgba(255,255,255,0.07)' : '#ebebf0', marginHorizontal: 18 },
    fareTotalRow:  {
      flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
      paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18,
    },
    fareTotalLabel: { fontSize: 13, fontWeight: '700', color: c.ink, letterSpacing: 0.2 },
    fareTotalRight: { alignItems: 'flex-end', gap: 2 },
    fareOriginal:   { fontSize: 13, color: c.inkSoft, textDecorationLine: 'line-through' as any },
    fareDiscounted: { fontSize: 28, fontWeight: '800', color: '#22a06b', letterSpacing: -1 },
    fareNormal:     { fontSize: 28, fontWeight: '800', color: c.ink, letterSpacing: -1 },
    savingsPill: {
      flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
      backgroundColor: 'rgba(85,196,154,0.12)', borderRadius: 99,
      paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-end',
    },
    savingsDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: c.accentMint },
    savingsText: { fontSize: 11, fontWeight: '700', color: '#22a06b', letterSpacing: 0.1 },

    /* ── Error banner ── */
    errorBanner: {
      backgroundColor: c.isDark ? 'rgba(220,38,38,0.10)' : '#fff2f2',
      borderRadius: 16, padding: 14, marginBottom: 16,
      flexDirection: 'row', gap: 10, alignItems: 'flex-start',
      borderWidth: 1, borderColor: c.isDark ? 'rgba(220,38,38,0.28)' : '#fecaca',
    },
    errorText: { flex: 1, fontSize: 13, color: c.isDark ? '#f87171' : '#b91c1c', lineHeight: 18 },

    /* ── CTA ── */
    cta: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingHorizontal: 16, paddingTop: 14, paddingBottom: insets.bottom + 16,
      backgroundColor: c.isDark ? c.background : '#f2f2f7',
      borderTopWidth: 1, borderTopColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    },
    ctaBtn: {
      height: 60, borderRadius: 26, backgroundColor: c.ink,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      ...S.float,
    },
    ctaBtnDisabled: { opacity: 0.45 },
    ctaBtnText: { color: c.isDark ? c.background : '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
    ctaSub: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
    ctaSubText: { fontSize: 12.5, color: c.inkSoft },
    ctaSubDivider: { width: 3, height: 3, borderRadius: 2, backgroundColor: c.silver },
    ctaSubFinal:   { fontSize: 12.5, fontWeight: '700', color: hasDiscount ? '#22a06b' : c.inkSoft },

  }), [c, gs, insets, hasDiscount]);

  return (
    <View style={styles.root}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.75}>
          {isRTL
            ? <ArrowLeft size={18} color={c.ink} />
            : <ChevronLeft size={18} color={c.ink} strokeWidth={2.5} />}
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('review_confirm_title')}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Hero card ─────────────────────────────────────────── */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={[c.ink, c.isDark ? '#1c1c36' : '#14142a']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.heroGrad}
          >
            <View style={styles.heroGlow} />
            <View style={styles.heroGlow2} />

            <View style={styles.heroTopRow}>
              <View style={styles.heroCodePill}>
                <View style={styles.heroCodeDot} />
                <Text style={styles.heroCodeText}>{t('line')} {routeCode}</Text>
              </View>
            </View>

            <Text style={styles.heroRouteName} numberOfLines={2}>{routeName}</Text>

            <View style={styles.heroTimeRow}>
              <Text style={styles.heroTime}>{time || '—'}</Text>
              <Text style={styles.heroDate}>{date || '—'}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* ── Trip details ──────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>{t('selected_trip')}</Text>
        <View style={styles.tripCard}>

          {/* Vertical timeline */}
          <View style={styles.timelineWrap}>
            <View style={styles.timelineLeft}>
              <View style={styles.tlDotTop} />
              <View style={styles.tlLine} />
              <View style={styles.tlDotBottom} />
            </View>
            <View style={styles.timelineRight}>
              {/* Boarding */}
              <View style={styles.stationBlock}>
                <View style={styles.stationBadge}>
                  <Text style={styles.stationBadgeText}>{t('boarding')}</Text>
                </View>
                <Text style={styles.stationName} numberOfLines={2}>
                  {boardingStation || '—'}
                </Text>
              </View>

              <View style={{ height: 18 }} />

              {/* Drop-off */}
              <View style={styles.stationBlock}>
                <View style={styles.stationBadge}>
                  <Text style={styles.stationBadgeText}>{t('drop_off')}</Text>
                </View>
                <Text style={styles.stationName} numberOfLines={2}>
                  {dropOffStation || '—'}
                </Text>
              </View>
            </View>
          </View>

          {/* Info chips */}
          <View style={styles.infoDivider} />
          <View style={styles.infoChipsRow}>
            <View style={styles.infoChip}>
              <View style={styles.infoChipIconBox}>
                <CalendarDays size={14} color={c.ink} strokeWidth={2} />
              </View>
              <Text style={styles.infoChipLabel}>{t('date')}</Text>
              <Text style={styles.infoChipValue} numberOfLines={1}>{date || '—'}</Text>
            </View>
            <View style={styles.infoChipDivider} />
            <View style={styles.infoChip}>
              <View style={styles.infoChipIconBox}>
                <Clock size={14} color={c.ink} strokeWidth={2} />
              </View>
              <Text style={styles.infoChipLabel}>{t('time_label')}</Text>
              <Text style={styles.infoChipValue}>{time || '—'}</Text>
            </View>
            <View style={styles.infoChipDivider} />
            <View style={styles.infoChip}>
              <View style={styles.infoChipIconBox}>
                <Users size={14} color={c.ink} strokeWidth={2} />
              </View>
              <Text style={styles.infoChipLabel}>{t('passengers')}</Text>
              <Text style={styles.infoChipValue}>{seats}</Text>
            </View>
          </View>
        </View>

        {/* ── Promo code ────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>{t('promo_code')}</Text>
        <View style={styles.promoCard}>
          <View style={styles.promoRow}>
            <View style={styles.promoIconBox}>
              <Tag size={17} color={promoStatus === 'valid' ? '#22a06b' : c.inkSoft} strokeWidth={2} />
            </View>
            <TextInput
              style={[styles.promoInput, inputFocused && styles.promoInputActive]}
              placeholder={t('enter_promo')}
              placeholderTextColor={c.silver}
              value={promoInput}
              onChangeText={(v) => {
                setPromoInput(v);
                if (promoStatus === 'invalid') setPromoStatus('idle');
              }}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={promoStatus !== 'valid' && promoStatus !== 'loading'}
              returnKeyType="done"
              onSubmitEditing={handleApplyPromo}
            />
            <TouchableOpacity
              style={[styles.promoApplyBtn, isApplyDisabled && styles.promoApplyBtnDisabled]}
              onPress={handleApplyPromo}
              disabled={isApplyDisabled}
              activeOpacity={0.82}
            >
              {promoStatus === 'loading'
                ? <ActivityIndicator size="small" color={c.isDark ? c.background : '#ffffff'} />
                : <Text style={[styles.promoApplyText, isApplyDisabled && styles.promoApplyTextDisabled]}>
                    {t('apply')}
                  </Text>}
            </TouchableOpacity>
          </View>

          {promoStatus === 'valid' && (
            <View style={styles.promoSuccessRow}>
              <Check size={15} color="#22a06b" strokeWidth={2.5} />
              <Text style={styles.promoSuccessText}>{t('promo_applied')} · -{promoDiscount}</Text>
              <TouchableOpacity onPress={clearPromo} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={15} color="#22a06b" />
              </TouchableOpacity>
            </View>
          )}
          {promoStatus === 'invalid' && (
            <Text style={styles.promoErrorText}>{promoError}</Text>
          )}
        </View>

        {/* ── Fare summary ──────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>{t('total_fare')}</Text>
        <View style={styles.fareCard}>
          {/* Base fare row */}
          <View style={styles.fareRow}>
            <Text style={styles.fareRowLabel}>{t('base_fare')}</Text>
            <Text style={styles.fareRowValue}>
              {perSeat} {t('egp')} × {seats}
            </Text>
          </View>

          <View style={styles.fareDivider} />

          {/* Total row */}
          <View style={styles.fareTotalRow}>
            <Text style={styles.fareTotalLabel}>{t('total')}</Text>
            <View style={styles.fareTotalRight}>
              {hasDiscount ? (
                <>
                  <Text style={styles.fareOriginal}>{baseTotal} {t('egp')}</Text>
                  <Text style={styles.fareDiscounted}>{finalTotal} {t('egp')}</Text>
                  <View style={styles.savingsPill}>
                    <View style={styles.savingsDot} />
                    <Text style={styles.savingsText}>
                      {t('you_save')} {discountAmt} {t('egp')}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={styles.fareNormal}>{baseTotal} {t('egp')}</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Booking error ─────────────────────────────────────── */}
        {!!bookingError && (
          <View style={styles.errorBanner}>
            <AlertCircle size={15} color="#b91c1c" style={{ marginTop: 1 }} />
            <Text style={styles.errorText}>{bookingError}</Text>
          </View>
        )}

      </ScrollView>

      {/* ── Sticky CTA ────────────────────────────────────────── */}
      <View style={styles.cta}>
        <TouchableOpacity
          style={[styles.ctaBtn, confirming && styles.ctaBtnDisabled]}
          disabled={confirming}
          activeOpacity={0.88}
          onPress={onConfirm}
        >
          {confirming
            ? <ActivityIndicator size="small" color={c.isDark ? c.background : '#ffffff'} />
            : <>
                <Check size={18} color={c.isDark ? c.background : '#ffffff'} strokeWidth={3} />
                <Text style={styles.ctaBtnText}>{t('confirm_book')}</Text>
              </>}
        </TouchableOpacity>

        <View style={styles.ctaSub}>
          {hasDiscount ? (
            <>
              <Text style={styles.ctaSubFinal}>{finalTotal} {t('egp')}</Text>
              <View style={styles.ctaSubDivider} />
              <Text style={[styles.ctaSubText, { textDecorationLine: 'line-through' }]}>{baseTotal} {t('egp')}</Text>
            </>
          ) : (
            <>
              <Text style={styles.ctaSubFinal}>{baseTotal} {t('egp')}</Text>
              <View style={styles.ctaSubDivider} />
              <Text style={styles.ctaSubText}>{seats} {t('seat_count')}</Text>
            </>
          )}
        </View>
      </View>

    </View>
  );
}
