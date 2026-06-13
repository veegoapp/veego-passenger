import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator, TextInput,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft, ArrowLeft, MapPin, Clock, Users, Ticket,
  Tag, X, Check, AlertCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { useBooking } from '@/context/BookingContext';
import { usePromos } from '@/src/hooks/usePromos';

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

/** Parse "20%" or "15 EGP" into a numeric EGP deduction from baseAmount */
function parseDiscountAmount(discountStr: string, baseAmount: number): number {
  if (!discountStr) return 0;
  const trimmed = discountStr.trim();
  if (trimmed.endsWith('%')) {
    const pct = parseFloat(trimmed);
    return isNaN(pct) ? 0 : Math.round(baseAmount * pct / 100);
  }
  const egp = parseFloat(trimmed);
  return isNaN(egp) ? 0 : Math.min(egp, baseAmount);
}

export default function ReviewConfirmScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, t, isRTL } = useTheme();
  const { handleConfirm, bookingError, clearBookingError } = useBooking();
  const { validateCode } = usePromos();

  const [confirming, setConfirming] = useState(false);

  /* ── Promo state ─────────────────────────────────────────── */
  const [promoInput, setPromoInput]   = useState('');
  const [promoStatus, setPromoStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');
  const [promoDiscount, setPromoDiscount] = useState('');   // human-readable, e.g. "20%"
  const [promoError, setPromoError]   = useState('');
  const [appliedCode, setAppliedCode] = useState('');

  /* ── Params ──────────────────────────────────────────────── */
  const params = useLocalSearchParams<Params>();
  const {
    routeName = '', routeCode = '', date = '', time = '',
    boardingStation = '', dropOffStation = '',
    price = '0', seatCount = '1',
  } = params;

  const baseTotal   = Number(price) || 0;
  const seats       = Number(seatCount) || 1;
  const discountAmt = useMemo(
    () => parseDiscountAmount(promoDiscount, baseTotal),
    [promoDiscount, baseTotal],
  );
  const finalTotal  = Math.max(0, baseTotal - discountAmt);
  const hasDiscount = promoStatus === 'valid' && discountAmt > 0;

  /* ── Promo handlers ─────────────────────────────────────── */
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
    setPromoInput('');
    setPromoStatus('idle');
    setPromoDiscount('');
    setPromoError('');
    setAppliedCode('');
  }, []);

  /* ── Confirm ─────────────────────────────────────────────── */
  const onConfirm = useCallback(async () => {
    if (confirming) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearBookingError();
    setConfirming(true);
    await handleConfirm(appliedCode || undefined);
    setConfirming(false);
  }, [confirming, appliedCode, handleConfirm, clearBookingError]);

  /* ── Styles ──────────────────────────────────────────────── */
  const styles = useMemo(() => StyleSheet.create({
    root:   { flex: 1, backgroundColor: c.isDark ? '#16162a' : '#f5f5fa' },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingTop: insets.top + 12, paddingBottom: 14, paddingHorizontal: 16,
      borderBottomWidth: 1, borderBottomColor: c.border,
      backgroundColor: c.isDark ? '#16162a' : '#f5f5fa',
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.mist,
    },
    headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: c.ink, letterSpacing: -0.4 },

    scroll:        { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 130 },

    /* Hero dark card */
    heroCard: {
      backgroundColor: c.ink, borderRadius: 24,
      paddingHorizontal: 20, paddingVertical: 18, marginBottom: 16,
    },
    heroCodeRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    heroCodeBox:  { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
    heroCodeText: { color: '#ffffff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    heroName:     { color: '#ffffff', fontSize: 20, fontWeight: '700', letterSpacing: -0.5, flex: 1 },
    heroTimeRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
    heroTime:     { color: '#ffffff', fontSize: 34, fontWeight: '800', letterSpacing: -1 },
    heroDate:     { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '500' },

    /* Section label */
    sectionLabel: {
      fontSize: 11, fontWeight: '600', color: c.inkSoft,
      textTransform: 'uppercase' as any, letterSpacing: 1.2,
      marginBottom: 10, marginTop: 4,
    },

    /* Detail card */
    detailCard: {
      backgroundColor: c.white, borderRadius: 20,
      borderWidth: 1, borderColor: c.border,
      overflow: 'hidden', marginBottom: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: c.isDark ? 0.18 : 0.05, shadowRadius: 8, elevation: 3,
    },
    detailRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
    detailDivider: { height: 1, backgroundColor: c.border, marginHorizontal: 16 },
    detailIconBox: {
      width: 34, height: 34, borderRadius: 10,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.mist,
      alignItems: 'center', justifyContent: 'center',
    },
    detailLabel: { fontSize: 11, color: c.inkSoft, marginBottom: 2 },
    detailValue: { fontSize: 14, fontWeight: '600', color: c.ink },

    /* Fare row */
    fareOriginal:   { fontSize: 14, fontWeight: '400', color: c.inkSoft, textDecorationLine: 'line-through' as any },
    fareDiscounted: { fontSize: 22, fontWeight: '800', color: '#22a06b', letterSpacing: -0.5, marginTop: 2 },
    fareNormal:     { fontSize: 22, fontWeight: '800', color: c.ink, letterSpacing: -0.5 },
    savingsBadge: {
      alignSelf: 'flex-start', marginTop: 4,
      backgroundColor: 'rgba(34,160,107,0.12)',
      borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    },
    savingsText: { fontSize: 11, fontWeight: '600', color: '#22a06b' },

    /* Promo card */
    promoCard: {
      backgroundColor: c.white, borderRadius: 20,
      borderWidth: 1, borderColor: c.border,
      marginBottom: 16, padding: 14,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: c.isDark ? 0.18 : 0.05, shadowRadius: 8, elevation: 3,
    },
    promoInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    promoIconBox:  { width: 34, height: 34, borderRadius: 10, backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.mist, alignItems: 'center', justifyContent: 'center' },
    promoInput: {
      flex: 1, height: 44, borderRadius: 12,
      borderWidth: 1.5, borderColor: c.border,
      paddingHorizontal: 12, fontSize: 14,
      color: c.ink,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : '#fafafa',
      letterSpacing: 0.5,
    },
    promoInputFocused: { borderColor: c.ink },
    promoApplyBtn: {
      height: 44, paddingHorizontal: 16, borderRadius: 12,
      backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center',
    },
    promoApplyBtnDisabled: { opacity: 0.38 },
    promoApplyText: { fontSize: 13, fontWeight: '700', color: c.isDark ? c.background : '#ffffff' },

    /* Promo feedback */
    promoSuccessRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 10, backgroundColor: 'rgba(34,160,107,0.1)',
      borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
    },
    promoSuccessText: { fontSize: 13, fontWeight: '600', color: '#22a06b', flex: 1 },
    promoErrorText:   { fontSize: 12.5, color: '#e0584a', marginTop: 8, paddingHorizontal: 2 },

    /* Error banner */
    errorBanner: {
      backgroundColor: '#fef2f2', borderRadius: 14, padding: 14,
      marginBottom: 16, flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    },
    errorText: { flex: 1, fontSize: 13, color: '#b91c1c', lineHeight: 18 },

    /* CTA bar */
    cta: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      padding: 16, paddingBottom: insets.bottom + 12,
      borderTopWidth: 1, borderTopColor: c.border,
      backgroundColor: c.isDark ? '#16162a' : '#f5f5fa',
    },
    ctaBtn: {
      height: 58, borderRadius: 22, backgroundColor: c.ink,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      shadowColor: c.ink, shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
    },
    ctaBtnDisabled: { opacity: 0.45 },
    ctaBtnText:     { color: c.isDark ? c.background : '#ffffff', fontSize: 15.5, fontWeight: '700', letterSpacing: -0.2 },
    ctaSubRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 },
    ctaSubText:     { fontSize: 12, color: c.inkSoft, textAlign: 'center' },
    ctaSubDiscount: { fontSize: 12, fontWeight: '600', color: '#22a06b' },
  }), [c, insets]);

  const isApplyDisabled = promoInput.trim().length === 0 || promoStatus === 'loading' || promoStatus === 'valid';

  return (
    <View style={styles.root}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          {isRTL ? <ArrowLeft size={18} color={c.ink} /> : <ChevronLeft size={18} color={c.ink} />}
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('review_confirm_title')}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Hero — route + departure ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroCodeRow}>
            <View style={styles.heroCodeBox}>
              <Text style={styles.heroCodeText}>{routeCode}</Text>
            </View>
            <Text style={styles.heroName} numberOfLines={1}>{routeName}</Text>
          </View>
          <View style={styles.heroTimeRow}>
            <Text style={styles.heroTime}>{time}</Text>
            <Text style={styles.heroDate}>{date}</Text>
          </View>
        </View>

        {/* ── Journey details ── */}
        <Text style={styles.sectionLabel}>{t('selected_trip')}</Text>
        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <View style={styles.detailIconBox}><MapPin size={15} color={c.ink} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>{t('boarding')}</Text>
              <Text style={styles.detailValue}>{boardingStation || '—'}</Text>
            </View>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <View style={styles.detailIconBox}><MapPin size={15} color={c.ink} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>{t('drop_off')}</Text>
              <Text style={styles.detailValue}>{dropOffStation || '—'}</Text>
            </View>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <View style={styles.detailIconBox}><Clock size={15} color={c.ink} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>{t('time_label')}</Text>
              <Text style={styles.detailValue}>{time} · {date}</Text>
            </View>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <View style={styles.detailIconBox}><Users size={15} color={c.ink} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>{t('seat_selector_label')}</Text>
              <Text style={styles.detailValue}>{seats} {t('seat_count')}</Text>
            </View>
          </View>
        </View>

        {/* ── Promo code ── */}
        <Text style={styles.sectionLabel}>{t('promo_code')}</Text>
        <View style={styles.promoCard}>
          <View style={styles.promoInputRow}>
            <View style={styles.promoIconBox}>
              <Tag size={15} color={c.inkSoft} />
            </View>
            <TextInput
              style={styles.promoInput}
              placeholder={t('enter_promo')}
              placeholderTextColor={c.inkSoft}
              value={promoInput}
              onChangeText={(v) => {
                setPromoInput(v);
                if (promoStatus === 'invalid') setPromoStatus('idle');
              }}
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
              activeOpacity={0.8}
            >
              {promoStatus === 'loading'
                ? <ActivityIndicator size="small" color={c.isDark ? c.background : '#ffffff'} />
                : <Text style={styles.promoApplyText}>{t('apply')}</Text>}
            </TouchableOpacity>
          </View>

          {promoStatus === 'valid' && (
            <View style={styles.promoSuccessRow}>
              <Check size={14} color="#22a06b" style={{ marginEnd: 6 }} />
              <Text style={styles.promoSuccessText}>
                {t('promo_applied')} · -{promoDiscount}
              </Text>
              <TouchableOpacity onPress={clearPromo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={15} color="#22a06b" />
              </TouchableOpacity>
            </View>
          )}

          {promoStatus === 'invalid' && (
            <Text style={styles.promoErrorText}>{promoError}</Text>
          )}
        </View>

        {/* ── Fare summary ── */}
        <Text style={styles.sectionLabel}>{t('total_fare')}</Text>
        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <View style={styles.detailIconBox}><Ticket size={15} color={c.ink} /></View>
            <View style={{ flex: 1 }}>
              {hasDiscount ? (
                <>
                  <Text style={styles.fareOriginal}>{baseTotal} {t('egp')}</Text>
                  <Text style={styles.fareDiscounted}>{finalTotal} {t('egp')}</Text>
                  <View style={styles.savingsBadge}>
                    <Text style={styles.savingsText}>
                      {t('you_save')} {discountAmt} {t('egp')} ({promoDiscount})
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={styles.fareNormal}>{baseTotal} {t('egp')}</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Booking error banner ── */}
        {!!bookingError && (
          <View style={styles.errorBanner}>
            <AlertCircle size={15} color="#b91c1c" />
            <Text style={styles.errorText}>{bookingError}</Text>
          </View>
        )}

      </ScrollView>

      {/* ── Sticky CTA ── */}
      <View style={styles.cta}>
        <TouchableOpacity
          style={[styles.ctaBtn, confirming && styles.ctaBtnDisabled]}
          disabled={confirming}
          activeOpacity={0.88}
          onPress={onConfirm}
        >
          {confirming
            ? <ActivityIndicator size="small" color={c.isDark ? c.background : '#ffffff'} />
            : <Text style={styles.ctaBtnText}>{t('confirm_book')}</Text>}
        </TouchableOpacity>

        <View style={styles.ctaSubRow}>
          {hasDiscount && (
            <Text style={styles.ctaSubText} numberOfLines={1}>
              <Text style={styles.ctaSubDiscount}>{finalTotal} {t('egp')}</Text>
              {'  '}
              <Text style={{ textDecorationLine: 'line-through' }}>{baseTotal} {t('egp')}</Text>
            </Text>
          )}
          {!hasDiscount && (
            <Text style={styles.ctaSubText}>{baseTotal} {t('egp')} · {seats} {t('seat_count')}</Text>
          )}
        </View>
      </View>

    </View>
  );
}
