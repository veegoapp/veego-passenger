import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Animated, Platform, ActivityIndicator, Alert,
} from 'react-native';
import {
  Users, Heart, Calendar, Clock, MapPin, AlertCircle,
  Minus, Plus, Ticket, Star, ArrowRight, Wallet, ChevronDown,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors, S } from '@/constants/colors';
import { useBooking } from '@/context/BookingContext';
import { DATES, calcSegmentPrice } from '@/constants/data';
import { SectionLabel } from '@/components/Shared';

// UTC date strings for each day in DATES — used as the `date` param for GET /trips
const DATES_UTC_API: string[] = (() => {
  const result: string[] = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    result.push(`${y}-${m}-${day}`);
  }
  return result;
})();

// Statuses the backend accepts for POST /bookings (Section 4 of API spec)
const BOOKABLE_STATUSES = new Set(['scheduled', 'active', 'boarding', 'driver_assigned']);

function isTripBookable(trip: any): boolean {
  return BOOKABLE_STATUSES.has(trip?.status ?? '');
}

function tripStatusLabel(trip: any): string {
  switch (trip?.status) {
    case 'waiting_driver': return 'Awaiting driver';
    case 'scheduled':      return 'Ready';
    case 'driver_assigned':return 'Driver assigned';
    case 'boarding':       return 'Boarding';
    case 'active':         return 'In progress';
    case 'completed':      return 'Completed';
    case 'cancelled':      return 'Cancelled';
    default:               return '';
  }
}

// Format a UTC ISO timestamp as HH:MM in UTC (no local offset)
function formatTripTimeUTC(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  });
}

// Format a UTC ISO timestamp as a display date in UTC
function formatTripDateUTC(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function makeStyles(c: ThemeColors, gs: object) {
  return StyleSheet.create({
    root: { ...StyleSheet.absoluteFillObject, zIndex: 9999, pointerEvents: 'box-none' as any },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '88%', backgroundColor: c.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, ...S.float },
    handle: { width: 48, height: 6, borderRadius: 3, backgroundColor: c.isDark ? 'rgba(120,120,160,0.4)' : 'rgba(195,195,204,0.7)', alignSelf: 'center', marginTop: 12 },
    scroll: { flex: 1 },
    scrollContent: { padding: 24, paddingBottom: 8, gap: 0 },
    routeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
    routeCodeBox: { width: 48, height: 48, borderRadius: 16, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
    routeCodeText: { color: c.isDark ? c.background : c.white, fontSize: 12, fontWeight: '600' },
    routeNameText: { fontSize: 18, fontWeight: '600', color: c.ink, letterSpacing: -0.3 },
    routePathText: { fontSize: 12, color: c.inkSoft, marginTop: 1 },
    seatsTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    seatsTagText: { fontSize: 11, color: c.inkSoft },
    section: { marginTop: 20, gap: 8 },
    hScroll: { marginTop: 8 },
    dateBtn: { minWidth: 64, paddingVertical: 10, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
    dateBtnActive: { backgroundColor: c.ink, borderColor: c.ink },
    dateBtnInactive: { backgroundColor: c.white, borderColor: c.border },
    dateDayLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
    dateDay: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
    timeBtn: { height: 52, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    timeBtnActive: { backgroundColor: c.ink, borderColor: c.ink },
    timeBtnInactive: { backgroundColor: c.white, borderColor: c.border },
    timeText: { fontSize: 13, fontWeight: '500' },
    timeSeatsBadge: { fontSize: 10, color: c.inkSoft, marginTop: 2 },
    timeSeatsBadgeActive: { color: c.isDark ? c.background : 'rgba(255,255,255,0.75)' },
    timeSeatsFull: { color: '#e53e3e', fontSize: 10, marginTop: 2 },
    pickTabWrap: { flexDirection: 'row', padding: 4, borderRadius: 16, marginTop: 8, gap: 2 },
    pickTab: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
    pickTabActive: { backgroundColor: c.ink },
    pickTabText: { fontSize: 12.5, fontWeight: '500' },
    timeline: { marginTop: 12, backgroundColor: c.mist, borderRadius: 24, padding: 16, gap: 0 },
    timelineRow: { flexDirection: 'row', gap: 12, paddingBottom: 12 },
    timelineLeft: { alignItems: 'center', width: 16 },
    tlDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
    tlDotActive: { borderColor: c.ink, backgroundColor: c.ink },
    tlDotSeg: { borderColor: c.ink, backgroundColor: c.white },
    tlDotInactive: { borderColor: c.silver, backgroundColor: c.white },
    tlLine: { width: 2, flex: 1, marginTop: 2, minHeight: 16 },
    tlLineActive: { backgroundColor: c.ink },
    tlLineInactive: { backgroundColor: 'rgba(195,195,204,0.5)' },
    timelineRight: { flex: 1, paddingBottom: 4 },
    timelineTextRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    tlName: { fontSize: 13.5, fontWeight: '500' },
    tlBadge: { backgroundColor: c.ink, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
    tlBadgeText: { fontSize: 10, fontWeight: '600', color: c.isDark ? c.background : c.white, textTransform: 'uppercase', letterSpacing: 0.8 },
    tlArea: { fontSize: 11, color: c.inkSoft, marginTop: 2 },
    paxRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 16, marginTop: 8 },
    paxCount: { fontSize: 13.5, fontWeight: '600', color: c.ink },
    paxLimit: { fontSize: 11, color: c.inkSoft, marginTop: 2 },
    paxControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    paxBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    paxBtnOutline: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border },
    paxBtnFilled: { backgroundColor: c.ink },
    paxNum: { width: 24, textAlign: 'center', fontSize: 15, fontWeight: '600', color: c.ink },
    priceSummary: { flexDirection: 'row', alignItems: 'center', borderRadius: 24, padding: 16, marginTop: 20, gap: 16 },
    priceIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
    priceSegLabel: { fontSize: 12, color: c.inkSoft },
    priceTotal: { fontSize: 20, fontWeight: '600', color: c.ink, letterSpacing: -0.5 },
    ratingBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    ratingText: { fontSize: 11, color: c.inkSoft },
    walletRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    walletText: { fontSize: 11, color: c.inkSoft },
    walletLow: { color: '#e53e3e' },
    walletOk: { color: '#38a169' },
    loadMoreBtn: { height: 44, borderRadius: 14, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, marginBottom: 4 },
    loadMoreText: { fontSize: 13, fontWeight: '500', color: c.ink },
    noTripsWrap: { paddingVertical: 20, alignItems: 'center', gap: 6 },
    noTripsText: { fontSize: 13, color: c.inkSoft, textAlign: 'center' },
    cta: { padding: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.white },
    ctaBtn: { height: 56, borderRadius: 20, backgroundColor: c.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...S.float },
    ctaBtnText: { color: c.isDark ? c.background : c.white, fontSize: 15, fontWeight: '600' },
    loadingWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10 },
    loadingText: { fontSize: 13, color: c.inkSoft },
    errorText: { fontSize: 13, color: c.inkSoft, textAlign: 'center' },
    retryBtn: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: c.border },
    retryBtnText: { fontSize: 13, fontWeight: '500', color: c.ink },
    tripsLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  });
}

export function TripSheet() {
  const {
    tripSheetOpen, closeTripSheet, selectedRoute, handleBook,
    routeLoading, tripsLoading, scheduledTrips, tripsTotal, tripsPage,
    openRoute, fetchTripsForDate, loadMoreTrips, walletBalance,
  } = useBooking();
  const { colors: c, glassStyle: gs, t } = useTheme();
  const styles = useMemo(() => makeStyles(c, gs), [c]);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);
  const [pax, setPax] = useState(1);
  const [dateIdx, setDateIdx] = useState(0);
  const [timeIdx, setTimeIdx] = useState(0);
  const [pick, setPick] = useState<'from' | 'to'>('from');
  const prevDateIdx = useRef<number>(0);

  useEffect(() => {
    if (selectedRoute && selectedRoute.path.length >= 2) {
      setFromIdx(0);
      setToIdx(selectedRoute.path.length - 1);
      setPax(1); setDateIdx(0); setTimeIdx(0); setPick('from');
      prevDateIdx.current = 0;
    }
  }, [selectedRoute?.id, selectedRoute?.path.length]);

  // Refetch trips when the selected date changes
  useEffect(() => {
    if (!selectedRoute || dateIdx === prevDateIdx.current) return;
    prevDateIdx.current = dateIdx;
    const utcDate = DATES_UTC_API[dateIdx];
    if (utcDate) {
      fetchTripsForDate(selectedRoute.id, utcDate);
      setTimeIdx(0);
    }
  }, [dateIdx, selectedRoute, fetchTripsForDate]);

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

  // Build time buttons from real API trips — UTC formatted
  const tripTimes: string[] = useMemo(() => {
    return scheduledTrips
      .map((trip: any) => formatTripTimeUTC(trip.departureTime ?? trip.departure_time ?? ''))
      .filter(Boolean);
  }, [scheduledTrips]);

  const safeTimeIdx = Math.min(timeIdx, Math.max(0, tripTimes.length - 1));

  const selectedTripSeats: number = useMemo(() => {
    if (scheduledTrips.length > 0 && scheduledTrips[safeTimeIdx]) {
      return scheduledTrips[safeTimeIdx].availableSeats ?? (selectedRoute?.seatsLeft ?? 0);
    }
    return selectedRoute?.seatsLeft ?? 0;
  }, [scheduledTrips, safeTimeIdx, selectedRoute?.seatsLeft]);

  const hasMoreTrips = useMemo(
    () => scheduledTrips.length < tripsTotal,
    [scheduledTrips.length, tripsTotal],
  );

  const handleLoadMore = useCallback(async () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    await loadMoreTrips();
  }, [loadMoreTrips]);

  if (!visible || !selectedRoute) return null;

  const route = selectedRoute;
  const hasPath = route.path.length >= 2;
  const safeFrom = hasPath ? fromIdx : 0;
  const safeTo = hasPath ? toIdx : 1;
  const lo = Math.min(safeFrom, safeTo);
  const hi = Math.max(safeFrom, safeTo);
  const total = hasPath ? calcSegmentPrice(route, safeFrom, safeTo, pax) : route.price * pax;
  const selectedTrip = scheduledTrips[safeTimeIdx] ?? null;
  const selectedTripBookable = !selectedTrip || isTripBookable(selectedTrip);
  const valid = hasPath && safeFrom !== safeTo && !routeLoading && tripTimes.length > 0 && selectedTripBookable;
  const maxPax = Math.max(1, Math.min(3, selectedTripSeats));
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
          <View style={styles.routeHeader}>
            <View style={styles.routeCodeBox}>
              <Text style={styles.routeCodeText}>{route.code}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeNameText}>{route.name}</Text>
              <Text style={styles.routePathText}>{route.from} → {route.to}</Text>
              <View style={styles.seatsTag}>
                <Users size={11} color={c.inkSoft} />
                <Text style={styles.seatsTagText}>
                  {selectedTripSeats} {t('seats_left')} · {route.price} {t('egp')}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7}>
              <Heart size={16} color={c.ink} />
            </TouchableOpacity>
          </View>

          {/* Date picker */}
          <View style={styles.section}>
            <SectionLabel icon={<Calendar size={14} color={c.inkSoft} />}>
              {t('travel_date')}
            </SectionLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
              {DATES.map((d, i) => {
                const active = i === dateIdx;
                return (
                  <TouchableOpacity key={d.id} onPress={() => { setDateIdx(i); if (Platform.OS !== 'web') Haptics.selectionAsync(); }}
                    style={[styles.dateBtn, active ? styles.dateBtnActive : styles.dateBtnInactive]}>
                    <Text style={[styles.dateDayLabel, { opacity: active ? 0.85 : 0.7, color: active ? (c.isDark ? c.background : c.white) : c.ink }]}>{d.label}</Text>
                    <Text style={[styles.dateDay, { color: active ? (c.isDark ? c.background : c.white) : c.ink }]}>{d.day}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Departure time picker */}
          <View style={styles.section}>
            <SectionLabel icon={<Clock size={14} color={c.inkSoft} />}>
              {t('departure')}
              {tripsTotal > 0 && (
                <Text style={{ fontSize: 11, color: c.inkSoft, fontWeight: '400' }}> · {tripsTotal} trip{tripsTotal !== 1 ? 's' : ''} (UTC)</Text>
              )}
            </SectionLabel>

            {routeLoading ? (
              <View style={{ paddingVertical: 12, alignItems: 'flex-start' }}>
                <ActivityIndicator size="small" color={c.ink} />
              </View>
            ) : tripTimes.length === 0 && !tripsLoading ? (
              <View style={styles.noTripsWrap}>
                <AlertCircle size={22} color={c.silver} />
                <Text style={styles.noTripsText}>No departures for this date.{'\n'}Try a different day.</Text>
              </View>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
                  {tripTimes.map((time, i) => {
                    const active = i === safeTimeIdx;
                    const trip = scheduledTrips[i];
                    const seats = trip?.availableSeats;
                    const isFull = seats !== undefined && seats === 0;
                    const bookable = isTripBookable(trip);
                    const statusLabel = tripStatusLabel(trip);
                    const disabled = isFull || !bookable;
                    return (
                      <TouchableOpacity
                        key={`${time}-${i}`}
                        onPress={() => { setTimeIdx(i); if (Platform.OS !== 'web') Haptics.selectionAsync(); }}
                        disabled={disabled}
                        style={[
                          styles.timeBtn,
                          active ? styles.timeBtnActive : styles.timeBtnInactive,
                          disabled && { opacity: 0.45 },
                        ]}
                      >
                        <Text style={[styles.timeText, { color: active ? (c.isDark ? c.background : c.white) : c.ink }]}>{time}</Text>
                        {isFull ? (
                          <Text style={styles.timeSeatsFull}>Full</Text>
                        ) : !bookable ? (
                          <Text style={styles.timeSeatsBadge}>{statusLabel}</Text>
                        ) : seats !== undefined ? (
                          <Text style={[styles.timeSeatsBadge, active && styles.timeSeatsBadgeActive]}>{seats} seats</Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Trips loading indicator (pagination) */}
                {tripsLoading && (
                  <View style={styles.tripsLoadingRow}>
                    <ActivityIndicator size="small" color={c.ink} />
                    <Text style={{ fontSize: 12, color: c.inkSoft }}>Loading trips…</Text>
                  </View>
                )}

                {/* Load more button */}
                {hasMoreTrips && !tripsLoading && (
                  <TouchableOpacity style={[gs, styles.loadMoreBtn]} onPress={handleLoadMore} activeOpacity={0.8}>
                    <ChevronDown size={14} color={c.ink} />
                    <Text style={styles.loadMoreText}>
                      Load more ({scheduledTrips.length}/{tripsTotal})
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* Station picker */}
          <View style={styles.section}>
            <SectionLabel icon={<MapPin size={14} color={c.inkSoft} />}>
              {t('boarding_dropoff')}
            </SectionLabel>

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
                      ? (route.path[safeFrom]?.name ?? route.from)
                      : (route.path[safeTo]?.name ?? route.to);
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
                            <Text style={[styles.tlName, { color: inSegment ? c.ink : c.inkSoft }]}>{s.name}</Text>
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

          {/* Passenger count */}
          <View style={styles.section}>
            <SectionLabel icon={<Users size={14} color={c.inkSoft} />}>
              {t('passengers')}
            </SectionLabel>
            <View style={[gs, styles.paxRow]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.paxCount}>{pax} {pax === 1 ? t('pax_one') : t('pax_many')}</Text>
                <Text style={styles.paxLimit}>{selectedTripSeats} {t('seats_left')}</Text>
              </View>
              <View style={styles.paxControls}>
                <TouchableOpacity
                  onPress={() => { setPax(Math.max(1, pax - 1)); if (Platform.OS !== 'web') Haptics.selectionAsync(); }}
                  disabled={pax <= 1}
                  style={[styles.paxBtn, styles.paxBtnOutline, pax <= 1 && { opacity: 0.4 }]}
                  activeOpacity={0.8}
                >
                  <Minus size={14} color={c.ink} />
                </TouchableOpacity>
                <Text style={styles.paxNum}>{pax}</Text>
                <TouchableOpacity
                  onPress={() => { setPax(Math.min(maxPax, pax + 1)); if (Platform.OS !== 'web') Haptics.selectionAsync(); }}
                  disabled={pax >= maxPax}
                  style={[styles.paxBtn, styles.paxBtnFilled, pax >= maxPax && { opacity: 0.4 }]}
                  activeOpacity={0.8}
                >
                  <Plus size={14} color={c.isDark ? c.background : c.white} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Price summary */}
          <View style={[gs, styles.priceSummary]}>
            <View style={styles.priceIcon}>
              <Ticket size={20} color={c.isDark ? c.background : c.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.priceSegLabel}>
                {hasPath ? `${Math.max(1, hi - lo)} ${hi - lo > 1 ? t('segments') : t('segment')} · ` : ''}{pax} {t('pax_one')}
              </Text>
              <Text style={styles.priceTotal}>{total} {t('egp')}</Text>
              {/* Wallet balance chip */}
              {walletBalance !== null && (
                <View style={styles.walletRow}>
                  <Wallet size={11} color={walletLow ? '#e53e3e' : c.inkSoft} />
                  <Text style={[styles.walletText, walletLow ? styles.walletLow : styles.walletOk]}>
                    {walletLow
                      ? `Low balance — ${walletBalance.toFixed(2)} EGP`
                      : `Wallet: ${walletBalance.toFixed(2)} EGP`}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.ratingBox}>
              <Star size={12} color={c.inkSoft} />
              <Text style={styles.ratingText}>4.9</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.cta}>
          <TouchableOpacity
            disabled={!valid}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const realDate = selectedTrip
                ? formatTripDateUTC(selectedTrip.departureTime ?? selectedTrip.departure_time ?? '')
                : DATES[dateIdx].date;

              handleBook({
                route,
                fromIdx: safeFrom,
                toIdx: safeTo,
                passengers: pax,
                date: realDate || DATES[dateIdx].date,
                time: tripTimes[safeTimeIdx] ?? '—',
                price: total,
                tripId: selectedTrip?.id ?? null,
              });
            }}
            style={[styles.ctaBtn, !valid && { opacity: 0.4 }]}
            activeOpacity={0.9}
          >
            <Text style={styles.ctaBtnText}>{t('book')} · {total} {t('egp')}</Text>
            <ArrowRight size={16} color={c.isDark ? c.background : c.white} />
          </TouchableOpacity>
          {selectedTrip && !selectedTripBookable && (
            <Text style={{ fontSize: 12, color: c.inkSoft, textAlign: 'center', marginTop: 8 }}>
              This departure is awaiting a driver and can't be booked yet.
            </Text>
          )}
          {tripTimes.length > 0 && !scheduledTrips.some(isTripBookable) && (
            <Text style={{ fontSize: 12, color: c.inkSoft, textAlign: 'center', marginTop: 8 }}>
              No bookable departures for this date yet — try another day.
            </Text>
          )}
        </View>
      </Animated.View>
    </View>
  );
}
