import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, RefreshControl, Alert, Modal, Pressable } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Bus, Car, Bike as ScooterIcon, Ticket, User, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { type TripType } from '@/constants/data';
import { useBooking } from '@/context/BookingContext';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { useTrips } from '@/src/hooks/useTrips';
import api from '@/src/api/client';

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
    codeText: { color: c.isDark ? c.background : c.white, fontSize: 11, fontWeight: '600' },
    tripName: { fontSize: 14, fontWeight: '600', color: c.ink },
    tripDate: { fontSize: 11.5, color: c.inkSoft, marginTop: 1 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 11, color: c.inkSoft },
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
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    modalBox: { width: 320, borderRadius: 20, padding: 24, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 12 },
    modalTitle: { fontSize: 17, fontWeight: '700', fontFamily: 'Inter_700Bold' },
    modalBody: { fontSize: 14, lineHeight: 20 },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    modalBtnText: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_700Bold' },
  });
}

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? 60 : insets.top;
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const { activeBooking } = useBooking();
  const { colors: c, glassStyle: gs, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const routeColors = c.isDark ? ROUTE_COLORS_DARK : ROUTE_COLORS_LIGHT;

  const { upcomingTrips, pastTrips, loading, refresh } = useTrips();
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleCancelPress = (tripId: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS !== 'web') {
      Alert.alert(
        'Cancel Booking',
        'Are you sure you want to cancel this booking? Your wallet will be refunded.',
        [
          { text: 'Keep Booking', style: 'cancel' },
          { text: 'Cancel Booking', style: 'destructive', onPress: () => doCancel(tripId) },
        ],
      );
    } else {
      setConfirmId(tripId);
    }
  };

  const doCancel = async (tripId: string) => {
    setCancellingId(tripId);
    try {
      await api.patch(`/bookings/${tripId}/cancel`);
      await refresh();
    } catch {
    } finally {
      setCancellingId(null);
      setConfirmId(null);
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
        date: activeBooking.date, time: activeBooking.time, seat: 'B4',
        status: 'upcoming' as const, price: activeBooking.price,
      }, ...upcomingTrips]
    : upcomingTrips;

  const trips = tab === 'upcoming' ? upcoming : pastTrips;

  const statusLabel = (status: string) => {
    if (status === 'upcoming') return t('upcoming');
    if (status === 'completed') return t('past');
    if (status === 'cancelled') return t('cancel_trip');
    return status;
  };

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
          const TripTypeIcon = TYPE_ICONS[trip.type];
          const isUpcoming = trip.status === 'upcoming' && trip.id !== 'live';
          const isCancelling = cancellingId === trip.id;
          return (
          <TouchableOpacity
            key={trip.id}
            style={[gs, styles.tripCard]}
            onPress={() => { if (trip.id === 'live') router.push('/ticket'); if (Platform.OS !== 'web') Haptics.selectionAsync(); }}
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
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, { backgroundColor: trip.status === 'upcoming' ? '#55c49a' : trip.status === 'cancelled' ? c.badge : c.silver }]} />
                <Text style={styles.statusText}>{statusLabel(trip.status)}</Text>
              </View>
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
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Web confirmation modal */}
      {Platform.OS === 'web' && confirmId !== null && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { backgroundColor: c.white }]}>
              <Text style={[styles.modalTitle, { color: c.ink }]}>Cancel Booking</Text>
              <Text style={[styles.modalBody, { color: c.inkSoft }]}>
                Are you sure you want to cancel this booking? Your wallet will be refunded.
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: c.mist }]}
                  onPress={() => setConfirmId(null)}
                >
                  <Text style={[styles.modalBtnText, { color: c.ink }]}>Keep Booking</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: c.badge }]}
                  onPress={() => doCancel(confirmId)}
                  disabled={cancellingId !== null}
                >
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                    {cancellingId !== null ? 'Cancelling...' : 'Cancel Booking'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </LinearGradient>
  );
}
