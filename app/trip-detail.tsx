import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView, Share,
  Alert, Modal, Pressable,
} from 'react-native';
import { AppLoader } from '@/components/ui/AppLoader';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ArrowRight, MapPin, Share2, Navigation, X, Star, ShieldAlert, Clock, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors, S } from '@/constants/colors';
import { shuttleStatusLabel, formatCairoDateTime } from '@/constants/data';
import type { ShuttleDirection } from '@/constants/data';
import { cancelBooking, submitShuttleRating } from '@/src/api/shuttleService';
import { getGivenRatings } from '@/src/api/userService';
import { getSocket } from '@/src/api/socket';
import api, { tokenStore } from '@/src/api/client';
import { PassengerTrackingMap } from '@/components/shared/PassengerTrackingMap';
import type { Station } from '@/components/shared/PassengerTrackingMap';
import { RatingSheet } from '@/components/shared/RatingSheet';
import { SafetySheet } from '@/components/shared/SafetySheet';
import { ConnectionBanner } from '@/components/shared/ConnectionBanner';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';
import { Shadows } from '@/constants/shadows';


// Show map from 20 min before departure through the entire active trip
const SHOW_MAP_STATUSES = ['driver_assigned', 'scheduled', 'active', 'boarding'];
const HIDE_MAP_STATUSES = ['completed', 'cancelled'];
const MINUTES_BEFORE_DEPARTURE = 20;

interface TripDetail {
  id: string | number;
  bookingId?: string | number | null;
  routeId?: number | string | null;
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
  pickupStationId?: number | null;
  driverName?: string | null;
  driverUserId?: number | null;
  /** This trip's physical direction, when the backend provides it — never fabricated. */
  direction?: ShuttleDirection;
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
    trip.departureTime ?? b.scheduledAt ?? '';
  // §21.9: display in Africa/Cairo, not UTC
  const { date, time } = formatCairoDateTime(departureIso);
  const pickupStation = trip.pickupStation ?? b.pickupStation ?? null;
  return {
    id: trip.id ?? b.id ?? '',
    // Distinct from `id` above (which resolves to the trip id when available) —
    // cancellation must target the booking's own id, not the trip's.
    bookingId: b.id ?? null,
    routeId: trip.routeId ?? route.id ?? null,
    status: (b.status ?? trip.shuttleStatus ?? trip.status ?? '').toLowerCase(),
    departureIso,
    routeName:   route.name   ?? trip.name  ?? '—',
    routeNameAr: route.nameAr ?? null,
    from:   route.fromLocation   ?? route.from  ?? b.pickupName     ?? b.origin      ?? '—',
    fromAr: route.fromLocationAr ?? null,
    to:   route.toLocation   ?? route.to  ?? b.destinationName ?? b.destination ?? '—',
    toAr: route.toLocationAr ?? null,
    date,
    time,
    seat: b.seatNumber ?? b.seat ?? '—',
    price: b.totalPrice ?? trip.price ?? b.price ?? 0,
    passengerCount: trip.passengerCount ?? null,
    minPassengers: trip.minPassengers ?? null,
    pickupLat: pickupStation?.latitude ?? null,
    pickupLng: pickupStation?.longitude ?? null,
    pickupStationId: pickupStation?.id ?? null,
    driverName: trip.driver?.name ?? b.driver?.name ?? null,
    driverUserId: trip.driver?.userId ?? trip.driver?.user?.id ?? b.driver?.userId ?? b.driver?.user?.id ?? null,
    direction: trip.direction ?? b.direction ?? undefined,
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
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: Spacing.md, gap: Spacing.md },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: c.ink, letterSpacing: -0.3 },
    shareBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    card: { marginHorizontal: 20, borderRadius: Radius.xl, overflow: 'hidden', padding: 20, marginBottom: Spacing.lg, ...S.float },
    sectionLabel: { fontSize: 10, fontWeight: Typography.weight.semibold, color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
    routeTitle: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: c.ink, letterSpacing: -0.4, marginBottom: Spacing.xs },
    routeSub: { fontSize: 13, color: c.inkSoft },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 10 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontSize: 13, fontWeight: Typography.weight.semibold },
    gridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 0, marginTop: 6 },
    gridItem: { width: '50%', paddingVertical: Spacing.sm },
    gridLabel: { fontSize: 10, color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 0.8 },
    gridValue: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: c.ink, marginTop: 2 },
    mapCard: { marginHorizontal: 20, borderRadius: Radius.xl, overflow: 'hidden', height: 240, backgroundColor: c.mist, marginBottom: Spacing.lg, ...S.float },
    mapLabel: { position: 'absolute', top: 12, left: 16, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 6 },
    mapLabelText: { fontSize: 11, fontWeight: Typography.weight.semibold, color: '#fff' },
    mapPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4d9ef6' },
    shareCard: { marginHorizontal: 20, borderRadius: 20, borderWidth: 1.5, borderColor: c.accentMint, backgroundColor: 'rgba(85,196,154,0.06)', padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
    shareCardText: { flex: 1 },
    shareCardTitle: { fontSize: 13.5, fontWeight: Typography.weight.bold, color: c.ink },
    shareCardBody: { fontSize: Typography.size.xs, color: c.inkSoft, marginTop: 3, lineHeight: 17 },
    shareCardBtn: { paddingHorizontal: Spacing.lg, paddingVertical: 9, borderRadius: 14, backgroundColor: c.accentMint, flexDirection: 'row', alignItems: 'center', gap: 6 },
    shareCardBtnText: { fontSize: 13, fontWeight: Typography.weight.bold, color: '#fff' },
    loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    loadingText: { fontSize: Typography.size.sm, color: c.inkSoft },
    errorText: { fontSize: Typography.size.sm, color: c.badge, textAlign: 'center', marginHorizontal: Spacing.xxl },
    goBack: { marginTop: Spacing.md, paddingHorizontal: Spacing.xl, paddingVertical: 11, borderRadius: 14, backgroundColor: c.ink },
    goBackText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: c.isDark ? c.background : c.white },
    cancelBtn: { marginHorizontal: 20, marginBottom: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: c.badge, backgroundColor: 'rgba(220,38,38,0.05)', padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    cancelBtnText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: c.badge },
    rateBtn: { marginHorizontal: 20, marginBottom: Spacing.sm, height: 54, borderRadius: 18, backgroundColor: c.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    rateBtnText: { fontSize: 15, fontWeight: Typography.weight.bold, color: c.isDark ? c.background : '#fff' },
    sosBtn: {
      position: 'absolute', top: 12, right: 12,
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: '#dc2626', borderRadius: 99,
      paddingHorizontal: Spacing.md, paddingVertical: 7,
      shadowColor: '#dc2626', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.45, shadowRadius: 8, elevation: Shadows.large.elevation,
    },
    sosBtnText: { fontSize: Typography.size.xs, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
    boardedBanner: {
      marginHorizontal: 20, marginBottom: Spacing.md,
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 18,
      padding: 14, borderWidth: 1.5, borderColor: '#22c55e',
    },
    boardedEmoji: { fontSize: Typography.size.xl },
    boardedTitle: { fontSize: Typography.size.sm, fontWeight: Typography.weight.bold, color: '#15803d' },
    boardedSub:   { fontSize: Typography.size.xs, color: '#16a34a', marginTop: 2 },
    etaCard: {
      marginHorizontal: 20, marginBottom: Spacing.md,
      backgroundColor: c.isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff',
      borderRadius: 18, padding: 14, borderWidth: 1,
      borderColor: c.isDark ? 'rgba(37,99,235,0.3)' : '#bfdbfe',
      gap: Spacing.sm,
    },
    etaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    etaLabel: { flex: 1, fontSize: 13, color: c.inkSoft },
    etaValue: { fontSize: Typography.size.sm, fontWeight: Typography.weight.bold, color: '#2563eb' },
    etaDivider: { height: 1, backgroundColor: c.isDark ? 'rgba(255,255,255,0.1)' : '#dbeafe' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl },
    modalBox: { borderRadius: Radius.xl, padding: Spacing.xl, width: '100%', maxWidth: 380, gap: Spacing.md },
    modalTitle: { fontSize: 17, fontWeight: Typography.weight.bold, textAlign: 'center' },
    modalBody: { fontSize: Typography.size.sm, lineHeight: 21, textAlign: 'center' },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: Spacing.xs },
    modalBtn: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    modalBtnText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold },
  });
}

export default function TripDetailScreen() {
  const { id, openRating } = useLocalSearchParams<{ id: string; openRating?: string }>();
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const { colors: c, t, language, isRTL } = useTheme();
  const isAr = language === 'ar';
  const styles = useMemo(() => makeStyles(c), [c]);

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const liveStatusRef = useRef<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [shuttleRatingVisible, setShuttleRatingVisible] = useState(false);
  const [shuttleAlreadyRated, setShuttleAlreadyRated] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [boarded, setBoarded] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);

  const tripIdRef = useRef<string | number | null>(null);
  const bookingIdRef = useRef<string | number | null>(null);
  // Latest routeId/direction, kept in sync by the station-polling effect below —
  // read by the station-arrived/completed socket handlers so they can trigger
  // an immediate refetch without needing to be in the [id]-only effect's deps.
  const tripStationsMetaRef = useRef<{ routeId: string | number; direction?: ShuttleDirection } | null>(null);

  const fetchTrip = useCallback(async () => {
    if (!id) { setError(t('trip_id_missing')); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      let detail: TripDetail | null = null;

      // Decode current user ID from JWT for ownership validation
      let currentUserId: number | string | null = null;
      try {
        const tok = await tokenStore.getToken(tokenStore.TOKEN_KEY);
        if (tok) {
          const payload = JSON.parse(atob(tok.split('.')[1]));
          currentUserId = payload.sub ?? payload.userId ?? payload.id ?? null;
        }
      } catch {}

      // §11.2: GET /bookings/:id — single booking with embedded trip data
      const single = await api.get(`/bookings/${id}`).catch(() => null);
      if (single?.data) {
        const raw = single.data?.data ?? single.data;
        const rawObj = Array.isArray(raw) ? raw[0] : raw;
        // Ownership check: booking must belong to authenticated user
        if (currentUserId != null && rawObj?.userId != null &&
            String(rawObj.userId) !== String(currentUserId)) {
          router.replace('/(tabs)');
          return;
        }
        const mapped = mapApiToDetail(rawObj);
        if (mapped.routeName && mapped.routeName !== '—') detail = mapped;
      }

      // Fallback: §11.5: GET /users/me/bookings — replaces deprecated /shuttle/my-trips
      if (!detail || !detail.routeName || detail.routeName === '—') {
        const listRes = await api.get('/users/me/bookings', { params: { page: 1, limit: 50 } }).catch(() => null);
        if (listRes?.data) {
          const d = listRes.data;
          const items: any[] = Array.isArray(d) ? d : d.trips ?? d.bookings ?? d.data ?? [];
          const match = items.find((b: any) => {
            const bTripId = String(b.trip?.id ?? b.tripId ?? b.id ?? '');
            const bBookingId = String(b.id ?? '');
            return bTripId === String(id) || bBookingId === String(id);
          });
          if (match) detail = mapApiToDetail(match);
        }
      }

      if (detail) {
        setTrip((prev) => {
          // Preserve socket-delivered status — REST poll must not overwrite it.
          // Use ref (not state) so we read the latest value inside this callback.
          if (prev && liveStatusRef.current) {
            return { ...detail, status: prev.status };
          }
          return detail;
        });
        tripIdRef.current = detail.id;
        bookingIdRef.current = detail.bookingId ?? null;
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

  // Fetch all stations for this trip's route — poll every 30 s during live phases.
  // When the trip's direction is known, it's both passed as a query param (in
  // case the endpoint supports it) and used to filter client-side afterward —
  // defense-in-depth, since we can't assume the backend honors the param.
  const fetchStations = useCallback(async (routeId: string | number, direction?: ShuttleDirection) => {
    try {
      const res = await api.get(`/routes/${routeId}/stations`, direction ? { params: { direction } } : undefined);
      const raw: any[] = res.data?.data ?? res.data ?? [];
      const mapped = raw.map((s: any) => ({
        id:        s.id,
        name:      s.name ?? s.stationName ?? '',
        order:     s.order ?? s.stationOrder ?? 0,
        latitude:  s.latitude ?? 0,
        longitude: s.longitude ?? 0,
        status:    (s.progress?.status ?? s.status ?? 'pending') as Station['status'],
        direction: (s.direction ?? undefined) as ShuttleDirection | undefined,
      }));
      const filtered = direction
        ? mapped.filter((s) => !s.direction || s.direction === direction)
        : mapped;
      setStations(filtered);
    } catch {
      // Station data is optional — map still works with pickup/dropoff fallback
    }
  }, []);

  useEffect(() => {
    const currentStatus = (liveStatus ?? trip?.status ?? '').toLowerCase();
    const livePhase = ['driver_assigned', 'scheduled', 'active', 'boarding'].includes(currentStatus);
    if (!trip?.routeId || !livePhase) return;
    tripStationsMetaRef.current = { routeId: trip.routeId, direction: trip.direction };
    fetchStations(trip.routeId, trip.direction);
    const interval = setInterval(() => fetchStations(trip.routeId!, trip.direction), 30_000);
    return () => clearInterval(interval);
  }, [trip?.routeId, trip?.direction, liveStatus, trip?.status, fetchStations]);

  // When trip is completed, check if passenger already rated via GET /user/ratings/given
  useEffect(() => {
    const status = liveStatus ?? trip?.status ?? '';
    if (status !== 'completed' || !trip?.id) return;

    getGivenRatings()
      .then((res) => {
        const items: any[] = res?.data ?? res ?? [];
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
    if (!id) return;

    let cleanedUp = false;
    const handlers: Array<() => void> = [];

    getSocket().then((socket) => {
      if (cleanedUp) return;

      socket.emit('join:trip', { tripId: Number(id) });

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
          liveStatusRef.current = normalized;
          setLiveStatus(normalized);
          // If passenger count changed (someone else joined/left), update it too
          if (typeof payload.passengerCount === 'number') {
            setTrip((prev) =>
              prev ? { ...prev, passengerCount: payload.passengerCount } : prev
            );
          }
        }
      };

      // Boarding confirmation — fired on passenger:{userId} room, but also arrives on trip room.
      // The event carries the booking's own id, not the trip id in `id` — compare
      // against the booking id captured when this screen loaded the trip.
      const boardedHandler = (data: { bookingId?: string | number }) => {
        if (!data.bookingId || bookingIdRef.current == null) return;
        if (String(data.bookingId) !== String(bookingIdRef.current)) return;
        setBoarded(true);
      };

      // Re-join trip room after socket reconnects (network recovery)
      const reconnectHandler = () => {
        socket.emit('join:trip', { tripId: Number(id) });
      };

      // Station arrival/completion — refresh the station list immediately instead
      // of waiting for the next 30s poll tick (fetchStations is a stable callback).
      const stationArrivedHandler = (payload: { tripId?: string | number; stationId?: number }) => {
        if (payload.tripId == null || String(payload.tripId) !== String(id)) return;
        const meta = tripStationsMetaRef.current;
        if (meta) fetchStations(meta.routeId, meta.direction);
      };
      const stationCompletedHandler = (payload: { tripId?: string | number; stationId?: number }) => {
        if (payload.tripId == null || String(payload.tripId) !== String(id)) return;
        const meta = tripStationsMetaRef.current;
        if (meta) fetchStations(meta.routeId, meta.direction);
      };

      socket.on('shuttle:driver:location', locationHandler);
      socket.on('shuttle:trip:status', statusHandler);
      socket.on('booking:boarded', boardedHandler);
      socket.on('connect', reconnectHandler);
      socket.on('shuttle:station:arrived', stationArrivedHandler);
      socket.on('shuttle:station:completed', stationCompletedHandler);

      handlers.push(
        () => socket.off('shuttle:driver:location', locationHandler),
        () => socket.off('shuttle:trip:status', statusHandler),
        () => socket.off('booking:boarded', boardedHandler),
        () => socket.off('connect', reconnectHandler),
        () => socket.off('shuttle:station:arrived', stationArrivedHandler),
        () => socket.off('shuttle:station:completed', stationCompletedHandler),
      );
    }).catch(() => {});

    return () => {
      cleanedUp = true;
      handlers.forEach((off) => off());
      getSocket().then((socket) => {
        socket.emit('leave:trip', { tripId: id });
      }).catch(() => {});
    };
  }, [id, fetchStations]);

  // ETA is now computed inside PassengerTrackingMap (single source of truth)
  // and reported back via onEtaChange below — no local calculation here.

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

  // Push notification "rate your driver" tap → auto-open the rating sheet once trip data is ready
  const autoRatingHandled = useRef(false);
  useEffect(() => {
    if (autoRatingHandled.current) return;
    if (openRating !== '1') return;
    if (effectiveStatus !== 'completed' || !trip?.driverUserId || shuttleAlreadyRated) return;
    autoRatingHandled.current = true;
    setShuttleRatingVisible(true);
  }, [openRating, effectiveStatus, trip?.driverUserId, shuttleAlreadyRated]);

  // The "already rated" check above runs async and may resolve after the sheet
  // was auto-opened (openRating=1 race) — close it if it turns out to be stale.
  useEffect(() => {
    if (shuttleAlreadyRated) setShuttleRatingVisible(false);
  }, [shuttleAlreadyRated]);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const within12h = isWithin12Hours(trip?.departureIso ?? '');
    Alert.alert(
      t('cancel_warning_title'),
      within12h ? t('cancel_no_refund') : t('cancel_refund_full'),
      [
        { text: t('cancel_keep'), style: 'cancel' },
        { text: t('cancel_confirm'), style: 'destructive', onPress: doCancel },
      ],
    );
  };

  const doCancel = async () => {
    if (!id) return;
    // The DELETE endpoint expects the booking's own id, not the trip id carried
    // in the `id` route param — fall back to `id` only if it wasn't captured.
    const targetBookingId = trip?.bookingId ?? id;
    setCancellingId(String(targetBookingId));
    try {
      // §11.4, §21.3: DELETE /shuttle/bookings/:id — preferred self-cancel with 12h refund policy
      // Replaces deprecated PATCH /bookings/:id/cancel
      const result = await cancelBooking(targetBookingId);
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
    if (typeof trip.driverUserId !== 'number') {
      Alert.alert(t('error'), 'Cannot submit rating: driver information unavailable');
      return;
    }
    try {
      await submitShuttleRating({
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

  const handleSOS = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSafetyOpen(true);
  };

  const deepLink = `veego://shuttle/trip/${id}`;

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
          <AppLoader />
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
            {!!trip.direction && (
              <Text style={{ fontSize: 13, color: c.inkSoft, marginStart: 6 }}>
                · {trip.direction === 'outbound' ? t('shuttle_direction_outbound') : t('shuttle_direction_return')}
              </Text>
            )}
            {liveStatus !== null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginStart: 6 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#55c49a' }} />
                <Text style={{ fontSize: 10, color: '#55c49a', fontWeight: Typography.weight.semibold }}>
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

        {/* Live tracking map */}
        {showMap && (
          <View style={[styles.mapCard, { height: boarded || ['active', 'boarding'].includes(effectiveStatus) ? 320 : 240 }]}>
            {/* Status label */}
            <View style={styles.mapLabel}>
              <View style={styles.mapPulse} />
              <Navigation size={11} color="#fff" />
              <Text style={styles.mapLabelText}>
                {boarded ? 'على متن الحافلة' : t('driver_en_route')}
              </Text>
            </View>

            <PassengerTrackingMap
              driverLocation={driverLocation ? { latitude: driverLocation.lat, longitude: driverLocation.lng } : null}
              pickup={trip.pickupLat != null && trip.pickupLng != null
                ? { latitude: trip.pickupLat, longitude: trip.pickupLng }
                : null}
              stations={stations}
              passengerStationId={trip.pickupStationId ?? undefined}
              style={{ borderRadius: Radius.xl }}
              onEtaChange={setEtaMinutes}
            />

            {/* SOS floating button — only once the trip is underway */}
            {(boarded || effectiveStatus === 'active') && (
              <TouchableOpacity style={styles.sosBtn} onPress={handleSOS} activeOpacity={0.85}>
                <ShieldAlert size={14} color="#fff" />
                <Text style={styles.sosBtnText}>SOS</Text>
              </TouchableOpacity>
            )}

            {/* Realtime connection indicator */}
            <ConnectionBanner style={{ position: 'absolute', bottom: 12, alignSelf: 'center' }} />
          </View>
        )}

        {/* Boarded confirmation banner */}
        {boarded && (
          <View style={styles.boardedBanner}>
            <Text style={styles.boardedEmoji}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.boardedTitle}>أنت على متن الحافلة</Text>
              <Text style={styles.boardedSub}>استمتع برحلتك — سنُعلمك عند الوصول</Text>
            </View>
          </View>
        )}

        {/* ETA card — shown when driver location known + passenger not yet boarded */}
        {showMap && !boarded && etaMinutes != null && driverLocation && (
          <View style={styles.etaCard}>
            <View style={styles.etaRow}>
              <Clock size={14} color="#2563eb" />
              <Text style={styles.etaLabel}>وقت الوصول لمحطتك</Text>
              <Text style={styles.etaValue}>~{etaMinutes} دقيقة</Text>
            </View>
            {trip.passengerCount != null && (
              <View style={styles.etaDivider} />
            )}
            {trip.passengerCount != null && (
              <View style={styles.etaRow}>
                <Users size={14} color="#64748b" />
                <Text style={styles.etaLabel}>الركاب حالياً</Text>
                <Text style={[styles.etaValue, { color: '#64748b' }]}>{trip.passengerCount}</Text>
              </View>
            )}
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

      <SafetySheet
        visible={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        tripId={trip?.id ?? tripIdRef.current}
        routeName={trip?.routeName}
        driverName={trip?.driverName}
        fallbackCoords={trip?.pickupLat != null && trip?.pickupLng != null
          ? { latitude: trip.pickupLat, longitude: trip.pickupLng }
          : null}
      />

    </LinearGradient>
  );
}
