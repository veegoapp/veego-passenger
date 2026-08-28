import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView,
  Animated, Easing,
} from 'react-native';
import { router } from 'expo-router';
import { X, Share2, Check, CheckCircle, ArrowLeft, ArrowRight, Ticket, Calendar, User, Tag, Zap, AlertTriangle } from 'lucide-react-native';
import { Animation } from '@/constants/animations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useActiveSession } from '@/context/ActiveSessionContext';
import { formatCairoDateTime } from '@/constants/data';
import { useBooking } from '@/context/BookingContext';
import { useTheme } from '@/context/ThemeContext';
import { getSocket } from '@/src/api/socket';
import { SOCKET_EVENTS } from '@/constants/socketEvents';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { useSplitColors, type SplitColors } from '@/constants/splitTheme';

// ── C · Split Panel — fixed palette, independent of the app's light/dark theme.
const C_MINT = '#3DDC97';


function SparkleParticle({ deg, delay, color, size = 8 }: { deg: number; delay: number; color: string; size?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const distance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay * 1000),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: Animation.duration.normal, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: Animation.duration.slower, useNativeDriver: true }),
        ]),
        Animated.timing(distance, { toValue: 1, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const radians = ((deg - 90) * Math.PI) / 180;
  const radius = 72;
  const translateX = distance.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(radians) * radius] });
  const translateY = distance.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(radians) * radius] });
  const r = Math.floor(size / 2);

  return (
    <Animated.View
      style={[
        { position: 'absolute', width: size, height: size, borderRadius: r, backgroundColor: color },
        { opacity, transform: [{ translateX }, { translateY }] },
      ]}
    />
  );
}

const SPARKLE_CONFIG = [
  { deg: 0,   delay: 0.08, size: 9 },
  { deg: 30,  delay: 0.15, size: 6 },
  { deg: 60,  delay: 0.12, size: 11 },
  { deg: 90,  delay: 0.20, size: 7 },
  { deg: 120, delay: 0.10, size: 8 },
  { deg: 150, delay: 0.18, size: 5 },
  { deg: 180, delay: 0.07, size: 10 },
  { deg: 210, delay: 0.22, size: 6 },
  { deg: 240, delay: 0.14, size: 9 },
  { deg: 270, delay: 0.09, size: 7 },
  { deg: 300, delay: 0.17, size: 11 },
  { deg: 330, delay: 0.11, size: 5 },
];

const SPARKLE_COLORS = ['#fbbf24', '#f59e0b', '#34d399', '#6ee7b7', '#93c5fd', '#fff'];


function makeStyles(S: SplitColors) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: Spacing.md },
    headerBtn: {
      width: 42, height: 42, alignItems: 'center', justifyContent: 'center',
      backgroundColor: S.card,
      borderRadius: 21, borderWidth: 1,
      borderColor: S.hair,
    },
    headerTitle: { fontSize: 15, fontWeight: '700', color: S.ink, letterSpacing: -0.2 },
    scrollContent: { paddingHorizontal: 20, gap: 20, paddingTop: Spacing.xs },

    /* ── Celebration block ── */
    celebrationBlock: { alignItems: 'center', paddingTop: Spacing.sm, paddingBottom: Spacing.xs, gap: 14 },
    sparkleHost: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center', position: 'relative' },
    checkRing: {
      width: 96, height: 96, borderRadius: 48,
      backgroundColor: 'rgba(14,159,142,0.1)',
      alignItems: 'center', justifyContent: 'center',
    },
    checkCircle: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: S.teal,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: S.teal, shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.4, shadowRadius: 24, elevation: 14,
    },
    confirmedLabel: { fontSize: 24, fontWeight: '800', color: S.ink, letterSpacing: -0.6, textAlign: 'center' },
    bookingId: { fontSize: 13, color: S.inkSoft, textAlign: 'center' },

    /* ── Ticket card ── */
    ticketCard: {
      borderRadius: 28, overflow: 'hidden', backgroundColor: S.card,
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1, shadowRadius: 24, elevation: 10,
    },
    ticketHeader: {
      backgroundColor: S.panel,
      paddingHorizontal: 22, paddingTop: 22, paddingBottom: 18,
      borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden',
    },
    ticketHeaderGlow: {
      position: 'absolute', top: -50, right: -50,
      width: 180, height: 180, borderRadius: 90,
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    ticketTripBadge: {
      alignSelf: 'flex-end', marginBottom: 14,
      borderRadius: 99, paddingHorizontal: Spacing.md, paddingVertical: 5,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    ticketTripBadgeText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
    ticketRouteName: {
      fontSize: 20, fontWeight: '800', color: '#ffffff',
      letterSpacing: -0.4, marginBottom: Spacing.sm, textAlign: 'center',
    },
    ticketRouteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
    ticketStation: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    ticketStationDot: { width: 8, height: 8, borderRadius: 4 },
    ticketStationText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
    ticketTimeRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.md },
    ticketTime: { fontSize: 34, fontWeight: '800', color: '#ffffff', letterSpacing: -1 },
    ticketTimeTz: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },

    /* Perforation */
    perforationRow: { flexDirection: 'row', alignItems: 'center', height: 32, position: 'relative' },
    punchLeft: { width: 32, height: 32, borderRadius: 16, backgroundColor: S.bg, marginStart: -16 },
    perforationLine: {
      flex: 1, height: 0,
      borderTopWidth: 2, borderColor: '#e2e2ea',
      borderStyle: 'dashed',
    },
    punchRight: { width: 32, height: 32, borderRadius: 16, backgroundColor: S.bg, marginEnd: -16 },

    /* Ticket body */
    ticketBody: { paddingHorizontal: 22, paddingBottom: Spacing.xl, paddingTop: Spacing.sm, backgroundColor: S.card, gap: 0 },
    infoRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: S.hair,
    },
    infoIcon: {
      width: 36, height: 36, borderRadius: 12,
      backgroundColor: '#F5F5FA',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    infoLabel: { fontSize: 10, color: S.cap, textTransform: 'uppercase', letterSpacing: 0.8 },
    infoValue: { fontSize: 14, fontWeight: '700', color: S.ink, marginTop: 1 },

    /* Status badge in ticket header */
    statusBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      alignSelf: 'center', marginTop: 10, marginBottom: 2,
      borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6,
    },
    statusBadgeDot: { width: 7, height: 7, borderRadius: 3.5 },
    statusBadgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },

    /* Pending notice banner */
    pendingBanner: { borderRadius: 18, overflow: 'hidden', marginBottom: Spacing.xs },
    pendingBannerInner: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      paddingHorizontal: Spacing.lg, paddingVertical: 14, borderRadius: 18,
      borderWidth: 1, borderColor: '#FDE7C0', backgroundColor: '#FFF8EC',
    },
    pendingBannerIcon: {
      width: 34, height: 34, borderRadius: 10,
      backgroundColor: '#FDE7C0',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    pendingBannerTitle: { fontSize: 13, fontWeight: '700', color: '#92400e', marginBottom: 2 },
    pendingBannerBody: { fontSize: 12, color: '#92400e', lineHeight: 17, opacity: 0.85 },

    /* Cancelled banner */
    cancelledBanner: { borderRadius: 18, overflow: 'hidden', marginBottom: Spacing.xs },
    cancelledBannerInner: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      paddingHorizontal: Spacing.lg, paddingVertical: 14, borderRadius: 18,
      borderWidth: 1, borderColor: '#F3C6C2', backgroundColor: '#FEF2F1',
    },
    cancelledBannerIcon: {
      width: 34, height: 34, borderRadius: 10,
      backgroundColor: '#F3C6C2',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    cancelledBannerTitle: { fontSize: 13, fontWeight: '700', color: '#991b1b', marginBottom: 2 },
    cancelledBannerBody: { fontSize: 12, color: '#991b1b', lineHeight: 17, opacity: 0.85 },

    /* Boarded banner */
    boardedBanner: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: S.teal, borderRadius: 20, padding: Spacing.lg,
    },
    boardedBannerText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#ffffff' },

    /* Actions */
    actions: { gap: 10 },
    primaryBtn: { height: 56, borderRadius: 20, backgroundColor: S.teal, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    primaryBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
    secondaryBtn: { height: 48, alignItems: 'center', justifyContent: 'center' },
    secondaryBtnText: { fontSize: 13.5, color: S.inkSoft, fontWeight: '600' },
    goHomeBtn: { marginTop: 20, borderRadius: 999, overflow: 'hidden' },
    goHomeBtnGradient: { height: 52, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: S.teal },
    goHomeBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  });
}

export default function TicketScreen() {
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const { session, refreshActiveSession } = useActiveSession();
  const { confirmedBookingId: bookingContextId, confirmedTripId: bookingContextTripId } = useBooking();
  const { t, language, isRTL } = useTheme();
  const isAr = language === 'ar';
  const S = useSplitColors();
  const styles = useMemo(() => makeStyles(S), [S]);

  const shuttleSession = session?.kind === 'shuttle' ? session : null;

  // Prefer ActiveSession for both cold-start recovery and post-snapshot state.
  // Fall back to BookingContext for the brief transition window after booking
  // creation (before the server emits session:snapshot via socket).
  const resolvedBookingId = shuttleSession
    ? String(shuttleSession.bookingId)
    : (bookingContextId ?? '');
  const resolvedTripId: number | null =
    shuttleSession?.trip.id ?? bookingContextTripId ?? null;
  // Derive initial live status from ActiveSession: pending booking → 'pending';
  // otherwise expose the trip-level status so cold-start recovery shows the correct badge.
  const initialStatus = shuttleSession
    ? (shuttleSession.bookingStatus === 'pending' ? 'pending' : shuttleSession.trip.status)
    : undefined;

  // All display values come from ActiveSession — no synthetic fallbacks.
  const { date: sessionDate, time: sessionTime } = shuttleSession
    ? formatCairoDateTime(shuttleSession.trip.departureTime, isRTL ? 'ar-EG' : 'en-US')
    : { date: '', time: '' };
  const displayRouteName   = shuttleSession?.trip.route.name   ?? '';
  const displayRouteNameAr = shuttleSession?.trip.route.nameAr ?? null;
  const displayFromName    = shuttleSession
    ? (shuttleSession.boardingStation?.name ?? shuttleSession.trip.route.fromLocation)
    : '';
  const displayFromNameAr  = shuttleSession?.boardingStation?.nameAr ?? null;
  // toLocation has no nameAr in the contract
  const displayToName      = shuttleSession?.trip.route.toLocation ?? '';
  const displayDirection   = shuttleSession?.trip.direction;
  const displayTime        = sessionTime;
  const displayDate        = sessionDate;
  const displayPassengers  = shuttleSession?.seatCount   ?? 1;
  const displayPrice       = shuttleSession?.totalPrice  ?? 0;

  const bookingId = resolvedBookingId;

  const [boarded, setBoarded] = useState(false);
  // The shuttle session only ever arrived over socket (session:snapshot) —
  // a passenger who just paid with a dropped socket connection was stuck on
  // "Loading…" indefinitely with no timeout, retry, or way back. After a
  // grace period, fall back to a REST refresh, then a manual retry/exit UI.
  const [sessionWaitTimedOut, setSessionWaitTimedOut] = useState(false);
  const [sessionRetrying, setSessionRetrying] = useState(false);
  const [shuttleDriverLocation, setShuttleDriverLocation] = useState<{ lat: number; lng: number; heading?: number } | null>(null);
  // Local trip status — updated in real-time via socket events
  const [liveStatus, setLiveStatus] = useState<string | undefined>(initialStatus);
  const boardedAnim = useRef(new Animated.Value(0)).current;
  // Refs so socket handlers always read latest values without stale closures
  const bookingIdRef = useRef(bookingId);
  const confirmedTripIdRef = useRef(resolvedTripId);
  bookingIdRef.current = bookingId;
  confirmedTripIdRef.current = resolvedTripId;

  const checkScale = useRef(new Animated.Value(0.5)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const checkRotate = useRef(new Animated.Value(-20)).current;
  const cardY = useRef(new Animated.Value(40)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(checkScale, { toValue: 1, damping: 10, stiffness: 150, useNativeDriver: true }),
      Animated.timing(checkOpacity, { toValue: 1, duration: Animation.duration.normal, useNativeDriver: true }),
      Animated.spring(checkRotate, { toValue: 0, damping: 16, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(250),
        Animated.spring(cardY, { toValue: 0, damping: 20, stiffness: 120, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(250),
        Animated.timing(cardOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  useEffect(() => {
    let resolvedSocket: Awaited<ReturnType<typeof getSocket>> | null = null;
    let isMounted = true;

    const boardedHandler = (data: { bookingId: string | number; userId?: number; tripId?: number; timestamp?: string }) => {
      const currentId = bookingIdRef.current;
      const bare = currentId.replace(/^#/, '');
      if (String(data.bookingId) === bare || String(data.bookingId) === currentId) {
        setBoarded(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Animated.spring(boardedAnim, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 180 }).start();
      }
    };

    const driverLocationHandler = (payload: { tripId: number | string; lat: number; lng: number; heading?: number }) => {
      const tid = confirmedTripIdRef.current;
      if (!tid || String(payload.tripId) === String(tid)) {
        setShuttleDriverLocation({ lat: payload.lat, lng: payload.lng, heading: payload.heading });
      }
    };

    const tripActivatedHandler = (data: { tripId: number | string; activatedAt?: string }) => {
      const tid = confirmedTripIdRef.current;
      if (!tid || String(data.tripId) === String(tid)) {
        setLiveStatus('active');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    };

    const reconnectHandler = () => {
      const tid = confirmedTripIdRef.current;
      if (tid && resolvedSocket) resolvedSocket.emit(SOCKET_EVENTS.PASSENGER_JOIN_TRIP, tid);
    };

    // Live trip status (started/completed) — same event trip-detail.tsx already
    // listens for; this screen only had trip:activated before, which covers the
    // booking-threshold case but not the driver actually starting/completing.
    const tripStatusHandler = (data: { tripId: string | number; status: string }) => {
      const tid = confirmedTripIdRef.current;
      if (!tid || String(data.tripId) === String(tid)) {
        setLiveStatus(data.status?.toLowerCase());
      }
    };

    (async () => {
      try {
        const socket = await getSocket();
        if (!isMounted) return;
        resolvedSocket = socket;

        if (confirmedTripIdRef.current) {
          socket.emit(SOCKET_EVENTS.PASSENGER_JOIN_TRIP, confirmedTripIdRef.current);
        }

        socket.on(SOCKET_EVENTS.BOOKING_BOARDED, boardedHandler);
        socket.on(SOCKET_EVENTS.SHUTTLE_DRIVER_LOCATION, driverLocationHandler);
        socket.on(SOCKET_EVENTS.TRIP_ACTIVATED, tripActivatedHandler);
        socket.on(SOCKET_EVENTS.SHUTTLE_TRIP_STATUS, tripStatusHandler);
        socket.on('connect', reconnectHandler);
      } catch {
        // socket unavailable — graceful degradation
      }
    })();

    return () => {
      isMounted = false;
      if (resolvedSocket) {
        resolvedSocket.off(SOCKET_EVENTS.BOOKING_BOARDED, boardedHandler);
        resolvedSocket.off(SOCKET_EVENTS.SHUTTLE_DRIVER_LOCATION, driverLocationHandler);
        resolvedSocket.off(SOCKET_EVENTS.TRIP_ACTIVATED, tripActivatedHandler);
        resolvedSocket.off(SOCKET_EVENTS.SHUTTLE_TRIP_STATUS, tripStatusHandler);
        resolvedSocket.off('connect', reconnectHandler);
      }
    };
  }, []);

  // 6s: try a REST refresh in case the socket snapshot was dropped.
  // 15s total: give up waiting and show a retry/exit UI instead of an
  // indefinite spinner.
  useEffect(() => {
    if (shuttleSession || !bookingId) return;
    const refreshTimer = setTimeout(() => {
      refreshActiveSession().catch(() => {});
    }, 6000);
    const giveUpTimer = setTimeout(() => setSessionWaitTimedOut(true), 15000);
    return () => {
      clearTimeout(refreshTimer);
      clearTimeout(giveUpTimer);
    };
  }, [shuttleSession, bookingId, refreshActiveSession]);

  const handleRetrySession = () => {
    setSessionRetrying(true);
    setSessionWaitTimedOut(false);
    refreshActiveSession()
      .catch(() => {})
      .finally(() => setSessionRetrying(false));
  };

  const rotateDeg = checkRotate.interpolate({ inputRange: [-20, 0], outputRange: ['-20deg', '0deg'] });

  if (!bookingId) {
    return (
      <View style={{ flex: 1, backgroundColor: S.bg, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl }}>
        <Text style={{ fontSize: 17, fontWeight: Typography.weight.bold, color: S.ink, textAlign: 'center', marginBottom: Spacing.sm }}>
          {t('ticket_load_error')}
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.goHomeBtn}>
          <View style={styles.goHomeBtnGradient}>
            <Text style={styles.goHomeBtnText}>{t('go_back')}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // bookingId is set (via confirmedBookingId transition window) but session not yet
  // delivered by the socket — show a brief loading state rather than an error screen.
  // After 15s with no session (dropped socket connection), offer a retry and
  // an escape hatch instead of spinning forever.
  if (!shuttleSession) {
    if (sessionWaitTimedOut) {
      return (
        <View style={{ flex: 1, backgroundColor: S.bg, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl }}>
          <Text style={{ fontSize: 17, fontWeight: Typography.weight.bold, color: S.ink, textAlign: 'center', marginBottom: Spacing.sm }}>
            {t('ticket_session_slow')}
          </Text>
          <TouchableOpacity onPress={handleRetrySession} style={styles.goHomeBtn} disabled={sessionRetrying}>
            <View style={styles.goHomeBtnGradient}>
              <Text style={styles.goHomeBtnText}>{sessionRetrying ? t('loading') : t('retry')}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={{ marginTop: Spacing.md }}>
            <Text style={{ fontSize: Typography.size.sm, color: S.inkSoft }}>{t('go_home')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: S.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: Typography.size.md, color: S.inkSoft }}>{t('loading')}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: S.bg }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.8}>
          <X size={18} color={S.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('boarding_pass')}</Text>
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.8} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
          <Share2 size={16} color={S.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.scrollContent, { paddingBottom: 52 }]} showsVerticalScrollIndicator={false}>

        {/* ── Celebration section ── */}
        <View style={styles.celebrationBlock}>
          <View style={styles.sparkleHost}>
            {SPARKLE_CONFIG.map((sp, i) => (
              <SparkleParticle
                key={sp.deg}
                deg={sp.deg}
                delay={sp.delay}
                size={sp.size}
                color={SPARKLE_COLORS[i % SPARKLE_COLORS.length]}
              />
            ))}
            <Animated.View style={[styles.checkRing, { opacity: checkOpacity, transform: [{ scale: checkScale }, { rotate: rotateDeg }] }]}>
              <View style={styles.checkCircle}>
                <Check size={36} color="#ffffff" strokeWidth={3} />
              </View>
            </Animated.View>
          </View>
          <Text style={styles.confirmedLabel}>{t('booking_confirmed')}</Text>
          {bookingId ? (
            <Text style={styles.bookingId}>Ref {bookingId.startsWith('#') ? bookingId : `#${bookingId}`}</Text>
          ) : null}
        </View>

        {/* Pending notice — shown when trip hasn't reached minRequired yet */}
        {liveStatus === 'pending' && (
          <View style={styles.pendingBanner}>
            <View style={styles.pendingBannerInner}>
              <View style={styles.pendingBannerIcon}>
                <Zap size={16} color="#f59e0b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingBannerTitle}>{t('waiting_for_passengers')}</Text>
                <Text style={styles.pendingBannerBody}>
                  {t('booking_pending_notice')}
                  {`  · ${t('seats_filled')
                    .replace('{current}', String(shuttleSession.trip.totalSeats - shuttleSession.trip.availableSeats))
                    .replace('{min}', String(shuttleSession.trip.minRequired))}`}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Cancelled notice — a system-cancelled trip's boarding pass used to
            keep looking valid with no indication anything had changed. */}
        {liveStatus === 'cancelled' && (
          <View style={styles.cancelledBanner}>
            <View style={styles.cancelledBannerInner}>
              <View style={styles.cancelledBannerIcon}>
                <AlertTriangle size={16} color="#ef4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cancelledBannerTitle}>{t('status_cancelled_trip')}</Text>
                <Text style={styles.cancelledBannerBody}>{t('trip_cancelled_notice')}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Boarded banner */}
        {boarded && (
          <Animated.View style={[styles.boardedBanner, { transform: [{ scale: boardedAnim }] }]}>
            <CheckCircle size={24} color="#ffffff" />
            <Text style={styles.boardedBannerText}>{t('boarded_msg')}</Text>
          </Animated.View>
        )}

        {/* ── Ticket card ── */}
        <Animated.View style={[styles.ticketCard, { opacity: cardOpacity, transform: [{ translateY: cardY }] }]}>

          {/* Header — dark panel with route info */}
          <View style={styles.ticketHeader}>
            <View style={styles.ticketHeaderGlow} />

            {/* route.code is not in the ActiveSession contract — badge omitted */}

            {/* Route name — Arabic when locale is Arabic (§3) */}
            <Text style={styles.ticketRouteName}>
              {isAr ? (displayRouteNameAr ?? displayRouteName) : displayRouteName}
            </Text>

            {/* Live status badge — Active or Pending, prominently shown below route name */}
            {boarded ? (
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(34,197,94,0.2)' }]}>
                <View style={[styles.statusBadgeDot, { backgroundColor: '#22c55e' }]} />
                <Text style={[styles.statusBadgeText, { color: '#22c55e' }]}>{t('boarded_badge')}</Text>
              </View>
            ) : liveStatus === 'active' ? (
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(34,197,94,0.2)' }]}>
                <View style={[styles.statusBadgeDot, { backgroundColor: '#22c55e' }]} />
                <Text style={[styles.statusBadgeText, { color: '#22c55e' }]}>{t('active')}</Text>
              </View>
            ) : liveStatus === 'boarding' ? (
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(124,58,237,0.2)' }]}>
                <View style={[styles.statusBadgeDot, { backgroundColor: '#7c3aed' }]} />
                <Text style={[styles.statusBadgeText, { color: '#7c3aed' }]}>{t('status_boarding')}</Text>
              </View>
            ) : liveStatus === 'pending' ? (
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(245,158,11,0.2)' }]}>
                <View style={[styles.statusBadgeDot, { backgroundColor: '#f59e0b' }]} />
                <Text style={[styles.statusBadgeText, { color: '#f59e0b' }]}>{t('trip_status_pending')}</Text>
              </View>
            ) : liveStatus === 'cancelled' ? (
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(239,68,68,0.2)' }]}>
                <View style={[styles.statusBadgeDot, { backgroundColor: '#ef4444' }]} />
                <Text style={[styles.statusBadgeText, { color: '#ef4444' }]}>{t('status_cancelled_trip')}</Text>
              </View>
            ) : null}

            {/* From → To */}
            <View style={styles.ticketRouteRow}>
              <View style={styles.ticketStation}>
                <View style={[styles.ticketStationDot, { backgroundColor: S.card }]} />
                <Text style={styles.ticketStationText} numberOfLines={1}>
                  {isAr ? (displayFromNameAr ?? displayFromName) : displayFromName}
                </Text>
              </View>
              {isRTL
                ? <ArrowLeft size={12} color="rgba(255,255,255,0.45)" />
                : <ArrowRight size={12} color="rgba(255,255,255,0.45)" />}
              <View style={styles.ticketStation}>
                <View style={[styles.ticketStationDot, { backgroundColor: C_MINT }]} />
                <Text style={styles.ticketStationText} numberOfLines={1}>
                  {displayToName}
                </Text>
              </View>
            </View>

            {!!displayDirection && (
              <Text style={[styles.ticketStationText, { textAlign: 'center', opacity: 0.7 }]}>
                {displayDirection === 'outbound' ? t('shuttle_direction_outbound') : t('shuttle_direction_return')}
              </Text>
            )}

            {/* Departure time — prominent */}
            <View style={styles.ticketTimeRow}>
              <Text style={styles.ticketTime}>{displayTime}</Text>
              <Text style={styles.ticketTimeTz}>{t('cairo_tz')}</Text>
            </View>
          </View>

          {/* Perforated divider */}
          <View style={styles.perforationRow}>
            <View style={styles.punchLeft} />
            <View style={styles.perforationLine} />
            <View style={styles.punchRight} />
          </View>

          {/* Ticket body */}
          <View style={styles.ticketBody}>

            {/* Info rows with icons */}
            <View style={{ gap: 0 }}>
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Calendar size={16} color={S.ink} />
                </View>
                <View>
                  <Text style={styles.infoLabel}>{t('date')}</Text>
                  <Text style={styles.infoValue}>{displayDate}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <User size={16} color={S.ink} />
                </View>
                <View>
                  <Text style={styles.infoLabel}>{t('passengers')}</Text>
                  <Text style={styles.infoValue}>{displayPassengers}</Text>
                </View>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <View style={styles.infoIcon}>
                  <Tag size={16} color={S.ink} />
                </View>
                <View>
                  <Text style={styles.infoLabel}>{t('total')}</Text>
                  <Text style={styles.infoValue}>{displayPrice} {t('egp')}</Text>
                </View>
              </View>
            </View>

            {/* Bottom spacer — fills space cleanly after QR removal */}
            <View style={{ height: 8 }} />

          </View>
        </Animated.View>

        {/* ── Action buttons ── */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.9} onPress={() => router.replace('/(tabs)/trips')}>
            <Text style={styles.primaryBtnText}>{t('view_all_trips')}</Text>
            <Ticket size={18} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.secondaryBtnText}>{t('back_home')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
