import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView,
  Animated, Easing,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Share2, Check, CheckCircle, ArrowLeft, ArrowRight, Ticket, MapPin, Calendar, User, Tag, Zap } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useBooking } from '@/context/BookingContext';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors, S } from '@/constants/colors';
import { getSocket } from '@/src/api/socket';


function SparkleParticle({ deg, delay, color, size = 8 }: { deg: number; delay: number; color: string; size?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const distance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay * 1000),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
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

interface TrackingUpdate {
  tripId: number;
  stationId: number;
  stationName: string;
  status: string;
  arrivedAt: string;
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
    headerBtn: {
      width: 42, height: 42, alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)',
      borderRadius: 21, borderWidth: 1,
      borderColor: c.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.35)',
    },
    headerTitle: { fontSize: 15, fontWeight: '600', color: c.ink, letterSpacing: -0.2 },
    scrollContent: { paddingHorizontal: 20, gap: 20, paddingTop: 4 },

    /* ── Celebration block ── */
    celebrationBlock: { alignItems: 'center', paddingTop: 8, paddingBottom: 4, gap: 14 },
    sparkleHost: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center', position: 'relative' },
    checkRing: {
      width: 96, height: 96, borderRadius: 48,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    checkCircle: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: '#22c55e',
      alignItems: 'center', justifyContent: 'center',
      shadowColor: '#22c55e', shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.5, shadowRadius: 24, elevation: 14,
    },
    confirmedLabel: { fontSize: 24, fontWeight: '800', color: c.ink, letterSpacing: -0.6, textAlign: 'center' },
    bookingId: { fontSize: 13, color: c.inkSoft, textAlign: 'center' },

    /* ── Ticket card ── */
    ticketCard: {
      borderRadius: 28, overflow: 'hidden', backgroundColor: c.white,
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
      shadowOpacity: c.isDark ? 0.35 : 0.10, shadowRadius: 24, elevation: 10,
    },
    ticketHeader: {
      paddingHorizontal: 22, paddingTop: 22, paddingBottom: 18,
      borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden',
    },
    ticketHeaderGlow: {
      position: 'absolute', top: -50, right: -50,
      width: 180, height: 180, borderRadius: 90,
      backgroundColor: 'rgba(255,255,255,0.07)',
    },
    ticketHeaderGlow2: {
      position: 'absolute', bottom: -30, left: -30,
      width: 120, height: 120, borderRadius: 60,
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    ticketTripBadge: {
      alignSelf: 'flex-end', marginBottom: 14,
      borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    },
    ticketTripBadgeText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
    ticketRouteName: {
      fontSize: 22, fontWeight: '800', color: '#ffffff',
      letterSpacing: -0.5, marginBottom: 8, textAlign: 'center',
    },
    ticketRouteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 },
    ticketStation: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    ticketStationDot: { width: 8, height: 8, borderRadius: 4 },
    ticketStationText: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
    ticketTimeRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8, marginTop: 12 },
    ticketTime: { fontSize: 36, fontWeight: '800', color: '#ffffff', letterSpacing: -1 },
    ticketTimeTz: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },

    /* Perforation */
    perforationRow: { flexDirection: 'row', alignItems: 'center', height: 32, position: 'relative' },
    punchLeft: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.isDark ? c.background : '#f0f0f5', marginStart: -16 },
    perforationLine: {
      flex: 1, height: 0,
      borderTopWidth: 2, borderColor: c.isDark ? 'rgba(255,255,255,0.08)' : '#e2e2ea',
      borderStyle: 'dashed',
    },
    punchRight: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.isDark ? c.background : '#f0f0f5', marginEnd: -16 },

    /* Ticket body */
    ticketBody: { paddingHorizontal: 22, paddingBottom: 24, paddingTop: 8, backgroundColor: c.white, gap: 0 },
    infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0, marginBottom: 20 },
    infoRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f5',
    },
    infoIcon: {
      width: 36, height: 36, borderRadius: 12,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : '#f5f5fa',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    infoLabel: { fontSize: 10, color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 0.8 },
    infoValue: { fontSize: 14, fontWeight: '600', color: c.ink, marginTop: 1 },

    /* Status badge in ticket header */
    statusBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      alignSelf: 'center', marginTop: 10, marginBottom: 2,
      borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6,
    },
    statusBadgeDot: { width: 7, height: 7, borderRadius: 3.5 },
    statusBadgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },

    /* Pending notice banner — modern minimal */
    pendingBanner: {
      borderRadius: 18, overflow: 'hidden',
      marginBottom: 4,
    },
    pendingBannerInner: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      borderRadius: 18,
      borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
      backgroundColor: 'rgba(245,158,11,0.09)',
    },
    pendingBannerIcon: {
      width: 34, height: 34, borderRadius: 10,
      backgroundColor: 'rgba(245,158,11,0.18)',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    pendingBannerTitle: {
      fontSize: 13, fontWeight: '700', color: '#92400e', marginBottom: 2,
    },
    pendingBannerBody: {
      fontSize: 12, color: '#92400e', lineHeight: 17, opacity: 0.85,
    },

    /* Boarded banner */
    boardedBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: '#22c55e', borderRadius: 20, padding: 16,
    },
    boardedBannerText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#ffffff' },

    /* Tracking card */
    trackingCard: { borderRadius: 20, backgroundColor: c.mist, padding: 14, gap: 8 },
    trackingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    trackingTitle: { fontSize: 13, fontWeight: '600', color: c.ink },
    trackingStation: { fontSize: 13, color: c.ink, fontWeight: '500' },
    trackingSub: { fontSize: 11, color: c.inkSoft },

    /* Actions */
    actions: { gap: 10 },
    primaryBtn: {
      height: 58, borderRadius: 22, backgroundColor: c.ink,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      shadowColor: c.ink, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 20, elevation: 10,
    },
    primaryBtnText: { color: c.isDark ? c.background : c.white, fontSize: 15.5, fontWeight: '700' },
    secondaryBtn: { height: 48, alignItems: 'center', justifyContent: 'center' },
    secondaryBtnText: { fontSize: 14, color: c.inkSoft },
    goHomeBtn: {
      marginTop: 20, height: 52, paddingHorizontal: 28, borderRadius: 18,
      backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center',
    },
    goHomeBtnText: { color: c.isDark ? c.background : c.white, fontSize: 15, fontWeight: '600' },
  });
}

export default function TicketScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? 60 : insets.top;
  const { activeBooking, confirmedBookingId, confirmedTripId, confirmedBookingStatus, shuttleInfo } = useBooking();
  const { colors: c, t, language, isRTL } = useTheme();
  const isAr = language === 'ar';
  const styles = useMemo(() => makeStyles(c), [c]);

  const [boarded, setBoarded] = useState(false);
  const [latestTracking, setLatestTracking] = useState<TrackingUpdate | null>(null);
  const [shuttleDriverLocation, setShuttleDriverLocation] = useState<{ lat: number; lng: number; heading?: number } | null>(null);
  // Local trip status — updated in real-time via trip:activated socket event
  const [liveStatus, setLiveStatus] = useState<string | undefined>(confirmedBookingStatus);
  const boardedAnim = useRef(new Animated.Value(0)).current;

  const checkScale = useRef(new Animated.Value(0.5)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const checkRotate = useRef(new Animated.Value(-20)).current;
  const cardY = useRef(new Animated.Value(40)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  const bookingId = confirmedBookingId ?? '';

  useEffect(() => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(checkScale, { toValue: 1, damping: 10, stiffness: 150, useNativeDriver: true }),
      Animated.timing(checkOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
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
    if (Platform.OS === 'web') return;

    let cleanedUp = false;
    const handlers: Array<() => void> = [];

    getSocket().then((socket) => {
      if (cleanedUp) return;

      if (confirmedTripId) {
        socket.emit('passenger:join:trip', confirmedTripId);
      }

      const boardedHandler = (data: { bookingId: string; userId?: number; tripId?: number }) => {
        const id = bookingId.replace(/^#/, '');
        if (data.bookingId === id || data.bookingId === bookingId) {
          setBoarded(true);
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Animated.spring(boardedAnim, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 180 }).start();
        }
      };

      const trackingHandler = (data: TrackingUpdate) => {
        if (!confirmedTripId || data.tripId === confirmedTripId) {
          setLatestTracking(data);
        }
      };

      const driverLocationHandler = (payload: { tripId: number | string; lat: number; lng: number; heading?: number }) => {
        if (!confirmedTripId || String(payload.tripId) === String(confirmedTripId)) {
          setShuttleDriverLocation({ lat: payload.lat, lng: payload.lng, heading: payload.heading });
        }
      };

      // trip:activated — pending trip reached minimum passengers; flip status to active
      const tripActivatedHandler = (data: { tripId: number | string; activatedAt?: string }) => {
        if (!confirmedTripId || String(data.tripId) === String(confirmedTripId)) {
          setLiveStatus('active');
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      };

      socket.on('booking:boarded', boardedHandler);
      socket.on('passenger:trip:tracking', trackingHandler);
      socket.on('shuttle:driver:location', driverLocationHandler);
      socket.on('trip:activated', tripActivatedHandler);

      handlers.push(
        () => socket.off('booking:boarded', boardedHandler),
        () => socket.off('passenger:trip:tracking', trackingHandler),
        () => socket.off('shuttle:driver:location', driverLocationHandler),
        () => socket.off('trip:activated', tripActivatedHandler),
      );
    }).catch(() => {});

    return () => {
      cleanedUp = true;
      handlers.forEach((off) => off());
    };
  }, [bookingId, confirmedTripId]);

  const rotateDeg = checkRotate.interpolate({ inputRange: [-20, 0], outputRange: ['-20deg', '0deg'] });

  if (!confirmedBookingId) {
    return (
      <LinearGradient colors={c.luxeGrad} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: c.ink, textAlign: 'center', marginBottom: 8 }}>
          {t('ticket_load_error')}
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.goHomeBtn}>
          <Text style={styles.goHomeBtnText}>{t('go_back')}</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  const booking = activeBooking;

  if (!booking) {
    return (
      <LinearGradient colors={c.luxeGrad} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 16, color: c.inkSoft }}>{t('no_booking')}</Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.goHomeBtn}>
          <Text style={styles.goHomeBtnText}>{t('go_home')}</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={c.luxeGrad} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.8}>
          <X size={18} color={c.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('boarding_pass')}</Text>
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.8} onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
          <Share2 size={16} color={c.ink} />
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
                <Text style={styles.pendingBannerTitle}>Waiting for passengers</Text>
                <Text style={styles.pendingBannerBody}>
                  {t('booking_pending_notice')}
                  {shuttleInfo?.minRequired != null && shuttleInfo.bookedSeats != null
                    ? `  · ${shuttleInfo.bookedSeats}/${shuttleInfo.minRequired} seats filled`
                    : ''}
                </Text>
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

        {/* Live tracking card */}
        {latestTracking && (
          <View style={styles.trackingCard}>
            <View style={styles.trackingHeader}>
              <MapPin size={14} color={c.ink} />
              <Text style={styles.trackingTitle}>{t('cairo_time')}</Text>
            </View>
            <Text style={styles.trackingStation}>{latestTracking.stationName}</Text>
            <Text style={styles.trackingSub}>
              {latestTracking.status} ·{' '}
              {(() => {
                try {
                  return new Intl.DateTimeFormat('en-US', {
                    timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', hour12: false,
                  }).format(new Date(latestTracking.arrivedAt));
                } catch {
                  return new Date(latestTracking.arrivedAt).toLocaleTimeString('en-US', {
                    hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false,
                  });
                }
              })()}
            </Text>
          </View>
        )}

        {/* ── Ticket card ── */}
        <Animated.View style={[styles.ticketCard, { opacity: cardOpacity, transform: [{ translateY: cardY }] }]}>

          {/* Header — dark gradient with route info */}
          <LinearGradient
            colors={[c.ink, c.isDark ? '#1e1e3a' : '#1a1a32']}
            style={styles.ticketHeader}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <View style={styles.ticketHeaderGlow} />
            <View style={styles.ticketHeaderGlow2} />

            {/* Trip badge top-right */}
            <View style={styles.ticketTripBadge}>
              <Text style={styles.ticketTripBadgeText}>{t('line')} {booking.route.code}</Text>
            </View>

            {/* Route name — Arabic when locale is Arabic (§3) */}
            <Text style={styles.ticketRouteName}>
              {isAr ? (booking.route.nameAr ?? booking.route.name) : booking.route.name}
            </Text>

            {/* Live status badge — Active or Pending, prominently shown below route name */}
            {boarded ? (
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(34,197,94,0.2)' }]}>
                <View style={[styles.statusBadgeDot, { backgroundColor: '#22c55e' }]} />
                <Text style={[styles.statusBadgeText, { color: '#22c55e' }]}>Boarded</Text>
              </View>
            ) : liveStatus === 'active' ? (
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(34,197,94,0.2)' }]}>
                <View style={[styles.statusBadgeDot, { backgroundColor: '#22c55e' }]} />
                <Text style={[styles.statusBadgeText, { color: '#22c55e' }]}>{t('active')}</Text>
              </View>
            ) : liveStatus === 'pending' ? (
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(245,158,11,0.2)' }]}>
                <View style={[styles.statusBadgeDot, { backgroundColor: '#f59e0b' }]} />
                <Text style={[styles.statusBadgeText, { color: '#f59e0b' }]}>Pending</Text>
              </View>
            ) : null}

            {/* From → To */}
            <View style={styles.ticketRouteRow}>
              <View style={styles.ticketStation}>
                <View style={[styles.ticketStationDot, { backgroundColor: '#ffffff' }]} />
                <Text style={styles.ticketStationText} numberOfLines={1}>
                  {isAr
                    ? (booking.route.path[booking.fromIdx]?.nameAr ?? booking.route.path[booking.fromIdx]?.name)
                    : booking.route.path[booking.fromIdx]?.name}
                </Text>
              </View>
              {isRTL
                ? <ArrowLeft size={12} color="rgba(255,255,255,0.45)" />
                : <ArrowRight size={12} color="rgba(255,255,255,0.45)" />}
              <View style={styles.ticketStation}>
                <View style={[styles.ticketStationDot, { backgroundColor: c.accentMint }]} />
                <Text style={styles.ticketStationText} numberOfLines={1}>
                  {isAr
                    ? (booking.route.path[booking.toIdx]?.nameAr ?? booking.route.path[booking.toIdx]?.name)
                    : booking.route.path[booking.toIdx]?.name}
                </Text>
              </View>
            </View>

            {/* Departure time — prominent */}
            <View style={styles.ticketTimeRow}>
              <Text style={styles.ticketTime}>{booking.time}</Text>
              <Text style={styles.ticketTimeTz}>Cairo</Text>
            </View>
          </LinearGradient>

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
                  <Calendar size={16} color={c.ink} />
                </View>
                <View>
                  <Text style={styles.infoLabel}>{t('date')}</Text>
                  <Text style={styles.infoValue}>{booking.date}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <User size={16} color={c.ink} />
                </View>
                <View>
                  <Text style={styles.infoLabel}>{t('passengers')}</Text>
                  <Text style={styles.infoValue}>{booking.passengers}</Text>
                </View>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <View style={styles.infoIcon}>
                  <Tag size={16} color={c.ink} />
                </View>
                <View>
                  <Text style={styles.infoLabel}>{t('total')}</Text>
                  <Text style={styles.infoValue}>{booking.price} {t('egp')}</Text>
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
            <Ticket size={18} color={c.isDark ? c.background : '#ffffff'} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.secondaryBtnText}>{t('back_home')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
