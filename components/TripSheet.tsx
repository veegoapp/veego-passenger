import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Animated, Platform, ActivityIndicator, Alert,
} from 'react-native';
import {
  Users, Heart, Clock, MapPin, AlertCircle,
  Ticket, ArrowRight, Wallet, ChevronRight, AlertTriangle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors, S } from '@/constants/colors';
import { useBooking } from '@/context/BookingContext';
import { useServiceControl } from '@/context/ServiceControlContext';
import { calcSegmentPrice } from '@/constants/data';
import { SectionLabel } from '@/components/Shared';

// shuttleStatus values per API contract
type ShuttleStatus = 'open' | 'active' | 'cancelled';

function isTripBookable(trip: any): boolean {
  const status: ShuttleStatus = trip?.shuttleStatus ?? trip?.status ?? '';
  return (status === 'open' || status === 'active') && (trip?.availableSeats ?? 0) > 0;
}

function shuttleStatusLabel(trip: any): string {
  const status: ShuttleStatus = trip?.shuttleStatus ?? trip?.status ?? '';
  switch (status) {
    case 'open':      return 'Open';
    case 'active':    return 'Active';
    case 'cancelled': return 'Cancelled';
    default:          return '';
  }
}

function shuttleStatusColor(trip: any): string {
  const status: ShuttleStatus = trip?.shuttleStatus ?? trip?.status ?? '';
  switch (status) {
    case 'open':      return '#d97706'; // amber
    case 'active':    return '#16a34a'; // green
    case 'cancelled': return '#dc2626'; // red
    default:          return '#6b7280';
  }
}

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

function formatTripDateUTC(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
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

    // Trip card (replaces simple time button)
    tripCard: {
      borderRadius: 16, borderWidth: 1, borderColor: c.border,
      padding: 12, minWidth: 180, backgroundColor: c.white,
    },
    tripCardActive: { backgroundColor: c.ink, borderColor: c.ink },
    tripCardDisabled: { opacity: 0.45 },
    tripCardTime: { fontSize: 15, fontWeight: '600', color: c.ink },
    tripCardTimeActive: { color: c.isDark ? c.background : c.white },
    tripCardDate: { fontSize: 10, color: c.inkSoft, marginTop: 1 },
    tripCardDateActive: { color: c.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.7)' },
    tripStatusBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3,
      marginTop: 6, alignSelf: 'flex-start',
    },
    tripStatusDot: { width: 5, height: 5, borderRadius: 3 },
    tripStatusText: { fontSize: 10, fontWeight: '600' },
    tripSeatText: { fontSize: 10, color: c.inkSoft, marginTop: 4 },
    tripSeatTextActive: { color: c.isDark ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.75)' },
    tripMessage: { fontSize: 10, color: c.inkSoft, marginTop: 3, lineHeight: 14 },
    tripMessageActive: { color: c.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.7)' },

    // Seat progress bar
    progressBarWrap: { height: 4, borderRadius: 2, backgroundColor: c.mist, marginTop: 6, overflow: 'hidden' },
    progressBarFill: { height: '100%' as any, borderRadius: 2 },

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
    priceSummary: { flexDirection: 'row', alignItems: 'center', borderRadius: 24, padding: 16, marginTop: 20, gap: 16 },
    priceIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
    priceSegLabel: { fontSize: 12, color: c.inkSoft },
    priceTotal: { fontSize: 20, fontWeight: '600', color: c.ink, letterSpacing: -0.5 },
    walletRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    walletText: { fontSize: 11, color: c.inkSoft },
    walletLow: { color: '#e53e3e' },
    walletOk: { color: '#38a169' },
    noTripsWrap: { paddingVertical: 20, alignItems: 'center', gap: 6 },
    noTripsText: { fontSize: 13, color: c.inkSoft, textAlign: 'center' },
    serviceBanner: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: '#fef3c7', borderRadius: 14, padding: 12, marginTop: 16,
    },
    serviceBannerText: { flex: 1, fontSize: 12.5, color: '#92400e', lineHeight: 18 },
    cta: { padding: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.white },
    ctaBtn: { height: 56, borderRadius: 20, backgroundColor: c.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...S.float },
    ctaBtnText: { color: c.isDark ? c.background : c.white, fontSize: 15, fontWeight: '600' },
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
    openRoute, walletBalance,
  } = useBooking();
  const { getService, handleServiceTap } = useServiceControl();
  const { colors: c, glassStyle: gs, t } = useTheme();
  const styles = useMemo(() => makeStyles(c, gs), [c]);

  // ── Service-level gate: is the shuttle service enabled? ──────────────────────
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

  // seatCount is always 1 per API contract
  const total = hasPath ? calcSegmentPrice(route, safeFrom, safeTo, 1) : route.price;
  const selectedTripBookable = !selectedTrip || isTripBookable(selectedTrip);
  const valid = hasPath && safeFrom !== safeTo && !routeLoading && scheduledTrips.length > 0 && selectedTripBookable && shuttleServiceEnabled;
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
          {/* Route header */}
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
            <TouchableOpacity
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' }}
              activeOpacity={0.7}
            >
              <Heart size={16} color={c.ink} />
            </TouchableOpacity>
          </View>

          {/* Service disabled banner — shown when admin disables shuttle */}
          {!shuttleServiceEnabled && (
            <View style={styles.serviceBanner}>
              <AlertTriangle size={15} color="#92400e" style={{ marginTop: 1 }} />
              <Text style={styles.serviceBannerText}>{shuttleDisabledMessage}</Text>
            </View>
          )}

          {/* Trip selector */}
          <View style={styles.section}>
            <SectionLabel icon={<Clock size={14} color={c.inkSoft} />}>
              {t('departure')}
              {scheduledTrips.length > 0 && (
                <Text style={{ fontSize: 11, color: c.inkSoft, fontWeight: '400' }}>
                  {' '}· {scheduledTrips.length} trip{scheduledTrips.length !== 1 ? 's' : ''}
                </Text>
              )}
            </SectionLabel>

            {routeLoading || tripsLoading ? (
              <View style={{ paddingVertical: 12, alignItems: 'flex-start' }}>
                <ActivityIndicator size="small" color={c.ink} />
              </View>
            ) : scheduledTrips.length === 0 ? (
              <View style={styles.noTripsWrap}>
                <AlertCircle size={22} color={c.silver} />
                <Text style={styles.noTripsText}>No upcoming trips available for this route.</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.hScroll}
                contentContainerStyle={{ gap: 8, paddingRight: 4 }}
              >
                {scheduledTrips.map((trip: any, i: number) => {
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

                  // Progress fill: total seats taken
                  const fillPct = totalSeats > 0 ? (bookedSeats / totalSeats) * 100 : 0;
                  // Activation fill for open trips
                  const activationPct = minRequired > 0 ? Math.min(100, (bookedSeats / minRequired) * 100) : 100;

                  const barColor = trip.shuttleStatus === 'active'
                    ? '#16a34a'
                    : trip.shuttleStatus === 'cancelled'
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
                    >
                      <Text style={[styles.tripCardTime, active && styles.tripCardTimeActive]}>{time}</Text>
                      <Text style={[styles.tripCardDate, active && styles.tripCardDateActive]}>{date}</Text>

                      {/* Status badge */}
                      <View style={[styles.tripStatusBadge, { backgroundColor: `${statusColor}18` }]}>
                        <View style={[styles.tripStatusDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.tripStatusText, { color: statusColor }]}>{statusLbl}</Text>
                      </View>

                      {/* Seat count */}
                      <Text style={[styles.tripSeatText, active && styles.tripSeatTextActive]}>
                        {bookedSeats}/{totalSeats} seats · {availableSeats} left
                      </Text>

                      {/* Progress bar */}
                      <View style={styles.progressBarWrap}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${trip.shuttleStatus === 'open' ? activationPct : fillPct}%` as any,
                              backgroundColor: active ? (c.isDark ? c.background : '#fff') : barColor,
                            },
                          ]}
                        />
                      </View>

                      {/* Message from API */}
                      {!!message && (
                        <Text style={[styles.tripMessage, active && styles.tripMessageActive]} numberOfLines={2}>
                          {message}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
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

          {/* Price summary — always 1 passenger (API contract) */}
          <View style={[gs, styles.priceSummary]}>
            <View style={styles.priceIcon}>
              <Ticket size={20} color={c.isDark ? c.background : c.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.priceSegLabel}>
                {route.path[safeFrom]?.name ?? route.from} → {route.path[safeTo]?.name ?? route.to}
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
            <ChevronRight size={16} color={c.inkSoft} />
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
                passengers: 1, // always 1
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
            {valid && !walletLow && shuttleServiceEnabled && <ArrowRight size={16} color={c.isDark ? c.background : c.white} />}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}
