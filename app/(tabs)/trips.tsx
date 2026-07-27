import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, RefreshControl, Animated, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Bus, Car, Bike as ScooterIcon, Package, Ticket, User, X, ChevronDown, Wifi } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { type TripType, type ShuttleDirection, shuttleStatusLabel, isShuttleTripUpcoming, formatCairoDateTime } from '@/constants/data';
import { useActiveSession } from '@/context/ActiveSessionContext';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { useTrips } from '@/src/hooks/shared/useTrips';
import { cancelBooking } from '@/src/api/shuttleService';
import { getSocket } from '@/src/api/socket';
import { CancelReasonSheet } from '@/components/shared/CancelReasonSheet';
import { UpcomingTripCard } from '@/components/shuttle/UpcomingTripCard';
import { AppLoader } from '@/components/ui/AppLoader';
import { useTabBar } from '@/context/TabBarContext';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

interface LivePatch {
  passengerCount?: number;
  status?: string;
}

const ROUTE_COLORS_LIGHT: Record<string, string> = {
  L01: '#d8ecf7', L02: '#d5f0e5', L03: '#e3daf5', L04: '#f5f0d3',
  CAR: '#fde8d8', SCOOTER: '#d8f5e8',
};
const ROUTE_COLORS_DARK: Record<string, string> = {
  L01: '#1a2a38', L02: '#1a2e26', L03: '#252038', L04: '#2e2a18',
  CAR: '#2e1e10', SCOOTER: '#0f2e1e',
};

const TYPE_ICONS: Record<TripType, React.ComponentType<{ size?: number; color?: string }>> = {
  shuttle: Bus,
  car: Car,
  scooter: ScooterIcon,
  delivery: Package,
};

function isActiveStatus(status: string): boolean {
  return ['active', 'boarding'].includes(status);
}

function isPendingStatus(status: string): boolean {
  return ['scheduled', 'upcoming', 'waiting_driver', 'driver_assigned'].includes(status);
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: Spacing.md, gap: Spacing.md },
    headerTitle: { fontSize: 26, fontWeight: Typography.weight.bold, color: c.ink, letterSpacing: -0.8, fontFamily: 'Inter_700Bold' },
    tabRow: { flexDirection: 'row', gap: Spacing.sm },
    tabBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 99, borderWidth: 1, borderColor: c.border, backgroundColor: c.white },
    tabBtnActive: { backgroundColor: c.ink, borderColor: c.ink },
    tabText: { fontSize: 12.5, fontWeight: Typography.weight.medium, color: c.inkSoft },
    tabTextActive: { color: c.isDark ? c.background : c.white },
    list: { paddingHorizontal: 20, gap: Spacing.md },
    loadingWrap: { alignItems: 'center', paddingTop: 60 },
    empty: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
    emptyIcon: { width: 72, height: 72, borderRadius: 28, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
    emptyTitle: { fontSize: Typography.size.md, fontWeight: Typography.weight.semibold, color: c.ink },
    emptySub: { fontSize: 13, color: c.inkSoft, textAlign: 'center', paddingHorizontal: Spacing.xxl, lineHeight: 20 },
    emptyBtn: { marginTop: Spacing.xs, paddingHorizontal: 28, paddingVertical: Spacing.md, borderRadius: Radius.lg, backgroundColor: c.ink },
    emptyBtnText: { color: c.isDark ? c.background : c.white, fontSize: 13, fontWeight: Typography.weight.semibold },
    tripCard: { borderRadius: Radius.xl, padding: Spacing.lg, overflow: 'hidden', backgroundColor: c.isDark ? c.surface ?? '#1c1c1e' : c.white },
    cardAccent: { position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: 60 },
    tripTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: 14 },
    codeBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
    tripName: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: c.ink },
    tripDate: { fontSize: 11.5, color: c.inkSoft, marginTop: 1 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: Spacing.xs, borderRadius: 99 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 11, fontWeight: Typography.weight.semibold },
    tripRoute: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 14 },
    tripStation: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    tripDot: { width: 8, height: 8, borderRadius: 4 },
    tripStationText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.medium, color: c.ink },
    tripLine: { flex: 1, height: 1, backgroundColor: c.silver, opacity: 0.7 },
    tripBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    tripMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    tripMetaText: { fontSize: 11.5, color: c.inkSoft },
    tripPrice: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: c.ink },
    typeBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.06)' },
    typeBadgeText: { fontSize: 10, fontWeight: Typography.weight.semibold, color: c.inkSoft },
    cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.md, borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.md, paddingVertical: 7, alignSelf: 'flex-start' },
    cancelBtnText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold },
    capacityWrap: { marginTop: Spacing.md, gap: 5 },
    capacityLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    capacityLabel: { fontSize: 11, color: c.inkSoft },
    capacityCount: { fontSize: 11, fontWeight: Typography.weight.semibold, color: c.inkSoft },
    capacityTrack: { height: 5, borderRadius: 99, backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', overflow: 'hidden' },
    capacityFill: { height: 5, borderRadius: 99 },
    loadMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: Spacing.xs, paddingVertical: Spacing.md },
    loadMoreText: { fontSize: 13, fontWeight: Typography.weight.semibold, color: c.inkSoft },
    liveIndicator: { position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center' },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#55c49a' },
  });
}

function StatusBadge({ status, activeLabel, pendingLabel, c }: {
  status: string;
  activeLabel: string;
  pendingLabel: string;
  c: ThemeColors;
}) {
  const styles = useMemo(() => makeStyles(c), [c]);
  if (isActiveStatus(status)) {
    return (
      <View style={[styles.statusBadge, { backgroundColor: 'rgba(85,196,154,0.14)' }]}>
        <View style={[styles.statusDot, { backgroundColor: '#55c49a' }]} />
        <Text style={[styles.statusText, { color: '#2d9e72' }]}>{activeLabel}</Text>
      </View>
    );
  }
  if (isPendingStatus(status)) {
    return (
      <View style={[styles.statusBadge, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
        <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />
        <Text style={[styles.statusText, { color: '#b97b10' }]}>{pendingLabel}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.statusBadge, { backgroundColor: c.mist }]}>
      <View style={[styles.statusDot, { backgroundColor: c.silver }]} />
      <Text style={[styles.statusText, { color: c.inkSoft }]}>{shuttleStatusLabel(status, 'en')}</Text>
    </View>
  );
}

function CapacityBar({ current, max, c, label }: { current: number; max: number; c: ThemeColors; label: string }) {
  const styles = useMemo(() => makeStyles(c), [c]);
  const pct = Math.min(100, Math.max(0, (current / max) * 100));
  const fillColor = pct >= 100 ? '#55c49a' : pct >= 50 ? '#4d9ef6' : '#f59e0b';
  return (
    <View style={styles.capacityWrap}>
      <View style={styles.capacityLabelRow}>
        <Text style={styles.capacityLabel}>{label}</Text>
        <Text style={styles.capacityCount}>{current} / {max}</Text>
      </View>
      <View style={styles.capacityTrack}>
        <View style={[styles.capacityFill, { width: `${pct}%` as any, backgroundColor: fillColor }]} />
      </View>
    </View>
  );
}

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const { tabBarHeight } = useTabBar();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const { session } = useActiveSession();
  const shuttleSession = session?.kind === 'shuttle' ? session : null;
  const { date: sessionDate, time: sessionTime } = shuttleSession
    ? formatCairoDateTime(shuttleSession.trip.departureTime)
    : { date: '', time: '' };
  const { colors: c, glassStyle: gs, t, language } = useTheme();
  const isAr = language === 'ar';
  const styles = useMemo(() => makeStyles(c), [c]);
  const routeColors = c.isDark ? ROUTE_COLORS_DARK : ROUTE_COLORS_LIGHT;

  const {
    upcomingTrips, pastTrips, loading, refresh, hasMore, loadMore,
    upcomingLoading, upcomingError, upcomingRetry,
  } = useTrips();
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelSheetId, setCancelSheetId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fadeAnims = useRef<Record<string, Animated.Value>>({}).current;
  const [liveUpdates, setLiveUpdates] = useState<Record<string, LivePatch>>({});
  // Persists across upcomingTrips re-renders so auto-nav only fires once per trip
  const autoNavigatedTrips = useRef<Set<string>>(new Set());

  const getFadeAnim = useCallback((id: string) => {
    if (!fadeAnims[id]) fadeAnims[id] = new Animated.Value(1);
    return fadeAnims[id];
  }, [fadeAnims]);

  // ── Real-time socket: join each upcoming trip's room, patch cards live ──────
  useEffect(() => {
    const tripIds = upcomingTrips
      .filter((t) => t.type === 'shuttle' && t.tripId != null)
      .map((t) => String(t.tripId));

    if (tripIds.length === 0) return;

    let cleanedUp = false;
    let cleanupFns: Array<() => void> = [];

    getSocket().then((socket) => {
      if (cleanedUp) return;

      tripIds.forEach((tid) => socket.emit('join:trip', { tripId: Number(tid) }));

      const statusHandler = (payload: {
        tripId: string | number;
        status?: string;
        passengerCount?: number;
      }) => {
        const key = String(payload.tripId);
        if (!tripIds.includes(key)) return;
        setLiveUpdates((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            ...(payload.status      !== undefined ? { status: payload.status.toLowerCase() }   : {}),
            ...(payload.passengerCount !== undefined ? { passengerCount: payload.passengerCount } : {}),
          },
        }));
      };

      // Auto-navigate when driver starts sending location (~20 min before departure).
      // Uses component-level ref so the guard survives upcomingTrips re-renders.
      const locationHandler = (payload: { tripId: string | number }) => {
        const key = String(payload.tripId);
        if (!tripIds.includes(key) || autoNavigatedTrips.current.has(key)) return;
        autoNavigatedTrips.current.add(key);
        router.push(`/trip-detail?id=${key}` as any);
      };

      // Re-join trip rooms after socket reconnects
      const reconnectHandler = () => {
        tripIds.forEach((tid) => socket.emit('join:trip', { tripId: Number(tid) }));
      };

      socket.on('shuttle:trip:status', statusHandler);
      socket.on('shuttle:driver:location', locationHandler);
      socket.on('connect', reconnectHandler);

      cleanupFns = [
        () => socket.off('shuttle:trip:status', statusHandler),
        () => socket.off('shuttle:driver:location', locationHandler),
        () => socket.off('connect', reconnectHandler),
        () => tripIds.forEach((tid) => socket.emit('leave:trip', { tripId: tid })),
      ];
    }).catch(() => {});

    return () => {
      cleanedUp = true;
      cleanupFns.forEach((fn) => fn());
    };
  }, [upcomingTrips]);

  // ── Fallback poll every 60 s — catches any socket gap ──────────────────────
  useEffect(() => {
    const interval = setInterval(() => { refresh(); }, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.selectionAsync();
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    await loadMore();
    setLoadingMore(false);
  }, [loadMore]);

  // cancelSheetId holds the bookingId (not tripId) so the API call is correct
  const handleCancelPress = (bookingId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCancelSheetId(bookingId);
  };

  const doCancel = async (reason: string) => {
    const bookingId = cancelSheetId;
    if (!bookingId) return;
    setCancellingId(bookingId);
    setCancelSheetId(null);

    const anim = getFadeAnim(bookingId);
    try {
      // §11.4, §21.3: DELETE /shuttle/bookings/:id — preferred self-cancel
      // endpoint, replaces the deprecated PATCH /bookings/:id/cancel.
      const result = await cancelBooking(bookingId);
      if (result?.refunded && result.refundAmount > 0) {
        Alert.alert(t('booking_cancelled_title'), t('ride_refund_msg').replace('{amount}', String(result.refundAmount)));
      }
      Animated.timing(anim, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }).start(async () => {
        await refresh();
        anim.setValue(1);
      });
    } catch (e: any) {
      Alert.alert(
        t('error'),
        e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? t('cancel_booking_failed'),
      );
    } finally {
      setCancellingId(null);
    }
  };

  // ── Dynamic date filter: drop upcoming entries whose departure has already passed ──
  const now = Date.now();
  const filteredUpcoming = upcomingTrips.filter((t) => {
    if (!t.departureIso) return true; // no ISO → keep (unknown future)
    const ms = new Date(t.departureIso).getTime();
    return isNaN(ms) || ms >= now - 60 * 60 * 1000; // keep if future or within 1 h grace
  });

  // Build the live card from ActiveSession — real data only, no synthetic values.
  const upcoming = shuttleSession
    ? [{
        id: 'live',
        type: 'shuttle' as TripType,
        routeCode: '',
        routeName: shuttleSession.trip.route.name,
        routeNameAr: shuttleSession.trip.route.nameAr ?? null,
        from: shuttleSession.boardingStation?.name ?? shuttleSession.trip.route.fromLocation,
        fromAr: shuttleSession.boardingStation?.nameAr ?? null,
        to: shuttleSession.trip.route.toLocation,
        toAr: null,
        date: sessionDate,
        time: sessionTime,
        departureIso: String(shuttleSession.trip.departureTime),
        seat: '—',
        status: shuttleSession.trip.status,
        price: shuttleSession.totalPrice,
        tripId: shuttleSession.trip.id,
        direction: shuttleSession.trip.direction as ShuttleDirection | undefined,
        // Fields required by the trip card renderer — sourced from ActiveSession contract.
        bookingId: String(shuttleSession.bookingId),
        totalSeats: shuttleSession.trip.totalSeats,
        passengerCount: shuttleSession.trip.totalSeats - shuttleSession.trip.availableSeats,
      }, ...filteredUpcoming]
    : filteredUpcoming;

  const trips = tab === 'upcoming' ? upcoming : pastTrips;

  const activeLabel  = isAr ? t('trip_status_active')  : `${t('trip_status_active')} / ${t('trip_status_active')}`;
  const pendingLabel = isAr ? t('trip_status_pending') : `${t('trip_status_pending')} / قيد الانتظار`;

  // Isolated to the shuttle upcoming fetch — a rides/history failure never affects these.
  const showUpcomingLoading = tab === 'upcoming' && upcomingLoading && upcomingTrips.length === 0 && !upcomingError;
  const showUpcomingError   = tab === 'upcoming' && !!upcomingError && !upcomingLoading && upcomingTrips.length === 0;

  return (
    <LinearGradient colors={c.luxeSoftGrad} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <Text style={styles.headerTitle}>{t('my_trips')}</Text>
        <View style={styles.tabRow}>
          {(['upcoming', 'past'] as const).map((tp) => (
            <TouchableOpacity
              key={tp}
              style={[styles.tabBtn, tab === tp && styles.tabBtnActive]}
              onPress={() => { setTab(tp); Haptics.selectionAsync(); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, tab === tp && styles.tabTextActive]}>
                {tp === 'upcoming' ? t('upcoming') : t('past')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loading}
            onRefresh={onRefresh}
            tintColor={c.ink}
            colors={[c.ink]}
          />
        }
      >
        {showUpcomingLoading ? (
          <View style={styles.loadingWrap}>
            <AppLoader size={80} />
          </View>
        ) : showUpcomingError ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ticket size={30} color={c.silver} />
            </View>
            <Text style={styles.emptyTitle}>{t('error')}</Text>
            <Text style={styles.emptySub}>{upcomingError}</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={upcomingRetry} activeOpacity={0.88}>
              <Text style={styles.emptyBtnText}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
        <>
        {trips.length === 0 && (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ticket size={30} color={c.silver} />
            </View>
            <Text style={styles.emptyTitle}>
              {tab === 'upcoming' ? t('no_trips').replace('{tab}', t('upcoming')) : t('no_trips').replace('{tab}', t('past'))}
            </Text>
            <Text style={styles.emptySub}>{t('trips_here')}</Text>
            {tab === 'upcoming' && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/' as any);
                }}
                activeOpacity={0.88}
              >
                <Text style={styles.emptyBtnText}>{t('browse_routes')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {trips.map((trip) => {
          // ── Strict ghost-trip guard ─────────────────────────────────────────
          // A valid trip must have a non-empty, non-placeholder route name AND
          // at least one real station name — anything else is a corrupted object.
          const hasValidRoute =
            (trip.routeName && trip.routeName !== '—') || !!trip.routeNameAr;
          const hasValidStations =
            (trip.from && trip.from !== '—') || !!trip.fromAr;
          if (!trip || !hasValidRoute || !hasValidStations) return null;

          const patch = trip.tripId ? (liveUpdates[String(trip.tripId)] ?? {}) : {};
          // Widened to include 'pending': patch.status comes from the live socket
          // payload (untyped string) and can carry raw backend values not present
          // in the ShuttleTripStatus union used for `trip.status`.
          const effectiveStatus   = (patch.status ?? trip.status) as typeof trip.status | 'pending';
          const effectivePassCount =
            patch.passengerCount !== undefined ? patch.passengerCount : trip.passengerCount;
          const isLive = !!patch.status || patch.passengerCount !== undefined;

          const TripTypeIcon = TYPE_ICONS[trip.type];

          // ── Cancel button: gated on the data layer's canCancel (backend field, ──
          // with a status-based fallback applied in useTrips.ts when absent) ──
          const isUpcoming =
            trip.id !== 'live' &&
            hasValidRoute &&
            !!(trip.bookingId || trip.id) &&
            !!trip.canCancel;

          // Use bookingId as the stable key for cancel state and fade animation
          const bookingKey = trip.bookingId || trip.id;
          const isCancelling = cancellingId === bookingKey;
          const fadeAnim = getFadeAnim(bookingKey);

          const showCapacity =
            tab === 'upcoming' &&
            trip.type === 'shuttle' &&
            typeof effectivePassCount === 'number' &&
            typeof trip.totalSeats === 'number' &&
            trip.totalSeats > 0;

          if (tab === 'upcoming') {
            return (
              <Animated.View key={trip.id} style={{ opacity: fadeAnim }}>
                <UpcomingTripCard
                  trip={trip}
                  tripStatus={effectiveStatus}
                  passengerCount={effectivePassCount}
                  isLive={isLive}
                  canCancel={isUpcoming}
                  isCancelling={isCancelling}
                  accentColor={routeColors[trip.routeCode] ?? c.mist}
                  onPress={() => {
                    if (trip.id === 'live') { router.push('/ticket'); }
                    else if (trip.bookingId) { router.push(`/trip-detail?id=${trip.bookingId}` as any); }
                    Haptics.selectionAsync();
                  }}
                  onCancelPress={() => handleCancelPress(bookingKey)}
                />
              </Animated.View>
            );
          }

          return (
            <Animated.View key={trip.id} style={{ opacity: fadeAnim }}>
              <TouchableOpacity
                style={[gs, styles.tripCard]}
                onPress={() => {
                  if (trip.id === 'live') { router.push('/ticket'); }
                  else if (trip.tripId) { router.push(`/trip-detail?id=${trip.tripId}` as any); }
                  Haptics.selectionAsync();
                }}
                activeOpacity={0.9}
              >
                <View style={[styles.cardAccent, { backgroundColor: routeColors[trip.routeCode] ?? c.mist }]} />

                <View style={styles.tripTop}>
                  <View style={styles.codeBox}>
                    <TripTypeIcon size={18} color={c.isDark ? c.background : c.white} />
                    {isLive && (
                      <View style={styles.liveIndicator}>
                        <View style={styles.liveDot} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tripName}>
                      {isAr ? (trip.routeNameAr ?? trip.routeName) : trip.routeName}
                    </Text>
                    <Text style={styles.tripDate}>{trip.date} · {trip.time}</Text>
                  </View>
                  <StatusBadge
                    status={effectiveStatus}
                    activeLabel={t('trip_status_active') + (isAr ? '' : ' / نشط')}
                    pendingLabel={t('trip_status_pending') + (isAr ? '' : ' / قيد الانتظار')}
                    c={c}
                  />
                </View>

                <View style={styles.tripRoute}>
                  <View style={styles.tripStation}>
                    <View style={[styles.tripDot, { backgroundColor: c.ink }]} />
                    <Text style={styles.tripStationText} numberOfLines={1}>
                      {isAr ? (trip.fromAr ?? trip.from) : trip.from}
                    </Text>
                  </View>
                  <View style={styles.tripLine} />
                  <View style={styles.tripStation}>
                    <View style={[styles.tripDot, { backgroundColor: c.accentMint }]} />
                    <Text style={styles.tripStationText} numberOfLines={1}>
                      {isAr ? (trip.toAr ?? trip.to) : trip.to}
                    </Text>
                  </View>
                  {!!trip.direction && (
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>
                        {trip.direction === 'outbound' ? t('shuttle_direction_outbound') : t('shuttle_direction_return')}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.tripBottom}>
                  <View style={styles.tripMeta}>
                    <View style={styles.typeBadge}>
                      <TripTypeIcon size={10} color={c.inkSoft} />
                      <Text style={styles.typeBadgeText}>{t(`trip_type_${trip.type}` as any)}</Text>
                    </View>
                    {trip.seat !== '—' && (
                      <>
                        <User size={11} color={c.inkSoft} />
                        <Text style={styles.tripMetaText}>{t('seat')} {trip.seat}</Text>
                      </>
                    )}
                  </View>
                  <Text style={styles.tripPrice}>{trip.price} {t('egp')}</Text>
                </View>

                {showCapacity && (
                  <CapacityBar
                    current={effectivePassCount!}
                    max={trip.totalSeats!}
                    c={c}
                    label={t('passengers')}
                  />
                )}

                {isUpcoming && (
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: c.badge, opacity: isCancelling ? 0.5 : 1 }]}
                    onPress={(e) => { (e as any).stopPropagation?.(); handleCancelPress(bookingKey); }}
                    disabled={isCancelling}
                    activeOpacity={0.7}
                  >
                    <X size={12} color={c.badge} strokeWidth={2.5} />
                    <Text style={[styles.cancelBtnText, { color: c.badge }]}>
                      {isCancelling ? t('cancel_trip') + '...' : t('cancel_trip')}
                    </Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
        </>
        )}

        {hasMore && tab === 'past' && (
          <TouchableOpacity
            style={styles.loadMoreBtn}
            onPress={handleLoadMore}
            disabled={loadingMore}
            activeOpacity={0.7}
          >
            <ChevronDown size={16} color={c.inkSoft} />
            <Text style={styles.loadMoreText}>
              {loadingMore ? t('loading') : t('load_more')}
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <CancelReasonSheet
        visible={cancelSheetId !== null}
        mode="shuttle"
        onClose={() => setCancelSheetId(null)}
        onConfirm={doCancel}
      />
    </LinearGradient>
  );
}
