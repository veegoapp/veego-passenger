import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView, Share, ActivityIndicator,
  Alert, Modal, Pressable,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ArrowRight, MapPin, Share2, Navigation, X, Star } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors, S } from '@/constants/colors';
import { shuttleStatusLabel, formatCairoDateTime } from '@/constants/data';
import { cancelBooking } from '@/src/api/shuttleService';
import { getSocket } from '@/src/api/socket';
import api from '@/src/api/client';
import { PassengerTrackingMap } from '@/components/shared/PassengerTrackingMap';
import { RatingSheet } from '@/components/shared/RatingSheet';


const SHOW_MAP_STATUSES = ['driver_assigned', 'scheduled'];
const HIDE_MAP_STATUSES = ['boarding', 'completed', 'cancelled'];
const MINUTES_BEFORE_DEPARTURE = 20;

interface TripDetail {
  id: string | number;
  status: string;
  departureIso: string;
  routeName: string;
  routeNameAr: string | null;
  from: string;
  fromAr: string | null;
  to: string;
  toAr: string | null;
  date: string;
  time: string;
  seat: string;
  price: number;
  passengerCount?: number;
  minPassengers?: number;
  pickupLat?: number | null;
  pickupLng?: number | null;
  driverName?: string | null;
  driverUserId?: number | null;
}

interface DriverLocation {
  lat: number;
  lng: number;
  heading?: number;
}

function mapApiToDetail(b: any): TripDetail {
  const trip = b.trip ?? {};
  const route = trip.route ?? trip.shuttleLine ?? trip.line ?? {};
  const departureIso =
    trip.departureTime ?? trip.departure_time ?? b.scheduledAt ?? b.scheduled_at ?? '';
  // §21.9: display in Africa/Cairo, not UTC
  const { date, time } = formatCairoDateTime(departureIso);
  const pickupStation = trip.pickupStation ?? b.pickupStation ?? null;
  return {
    id: trip.id ?? trip._id ?? b.id ?? b._id ?? '',
    status: (b.status ?? trip.shuttleStatus ?? trip.shuttle_status ?? trip.status ?? '').toLowerCase(),
    departureIso,
    routeName:   route.name   ?? trip.name  ?? '—',
    routeNameAr: route.nameAr ?? route.name_ar ?? null,
    from:   route.fromLocation   ?? route.from_location   ?? route.from  ?? b.pickupName     ?? b.origin      ?? '—',
    fromAr: route.fromLocationAr ?? route.from_location_ar ?? null,
    to:   route.toLocation   ?? route.to_location   ?? route.to  ?? b.destinationName ?? b.destination ?? '—',
    toAr: route.toLocationAr ?? route.to_location_ar ?? null,
    date,
    time,
    seat: b.seatNumber ?? b.seat_number ?? b.seat ?? '—',
    price: b.totalPrice ?? b.total_price ?? trip.price ?? b.price ?? 0,
    passengerCount: trip.passengerCount ?? trip.passenger_count ?? null,
    minPassengers: trip.minPassengers ?? trip.min_passengers ?? null,
    pickupLat: pickupStation?.latitude ?? pickupStation?.lat ?? null,
    pickupLng: pickupStation?.longitude ?? pickupStation?.lng ?? null,
    driverName: trip.driver?.name ?? b.driver?.name ?? null,
    driverUserId: trip.driver?.userId ?? trip.driver?.user?.id ?? b.driver?.userId ?? b.driver?.user?.id ?? null,
  };
}

function isWithin20Min(departureIso: string): boolean {
  if (!departureIso) return false;
  const now = Date.now();
  const dep = new Date(departureIso).getTime();
  if (isNaN(dep)) return false;
  const diffMs = dep - now;
  return diffMs >= 0 && diffMs <= MINUTES_BEFORE_DEPARTURE * 60 * 1000;
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: c.ink, letterSpacing: -0.3 },
    shareBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    card: { marginHorizontal: 20, borderRadius: 24, overflow: 'hidden', padding: 20, marginBottom: 16, ...S.float },
    sectionLabel: { fontSize: 10, fontWeight: '600', color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
    routeTitle: { fontSize: 18, fontWeight: '700', color: c.ink, letterSpacing: -0.4, marginBottom: 4 },
    routeSub: { fontSize: 13, color: c.inkSoft },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontSize: 13, fontWeight: '600' },
    gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 0, marginTop: 6 },
    gridItem: { width: '50%', paddingVertical: 8 },
    gridLabel: { fontSize: 10, color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 0.8 },
    gridValue: { fontSize: 14, fontWeight: '600', color: c.ink, marginTop: 2 },
    mapCard: { marginHorizontal: 20, borderRadius: 24, overflow: 'hidden', height: 240, backgroundColor: c.mist, marginBottom: 16, ...S.float },
    mapLabel: { position: 'absolute', top: 12, left: 16, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 6 },
    mapLabelText: { fontSize: 11, fontWeight: '600', color: '#fff' },
    mapPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4d9ef6' },
    shareCard: { marginHorizontal: 20, borderRadius: 20, borderWidth: 1.5, borderColor: c.accentMint, backgroundColor: 'rgba(85,196,154,0.06)', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    shareCardText: { flex: 1 },
    shareCardTitle: { fontSize: 13.5, fontWeight: '700', color: c.ink },
    shareCardBody: { fontSize: 12, color: c.inkSoft, marginTop: 3, lineHeight: 17 },
    shareCardBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 14, backgroundColor: c.accentMint, flexDirection: 'row', alignItems: 'center', gap: 6 },
    shareCardBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { fontSize: 14, color: c.inkSoft },
    errorText: { fontSize: 14, color: c.badge, textAlign: 'center', marginHorizontal: 32 },
    goBack: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 14, backgroundColor: c.ink },
    goBackText: { fontSize: 14, fontWeight: '600', color: c.isDark ? c.background : c.white },
    cancelBtn: { marginHorizontal: 20, marginBottom: 8, borderRadius: 16, borderWidth: 1.5, borderColor: c.badge, backgroundColor: 'rgba(220,38,38,0.05)', padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    cancelBtnText: { fontSize: 14, fontWeight: '600', color: c.badge },
    rateBtn: { marginHorizontal: 20, marginBottom: 8, height: 54, borderRadius: 18, backgroundColor: c.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    rateBtnText: { fontSize: 15, fontWeight: '700', color: c.isDark ? c.background : '#fff' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 32 },
    modalBox: { borderRadius: 24, padding: 24, width: '100%', maxWidth: 380, gap: 12 },
    modalTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
    modalBody: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    modalBtn: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    modalBtnText: { fontSize: 14, fontWeight: '600' },
  });
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? 60 : insets.top;
  const { colors: c, t, language, isRTL } = useTheme();
  const isAr = language === 'ar';
  const styles = useMemo(() => makeStyles(c), [c]);

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [shuttleRatingVisible, setShuttleRatingVisible] = useState(false);
  const [shuttleAlreadyRated, setShuttleAlreadyRated] = useState(false);

  const tripIdRef = useRef<string | number | null>(null);

  const fetchTrip = useCallback(async () => {
    if (!id) { setError(t('trip_id_missing')); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      let detail: TripDetail | null = null;

      // §11.2: GET /bookings/:id — single booking with embedded trip data
      const single = await api.get(`/bookings/${id}`).catch(() => null);
      if (single?.data) {
        const raw = single.data?.data ?? single.data;
        const mapped = mapApiToDetail(Array.isArray(raw) ? raw[0] : raw);
        if (mapped.routeName && mapped.routeName !== '—') detail = mapped;
      }

      // Fallback: §11.5: GET /users/me/bookings — replaces deprecated /shuttle/my-trips
      if (!detail || !detail.routeName || detail.routeName === '—') {
        const listRes = await api.get('/users/me/bookings', { params: { page: 1, limit: 50 } }).catch(() => null);
        if (listRes?.data) {
          const d = listRes.data;
          const items: any[] = Array.isArray(d) ? d : d.trips ?? d.bookings ?? d.data ?? [];
          const match = items.find((b: any) => {
            const bTripId = String(b.trip?.id ?? b.trip?._id ?? b.tripId ?? b.trip_id ?? b.id ?? '');
            const bBookingId = String(b.id ?? b._id ?? '');
            return bTripId === String(id) || bBookingId === String(id);
          });
          if (match) detail = mapApiToDetail(match);
        }
      }

      if (detail) {
        setTrip(detail);
        tripIdRef.current = detail.id;
      } else {
        setError(t('trip_load_error'));
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? t('trip_load_error'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  // When trip is completed, check if passenger already rated via GET /user/ratings/given
  useEffect(() => {
    const status = liveStatus ?? trip?.status ?? '';
    if (status !== 'completed' || !trip?.id) return;

    api.get('/user/ratings/given')
      .then((res) => {
        const items: any[] = res.data?.data ?? res.data ?? [];
        const tripIdStr = String(trip.id);
        const alreadyRated = items.some(
          (r: any) => r.tripId != null && String(r.tripId) === tripIdStr,
        );
        setShuttleAlreadyRated(alreadyRated);
      })
      .catch(() => {});
  }, [liveStatus, trip?.id, trip?.status]);

  // Socket: join/leave trip room + listen for driver location + live status updates
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!id) return;

    let cleanedUp = false;
    const handlers: Array<() => void> = [];

    getSocket().then((socket) => {
      if (cleanedUp) return;

      socket.emit('join:trip', { tripId: id });

      // Driver location — moves the map marker in real time
      const locationHandler = (payload: {
        tripId: string | number;
        driverId?: string | number;
        lat: number;
        lng: number;
        heading?: number;
      }) => {
        if (String(payload.tripId) === String(id)) {
          setDriverLocation({ lat: payload.lat, lng: payload.lng, heading: payload.heading });
        }
      };

      // Live status — updates badge and map visibility instantly, no API refetch needed
      const statusHandler = (payload: {
        tripId: string | number;
        status: string;
        passengerCount?: number;
      }) => {
        if (String(payload.tripId) === String(id)) {
          const normalized = payload.status?.toLowerCase() ?? '';
          setLiveStatus(normalized);
          // If passenger count changed (someone else joined/left), update it too
          if (typeof payload.passengerCount === 'number') {
            setTrip((prev) =>
              prev ? { ...prev, passengerCount: payload.passengerCount } : prev
            );
          }
        }
      };

      socket.on('shuttle:driver:location', locationHandler);
      socket.on('shuttle:trip:status', statusHandler);

      handlers.push(
        () => socket.off('shuttle:driver:location', locationHandler),
        () => socket.off('shuttle:trip:status', statusHandler),
      );
    }).catch(() => {});

    return () => {
      cleanedUp = true;
      handlers.forEach((off) => off());
      getSocket().then((socket) => {
        socket.emit('leave:trip', { tripId: id });
      }).catch(() => {});
    };
  }, [id]);

  // Fallback poll every 2 minutes — real-time socket handles instant updates;
  // polling only catches drift (e.g., socket reconnect gap)
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => {
      fetchTrip();
    }, 120000);
    return () => clearInterval(interval);
  }, [id, fetchTrip]);

  // Merge socket live status over API status — socket wins when present
  const effectiveStatus = liveStatus ?? trip?.status ?? '';

  const showMap = useMemo(() => {
    if (!trip) return false;
    if (HIDE_MAP_STATUSES.includes(effectiveStatus)) return false;
    if (!SHOW_MAP_STATUSES.includes(effectiveStatus)) return false;
    return isWithin20Min(trip.departureIso) || !!driverLocation;
  }, [effectiveStatus, trip, driverLocation]);

  const isUnderBooked = useMemo(() => {
    if (!trip) return false;
    if (!trip.minPassengers || !trip.passengerCount) return false;
    if (['completed', 'cancelled', 'active', 'boarding'].includes(effectiveStatus)) return false;
    return trip.passengerCount < trip.minPassengers;
  }, [trip, effectiveStatus]);

  /**
   * §21.3 + §11.4: 12-hour refund window for passenger self-cancel.
   * >12h before departure → full refund; ≤12h → no refund.
   * Note: server is authoritative; client check is for UX pre-warning only.
   */
  const isWithin12Hours = (departureIso: string): boolean => {
    if (!departureIso) return false;
    const dep = new Date(departureIso).getTime();
    if (isNaN(dep)) return false;
    return dep - Date.now() < 12 * 60 * 60 * 1000;
  };

  const handleCancelPress = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const within12h = isWithin12Hours(trip?.departureIso ?? '');
    if (Platform.OS !== 'web') {
      Alert.alert(
        t('cancel_warning_title'),
        within12h ? t('cancel_no_refund') : t('cancel_refund_full'),
        [
          { text: t('cancel_keep'), style: 'cancel' },
          { text: t('cancel_confirm'), style: 'destructive', onPress: doCancel },
        ],
      );
    } else {
      setShowCancelModal(true);
    }
  };

  const doCancel = async () => {
    if (!id) return;
    setCancellingId(String(id));
    try {
      // §11.4, §21.3: DELETE /shuttle/bookings/:id — preferred self-cancel with 12h refund policy
      // Replaces deprecated PATCH /bookings/:id/cancel
      const result = await cancelBooking(id);
      if (result?.refunded === false) {
        Alert.alert(
          t('booking_cancelled_title'),
          t('cancel_no_refund'),
          [{ text: t('confirm'), onPress: () => router.back() }],
        );
      } else {
        router.back();
      }
    } catch (e: any) {
      Alert.alert(
        t('error'),
        e?.response?.data?.message ?? e?.message ?? t('cancel_booking_failed'),
      );
    } finally {
      setCancellingId(null);
      setShowCancelModal(false);
    }
  };

  const handleShuttleRatingSubmit = useCallback(async (stars: number) => {
    setShuttleRatingVisible(false);
    if (!trip?.id || !trip?.driverUserId) return;
    try {
      await api.post('/shuttle/ratings', {
        tripId: Number(trip.id),
        rateeId: trip.driverUserId,
        stars: Math.round(stars),
      });
      setShuttleAlreadyRated(true);
    } catch (e: any) {
      const msg: string = e?.response?.data?.message ?? '';
      if (msg.toLowerCase().includes('already rated')) {
        setShuttleAlreadyRated(true);
      }
    }
  }, [trip?.id, trip?.driverUserId]);

  const deepLink = `veego://shuttle/trip/${id}`;

  const handleShare = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: t('join_trip_msg')
          .replace('{route}', trip?.routeName ?? '')
          .replace('{link}', deepLink),
        url: deepLink,
      });
    } catch {}
  };

  if (loading) {
    return (
      <LinearGradient colors={c.luxeGrad} style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: top + 12 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            {isRTL ? <ArrowRight size={18} color={c.ink} /> : <ArrowLeft size={18} color={c.ink} />}
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('trip_detail_title')}</Text>
          <View style={styles.shareBtn} />
        </View>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={c.ink} />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </LinearGradient>
    );
  }

  if (error || !trip) {
    return (
      <LinearGradient colors={c.luxeGrad} style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: top + 12 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            {isRTL ? <ArrowRight size={18} color={c.ink} /> : <ArrowLeft size={18} color={c.ink} />}
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('trip_detail_title')}</Text>
          <View style={styles.shareBtn} />
        </View>
        <View style={[styles.loadingBox]}>
          <Text style={styles.errorText}>{error ?? t('trip_not_found')}</Text>
          <TouchableOpacity style={styles.goBack} onPress={() => router.back()}>
            <Text style={styles.goBackText}>{t('go_back')}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  const statusColor: Record<string, string> = {
    waiting_driver: '#f59e0b',
    scheduled: '#4d9ef6',
    driver_assigned: '#4d9ef6',
    active: '#55c49a',
    boarding: '#55c49a',
    completed: c.silver,
    cancelled: c.badge,
  };
  const resolvedStatusColor = statusColor[effectiveStatus] ?? c.silver;

  return (
    <LinearGradient colors={c.luxeGrad} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          {isRTL ? <ArrowRight size={18} color={c.ink} /> : <ArrowLeft size={18} color={c.ink} />}
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('trip_detail_title')}</Text>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
          <Share2 size={16} color={c.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Trip info card */}
        <LinearGradient
          colors={c.isDark ? ['#1e1e3a', '#16162e'] : ['#ffffff', '#f7f7fc']}
          style={styles.card}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <Text style={styles.sectionLabel}>{t('route_label')}</Text>
          <Text style={styles.routeTitle}>{isAr ? (trip.routeNameAr ?? trip.routeName) : trip.routeName}</Text>
          <Text style={styles.routeSub}>
            {isAr ? (trip.fromAr ?? trip.from) : trip.from}
            {isRTL ? ' ← ' : ' → '}
            {isAr ? (trip.toAr ?? trip.to) : trip.to}
          </Text>

          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: resolvedStatusColor }]} />
            <Text style={[styles.statusText, { color: resolvedStatusColor }]}>
              {shuttleStatusLabel(effectiveStatus, isAr ? 'ar' : 'en')}
            </Text>
            {liveStatus !== null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginStart: 6 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#55c49a' }} />
                <Text style={{ fontSize: 10, color: '#55c49a', fontWeight: '600' }}>
                  {t('live_badge')}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.gridRow}>
            {[
              { label: t('date_label'), value: trip.date },
              { label: t('time_label'), value: trip.time },
              { label: t('seat_label'), value: trip.seat },
              { label: t('price_label'), value: `${trip.price} ${t('egp')}` },
            ].map((item) => (
              <View key={item.label} style={styles.gridItem}>
                <Text style={styles.gridLabel}>{item.label}</Text>
                <Text style={styles.gridValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Driver location map — only when driver_assigned/scheduled + within 20 min */}
        {showMap && (
          <View style={styles.mapCard}>
            <View style={styles.mapLabel}>
              <View style={styles.mapPulse} />
              <Navigation size={11} color="#fff" />
              <Text style={styles.mapLabelText}>
                {t('driver_en_route')}
              </Text>
            </View>
            <PassengerTrackingMap
              driverLocation={driverLocation ? { latitude: driverLocation.lat, longitude: driverLocation.lng } : null}
              pickup={
                trip.pickupLat != null && trip.pickupLng != null
                  ? { latitude: trip.pickupLat, longitude: trip.pickupLng }
                  : null
              }
              style={{ borderRadius: 24 }}
            />
          </View>
        )}

        {/* Rate driver — only for completed trips with known driver */}
        {effectiveStatus === 'completed' && !shuttleAlreadyRated && !!trip.driverUserId && (
          <TouchableOpacity
            style={styles.rateBtn}
            onPress={() => setShuttleRatingVisible(true)}
            activeOpacity={0.85}
          >
            <Star size={16} color="#f5a623" fill="#f5a623" />
            <Text style={styles.rateBtnText}>{t('rate_driver')}</Text>
          </TouchableOpacity>
        )}

        {/* Cancel booking — only for cancellable statuses */}
        {!['completed', 'cancelled', 'boarding', 'active'].includes(effectiveStatus) && (
          <TouchableOpacity
            style={[styles.cancelBtn, { opacity: cancellingId ? 0.5 : 1 }]}
            disabled={!!cancellingId}
            onPress={handleCancelPress}
            activeOpacity={0.8}
          >
            <X size={14} color={c.badge} strokeWidth={2.5} />
            <Text style={styles.cancelBtnText}>
              {cancellingId ? `${t('cancel_trip')}…` : t('cancel_trip')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Share invite when trip is under minimum passenger count */}
        {isUnderBooked && (
          <View style={styles.shareCard}>
            <MapPin size={22} color={c.accentMint} style={{ flexShrink: 0 }} />
            <View style={styles.shareCardText}>
              <Text style={styles.shareCardTitle}>
                {t('invite_friends_title')}
              </Text>
              <Text style={styles.shareCardBody}>
                {t('invite_friends_body')}
              </Text>
            </View>
            <TouchableOpacity style={styles.shareCardBtn} onPress={handleShare} activeOpacity={0.85}>
              <Share2 size={14} color="#fff" />
              <Text style={styles.shareCardBtnText}>{t('share_action')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Shuttle driver rating sheet */}
      <RatingSheet
        visible={shuttleRatingVisible}
        driverName={trip?.driverName ?? t('your_driver')}
        driverInitials={(trip?.driverName ?? 'D').charAt(0).toUpperCase()}
        driverColor="#2563eb"
        onSubmit={(stars) => handleShuttleRatingSubmit(stars)}
        onSkip={() => setShuttleRatingVisible(false)}
      />

      {Platform.OS === 'web' && showCancelModal && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { backgroundColor: c.white }]}>
              <Text style={[styles.modalTitle, { color: c.ink }]}>{t('cancel_warning_title')}</Text>
              <Text style={[styles.modalBody, { color: c.inkSoft }]}>
                {isWithin12Hours(trip?.departureIso ?? '') ? t('cancel_warning_10h') : t('cancel_warning_free')}
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: c.mist }]}
                  onPress={() => setShowCancelModal(false)}
                >
                  <Text style={[styles.modalBtnText, { color: c.ink }]}>{t('cancel_keep')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: c.badge }]}
                  onPress={doCancel}
                  disabled={!!cancellingId}
                >
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                    {cancellingId ? `${t('cancel_confirm')}…` : t('cancel_confirm')}
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
