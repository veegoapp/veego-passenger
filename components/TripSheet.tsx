import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Animated, Platform, ActivityIndicator, Alert,
} from 'react-native';
import {
  Users, Heart, Clock, MapPin, AlertCircle,
  Ticket, ArrowRight, ArrowLeft, Wallet, ChevronRight, ChevronLeft, AlertTriangle,
  Minus, Plus, Bus, Calendar,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors, S } from '@/constants/colors';
import { useBooking } from '@/context/BookingContext';
import { useServiceControl } from '@/context/ServiceControlContext';
import { calcSegmentPrice } from '@/constants/data';
import { SectionLabel } from '@/components/Shared';

/**
 * §21.2: statuses that mean the trip is ahead and accepting new bookings.
 * Expanded from the old 'open'/'active' check to include all pre-departure states.
 */
const BOOKABLE_STATUSES = ['scheduled', 'waiting_driver', 'driver_assigned', 'open', 'active'];
const ACTIVE_STATUSES   = ['active', 'driver_assigned', 'boarding'];

function isTripBookable(trip: any): boolean {
  const status = (trip?.status ?? trip?.shuttleStatus ?? '').toLowerCase();
  return BOOKABLE_STATUSES.includes(status) && (trip?.availableSeats ?? 0) > 0;
}

function shuttleStatusLabel(trip: any): string {
  const status = (trip?.status ?? trip?.shuttleStatus ?? '').toLowerCase();
  switch (status) {
    case 'scheduled':       return 'Confirmed';
    case 'waiting_driver':  return 'Searching driver';
    case 'driver_assigned': return 'Driver assigned';
    case 'open':            return 'Open';
    case 'active':          return 'Active';
    case 'boarding':        return 'Boarding';
    case 'completed':       return 'Completed';
    case 'cancelled':       return 'Cancelled';
    default:                return status || 'Upcoming';
  }
}

function shuttleStatusColor(trip: any): string {
  const status = (trip?.status ?? trip?.shuttleStatus ?? '').toLowerCase();
  switch (status) {
    case 'scheduled':       return '#2563eb'; // blue — confirmed, waiting min pax
    case 'waiting_driver':  return '#d97706'; // amber — searching
    case 'driver_assigned': return '#059669'; // green — driver found
    case 'open':            return '#d97706'; // amber
    case 'active':          return '#16a34a'; // green — en route
    case 'boarding':        return '#7c3aed'; // purple — boarding now
    case 'cancelled':       return '#dc2626'; // red
    default:                return '#6b7280'; // gray
  }
}

/** §21.9: Display departure times in Africa/Cairo timezone, not UTC */
function formatTripTimeUTC(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false });
  }
}

/** §21.9: Display departure dates in Africa/Cairo timezone, not UTC */
function formatTripDateUTC(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
}

function makeStyles(c: ThemeColors, gs: object) {
  return StyleSheet.create({
    root: { ...StyleSheet.absoluteFillObject, zIndex: 9999, pointerEvents: 'box-none' as any },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      position: 'absolute', bottom: 0, left: 0, right: 0, height: '92%',
      backgroundColor: c.isDark ? '#16162a' : '#f5f5fa',
      borderTopLeftRadius: 36, borderTopRightRadius: 36, ...S.float,
    },
    handle: {
      width: 44, height: 5, borderRadius: 2.5,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
      alignSelf: 'center', marginTop: 14,
    },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 8 },

    /* ── Route hero ─────────────────────────────────────── */
    routeHero: {
      backgroundColor: c.ink,
      paddingHorizontal: 24, paddingTop: 22, paddingBottom: 0,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      marginHorizontal: 12, marginTop: 16,
      borderRadius: 28, overflow: 'hidden',
    },
    heroGlow: {
      position: 'absolute', top: -60, right: -60,
      width: 200, height: 200, borderRadius: 100,
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
    heroCodeBox: {
      width: 42, height: 42, borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    heroCodeText: { color: '#ffffff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    heroFavBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: 'rgba(255,255,255,0.1)',
      alignItems: 'center', justifyContent: 'center',
    },
    heroRouteName: {
      fontSize: 22, fontWeight: '700', color: '#ffffff',
      letterSpacing: -0.5, marginBottom: 4,
    },
    heroRoutePath: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 20 },

    /* Journey track */
    journeyWrap: { paddingBottom: 20 },
    journeyScroll: { paddingRight: 24 },
    journeyRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 8 },
    journeyStop: { alignItems: 'center', width: 70 },
    journeyNodeOuter: {
      width: 28, height: 28, borderRadius: 14,
      borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    journeyNodeOuterActive: {
      borderColor: '#ffffff',
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    journeyNodeInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.45)' },
    journeyNodeInnerActive: { backgroundColor: '#ffffff' },
    journeyLabel: {
      fontSize: 10, color: 'rgba(255,255,255,0.55)',
      textAlign: 'center', marginTop: 8, lineHeight: 13,
    },
    journeyLabelActive: { color: '#ffffff', fontWeight: '600' },
    journeyConnector: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 20 },
    journeyConnectorActive: { backgroundColor: 'rgba(255,255,255,0.55)' },

    /* Stat cards row */
    statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, marginTop: 12, marginBottom: 4 },
    statCard: {
      flex: 1, borderRadius: 18, padding: 14,
      backgroundColor: c.white,
      alignItems: 'center', gap: 6,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: c.isDark ? 0.25 : 0.06, shadowRadius: 8, elevation: 3,
    },
    statIconBox: {
      width: 36, height: 36, borderRadius: 12,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.mist,
      alignItems: 'center', justifyContent: 'center',
    },
    statValue: { fontSize: 15, fontWeight: '700', color: c.ink, letterSpacing: -0.3 },
    statLabel: { fontSize: 9.5, color: c.inkSoft, textAlign: 'center', lineHeight: 13, letterSpacing: 0.2 },

    /* Section wrapper */
    sectionWrap: { paddingHorizontal: 12, marginTop: 18 },
    sectionTitle: {
      fontSize: 11, fontWeight: '600', color: c.inkSoft,
      textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12,
    },

    /* Trip cards — vertical full-width */
    tripCard: {
      borderRadius: 20, borderWidth: 1.5, borderColor: c.border,
      padding: 16, backgroundColor: c.white, marginBottom: 10,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: c.isDark ? 0.18 : 0.04, shadowRadius: 6, elevation: 2,
    },
    tripCardActive: {
      backgroundColor: c.ink, borderColor: c.ink,
      shadowOpacity: 0.22, shadowRadius: 14, elevation: 8,
    },
    tripCardDisabled: { opacity: 0.4 },
    tripCardTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
    tripTime: { fontSize: 28, fontWeight: '800', color: c.ink, letterSpacing: -1 },
    tripTimeActive: { color: c.isDark ? c.background : '#ffffff' },
    tripNumberBox: {
      borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.mist,
      flexDirection: 'row', alignItems: 'center', gap: 4,
    },
    tripNumberBoxActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
    tripNumberText: { fontSize: 12, fontWeight: '600', color: c.inkSoft },
    tripNumberTextActive: { color: 'rgba(255,255,255,0.8)' },
    tripDateText: { fontSize: 11, color: c.inkSoft, marginTop: 2 },
    tripDateTextActive: { color: 'rgba(255,255,255,0.55)' },
    tripStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    tripStatusDot: { width: 7, height: 7, borderRadius: 4 },
    tripStatusText: { fontSize: 11, fontWeight: '600' },
    tripSeatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    tripSeatsFraction: { fontSize: 12, fontWeight: '600', color: c.inkSoft },
    tripSeatsFractionActive: { color: 'rgba(255,255,255,0.65)' },
    tripSeatsLabel: { fontSize: 11, color: c.inkSoft },
    tripSeatsLabelActive: { color: 'rgba(255,255,255,0.5)' },
    progressBarWrap: { height: 6, borderRadius: 3, backgroundColor: c.isDark ? 'rgba(255,255,255,0.1)' : c.mist, overflow: 'hidden' },
    progressBarFill: { height: '100%' as any, borderRadius: 3 },
    tripAvailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
    tripAvailDot: { width: 6, height: 6, borderRadius: 3 },
    tripAvailText: { fontSize: 12, fontWeight: '600' },
    tripMessage: { fontSize: 11, color: c.inkSoft, marginTop: 6, lineHeight: 15 },
    tripMessageActive: { color: 'rgba(255,255,255,0.6)' },

    /* No trips */
    noTripsWrap: { paddingVertical: 28, alignItems: 'center', gap: 8, borderRadius: 20, backgroundColor: c.white, borderWidth: 1, borderColor: c.border },
    noTripsText: { fontSize: 13, color: c.inkSoft, textAlign: 'center', paddingHorizontal: 24 },

    /* Station picker */
    pickTabWrap: { flexDirection: 'row', padding: 4, borderRadius: 18, gap: 2, backgroundColor: c.mist },
    pickTab: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
    pickTabActive: { backgroundColor: c.ink, shadowColor: c.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
    pickTabText: { fontSize: 12.5, fontWeight: '500' },

    timeline: { marginTop: 12, backgroundColor: c.white, borderRadius: 20, padding: 16, gap: 0, borderWidth: 1, borderColor: c.border },
    timelineRow: { flexDirection: 'row', gap: 12, paddingBottom: 12 },
    timelineLeft: { alignItems: 'center', width: 16 },
    tlDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
    tlDotActive: { borderColor: c.ink, backgroundColor: c.ink },
    tlDotSeg: { borderColor: c.ink, backgroundColor: c.white },
    tlDotInactive: { borderColor: c.silver, backgroundColor: c.white },
    tlLine: { width: 2, flex: 1, marginTop: 2, minHeight: 16 },
    tlLineActive: { backgroundColor: c.ink },
    tlLineInactive: { backgroundColor: 'rgba(195,195,204,0.4)' },
    timelineRight: { flex: 1, paddingBottom: 4 },
    timelineTextRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    tlName: { fontSize: 13.5, fontWeight: '500' },
    tlBadge: { backgroundColor: c.ink, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
    tlBadgeText: { fontSize: 10, fontWeight: '600', color: c.isDark ? c.background : c.white, textTransform: 'uppercase', letterSpacing: 0.8 },
    tlArea: { fontSize: 11, color: c.inkSoft, marginTop: 2 },

    /* Seat selector */
    seatRow: {
      flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 16, marginTop: 12,
      backgroundColor: c.white, borderWidth: 1, borderColor: c.border,
    },
    seatBtn: {
      width: 44, height: 44, borderRadius: 14, backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.mist,
      alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border,
    },
    seatBtnDisabled: { opacity: 0.3 },
    seatCountText: { fontSize: 24, fontWeight: '800', color: c.ink, minWidth: 42, textAlign: 'center' },
    seatLabelWrap: { flex: 1, paddingStart: 12 },
    seatLabel: { fontSize: 13, color: c.ink, fontWeight: '600' },
    seatMax: { fontSize: 11, color: c.inkSoft, marginTop: 2 },

    /* Price card */
    priceSummary: {
      flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 16, marginTop: 12,
      backgroundColor: c.white, borderWidth: 1, borderColor: c.border, gap: 16,
    },
    priceIcon: {
      width: 52, height: 52, borderRadius: 16, backgroundColor: c.ink,
      alignItems: 'center', justifyContent: 'center',
    },
    priceSegLabel: { fontSize: 12, color: c.inkSoft, lineHeight: 17 },
    priceTotal: { fontSize: 22, fontWeight: '700', color: c.ink, letterSpacing: -0.5, marginTop: 2 },
    walletRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    walletText: { fontSize: 11, color: c.inkSoft },
    walletLow: { color: '#e53e3e' },
    walletOk: { color: '#38a169' },

    /* Service banner */
    serviceBanner: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: '#fef3c7', borderRadius: 16, padding: 14, marginTop: 12,
    },
    serviceBannerText: { flex: 1, fontSize: 12.5, color: '#92400e', lineHeight: 18 },

    /* CTA */
    cta: {
      padding: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border,
      backgroundColor: c.isDark ? '#16162a' : '#f5f5fa',
    },
    ctaBtn: {
      height: 58, borderRadius: 22, backgroundColor: c.ink,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      shadowColor: c.ink, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
    },
    ctaBtnText: { color: c.isDark ? c.background : c.white, fontSize: 15.5, fontWeight: '700', letterSpacing: -0.2 },

    /* Loading / error */
    loadingWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10 },
    loadingText: { fontSize: 13, color: c.inkSoft },
    errorText: { fontSize: 13, color: c.inkSoft, textAlign: 'center' },
    retryBtn: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: c.border },
    retryBtnText: { fontSize: 13, fontWeight: '500', color: c.ink },
  });
}

export function TripSheet() {
  const {
    tripSheetOpen, closeTripSheet, selectedRoute, handleBook,
    routeLoading, tripsLoading, scheduledTrips,
    openRoute, walletBalance, seatCount, setSeatCount,
  } = useBooking();
  const { getService, handleServiceTap } = useServiceControl();
  const { colors: c, glassStyle: gs, t, language, isRTL } = useTheme();
  const isAr = language === 'ar';
  const styles = useMemo(() => makeStyles(c, gs), [c]);

  const shuttleSvc = getService('shuttle');
  const shuttleServiceEnabled: boolean = !shuttleSvc || (shuttleSvc.isEnabled && shuttleSvc.displayMode === 'live');
  const shuttleDisabledMessage: string =
    shuttleSvc?.unavailableMessage ??
    (shuttleSvc?.displayMode === 'maintenance' ? 'Shuttle service is under maintenance.' :
     shuttleSvc?.displayMode === 'coming_soon' ? 'Shuttle service coming soon.' :
     'Shuttle service is currently unavailable.');

  const slideAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);
  const [timeIdx, setTimeIdx] = useState(0);
  const [pick, setPick] = useState<'from' | 'to'>('from');

  useEffect(() => {
    if (selectedRoute && selectedRoute.path.length >= 2) {
      setFromIdx(0);
      setToIdx(selectedRoute.path.length - 1);
      setTimeIdx(0);
      setPick('from');
      setSeatCount(1);
    }
  }, [selectedRoute?.id, selectedRoute?.path.length]);

  useEffect(() => {
    if (tripSheetOpen) {
      setVisible(true);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start(() => setVisible(false));
    }
  }, [tripSheetOpen]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [900, 0] });

  const safeTimeIdx = Math.min(timeIdx, Math.max(0, scheduledTrips.length - 1));
  const selectedTrip = scheduledTrips[safeTimeIdx] ?? null;

  const selectedTripSeats: number = useMemo(() => {
    if (selectedTrip) return selectedTrip.availableSeats ?? 0;
    return selectedRoute?.seatsLeft ?? 0;
  }, [selectedTrip, selectedRoute?.seatsLeft]);

  if (!visible || !selectedRoute) return null;

  const route = selectedRoute;
  const hasPath = route.path.length >= 2;
  const safeFrom = hasPath ? fromIdx : 0;
  const safeTo = hasPath ? toIdx : 1;
  const lo = Math.min(safeFrom, safeTo);
  const hi = Math.max(safeFrom, safeTo);

  const pricePerSeat = hasPath ? calcSegmentPrice(route, safeFrom, safeTo, 1) : route.price;
  const total = pricePerSeat * seatCount;
  const selectedTripBookable = !selectedTrip || isTripBookable(selectedTrip);
  const seatsOk = seatCount >= 1 && seatCount <= selectedTripSeats;
  const valid = hasPath && safeFrom !== safeTo && !routeLoading && scheduledTrips.length > 0 && selectedTripBookable && shuttleServiceEnabled && seatsOk;
  const walletLow = walletBalance !== null && walletBalance < total;

  const pickStation = (idx: number) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    if (pick === 'from') {
      setFromIdx(idx);
      if (idx === toIdx) setToIdx(Math.min(route.path.length - 1, idx + 1));
      setPick('to');
    } else {
      if (idx === fromIdx) return;
      setToIdx(idx);
    }
  };

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closeTripSheet} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.handle} />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ── Route Hero ── */}
          <View style={styles.routeHero}>
            <View style={styles.heroGlow} />
            <View style={styles.heroTopRow}>
              <View style={styles.heroCodeBox}>
                <Text style={styles.heroCodeText}>{route.code}</Text>
              </View>
              <TouchableOpacity
                style={styles.heroFavBtn}
                activeOpacity={0.7}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Heart size={16} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
            <Text style={styles.heroRouteName}>
              {isAr ? (route.nameAr ?? route.name) : route.name}
            </Text>
            <Text style={styles.heroRoutePath}>
              {isAr ? (route.fromAr ?? route.from) : route.from}
              {' → '}
              {isAr ? (route.toAr ?? route.to) : route.to}
            </Text>

            {/* Journey track visualization */}
            <View style={styles.journeyWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.journeyScroll}
              >
                <View style={styles.journeyRow}>
                  {route.path.map((s, i) => {
                    const isActive = i >= lo && i <= hi;
                    const isFirst = i === 0;
                    const isLast = i === route.path.length - 1;
                    return (
                      <React.Fragment key={s.id}>
                        <TouchableOpacity style={styles.journeyStop} onPress={() => pickStation(i)} activeOpacity={0.7}>
                          <View style={[styles.journeyNodeOuter, isActive && styles.journeyNodeOuterActive]}>
                            <View style={[styles.journeyNodeInner, isActive && styles.journeyNodeInnerActive]} />
                          </View>
                          <Text style={[styles.journeyLabel, isActive && styles.journeyLabelActive]} numberOfLines={2}>
                            {isAr ? (s.nameAr ?? s.name) : s.name}
                          </Text>
                        </TouchableOpacity>
                        {!isLast && (
                          <View style={[
                            styles.journeyConnector,
                            (i >= lo && i < hi) && styles.journeyConnectorActive,
                          ]} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>

          {/* ── Info stat cards ── */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statIconBox}>
                <Bus size={16} color={c.ink} />
              </View>
              <Text style={styles.statValue}>{scheduledTrips.length || route.stations}</Text>
              <Text style={styles.statLabel}>{t('departure')}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconBox}>
                <Clock size={16} color={c.ink} />
              </View>
              <Text style={styles.statValue}>{route.duration}</Text>
              <Text style={styles.statLabel}>{t('trip_duration')}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIconBox}>
                <Ticket size={16} color={c.ink} />
              </View>
              <Text style={styles.statValue}>{route.price}</Text>
              <Text style={styles.statLabel}>{t('egp')}</Text>
            </View>
          </View>

          {/* Service disabled banner */}
          {!shuttleServiceEnabled && (
            <View style={[styles.serviceBanner, { marginHorizontal: 12 }]}>
              <AlertTriangle size={15} color="#92400e" style={{ marginTop: 1 }} />
              <Text style={styles.serviceBannerText}>{shuttleDisabledMessage}</Text>
            </View>
          )}

          {/* ── Trips section ── */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>
              {t('departure')}
              {scheduledTrips.length > 0 ? ` · ${scheduledTrips.length}` : ''}
            </Text>

            {routeLoading || tripsLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={c.ink} />
                <Text style={styles.loadingText}>Loading trips…</Text>
              </View>
            ) : scheduledTrips.length === 0 ? (
              <View style={styles.noTripsWrap}>
                <AlertCircle size={24} color={c.silver} />
                <Text style={styles.noTripsText}>No upcoming trips available for this route.</Text>
              </View>
            ) : (
              scheduledTrips.map((trip: any, i: number) => {
                const active = i === safeTimeIdx;
                const bookable = isTripBookable(trip);
                const disabled = !bookable;
                const statusColor = shuttleStatusColor(trip);
                const statusLbl = shuttleStatusLabel(trip);
                const time = formatTripTimeUTC(trip.departureTime ?? trip.departure_time ?? '');
                const date = formatTripDateUTC(trip.departureTime ?? trip.departure_time ?? '');
                const bookedSeats: number = trip.bookedSeats ?? 0;
                const totalSeats: number = trip.totalSeats ?? 14;
                const availableSeats: number = trip.availableSeats ?? 0;
                const minRequired: number = trip.minRequired ?? 7;
                const message: string = trip.message ?? '';
                const tripNum = String(i + 1).padStart(2, '0');

                const fillPct = totalSeats > 0 ? (bookedSeats / totalSeats) * 100 : 0;
                const activationPct = minRequired > 0 ? Math.min(100, (bookedSeats / minRequired) * 100) : 100;

                const tripStatus = (trip.status ?? trip.shuttleStatus ?? '').toLowerCase();
                const barColor = ACTIVE_STATUSES.includes(tripStatus)
                  ? '#16a34a'
                  : tripStatus === 'cancelled'
                  ? '#dc2626'
                  : '#d97706';

                return (
                  <TouchableOpacity
                    key={`${trip.id ?? i}`}
                    onPress={() => { setTimeIdx(i); if (Platform.OS !== 'web') Haptics.selectionAsync(); }}
                    disabled={disabled}
                    style={[
                      styles.tripCard,
                      active && styles.tripCardActive,
                      disabled && styles.tripCardDisabled,
                    ]}
                    activeOpacity={0.85}
                  >
                    {/* Top row: time + trip number */}
                    <View style={styles.tripCardTopRow}>
                      <View>
                        <Text style={[styles.tripTime, active && styles.tripTimeActive]}>{time}</Text>
                        <Text style={[styles.tripDateText, active && styles.tripDateTextActive]}>{date}</Text>
                      </View>
                      <View style={[styles.tripNumberBox, active && styles.tripNumberBoxActive]}>
                        <Text style={[styles.tripNumberText, active && styles.tripNumberTextActive]}>
                          #{tripNum}
                        </Text>
                      </View>
                    </View>

                    {/* Status badge */}
                    <View style={styles.tripStatusRow}>
                      <View style={[styles.tripStatusDot, { backgroundColor: active ? '#fff' : statusColor }]} />
                      <Text style={[styles.tripStatusText, { color: active ? 'rgba(255,255,255,0.8)' : statusColor }]}>
                        {statusLbl}
                      </Text>
                    </View>

                    {/* Seat bar */}
                    <View style={styles.tripSeatsRow}>
                      <Text style={[styles.tripSeatsFraction, active && styles.tripSeatsFractionActive]}>
                        {bookedSeats} / {totalSeats}
                      </Text>
                      <Text style={[styles.tripSeatsLabel, active && styles.tripSeatsLabelActive]}>
                        {t('seats_left').replace(/\d+/, String(availableSeats))}
                      </Text>
                    </View>
                    <View style={styles.progressBarWrap}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${ACTIVE_STATUSES.includes(tripStatus) ? fillPct : activationPct}%` as any,
                            backgroundColor: active ? (c.isDark ? c.background : '#fff') : barColor,
                          },
                        ]}
                      />
                    </View>

                    {/* Available seats pill */}
                    <View style={styles.tripAvailRow}>
                      <View style={[styles.tripAvailDot, { backgroundColor: active ? 'rgba(255,255,255,0.7)' : (availableSeats <= 3 ? '#dc2626' : '#16a34a') }]} />
                      <Text style={[
                        styles.tripAvailText,
                        { color: active ? 'rgba(255,255,255,0.75)' : (availableSeats <= 3 ? '#dc2626' : '#16a34a') },
                      ]}>
                        {availableSeats} available
                      </Text>
                    </View>

                    {!!message && (
                      <Text style={[styles.tripMessage, active && styles.tripMessageActive]} numberOfLines={2}>
                        {message}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* ── Station picker ── */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>{t('boarding_dropoff')}</Text>

            {routeLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={c.ink} />
                <Text style={styles.loadingText}>Loading stops…</Text>
              </View>
            ) : !hasPath ? (
              <View style={styles.loadingWrap}>
                <AlertCircle size={28} color={c.silver} />
                <Text style={styles.errorText}>Stop information not available for this route.</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => openRoute(route)} activeOpacity={0.8}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={[gs, styles.pickTabWrap]}>
                  {(['from', 'to'] as const).map((p) => {
                    const active = pick === p;
                    const stationName = p === 'from'
                      ? (isAr
                          ? (route.path[safeFrom]?.nameAr ?? route.path[safeFrom]?.name ?? route.fromAr ?? route.from)
                          : (route.path[safeFrom]?.name ?? route.from))
                      : (isAr
                          ? (route.path[safeTo]?.nameAr ?? route.path[safeTo]?.name ?? route.toAr ?? route.to)
                          : (route.path[safeTo]?.name ?? route.to));
                    return (
                      <TouchableOpacity key={p} style={[styles.pickTab, active && styles.pickTabActive]} onPress={() => setPick(p)} activeOpacity={0.8}>
                        <Text style={[styles.pickTabText, { color: active ? (c.isDark ? c.background : c.white) : c.inkSoft }]} numberOfLines={1}>
                          {p === 'from' ? t('from') : t('to')} · {stationName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.timeline}>
                  {route.path.map((s, i) => {
                    const inSegment = i >= lo && i <= hi;
                    const isFrom = i === safeFrom;
                    const isTo = i === safeTo;
                    return (
                      <TouchableOpacity key={s.id} style={styles.timelineRow} onPress={() => pickStation(i)} activeOpacity={0.7}>
                        <View style={styles.timelineLeft}>
                          <View style={[styles.tlDot, isFrom || isTo ? styles.tlDotActive : inSegment ? styles.tlDotSeg : styles.tlDotInactive]} />
                          {i < route.path.length - 1 && (
                            <View style={[styles.tlLine, i >= lo && i < hi ? styles.tlLineActive : styles.tlLineInactive]} />
                          )}
                        </View>
                        <View style={styles.timelineRight}>
                          <View style={styles.timelineTextRow}>
                            <Text style={[styles.tlName, { color: inSegment ? c.ink : c.inkSoft }]}>
                            {isAr ? (s.nameAr ?? s.name) : s.name}
                          </Text>
                            {(isFrom || isTo) && (
                              <View style={styles.tlBadge}>
                                <Text style={styles.tlBadgeText}>{isFrom ? t('from') : t('to')}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.tlArea}>{s.area}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          {/* ── Seat selector ── */}
          {hasPath && scheduledTrips.length > 0 && (
            <View style={[styles.seatRow, { marginHorizontal: 12 }]}>
              <TouchableOpacity
                style={[styles.seatBtn, seatCount <= 1 && styles.seatBtnDisabled]}
                disabled={seatCount <= 1}
                onPress={() => { setSeatCount(Math.max(1, seatCount - 1)); if (Platform.OS !== 'web') Haptics.selectionAsync(); }}
                activeOpacity={0.7}
              >
                <Minus size={16} color={c.ink} />
              </TouchableOpacity>
              <Text style={styles.seatCountText}>{seatCount}</Text>
              <View style={styles.seatLabelWrap}>
                <Text style={styles.seatLabel}>{t('seat_selector_label')}</Text>
                <Text style={styles.seatMax}>{t('seats_left').replace(/\d+/, String(selectedTripSeats))}: {selectedTripSeats}</Text>
              </View>
              <TouchableOpacity
                style={[styles.seatBtn, seatCount >= selectedTripSeats && styles.seatBtnDisabled]}
                disabled={seatCount >= selectedTripSeats}
                onPress={() => { setSeatCount(Math.min(selectedTripSeats, seatCount + 1)); if (Platform.OS !== 'web') Haptics.selectionAsync(); }}
                activeOpacity={0.7}
              >
                <Plus size={16} color={c.ink} />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Price summary ── */}
          <View style={[styles.priceSummary, { marginHorizontal: 12, marginTop: 12 }]}>
            <View style={styles.priceIcon}>
              <Ticket size={22} color={c.isDark ? c.background : c.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.priceSegLabel}>
                {isAr
                  ? (route.path[safeFrom]?.nameAr ?? route.path[safeFrom]?.name ?? route.fromAr ?? route.from)
                  : (route.path[safeFrom]?.name ?? route.from)}
                {' → '}
                {isAr
                  ? (route.path[safeTo]?.nameAr ?? route.path[safeTo]?.name ?? route.toAr ?? route.to)
                  : (route.path[safeTo]?.name ?? route.to)}
                {seatCount > 1 ? ` · ${seatCount} ${t('seat_count')}` : ''}
              </Text>
              <Text style={styles.priceTotal}>{total} {t('egp')}</Text>
              <View style={styles.walletRow}>
                <Wallet size={11} color={walletLow ? '#e53e3e' : '#38a169'} />
                <Text style={[styles.walletText, walletLow ? styles.walletLow : styles.walletOk]}>
                  {walletBalance !== null
                    ? `Wallet: ${walletBalance.toFixed(2)} EGP`
                    : 'Wallet balance loading…'}
                </Text>
              </View>
            </View>
            {isRTL ? <ChevronLeft size={16} color={c.inkSoft} /> : <ChevronRight size={16} color={c.inkSoft} />}
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        <View style={styles.cta}>
          <TouchableOpacity
            style={[styles.ctaBtn, (!valid || walletLow) && { opacity: 0.45 }]}
            disabled={!valid || walletLow}
            activeOpacity={0.88}
            onPress={() => {
              if (!valid) return;
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const trip = scheduledTrips[safeTimeIdx];
              handleBook({
                route,
                fromIdx: safeFrom,
                toIdx: safeTo,
                passengers: seatCount,
                date: formatTripDateUTC(trip?.departureTime ?? ''),
                time: formatTripTimeUTC(trip?.departureTime ?? ''),
                price: total,
                tripId: trip?.id ?? null,
              });
            }}
          >
            <Text style={styles.ctaBtnText}>
              {!shuttleServiceEnabled
                ? 'Service Unavailable'
                : !valid
                ? t('select_trip')
                : walletLow
                ? 'Insufficient Balance'
                : `${t('book_now')} · ${total} ${t('egp')}`}
            </Text>
            {valid && !walletLow && shuttleServiceEnabled && (isRTL ? <ArrowLeft size={18} color={c.isDark ? c.background : c.white} /> : <ArrowRight size={18} color={c.isDark ? c.background : c.white} />)}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}
