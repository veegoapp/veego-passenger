import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, RefreshControl, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { showAppAlert } from '@/components/shared/AppAlertHost';
import { Ticket, ChevronDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { type TripType, type ShuttleDirection, formatCairoDateTime } from '@/constants/data';
import { useActiveSession } from '@/context/ActiveSessionContext';
import { useTheme } from '@/context/ThemeContext';
import { useTrips } from '@/src/hooks/shared/useTrips';
import { cancelBooking } from '@/src/api/shuttleService';
import { getSocket } from '@/src/api/socket';
import { SOCKET_EVENTS } from '@/constants/socketEvents';
import { CancelReasonSheet } from '@/components/shared/CancelReasonSheet';
import { UpcomingTripCard } from '@/components/shuttle/UpcomingTripCard';
import { HistoryTripCard } from '@/components/shared/HistoryTripCard';
import { AppLoader } from '@/components/ui/AppLoader';
import { useTabBar } from '@/context/TabBarContext';
import { Spacing } from '@/constants/spacing';
import { useSplitColors, type SplitColors } from '@/constants/splitTheme';

interface LivePatch {
  passengerCount?: number;
  status?: string;
}

// ── C · Split Panel — fixed palette, independent of the app's light/dark theme.

function makeStyles(S: SplitColors) {
  return StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: Spacing.md, gap: Spacing.md },
    headerTitle: { fontSize: 24, fontWeight: '800', color: S.ink, letterSpacing: -0.7 },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: S.cap,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: Spacing.xs,
    },
    list: { paddingHorizontal: 20, gap: Spacing.md },
    loadingWrap: { alignItems: 'center', paddingTop: 32, paddingBottom: Spacing.md },
    empty: { alignItems: 'center', paddingTop: 32, paddingBottom: Spacing.md, gap: Spacing.md },
    emptyIcon: { width: 64, height: 64, borderRadius: 24, backgroundColor: S.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: S.ink },
    emptySub: { fontSize: 13, color: S.inkSoft, textAlign: 'center', paddingHorizontal: Spacing.xxl, lineHeight: 20 },
    emptyBtn: { marginTop: Spacing.xs, paddingHorizontal: 28, paddingVertical: Spacing.md, borderRadius: 16, backgroundColor: S.panel },
    emptyBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    loadMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: Spacing.xs, paddingVertical: Spacing.md },
    loadMoreText: { fontSize: 13, fontWeight: '700', color: S.inkSoft },
    sectionDivider: { height: 1, backgroundColor: '#E2E5E8', marginVertical: Spacing.sm },
  });
}

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const { tabBarHeight } = useTabBar();
  const { session } = useActiveSession();
  const { t, language } = useTheme();
  const dateLocale = language === 'ar' ? 'ar-EG' : 'en-US';
  const shuttleSession = session?.kind === 'shuttle' ? session : null;
  const { date: sessionDate, time: sessionTime } = shuttleSession
    ? formatCairoDateTime(shuttleSession.trip.departureTime, dateLocale)
    : { date: '', time: '' };
  const S = useSplitColors();
  const styles = useMemo(() => makeStyles(S), [S]);

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

      tripIds.forEach((tid) => socket.emit(SOCKET_EVENTS.JOIN_TRIP, { tripId: Number(tid) }));

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
        tripIds.forEach((tid) => socket.emit(SOCKET_EVENTS.JOIN_TRIP, { tripId: Number(tid) }));
      };

      socket.on(SOCKET_EVENTS.SHUTTLE_TRIP_STATUS, statusHandler);
      socket.on('shuttle:driver:location', locationHandler);
      socket.on('connect', reconnectHandler);

      cleanupFns = [
        () => socket.off(SOCKET_EVENTS.SHUTTLE_TRIP_STATUS, statusHandler),
        () => socket.off('shuttle:driver:location', locationHandler),
        () => socket.off('connect', reconnectHandler),
        // D5-2: backend requires a numeric tripId (same as the JOIN_TRIP emits
        // above) — tripIds holds strings, so this must convert too or the
        // backend silently no-ops the leave and the room membership leaks.
        () => tripIds.forEach((tid) => socket.emit('leave:trip', { tripId: Number(tid) })),
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
        showAppAlert(t('booking_cancelled_title'), t('ride_refund_msg').replace('{amount}', String(result.refundAmount)));
      } else if (result?.debtCreated && result.debtCreated > 0) {
        // A repeat late cancellation (<12h before departure) creates a real
        // cash debt — this used to reach the passenger only later, as a
        // blocked future booking, with no explanation at cancel time.
        showAppAlert(t('late_cancellation_debt_title'), t('late_cancellation_debt_msg').replace('{amount}', String(result.debtCreated)));
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
      showAppAlert(
        t('error'),
        e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? t('cancel_booking_failed'),
      );
    } finally {
      setCancellingId(null);
    }
  };

  // ── Dynamic date filter: drop upcoming entries whose departure has already passed ──
  // Memoized on upcomingTrips — this was re-filtering (with a fresh `new Date()`
  // parse per trip) on every render regardless of whether the trip list itself
  // had changed. Recomputes whenever the list changes (e.g. the next poll
  // refresh), which is precise enough for a 1h grace window.
  const filteredUpcoming = useMemo(() => {
    const now = Date.now();
    return upcomingTrips.filter((t) => {
      if (!t.departureIso) return true; // no ISO → keep (unknown future)
      const ms = new Date(t.departureIso).getTime();
      return isNaN(ms) || ms >= now - 60 * 60 * 1000; // keep if future or within 1 h grace
    });
  }, [upcomingTrips]);

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

  // Section-level loading/error states — independent of each other
  const showUpcomingLoading = upcomingLoading && upcomingTrips.length === 0 && !upcomingError;
  const showUpcomingError   = !!upcomingError && !upcomingLoading && upcomingTrips.length === 0;
  const showHistoryLoading  = loading && pastTrips.length === 0 && !error;
  const showHistoryError    = !!error && !loading && pastTrips.length === 0;

  // Single page-level loader: both sections still fetching and have no data yet.
  // Prevents two spinners appearing simultaneously on first load.
  const showPageLoading = showUpcomingLoading && showHistoryLoading;

  return (
    <View style={{ flex: 1, backgroundColor: S.bg }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <Text style={styles.headerTitle}>{t('my_trips')}</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || loading}
            onRefresh={onRefresh}
            tintColor={S.ink}
            colors={[S.panel]}
          />
        }
      >
        {/* ── Single page-level loader (first load only) ─────────────────── */}
        {showPageLoading && (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
            <AppLoader size={80} />
          </View>
        )}

        {/* ── Upcoming section ───────────────────────────────────────────── */}
        {!showPageLoading && <Text style={styles.sectionTitle}>{t('upcoming')}</Text>}

        {!showPageLoading && showUpcomingLoading ? (
          null
        ) : !showPageLoading && showUpcomingError ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ticket size={28} color={S.cap} />
            </View>
            <Text style={styles.emptyTitle}>{t('error')}</Text>
            <Text style={styles.emptySub}>{upcomingError}</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={upcomingRetry} activeOpacity={0.88}>
              <Text style={styles.emptyBtnText}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : upcoming.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ticket size={28} color={S.cap} />
            </View>
            <Text style={styles.emptyTitle}>
              {t('no_trips').replace('{tab}', t('upcoming'))}
            </Text>
            <Text style={styles.emptySub}>{t('trips_here')}</Text>
          </View>
        ) : (
          <>
            {upcoming.map((trip) => {
              // ── Ghost-trip guard ────────────────────────────────────────────
              // Route name is a genuine invalid-data signal. A missing boarding
              // station is not — a paid booking made without picking a station
              // is a real, valid trip and used to vanish from this list entirely.
              const hasValidRoute =
                (trip.routeName && trip.routeName !== '—') || !!trip.routeNameAr;
              if (!trip || !hasValidRoute) return null;

              const patch = trip.tripId ? (liveUpdates[String(trip.tripId)] ?? {}) : {};
              const effectiveStatus   = (patch.status ?? trip.status) as typeof trip.status | 'pending';
              const effectivePassCount =
                patch.passengerCount !== undefined ? patch.passengerCount : trip.passengerCount;
              const isLive = !!patch.status || patch.passengerCount !== undefined;

              // A live cancellation used to only patch the status badge — the
              // card stayed in Upcoming with an active Cancel button that then
              // failed with "already cancelled." A full refetch will drop it
              // from this list properly; until then, stop rendering it here.
              if (effectiveStatus === 'cancelled') return null;

              const isUpcoming =
                trip.id !== 'live' &&
                hasValidRoute &&
                !!(trip.bookingId || trip.id) &&
                !!trip.canCancel;

              const bookingKey = trip.bookingId || trip.id;
              const isCancelling = cancellingId === bookingKey;
              const fadeAnim = getFadeAnim(bookingKey);

              return (
                <Animated.View key={trip.id} style={{ opacity: fadeAnim }}>
                  <UpcomingTripCard
                    trip={trip}
                    tripStatus={effectiveStatus}
                    passengerCount={effectivePassCount}
                    isLive={isLive}
                    canCancel={isUpcoming}
                    isCancelling={isCancelling}
                    accentColor={S.surfaceMuted}
                    onPress={() => {
                      if (trip.id === 'live') { router.push('/ticket'); }
                      else if (trip.bookingId) { router.push(`/trip-detail?id=${trip.bookingId}` as any); }
                      Haptics.selectionAsync();
                    }}
                    onCancelPress={() => handleCancelPress(bookingKey)}
                  />
                </Animated.View>
              );
            })}
          </>
        )}

        {/* ── Divider + Past section (hidden while full-page loader is active) ── */}
        {!showPageLoading && (
          <>
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionTitle}>{t('past')}</Text>
          </>
        )}

        {!showPageLoading && (showHistoryLoading ? (
          <View style={styles.loadingWrap}>
            <AppLoader size={80} />
          </View>
        ) : showHistoryError ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ticket size={28} color={S.cap} />
            </View>
            <Text style={styles.emptyTitle}>{t('error')}</Text>
            <Text style={styles.emptySub}>{error}</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={retry} activeOpacity={0.88}>
              <Text style={styles.emptyBtnText}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : pastTrips.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ticket size={28} color={S.cap} />
            </View>
            <Text style={styles.emptyTitle}>
              {t('no_trips').replace('{tab}', t('past'))}
            </Text>
            <Text style={styles.emptySub}>{t('trips_here')}</Text>
          </View>
        ) : (
          <>
            {pastTrips.map((trip) => {
              // ── Ghost-trip guard ────────────────────────────────────────────
              // Route name is a genuine invalid-data signal. A missing boarding
              // station is not — a paid booking made without picking a station
              // is a real, valid trip and used to vanish from this list entirely.
              const hasValidRoute =
                (trip.routeName && trip.routeName !== '—') || !!trip.routeNameAr;
              if (!trip || !hasValidRoute) return null;

              const fadeAnim = getFadeAnim(trip.bookingId || trip.id);

              // Shuttle history opens by tripId; on-demand (car/scooter/delivery) rides
              // only carry a bookingId — either one is enough to open the detail screen.
              const canOpenHistoryDetail = trip.id === 'live' || !!trip.tripId || !!trip.bookingId;

              return (
                <Animated.View key={trip.id} style={{ opacity: fadeAnim }}>
                  <HistoryTripCard
                    trip={trip}
                    accentColor={S.surfaceMuted}
                    onPress={canOpenHistoryDetail ? () => {
                      if (trip.id === 'live') { router.push('/ticket'); }
                      else if (trip.tripId) { router.push(`/trip-detail?id=${trip.tripId}` as any); }
                      else if (trip.bookingId) { router.push(`/trip-detail?id=${trip.bookingId}` as any); }
                      Haptics.selectionAsync();
                    } : undefined}
                  />
                </Animated.View>
              );
            })}
          </>
        ))}

        {/* ── Load more (past) ───────────────────────────────────────────── */}
        {hasMore && (
          <TouchableOpacity
            style={styles.loadMoreBtn}
            onPress={handleLoadMore}
            disabled={loadingMore}
            activeOpacity={0.7}
          >
            <ChevronDown size={16} color={S.inkSoft} />
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
    </View>
  );
}
