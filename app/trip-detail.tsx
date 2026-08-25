import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView, Share,
  Modal, Pressable, Image, useWindowDimensions,
} from 'react-native';
import { AppLoader } from '@/components/ui/AppLoader';
import { showAppAlert } from '@/components/shared/AppAlertHost';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ArrowRight, MapPin, Share2, Navigation, X, Star, ShieldAlert, Clock, Users, Car, HelpCircle, Timer, CheckCircle2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors, S } from '@/constants/colors';
import { shuttleStatusLabel, formatCairoDateTime, formatCairoTime } from '@/constants/data';
import type { ShuttleDirection } from '@/constants/data';
import { shuttleStatusColor } from '@/components/shuttle/tripSheetHelpers';
import { useActiveSession } from '@/context/ActiveSessionContext';
import { cancelBooking, submitShuttleRating } from '@/src/api/shuttleService';
import { getRide } from '@/src/api/rideService';
import { getGivenRatings } from '@/src/api/userService';
import { getSocket } from '@/src/api/socket';
import { SOCKET_EVENTS } from '@/constants/socketEvents';
import api, { tokenStore } from '@/src/api/client';
import { PassengerTrackingMap } from '@/components/shared/PassengerTrackingMap';
import type { Station } from '@/components/shared/PassengerTrackingMap';
import { RealMap } from '@/components/shared/RealMap';
import { RatingSheet } from '@/components/shared/RatingSheet';
import { SafetySheet } from '@/components/shared/SafetySheet';
import { TripSupportSheet } from '@/components/shared/TripSupportSheet';
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
  /** Scheduled time at this booking's boarding/alighting station — derived
   *  before the trip starts, frozen once it has (GET /bookings/:id's
   *  boardingScheduledTime/alightingScheduledTime). Distinct from `time`
   *  above, which is the trip's departure from the route's first station,
   *  not necessarily this passenger's own boarding station. */
  boardingScheduledTime?: string | null;
  alightingScheduledTime?: string | null;
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

/** On-demand ride (car/scooter/delivery) trip detail — from GET /rides/:id. */
interface RideDetail {
  id: string | number;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  requestedAt: string | null;
  driverAssignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  actualDurationMinutes: number | null;
  distanceKm: number | null;
  finalPrice: number | null;
  driverName: string | null;
  driverAvatarUrl: string | null;
  driverRating: number | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehiclePlate: string | null;
  vehicleType: 'car' | 'scooter' | 'delivery' | null;
}

const RIDE_LABEL = {
  startedAt:   { en: 'Started',   ar: 'بدأت' },
  completedAt: { en: 'Completed', ar: 'اكتملت' },
  distance:    { en: 'Distance',  ar: 'المسافة' },
  duration:    { en: 'Duration',  ar: 'المدة' },
  price:       { en: 'Total fare', ar: 'السعر الإجمالي' },
  driver:      { en: 'Driver',    ar: 'السائق' },
  rating:      { en: 'Rating',    ar: 'التقييم' },
  vehicle:     { en: 'Vehicle',   ar: 'المركبة' },
  plate:       { en: 'Plate',     ar: 'رقم اللوحة' },
};

const RIDE_STATUS_LABEL: Record<string, { en: string; ar: string }> = {
  requested:       { en: 'Requested',        ar: 'تم الطلب' },
  searching:       { en: 'Finding driver',   ar: 'جاري البحث عن سائق' },
  driver_assigned: { en: 'Driver assigned',  ar: 'تم تعيين السائق' },
  driver_arrived:  { en: 'Driver arrived',   ar: 'وصل السائق' },
  active:          { en: 'In progress',      ar: 'جارية' },
  started:         { en: 'In progress',      ar: 'جارية' },
  completed:       { en: 'Completed',        ar: 'مكتملة' },
  cancelled:       { en: 'Cancelled',        ar: 'ملغية' },
};

const RIDE_STATUS_COLOR: Record<string, string> = {
  requested: '#f59e0b',
  searching: '#f59e0b',
  driver_assigned: '#1e1e28',
  driver_arrived: '#1e1e28',
  active: '#55c49a',
  started: '#55c49a',
  completed: '#94a3b8',
  cancelled: '#dc2626',
};

function rideStatusLabel(status: string, isAr: boolean): string {
  const entry = RIDE_STATUS_LABEL[status];
  if (!entry) return status || '—';
  return isAr ? entry.ar : entry.en;
}

/** Formats an ISO timestamp via the app's existing Cairo-timezone date utility; '—' when absent. */
function formatRideTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const { date, time } = formatCairoDateTime(iso);
  if (date === '—') return '—';
  return `${date} · ${time}`;
}

function mapRideToDetail(r: any): RideDetail {
  const driver = r.driver ?? {};
  const vehicle = driver.vehicle ?? r.vehicle ?? {};
  const pickup = r.pickup ?? {};
  const dropoff = r.dropoff ?? {};

  return {
    id: r.id ?? '',
    status: String(r.status ?? '').toLowerCase(),
    pickupAddress: r.pickupAddress ?? pickup.address ?? '—',
    dropoffAddress: r.dropoffAddress ?? dropoff.address ?? '—',
    pickupLat: r.pickupLatitude ?? pickup.latitude ?? null,
    pickupLng: r.pickupLongitude ?? pickup.longitude ?? null,
    dropoffLat: r.dropoffLatitude ?? dropoff.latitude ?? null,
    dropoffLng: r.dropoffLongitude ?? dropoff.longitude ?? null,
    requestedAt: r.requestedAt ?? null,
    driverAssignedAt: r.driverAssignedAt ?? null,
    startedAt: r.startedAt ?? null,
    completedAt: r.completedAt ?? null,
    actualDurationMinutes: typeof r.actualDurationMinutes === 'number' ? r.actualDurationMinutes : null,
    distanceKm: typeof r.distanceKm === 'number' ? r.distanceKm : null,
    finalPrice: typeof r.finalPrice === 'number' ? r.finalPrice : (typeof r.price === 'number' ? r.price : null),
    driverName: driver.name ?? null,
    driverAvatarUrl: driver.avatarUrl ?? driver.photoUrl ?? driver.avatar ?? driver.photo ?? null,
    driverRating: typeof driver.rating === 'number' ? driver.rating : null,
    vehicleMake: vehicle.make ?? null,
    vehicleModel: vehicle.model ?? null,
    vehiclePlate: vehicle.plateNumber ?? vehicle.plate_number ?? null,
    vehicleType: (['car', 'scooter', 'delivery'].includes(r.vehicleType ?? r.type ?? '')
      ? (r.vehicleType ?? r.type)
      : null) as 'car' | 'scooter' | 'delivery' | null,
  };
}

function mapApiToDetail(b: any): TripDetail {
  // GET /bookings/:id (the primary source for this screen) returns a FLAT
  // shape — trip/route fields spread directly onto the booking row, not
  // nested under `b.trip`/`b.route`. That nested shape doesn't exist there
  // at all, so reading it first silently produced an all-'—' detail screen.
  // GET /users/me/bookings (the fallback path below) may still nest under
  // `b.trip` — kept as a secondary source so both are supported.
  const trip = b.trip ?? {};
  const route = trip.route ?? trip.shuttleLine ?? trip.line ?? {};
  const fromStation = b.fromStation ?? trip.pickupStation ?? b.pickupStation ?? null;
  const toStation = b.toStation ?? null;
  const departureIso = b.departureTime ?? trip.departureTime ?? b.scheduledAt ?? '';
  // §21.9: display in Africa/Cairo, not UTC
  const { date, time } = formatCairoDateTime(departureIso);
  return {
    // The real trip id — GET /bookings/:id returns it flat as `tripId`
    // (there is no `trip.id`). Previously this fell through to `b.id`
    // (the booking id), which is what fed the trip id into the rating and
    // SOS endpoints and the live-tracking socket room further down.
    id: b.tripId ?? trip.id ?? b.id ?? '',
    // Distinct from `id` above (which resolves to the trip id when available) —
    // cancellation must target the booking's own id, not the trip's.
    bookingId: b.id ?? null,
    routeId: b.routeId ?? trip.routeId ?? route.id ?? null,
    // The trip's own lifecycle status (scheduled/active/boarding/completed/
    // cancelled) — not the booking's status (confirmed/pending/cancelled),
    // which is a different, coarser field. Every check below (map
    // visibility, rating gate, "Confirmed" badge) is written for the trip's
    // states, so reading the booking's status here made a system-cancelled
    // trip still display "Confirmed."
    status: (b.tripStatus ?? trip.status ?? trip.shuttleStatus ?? b.status ?? '').toLowerCase(),
    departureIso,
    routeName:   b.routeName   ?? route.name   ?? trip.name  ?? '—',
    routeNameAr: b.routeNameAr ?? route.nameAr ?? null,
    from:   fromStation?.name ?? route.fromLocation   ?? route.from  ?? b.pickupName     ?? b.origin      ?? '—',
    fromAr: fromStation?.nameAr ?? route.fromLocationAr ?? null,
    to:   b.toLocation ?? route.toLocation   ?? route.to  ?? toStation?.name ?? b.destinationName ?? b.destination ?? '—',
    toAr: route.toLocationAr ?? null,
    date,
    time,
    seat: b.seatNumber ?? b.seat ?? '—',
    price: b.totalPrice ?? trip.price ?? b.price ?? 0,
    passengerCount: b.seatCount ?? trip.passengerCount ?? null,
    minPassengers: trip.minPassengers ?? null,
    pickupLat: fromStation?.latitude ?? null,
    pickupLng: fromStation?.longitude ?? null,
    pickupStationId: fromStation?.id ?? null,
    boardingScheduledTime: b.boardingScheduledTime ?? null,
    alightingScheduledTime: b.alightingScheduledTime ?? null,
    driverName: b.driverName ?? trip.driver?.name ?? b.driver?.name ?? null,
    driverUserId: b.driverUserId ?? trip.driver?.userId ?? trip.driver?.user?.id ?? b.driver?.userId ?? b.driver?.user?.id ?? null,
    direction: b.direction ?? trip.direction ?? undefined,
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

function makeStyles(c: ThemeColors, isRTL: boolean) {
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
    mapPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.ink },
    staleLocationBadge: { position: 'absolute', top: 12, right: 16, zIndex: 10, backgroundColor: 'rgba(217,119,6,0.9)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
    staleLocationText: { fontSize: 11, fontWeight: Typography.weight.semibold, color: '#fff' },
    shareCard: { marginHorizontal: 20, borderRadius: 20, borderWidth: 1.5, borderColor: c.accentMint, backgroundColor: 'rgba(85,196,154,0.06)', padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
    shareCardText: { flex: 1 },
    shareCardTitle: { fontSize: 13.5, fontWeight: Typography.weight.bold, color: c.ink },
    shareCardBody: { fontSize: Typography.size.xs, color: c.inkSoft, marginTop: 3, lineHeight: 17 },
    shareCardBtn: { paddingHorizontal: Spacing.lg, paddingVertical: 9, borderRadius: 14, backgroundColor: c.accentMint, flexDirection: 'row', alignItems: 'center', gap: 6 },
    shareCardBtnText: { fontSize: 13, fontWeight: Typography.weight.bold, color: '#fff' },
    loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    loadingText: { fontSize: Typography.size.sm, color: c.inkSoft },
    errorText: { fontSize: Typography.size.sm, color: c.badge, textAlign: 'center', marginHorizontal: Spacing.xxl },
    goBack: { marginTop: Spacing.md, borderRadius: 14, overflow: 'hidden' },
    goBackGradient: { paddingHorizontal: Spacing.xl, paddingVertical: 11 },
    goBackText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: '#ffffff' },
    cancelBtn: { marginHorizontal: 20, marginBottom: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: c.badge, backgroundColor: `${c.badge}0D`, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    cancelBtnText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: c.badge },
    rateBtn: { marginHorizontal: 20, marginBottom: Spacing.sm, height: 54, borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.24, shadowRadius: 12, elevation: 6 },
    rateBtnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    rateBtnText: { fontSize: 15, fontWeight: Typography.weight.bold, color: '#ffffff' },
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
      backgroundColor: c.mist,
      borderRadius: 18, padding: 14, borderWidth: 1,
      borderColor: c.border,
      gap: Spacing.sm,
    },
    etaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    etaLabel: { flex: 1, fontSize: 13, color: c.inkSoft },
    etaValue: { fontSize: Typography.size.sm, fontWeight: Typography.weight.bold, color: c.ink },
    etaDivider: { height: 1, backgroundColor: c.border },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl },
    modalBox: { borderRadius: Radius.xl, padding: Spacing.xl, width: '100%', maxWidth: 380, gap: Spacing.md },
    modalTitle: { fontSize: 17, fontWeight: Typography.weight.bold, textAlign: 'center' },
    modalBody: { fontSize: Typography.size.sm, lineHeight: 21, textAlign: 'center' },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: Spacing.xs },
    modalBtn: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    modalBtnText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold },
    nextStopCard: {
      marginHorizontal: 20, marginBottom: Spacing.sm,
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      backgroundColor: c.mist,
      borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
      borderWidth: 1, borderColor: c.border,
    },
    nextStopLabel: { fontSize: 11, color: c.inkSoft, fontWeight: Typography.weight.semibold },
    nextStopName: { flex: 1, fontSize: 13, fontWeight: Typography.weight.bold, color: c.ink, textAlign: isRTL ? 'right' : 'left' },
    helpBtn: { marginHorizontal: 20, marginBottom: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: c.isDark ? 'rgba(232,232,242,0.25)' : 'rgba(30,30,40,0.15)', backgroundColor: c.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', padding: 14, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: Spacing.sm },
    helpBtnText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: c.ink },

    // ── Ride trip-detail redesign (header map + unified card) ──────────────
    rideMapHeader: { width: '100%', overflow: 'hidden' },
    rideMapStatusPill: {
      position: 'absolute', top: 14, left: 16, zIndex: 10,
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: Radius.full,
      paddingHorizontal: 12, paddingVertical: 6,
    },
    rideMapStatusText: { fontSize: 12, fontWeight: Typography.weight.semibold, color: '#fff' },
    unifiedCard: {
      marginHorizontal: 20, borderRadius: Radius.xl,
      borderWidth: 1, borderColor: c.border, backgroundColor: c.white,
      padding: Spacing.lg, gap: Spacing.lg, marginBottom: Spacing.lg,
      ...S.float,
    },
    divider: { height: 1, backgroundColor: c.border },

    driverRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    avatarImg: { width: 56, height: 56, borderRadius: Radius.lg, backgroundColor: c.mist },
    avatarFallback: {
      width: 56, height: 56, borderRadius: Radius.lg,
      backgroundColor: c.mist, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarInitials: { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: c.ink },
    driverInfo: { flex: 1, gap: 4 },
    driverNameText: { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: c.ink, letterSpacing: -0.2 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    ratingText: { fontSize: 13, fontWeight: Typography.weight.semibold, color: c.inkSoft },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: 2 },
    tag: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: c.mist, borderRadius: Radius.full,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    tagText: { fontSize: 11.5, fontWeight: Typography.weight.semibold, color: c.inkSoft },

    timeline: { gap: 0 },
    timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, minHeight: 34 },
    timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
    timelineLine: { width: 10, alignItems: 'center' },
    timelineLineBar: { width: 2, flex: 1, minHeight: 18, backgroundColor: c.border, marginVertical: 2 },
    timelineText: { flex: 1, fontSize: Typography.size.sm, color: c.ink, lineHeight: 19 },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    statTile: {
      flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      backgroundColor: c.mist, borderRadius: Radius.lg, borderWidth: 1, borderColor: c.border,
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    },
    statIconWrap: {
      width: 32, height: 32, borderRadius: Radius.md,
      backgroundColor: c.white, alignItems: 'center', justifyContent: 'center',
    },
    statLabel: { fontSize: 10, color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 },
    statValue: { fontSize: 13, fontWeight: Typography.weight.semibold, color: c.ink, marginTop: 2 },

    priceRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(30,30,40,0.03)',
      borderRadius: Radius.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    },
    priceLabel: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: c.inkSoft },
    priceValue: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, color: c.ink, letterSpacing: -0.4 },
  });
}

export default function TripDetailScreen() {
  const { id, openRating } = useLocalSearchParams<{ id: string; openRating?: string }>();
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const { height: windowHeight } = useWindowDimensions();
  const { colors: c, t, language, isRTL } = useTheme();
  const isAr = language === 'ar';
  const styles = useMemo(() => makeStyles(c, isRTL), [c, isRTL]);

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [rideDetail, setRideDetail] = useState<RideDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  // D6-4: last time driverLocation was actually refreshed (live tick or a
  // resilient re-seed below) + a periodically-recomputed staleness flag, so
  // the map never shows a frozen marker as if it were current.
  const driverLocationUpdatedAtRef = useRef<number | null>(null);
  const [driverLocationStale, setDriverLocationStale] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const liveStatusRef = useRef<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [shuttleRatingVisible, setShuttleRatingVisible] = useState(false);
  const [shuttleAlreadyRated, setShuttleAlreadyRated] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [boarded, setBoarded] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [nextStation, setNextStation] = useState<Station | null>(null);

  const tripIdRef = useRef<string | number | null>(null);
  const bookingIdRef = useRef<string | number | null>(null);
  // Latest routeId/direction, kept in sync by the station-polling effect below —
  // read by the station-arrived/completed socket handlers so they can trigger
  // an immediate refetch without needing to be in the [id]-only effect's deps.
  const tripStationsMetaRef = useRef<{ routeId: string | number; direction?: ShuttleDirection } | null>(null);

  // ── ActiveSession cold-start seed ────────────────────────────────────────
  // Populate initial trip state from ActiveSession so the screen renders
  // immediately on cold start / force-close recovery, with no loading flash.
  // The REST fetch that follows will overwrite this with full data (seat number
  // etc.) once it completes. Guard: only runs while trip is still null so the
  // REST result is never overwritten by a stale snapshot.
  const { session } = useActiveSession();

  // Shuttle-only: this trip's actual bus size (hiace = 14-seat microbus,
  // minibus = 28-seat) — already present on the ActiveSession snapshot
  // (PassengerShuttleTrip.vehicleType), no new fetch needed. Undefined until
  // the session resolves, which leaves PassengerTrackingMap on its existing
  // 'shuttle' default (generic bus) — never a broken/missing marker.
  const shuttleVehicleType = session?.kind === 'shuttle' ? (session as any).trip?.vehicleType : undefined;

  // D6-4: applies a driver location update and stamps when it happened, so
  // staleness can be measured from either a live socket tick or a session
  // re-seed (below) — single choke point used by both.
  const applyDriverLocation = useCallback((loc: DriverLocation) => {
    driverLocationUpdatedAtRef.current = Date.now();
    setDriverLocationStale(false);
    setDriverLocation(loc);
  }, []);

  // ── Driver location seed from ActiveSession ───────────────────────────────
  // Seed driverLocation from the session's last-known driver position so the
  // map shows the driver marker immediately on open, before the first socket
  // event arrives. Socket updates continue replacing this value normally.
  // D6-4: also re-applies once the current location has gone stale — this
  // reuses ActiveSessionContext's existing refresh-on-foreground/reconnect
  // behavior as the recovery path instead of standing up a second polling
  // mechanism, so a frozen marker can recover without a live tick.
  useEffect(() => {
    if (session?.kind !== 'shuttle') return;
    if (driverLocation !== null && !driverLocationStale) return;
    const lat = (session as any).trip?.driver?.currentLatitude;
    const lng = (session as any).trip?.driver?.currentLongitude;
    if (lat != null && lng != null) {
      applyDriverLocation({ lat: Number(lat), lng: Number(lng) });
    }
  }, [session, driverLocation, driverLocationStale, applyDriverLocation]);

  // D6-4: periodically checks whether the last-applied driver location is
  // still fresh. 30s is ~6x the ~5s foreground broadcast cadence and ~3x the
  // ~10s background cadence, so normal jitter doesn't false-positive.
  useEffect(() => {
    if (!driverLocation) return;
    const DRIVER_LOCATION_STALE_MS = 30000;
    const check = () => {
      const last = driverLocationUpdatedAtRef.current;
      setDriverLocationStale(last != null && Date.now() - last > DRIVER_LOCATION_STALE_MS);
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [driverLocation]);

  useEffect(() => {
    if (session?.kind !== 'shuttle') return;
    if (trip !== null) return;

    const s = session;
    const matchesTripId    = id && String(s.trip.id)    === String(id);
    const matchesBookingId = id && String(s.bookingId)  === String(id);
    if (!matchesTripId && !matchesBookingId) return;

    const { date, time } = formatCairoDateTime(s.trip.departureTime);
    setTrip({
      id:             s.trip.id,
      bookingId:      s.bookingId,
      routeId:        s.trip.route.id,
      status:         s.trip.status,
      departureIso:   s.trip.departureTime,
      routeName:      s.trip.route.name,
      routeNameAr:    s.trip.route.nameAr ?? null,
      from:           s.boardingStation?.name ?? s.trip.route.fromLocation,
      fromAr:         s.boardingStation?.nameAr ?? null,
      to:             s.trip.route.toLocation,
      toAr:           null,
      date,
      time,
      seat:           '—',
      price:          s.totalPrice,
      passengerCount: s.seatCount,
      pickupLat:      s.boardingStation?.latitude ?? null,
      pickupLng:      s.boardingStation?.longitude ?? null,
      direction:      s.trip.direction as ShuttleDirection | undefined,
    });
    // loading stays true — REST fetch will refine with full data when it lands
  }, [session, id, trip]);

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
        setRideDetail(null);
        tripIdRef.current = detail.id;
        bookingIdRef.current = detail.bookingId ?? null;
        return;
      }

      // Not a shuttle booking — this id may belong to an on-demand ride.
      const rideRaw = await getRide(id).catch(() => null);
      const rideObj = rideRaw?.data ?? rideRaw;
      if (rideObj && (rideObj.id != null || rideObj.pickupAddress != null || rideObj.pickup != null)) {
        const rideUserId = rideObj.userId ?? rideObj.passengerId ?? null;
        if (currentUserId != null && rideUserId != null &&
            String(rideUserId) !== String(currentUserId)) {
          router.replace('/(tabs)');
          return;
        }
        setRideDetail(mapRideToDetail(rideObj));
        setTrip(null);
        return;
      }

      setError(t('trip_load_error'));
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

  // Socket: join/leave trip room + listen for driver location + live status updates.
  // Shuttle-only — ride details don't use the shuttle trip-room protocol.
  //
  // Keyed on trip.id (the real trip id, resolved from the fetched detail),
  // NOT the raw `id` route param — on the primary entry path (Upcoming list)
  // that param is the booking id, not the trip id. Joining/comparing against
  // the booking id joined the wrong live-tracking socket room and silently
  // dropped every status/station event (their tripId never matched).
  const realTripId = trip?.id;
  useEffect(() => {
    if (!realTripId || rideDetail) return;

    let cleanedUp = false;
    const handlers: Array<() => void> = [];

    getSocket().then((socket) => {
      if (cleanedUp) return;

      socket.emit(SOCKET_EVENTS.JOIN_TRIP, { tripId: Number(realTripId) });

      // Driver location — moves the map marker in real time
      const locationHandler = (payload: {
        tripId: string | number;
        driverId?: string | number;
        lat: number;
        lng: number;
        heading?: number;
      }) => {
        if (String(payload.tripId) !== String(realTripId)) return;
        // D6-7: guard against a malformed/out-of-range payload reaching the
        // map — a NaN or bogus lat/lng would otherwise crash the marker or
        // silently render it in the wrong place.
        const { lat, lng, heading } = payload;
        if (
          typeof lat !== 'number' || typeof lng !== 'number' ||
          !Number.isFinite(lat) || !Number.isFinite(lng) ||
          lat < -90 || lat > 90 || lng < -180 || lng > 180
        ) return;
        applyDriverLocation({ lat, lng, heading: typeof heading === 'number' && Number.isFinite(heading) ? heading : undefined });
      };

      // Live status — updates badge and map visibility instantly, no API refetch needed
      const statusHandler = (payload: {
        tripId: string | number;
        status: string;
        passengerCount?: number;
      }) => {
        if (String(payload.tripId) === String(realTripId)) {
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
      // The event carries the booking's own id — compare against the booking
      // id captured when this screen loaded the trip.
      const boardedHandler = (data: { bookingId?: string | number }) => {
        if (!data.bookingId || bookingIdRef.current == null) return;
        if (String(data.bookingId) !== String(bookingIdRef.current)) return;
        setBoarded(true);
      };

      // Re-join trip room after socket reconnects (network recovery)
      const reconnectHandler = () => {
        socket.emit(SOCKET_EVENTS.JOIN_TRIP, { tripId: Number(realTripId) });
      };

      // Station arrival/completion — refresh the station list immediately instead
      // of waiting for the next 30s poll tick (fetchStations is a stable callback).
      const stationArrivedHandler = (payload: { tripId?: string | number; stationId?: number }) => {
        if (payload.tripId == null || String(payload.tripId) !== String(realTripId)) return;
        const meta = tripStationsMetaRef.current;
        if (meta) fetchStations(meta.routeId, meta.direction);
      };
      const stationCompletedHandler = (payload: { tripId?: string | number; stationId?: number }) => {
        if (payload.tripId == null || String(payload.tripId) !== String(realTripId)) return;
        const meta = tripStationsMetaRef.current;
        if (meta) fetchStations(meta.routeId, meta.direction);
      };

      socket.on(SOCKET_EVENTS.SHUTTLE_DRIVER_LOCATION, locationHandler);
      socket.on(SOCKET_EVENTS.SHUTTLE_TRIP_STATUS, statusHandler);
      socket.on(SOCKET_EVENTS.BOOKING_BOARDED, boardedHandler);
      socket.on('connect', reconnectHandler);
      socket.on(SOCKET_EVENTS.SHUTTLE_STATION_ARRIVED, stationArrivedHandler);
      socket.on(SOCKET_EVENTS.SHUTTLE_STATION_COMPLETED, stationCompletedHandler);

      handlers.push(
        () => socket.off(SOCKET_EVENTS.SHUTTLE_DRIVER_LOCATION, locationHandler),
        () => socket.off(SOCKET_EVENTS.SHUTTLE_TRIP_STATUS, statusHandler),
        () => socket.off(SOCKET_EVENTS.BOOKING_BOARDED, boardedHandler),
        () => socket.off('connect', reconnectHandler),
        () => socket.off(SOCKET_EVENTS.SHUTTLE_STATION_ARRIVED, stationArrivedHandler),
        () => socket.off(SOCKET_EVENTS.SHUTTLE_STATION_COMPLETED, stationCompletedHandler),
      );
    }).catch(() => {});

    return () => {
      cleanedUp = true;
      handlers.forEach((off) => off());
      getSocket().then((socket) => {
        socket.emit(SOCKET_EVENTS.LEAVE_TRIP, { tripId: Number(realTripId) });
      }).catch(() => {});
    };
  }, [realTripId, fetchStations, rideDetail, applyDriverLocation]);

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
    showAppAlert(
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
      if (result?.debtCreated && result.debtCreated > 0) {
        // A repeat late cancellation (<12h before departure) creates a real
        // cash debt — this used to reach the passenger only later, as a
        // blocked future booking, with no explanation at cancel time.
        showAppAlert(
          t('late_cancellation_debt_title'),
          t('late_cancellation_debt_msg').replace('{amount}', String(result.debtCreated)),
          [{ text: t('confirm'), onPress: () => router.back() }],
        );
      } else if (result?.refunded === false) {
        showAppAlert(
          t('booking_cancelled_title'),
          t('cancel_no_refund'),
          [{ text: t('confirm'), onPress: () => router.back() }],
        );
      } else if (result?.refunded && result.refundAmount > 0) {
        showAppAlert(
          t('booking_cancelled_title'),
          t('ride_refund_msg').replace('{amount}', String(result.refundAmount)),
          [{ text: t('confirm'), onPress: () => router.back() }],
        );
      } else {
        router.back();
      }
    } catch (e: any) {
      showAppAlert(
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
      showAppAlert(t('error'), 'Cannot submit rating: driver information unavailable');
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

  if (error || (!trip && !rideDetail)) {
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
            <LinearGradient colors={c.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.goBackGradient}>
              <Text style={styles.goBackText}>{t('go_back')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  if (rideDetail) {
    const rd = rideDetail;
    const hasDriverInfo = !!rd.driverName || !!rd.vehicleMake || !!rd.vehiclePlate;
    const hasMapCoords = (rd.pickupLat != null && rd.pickupLng != null) || (rd.dropoffLat != null && rd.dropoffLng != null);
    const ridePickup = rd.pickupLat != null && rd.pickupLng != null ? { latitude: rd.pickupLat, longitude: rd.pickupLng } : undefined;
    const rideDropoff = rd.dropoffLat != null && rd.dropoffLng != null ? { latitude: rd.dropoffLat, longitude: rd.dropoffLng } : undefined;
    const rideStatusColor = RIDE_STATUS_COLOR[rd.status] ?? c.silver;
    const vehicleLabel = rd.vehicleMake || rd.vehicleModel ? `${rd.vehicleMake ?? ''} ${rd.vehicleModel ?? ''}`.trim() : null;
    const driverInitials = rd.driverName
      ? rd.driverName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
      : '?';

    const statTiles = [
      { icon: Clock, label: RIDE_LABEL.startedAt[isAr ? 'ar' : 'en'], value: formatRideTimestamp(rd.startedAt) },
      { icon: CheckCircle2, label: RIDE_LABEL.completedAt[isAr ? 'ar' : 'en'], value: formatRideTimestamp(rd.completedAt) },
      { icon: Navigation, label: RIDE_LABEL.distance[isAr ? 'ar' : 'en'], value: rd.distanceKm != null ? `${rd.distanceKm} km` : '—' },
      { icon: Timer, label: RIDE_LABEL.duration[isAr ? 'ar' : 'en'], value: rd.actualDurationMinutes != null ? `${rd.actualDurationMinutes} ${t('min')}` : '—' },
    ];

    return (
      <LinearGradient colors={c.luxeGrad} style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: top + 12, paddingBottom: 0, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            {isRTL ? <ArrowRight size={18} color={c.ink} /> : <ArrowLeft size={18} color={c.ink} />}
          </TouchableOpacity>
        </View>

        {/* Header map — ~35% of screen height, route fitted to pickup/dropoff */}
        {hasMapCoords && (
          <View style={[styles.rideMapHeader, { height: windowHeight * 0.35 }]}>
            <RealMap pickup={ridePickup} dropoff={rideDropoff} style={{ borderRadius: 0 }} />
            <View style={[styles.rideMapStatusPill, { top: top + 60 }]}>
              <View style={[styles.statusDot, { backgroundColor: rideStatusColor }]} />
              <Text style={styles.rideMapStatusText}>{rideStatusLabel(rd.status, isAr)}</Text>
            </View>
          </View>
        )}

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80, paddingTop: hasMapCoords ? Spacing.lg : top + 12 + 40 + Spacing.lg }}>
          <View style={styles.unifiedCard}>
            {!hasMapCoords && (
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: rideStatusColor }]} />
                <Text style={[styles.statusText, { color: rideStatusColor }]}>{rideStatusLabel(rd.status, isAr)}</Text>
              </View>
            )}

            {/* Driver section */}
            {hasDriverInfo && (
              <>
                <View style={styles.driverRow}>
                  {rd.driverAvatarUrl ? (
                    <Image source={{ uri: rd.driverAvatarUrl }} style={styles.avatarImg} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitials}>{driverInitials}</Text>
                    </View>
                  )}
                  <View style={styles.driverInfo}>
                    <Text style={styles.driverNameText} numberOfLines={1}>{rd.driverName ?? '—'}</Text>
                    {rd.driverRating != null && (
                      <View style={styles.ratingRow}>
                        <Star size={13} color={c.gold} fill={c.gold} strokeWidth={0} />
                        <Text style={styles.ratingText}>{rd.driverRating.toFixed(1)}</Text>
                      </View>
                    )}
                    {(vehicleLabel || rd.vehiclePlate) && (
                      <View style={styles.tagsRow}>
                        {vehicleLabel && (
                          <View style={styles.tag}>
                            <Car size={11} color={c.inkSoft} />
                            <Text style={styles.tagText}>{vehicleLabel}</Text>
                          </View>
                        )}
                        {rd.vehiclePlate && (
                          <View style={styles.tag}>
                            <Text style={styles.tagText}>{rd.vehiclePlate}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.divider} />
              </>
            )}

            {/* Pickup → dropoff timeline */}
            <View style={styles.timeline}>
              <View style={styles.timelineRow}>
                <View style={styles.timelineLine}>
                  <View style={[styles.timelineDot, { backgroundColor: '#22c55e' }]} />
                  <View style={styles.timelineLineBar} />
                </View>
                <Text style={styles.timelineText} numberOfLines={2}>{rd.pickupAddress}</Text>
              </View>
              <View style={styles.timelineRow}>
                <View style={styles.timelineLine}>
                  <View style={[styles.timelineDot, { backgroundColor: '#ef4444' }]} />
                </View>
                <Text style={styles.timelineText} numberOfLines={2}>{rd.dropoffAddress}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Trip stats */}
            <View style={styles.statsGrid}>
              {statTiles.map(({ icon: Icon, label, value }) => (
                <View key={label} style={styles.statTile}>
                  <View style={styles.statIconWrap}>
                    <Icon size={15} color={c.ink} />
                  </View>
                  <View>
                    <Text style={styles.statLabel}>{label}</Text>
                    <Text style={styles.statValue}>{value}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.divider} />

            {/* Price */}
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>{RIDE_LABEL.price[isAr ? 'ar' : 'en']}</Text>
              <Text style={styles.priceValue}>{rd.finalPrice != null ? `${rd.finalPrice} ${t('egp')}` : '—'}</Text>
            </View>
          </View>

          {/* Need Help — available for all ride statuses */}
          <TouchableOpacity
            style={styles.helpBtn}
            onPress={() => setSupportOpen(true)}
            activeOpacity={0.8}
          >
            <HelpCircle size={14} color={c.ink} />
            <Text style={styles.helpBtnText}>{t('need_help')}</Text>
          </TouchableOpacity>
        </ScrollView>

        <TripSupportSheet
          visible={supportOpen}
          onClose={() => setSupportOpen(false)}
          serviceType={rd.vehicleType ?? 'car'}
          rideId={rd.id}
        />
      </LinearGradient>
    );
  }

  if (!trip) {
    // Unreachable given the guards above — keeps trip narrowed to non-null below.
    return null;
  }

  // D8-6: was a locally-duplicated status→color map that had drifted from
  // components/shuttle/tripSheetHelpers.ts::shuttleStatusColor (e.g. this map
  // gave 'active' and 'boarding' the same color; the shared one distinguishes
  // them). Consolidated onto the shared implementation.
  const resolvedStatusColor = shuttleStatusColor({ status: effectiveStatus }) ?? c.silver;

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
          colors={c.cardGrad}
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
              // Only shown when this booking has its own boarding/alighting
              // station — falls back to nothing (not the trip-wide `time`
              // above) rather than imply a time that isn't this passenger's.
              ...(trip.boardingScheduledTime
                ? [{ label: t('boarding_time_label'), value: formatCairoTime(trip.boardingScheduledTime) }]
                : []),
              ...(trip.alightingScheduledTime
                ? [{ label: t('alighting_time_label'), value: formatCairoTime(trip.alightingScheduledTime) }]
                : []),
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
                {boarded ? t('on_board_label') : t('driver_en_route')}
              </Text>
            </View>

            <PassengerTrackingMap
              driverLocation={driverLocation ? { latitude: driverLocation.lat, longitude: driverLocation.lng } : null}
              pickup={trip.pickupLat != null && trip.pickupLng != null
                ? { latitude: trip.pickupLat, longitude: trip.pickupLng }
                : null}
              stations={stations}
              passengerStationId={trip.pickupStationId ?? undefined}
              boarded={boarded}
              vehicleType={shuttleVehicleType}
              style={{ borderRadius: Radius.xl }}
              onEtaChange={setEtaMinutes}
              onTargetStationChange={setNextStation}
            />

            {/* SOS floating button — only once the trip is underway */}
            {(boarded || effectiveStatus === 'active') && (
              <TouchableOpacity style={styles.sosBtn} onPress={handleSOS} activeOpacity={0.85}>
                <ShieldAlert size={14} color="#fff" />
                <Text style={styles.sosBtnText}>{t('sos_label')}</Text>
              </TouchableOpacity>
            )}

            {/* Realtime connection indicator */}
            <ConnectionBanner style={{ position: 'absolute', bottom: 12, alignSelf: 'center' }} />

            {/* D6-4: driver-location staleness indicator — the marker below is
                still the last known position, but this tells the passenger it
                may not be current instead of silently going frozen. */}
            {driverLocationStale && driverLocation && (
              <View style={styles.staleLocationBadge}>
                <Text style={styles.staleLocationText}>{t('updating_driver_location')}</Text>
              </View>
            )}
          </View>
        )}

        {/* Next stop card — shown whenever there is a target station ahead */}
        {showMap && nextStation != null && (
          <View style={styles.nextStopCard}>
            <MapPin size={14} color={c.ink} />
            <Text style={styles.nextStopLabel}>
              {boarded ? t('next_station_label') : t('boarding_station_label')}
            </Text>
            <Text style={styles.nextStopName} numberOfLines={1}>
              {nextStation.name}
            </Text>
          </View>
        )}

        {/* Boarded confirmation banner */}
        {boarded && (
          <View style={styles.boardedBanner}>
            <Text style={styles.boardedEmoji}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.boardedTitle}>{t('on_board_title')}</Text>
              <Text style={styles.boardedSub}>{t('on_board_sub')}</Text>
            </View>
          </View>
        )}

        {/* ETA card — shown when driver location known + passenger not yet boarded */}
        {showMap && !boarded && etaMinutes != null && driverLocation && (
          <View style={styles.etaCard}>
            <View style={styles.etaRow}>
              <Clock size={14} color={c.ink} />
              <Text style={styles.etaLabel}>{t('eta_to_station_label')}</Text>
              <Text style={styles.etaValue}>~{etaMinutes} {t('min')}</Text>
            </View>
            {trip.passengerCount != null && (
              <View style={styles.etaDivider} />
            )}
            {trip.passengerCount != null && (
              <View style={styles.etaRow}>
                <Users size={14} color="#64748b" />
                <Text style={styles.etaLabel}>{t('current_passengers_label')}</Text>
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
            <LinearGradient colors={c.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.rateBtnGradient}>
              <Star size={16} color="#ffffff" fill="#ffffff" />
              <Text style={styles.rateBtnText}>{t('rate_driver')}</Text>
            </LinearGradient>
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

        {/* Need Help — always available for shuttle bookings */}
        <TouchableOpacity
          style={styles.helpBtn}
          onPress={() => setSupportOpen(true)}
          activeOpacity={0.8}
        >
          <HelpCircle size={14} color={c.ink} />
          <Text style={styles.helpBtnText}>{t('need_help')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Shuttle driver rating sheet */}
      <RatingSheet
        visible={shuttleRatingVisible}
        driverName={trip?.driverName ?? t('your_driver')}
        driverInitials={(trip?.driverName ?? 'D').charAt(0).toUpperCase()}
        driverColor={c.ink}
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

      <TripSupportSheet
        visible={supportOpen}
        onClose={() => setSupportOpen(false)}
        serviceType="shuttle"
        bookingId={trip?.bookingId ?? id}
      />

    </LinearGradient>
  );
}
