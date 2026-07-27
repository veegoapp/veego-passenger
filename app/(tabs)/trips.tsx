import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, RefreshControl, Animated, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Ticket, ChevronDown, Wifi } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { type TripType, type ShuttleDirection, isShuttleTripUpcoming, formatCairoDateTime } from '@/constants/data';
import { useActiveSession } from '@/context/ActiveSessionContext';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { useTrips } from '@/src/hooks/shared/useTrips';
import { cancelBooking } from '@/src/api/shuttleService';
import { getSocket } from '@/src/api/socket';
import { CancelReasonSheet } from '@/components/shared/CancelReasonSheet';
import { UpcomingTripCard } from '@/components/shuttle/UpcomingTripCard';
import { HistoryTripCard } from '@/components/shared/HistoryTripCard';
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
    loadMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: Spacing.xs, paddingVertical: Spacing.md },
    loadMoreText: { fontSize: 13, fontWeight: Typography.weight.semibold, color: c.inkSoft },
  });
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
  const { colors: c, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const routeColors = c.isDark ? ROUTE_COLORS_DARK : ROUTE_COLORS_LIGHT;

  const {
    upcomingTrips, pastTrips, loading, error, refresh, hasMore, loadMore, retry,
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

  // Isolated to the shuttle upcoming fetch — a rides/history failure never affects these.
  const showUpcomingLoading = tab === 'upcoming' && upcomingLoading && upcomingTrips.length === 0 && !upcomingError;
  const showUpcomingError   = tab === 'upcoming' && !!upcomingError && !upcomingLoading && upcomingTrips.length === 0;

  // History depends on both the shuttle and rides fetches, so the combined loading/error is correct here.
  const showHistoryLoading = tab === 'past' && loading && pastTrips.length === 0 && !error;
  const showHistoryError   = tab === 'past' && !!error && !loading && pastTrips.length === 0;

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
        ) : showHistoryLoading ? (
          <View style={styles.loadingWrap}>
            <AppLoader size={80} />
          </View>
        ) : showHistoryError ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ticket size={30} color={c.silver} />
            </View>
            <Text style={styles.emptyTitle}>{t('error')}</Text>
            <Text style={styles.emptySub}>{error}</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={retry} activeOpacity={0.88}>
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

          // Ride history items have no tripId (no detail screen to open) — the card stays non-clickable.
          const canOpenHistoryDetail = trip.id === 'live' || !!trip.tripId;

          return (
            <Animated.View key={trip.id} style={{ opacity: fadeAnim }}>
              <HistoryTripCard
                trip={trip}
                accentColor={routeColors[trip.routeCode] ?? c.mist}
                onPress={canOpenHistoryDetail ? () => {
                  if (trip.id === 'live') { router.push('/ticket'); }
                  else if (trip.tripId) { router.push(`/trip-detail?id=${trip.tripId}` as any); }
                  Haptics.selectionAsync();
                } : undefined}
              />
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
