import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, ChevronLeft, MapPin, Clock, Users, Ticket,
  CalendarDays, CheckCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { useBooking } from '@/context/BookingContext';

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

export default function ReviewConfirmScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c, t, isRTL } = useTheme();
  const { handleConfirm, bookingError, clearBookingError, pendingBooking } = useBooking();
  const [confirming, setConfirming] = useState(false);

  const params = useLocalSearchParams<Params>();
  const {
    routeName = '',
    routeCode = '',
    tripId = '',
    date = '',
    time = '',
    boardingStation = '',
    dropOffStation = '',
    price = '0',
    seatCount = '1',
  } = params;

  const total = Number(price) || 0;
  const seats = Number(seatCount) || 1;

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: c.isDark ? '#16162a' : '#f5f5fa' },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingTop: insets.top + 12, paddingBottom: 14,
      paddingHorizontal: 16,
      borderBottomWidth: 1, borderBottomColor: c.border,
      backgroundColor: c.isDark ? '#16162a' : '#f5f5fa',
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.mist,
    },
    headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: c.ink, letterSpacing: -0.4 },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 120 },

    heroCard: {
      backgroundColor: c.ink, borderRadius: 24,
      paddingHorizontal: 20, paddingVertical: 18,
      marginBottom: 16,
    },
    heroCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    heroCodeBox: {
      width: 38, height: 38, borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    heroCodeText: { color: '#ffffff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    heroRouteName: { color: '#ffffff', fontSize: 20, fontWeight: '700', letterSpacing: -0.5, flex: 1 },
    heroTimeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
    heroTime: { color: '#ffffff', fontSize: 34, fontWeight: '800', letterSpacing: -1 },
    heroDate: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '500' },

    sectionLabel: {
      fontSize: 11, fontWeight: '600', color: c.inkSoft,
      textTransform: 'uppercase' as any, letterSpacing: 1.2,
      marginBottom: 10, marginTop: 6,
    },
    detailCard: {
      backgroundColor: c.white, borderRadius: 20,
      borderWidth: 1, borderColor: c.border,
      overflow: 'hidden', marginBottom: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: c.isDark ? 0.18 : 0.05, shadowRadius: 8, elevation: 3,
    },
    detailRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    },
    detailDivider: { height: 1, backgroundColor: c.border, marginHorizontal: 16 },
    detailIconBox: {
      width: 34, height: 34, borderRadius: 10,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.mist,
      alignItems: 'center', justifyContent: 'center',
    },
    detailLabel: { fontSize: 11, color: c.inkSoft, marginBottom: 2 },
    detailValue: { fontSize: 14, fontWeight: '600', color: c.ink },

    errorBanner: {
      backgroundColor: '#fef2f2', borderRadius: 14, padding: 14,
      marginBottom: 16, flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    },
    errorText: { flex: 1, fontSize: 13, color: '#b91c1c', lineHeight: 18 },

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
    ctaBtnText: { color: c.isDark ? c.background : '#ffffff', fontSize: 15.5, fontWeight: '700', letterSpacing: -0.2 },
    ctaSubText: { fontSize: 12, color: c.inkSoft, textAlign: 'center', marginTop: 8 },
  });

  const onConfirm = async () => {
    if (confirming) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearBookingError();
    setConfirming(true);
    await handleConfirm();
    setConfirming(false);
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          {isRTL ? <ArrowLeft size={18} color={c.ink} /> : <ChevronLeft size={18} color={c.ink} />}
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('review_confirm_title')}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Hero card — route + time */}
        <View style={styles.heroCard}>
          <View style={styles.heroCodeRow}>
            <View style={styles.heroCodeBox}>
              <Text style={styles.heroCodeText}>{routeCode}</Text>
            </View>
            <Text style={styles.heroRouteName} numberOfLines={1}>{routeName}</Text>
          </View>
          <View style={styles.heroTimeRow}>
            <Text style={styles.heroTime}>{time}</Text>
            <Text style={styles.heroDate}>{date}</Text>
          </View>
        </View>

        {/* Journey detail card */}
        <Text style={styles.sectionLabel}>{t('selected_trip')}</Text>
        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <View style={styles.detailIconBox}>
              <MapPin size={15} color={c.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>{t('boarding')}</Text>
              <Text style={styles.detailValue}>{boardingStation || '—'}</Text>
            </View>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <View style={styles.detailIconBox}>
              <MapPin size={15} color={c.ink} fill={c.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>{t('drop_off')}</Text>
              <Text style={styles.detailValue}>{dropOffStation || '—'}</Text>
            </View>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <View style={styles.detailIconBox}>
              <Clock size={15} color={c.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>{t('trip_duration')}</Text>
              <Text style={styles.detailValue}>{time} · {date}</Text>
            </View>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailRow}>
            <View style={styles.detailIconBox}>
              <Users size={15} color={c.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>{t('seat_selector_label')}</Text>
              <Text style={styles.detailValue}>{seats} {t('seat_count')}</Text>
            </View>
          </View>
        </View>

        {/* Fare summary */}
        <Text style={styles.sectionLabel}>{t('total_fare')}</Text>
        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <View style={styles.detailIconBox}>
              <Ticket size={15} color={c.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>{t('egp')}</Text>
              <Text style={[styles.detailValue, { fontSize: 22, letterSpacing: -0.5 }]}>
                {total} {t('egp')}
              </Text>
            </View>
          </View>
        </View>

        {/* Error banner */}
        {!!bookingError && (
          <View style={styles.errorBanner}>
            <CheckCircle size={15} color="#b91c1c" />
            <Text style={styles.errorText}>{bookingError}</Text>
          </View>
        )}
      </ScrollView>

      {/* CTA */}
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
        <Text style={styles.ctaSubText}>{total} {t('egp')} · {seats} {t('seat_count')}</Text>
      </View>
    </View>
  );
}
