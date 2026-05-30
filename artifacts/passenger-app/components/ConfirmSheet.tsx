import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { Calendar, Clock, Users, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors, S } from '@/constants/colors';
import { useBooking } from '@/context/BookingContext';

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
  const slideAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (confirmSheetOpen) {
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

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [700, 0] });
  if (!visible || !pendingBooking) return null;
  const booking = pendingBooking;

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
                <Text style={styles.totalValue}>{booking.price} {t('egp')}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.confirmBtn} activeOpacity={0.9} onPress={() => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); handleConfirm(); }}>
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
