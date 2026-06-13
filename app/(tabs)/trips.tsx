// TODO: Provide Trip Action Endpoints
// - GET  /users/me/bookings        → getUpcomingTrips (paginated shuttle bookings)
// - PATCH /bookings/:id/cancel     → cancelBooking (frees seat slot, triggers re-fetch)
// - GET  /trips/:id/capacity       → getTripLiveCapacity (passengerCount / totalSeats)

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, RefreshControl, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Bus, Car, Bike as ScooterIcon, Ticket, User, X, ChevronDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { type TripType, shuttleStatusLabel, isShuttleTripUpcoming } from '@/constants/data';
import { useBooking } from '@/context/BookingContext';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { useTrips } from '@/src/hooks/useTrips';
import api from '@/src/api/client';
import { CancelReasonSheet } from '@/components/shared/CancelReasonSheet';

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
};

function isActiveStatus(status: string): boolean {
  return ['active', 'boarding'].includes(status);
}

function isPendingStatus(status: string): boolean {
  return ['scheduled', 'upcoming', 'waiting_driver', 'driver_assigned'].includes(status);
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
    headerTitle: { fontSize: 26, fontWeight: '700', color: c.ink, letterSpacing: -0.8, fontFamily: 'Inter_700Bold' },
    tabRow: { flexDirection: 'row', gap: 8 },
    tabBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 99, borderWidth: 1, borderColor: c.border, backgroundColor: c.white },
    tabBtnActive: { backgroundColor: c.ink, borderColor: c.ink },
    tabText: { fontSize: 12.5, fontWeight: '500', color: c.inkSoft },
    tabTextActive: { color: c.isDark ? c.background : c.white },
    list: { paddingHorizontal: 20, gap: 12 },
    empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
    emptyIcon: { width: 72, height: 72, borderRadius: 28, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: c.ink },
    emptySub: { fontSize: 13, color: c.inkSoft, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
    emptyBtn: { marginTop: 4, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 16, backgroundColor: c.ink },
    emptyBtnText: { color: c.isDark ? c.background : c.white, fontSize: 13, fontWeight: '600' },
    tripCard: { borderRadius: 24, padding: 16, overflow: 'hidden', backgroundColor: c.white },
    cardAccent: { position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: 60 },
    tripTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    codeBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
    tripName: { fontSize: 14, fontWeight: '600', color: c.ink },
    tripDate: { fontSize: 11.5, color: c.inkSoft, marginTop: 1 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 11, fontWeight: '600' },
    tripRoute: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    tripStation: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    tripDot: { width: 8, height: 8, borderRadius: 4 },
    tripStationText: { fontSize: 12, fontWeight: '500', color: c.ink },
    tripLine: { flex: 1, height: 1, backgroundColor: c.silver, opacity: 0.7 },
    tripBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    tripMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    tripMetaText: { fontSize: 11.5, color: c.inkSoft },
    tripPrice: { fontSize: 14, fontWeight: '600', color: c.ink },
    typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.06)' },
    typeBadgeText: { fontSize: 10, fontWeight: '600', color: c.inkSoft },
    cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start' },
    cancelBtnText: { fontSize: 12, fontWeight: '600' },
    capacityWrap: { marginTop: 12, gap: 5 },
    capacityLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    capacityLabel: { fontSize: 11, color: c.inkSoft },
    capacityCount: { fontSize: 11, fontWeight: '600', color: c.inkSoft },
    capacityTrack: { height: 5, borderRadius: 99, backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', overflow: 'hidden' },
    capacityFill: { height: 5, borderRadius: 99 },
    loadMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, paddingVertical: 12 },
    loadMoreText: { fontSize: 13, fontWeight: '600', color: c.inkSoft },
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

function CapacityBar({ current, max, c }: { current: number; max: number; c: ThemeColors }) {
  const styles = useMemo(() => makeStyles(c), [c]);
  const pct = Math.min(100, Math.max(0, (current / max) * 100));
  const fillColor = pct >= 100 ? '#55c49a' : pct >= 50 ? '#4d9ef6' : '#f59e0b';
  return (
    <View style={styles.capacityWrap}>
      <View style={styles.capacityLabelRow}>
        <Text style={styles.capacityLabel}>Passengers</Text>
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
  const top = Platform.OS === 'web' ? 60 : insets.top;
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const { activeBooking } = useBooking();
  const { colors: c, glassStyle: gs, t, language } = useTheme();
  const isAr = language === 'ar';
  const styles = useMemo(() => makeStyles(c), [c]);
  const routeColors = c.isDark ? ROUTE_COLORS_DARK : ROUTE_COLORS_LIGHT;

  const { upcomingTrips, pastTrips, loading, refresh, hasMore, loadMore } = useTrips();
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelSheetId, setCancelSheetId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fadeAnims = useRef<Record<string, Animated.Value>>({}).current;

  const getFadeAnim = useCallback((id: string) => {
    if (!fadeAnims[id]) fadeAnims[id] = new Animated.Value(1);
    return fadeAnims[id];
  }, [fadeAnims]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    await loadMore();
    setLoadingMore(false);
  }, [loadMore]);

  const handleCancelPress = (tripId: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCancelSheetId(tripId);
  };

  const doCancel = async (reason: string) => {
    const tripId = cancelSheetId;
    if (!tripId) return;
    setCancellingId(tripId);
    setCancelSheetId(null);

    const anim = getFadeAnim(tripId);
    try {
      await api.patch(`/bookings/${tripId}/cancel`, reason ? { reason } : undefined);
      Animated.timing(anim, {
        toValue: 0,
        duration: 320,
        useNativeDriver: Platform.OS !== 'web',
      }).start(async () => {
        await refresh();
        anim.setValue(1);
      });
    } catch {
    } finally {
      setCancellingId(null);
    }
  };

  const upcoming = activeBooking
    ? [{
        id: 'live',
        type: 'shuttle' as TripType,
        routeCode: activeBooking.route.code,
        routeName: activeBooking.route.name,
        from: activeBooking.route.path[activeBooking.fromIdx].name,
        to: activeBooking.route.path[activeBooking.toIdx].name,
        date: activeBooking.date, time: activeBooking.time,
        departureIso: '',
        seat: 'B4',
        status: 'upcoming' as const, price: activeBooking.price,
        tripId: null,
      }, ...upcomingTrips]
    : upcomingTrips;

  const trips = tab === 'upcoming' ? upcoming : pastTrips;

  const activeLabel  = isAr ? t('trip_status_active')  : `${t('trip_status_active')} / ${t('trip_status_active')}`;
  const pendingLabel = isAr ? t('trip_status_pending') : `${t('trip_status_pending')} / قيد الانتظار`;

  return (
    <LinearGradient colors={c.luxeSoftGrad} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <Text style={styles.headerTitle}>{t('my_trips')}</Text>
        <View style={styles.tabRow}>
          {(['upcoming', 'past'] as const).map((tp) => (
            <TouchableOpacity
              key={tp}
              style={[styles.tabBtn, tab === tp && styles.tabBtnActive]}
              onPress={() => { setTab(tp); if (Platform.OS !== 'web') Haptics.selectionAsync(); }}
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
        contentContainerStyle={styles.list}
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
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
          if (!trip.routeName) return null;

          const TripTypeIcon = TYPE_ICONS[trip.type];
          const isUpcoming = isShuttleTripUpcoming(trip.status) && trip.id !== 'live';
          const isCancelling = cancellingId === trip.id;
          const fadeAnim = getFadeAnim(trip.id);

          const showCapacity =
            tab === 'upcoming' &&
            trip.type === 'shuttle' &&
            typeof trip.passengerCount === 'number' &&
            typeof trip.totalSeats === 'number' &&
            trip.totalSeats > 0;

          return (
            <Animated.View key={trip.id} style={{ opacity: fadeAnim }}>
              <TouchableOpacity
                style={[gs, styles.tripCard]}
                onPress={() => {
                  if (trip.id === 'live') { router.push('/ticket'); }
                  else if (trip.tripId) { router.push(`/trip-detail?id=${trip.tripId}` as any); }
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                }}
                activeOpacity={0.9}
              >
                <View style={[styles.cardAccent, { backgroundColor: routeColors[trip.routeCode] ?? c.mist }]} />

                <View style={styles.tripTop}>
                  <View style={styles.codeBox}>
                    <TripTypeIcon size={18} color={c.isDark ? c.background : c.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tripName}>{trip.routeName}</Text>
                    <Text style={styles.tripDate}>{trip.date} · {trip.time}</Text>
                  </View>
                  <StatusBadge
                    status={trip.status}
                    activeLabel={t('trip_status_active') + (isAr ? '' : ' / نشط')}
                    pendingLabel={t('trip_status_pending') + (isAr ? '' : ' / قيد الانتظار')}
                    c={c}
                  />
                </View>

                <View style={styles.tripRoute}>
                  <View style={styles.tripStation}>
                    <View style={[styles.tripDot, { backgroundColor: c.ink }]} />
                    <Text style={styles.tripStationText} numberOfLines={1}>{trip.from}</Text>
                  </View>
                  <View style={styles.tripLine} />
                  <View style={styles.tripStation}>
                    <View style={[styles.tripDot, { backgroundColor: c.accentMint }]} />
                    <Text style={styles.tripStationText} numberOfLines={1}>{trip.to}</Text>
                  </View>
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
                    current={trip.passengerCount!}
                    max={trip.totalSeats!}
                    c={c}
                  />
                )}

                {isUpcoming && (
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: c.badge, opacity: isCancelling ? 0.5 : 1 }]}
                    onPress={(e) => { (e as any).stopPropagation?.(); handleCancelPress(trip.id); }}
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
