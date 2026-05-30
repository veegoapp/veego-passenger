import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView,
  Animated, Easing,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Share2, Check, CheckCircle, ArrowRight, Ticket } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import { useBooking } from '@/context/BookingContext';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors, S } from '@/constants/colors';
import { getSocket } from '@/src/api/socket';


function SparkleParticle({ deg, delay, color }: { deg: number; delay: number; color: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const distance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay * 1000),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 700, useNativeDriver: true }),
        ]),
        Animated.timing(distance, { toValue: 1, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const radians = ((deg - 90) * Math.PI) / 180;
  const radius = 54;
  const translateX = distance.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(radians) * radius] });
  const translateY = distance.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(radians) * radius] });

  return (
    <Animated.View
      style={[
        { position: 'absolute', width: 7, height: 7, borderRadius: 3.5, backgroundColor: color },
        { opacity, transform: [{ translateX }, { translateY }] },
      ]}
    />
  );
}

const SPARKLE_DEGREES = [0, 60, 120, 180, 240, 300];
const SPARKLE_DELAYS = [0.1, 0.15, 0.2, 0.1, 0.18, 0.12];

interface QRDisplayProps {
  value: string;
  bg: string;
  fg: string;
}

function QRDisplay({ value, bg, fg }: QRDisplayProps) {
  if (Platform.OS === 'web') {
    return (
      <View style={{ backgroundColor: bg, borderRadius: 16, padding: 10, alignItems: 'center', justifyContent: 'center', width: 100, height: 100 }}>
        <QrCode size={64} color={fg} />
      </View>
    );
  }
  return (
    <View style={{ backgroundColor: bg, borderRadius: 16, padding: 10, alignItems: 'center', justifyContent: 'center' }}>
      <QRCode
        value={value || FALLBACK_BOOKING_ID}
        size={80}
        color={fg}
        backgroundColor={bg}
        quietZone={0}
      />
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
    headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)', borderRadius: 20, borderWidth: 1, borderColor: c.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)' },
    headerTitle: { fontSize: 15, fontWeight: '600', color: c.ink, letterSpacing: -0.2 },
    scrollContent: { paddingHorizontal: 20, gap: 20, paddingTop: 4 },
    confirmBlock: { alignItems: 'center', gap: 10 },
    sparkleHost: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center', position: 'relative' },
    checkCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center', shadowColor: c.ink, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.25, shadowRadius: 28, elevation: 10 },
    confirmedLabel: { fontSize: 22, fontWeight: '700', color: c.ink, letterSpacing: -0.5, fontFamily: 'Inter_700Bold' },
    bookingId: { fontSize: 12, color: c.inkSoft, fontFamily: 'Inter_400Regular' },
    ticketCard: { borderRadius: 32, overflow: 'hidden', backgroundColor: c.white, ...S.float },
    ticketHeader: { padding: 20, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' },
    ticketHeaderGlow: { position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.06)' },
    ticketHeaderContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    ticketCodeLabel: { fontSize: 9, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1 },
    ticketCode: { fontSize: 20, fontWeight: '700', color: '#ffffff' },
    ticketHeaderMid: { flex: 1 },
    ticketRouteName: { fontSize: 13, fontWeight: '600', color: '#ffffff', marginBottom: 6 },
    ticketRouteRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    ticketStation: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 },
    ticketStationText: { fontSize: 11, color: 'rgba(255,255,255,0.8)', flex: 1 },
    ticketTimeBox: { alignItems: 'flex-end' },
    ticketTimeLabel: { fontSize: 9, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1 },
    ticketTime: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
    perforationRow: { flexDirection: 'row', alignItems: 'center', height: 24, position: 'relative' },
    punchLeft: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.isDark ? c.background : c.snow, marginLeft: -12 },
    perforationLine: { flex: 1, height: 1, borderTopWidth: 1.5, borderColor: c.border, borderStyle: 'dashed' },
    punchRight: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.isDark ? c.background : c.snow, marginRight: -12 },
    ticketBody: { padding: 20, gap: 20, backgroundColor: c.white },
    ticketGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
    ticketGridItem: { width: '50%', paddingVertical: 8, paddingRight: 8 },
    ticketItemLabel: { fontSize: 10, color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 0.9 },
    ticketItemValue: { fontSize: 14.5, fontWeight: '600', color: c.ink, marginTop: 2 },
    qrSection: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
    qrRight: { flex: 1, gap: 4 },
    qrText: { fontSize: 13.5, fontWeight: '600', color: c.ink },
    qrSub: { fontSize: 11, color: c.inkSoft },
    qrLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    qrLiveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.accentMint },
    qrLiveText: { fontSize: 11, fontWeight: '600', color: c.accentMint },
    boardedBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: '#55c49a', borderRadius: 16, padding: 14, marginTop: 8,
    },
    boardedBannerText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#ffffff' },
    actions: { gap: 10 },
    primaryBtn: { height: 56, borderRadius: 20, backgroundColor: c.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...S.float },
    primaryBtnText: { color: c.isDark ? c.background : c.white, fontSize: 15, fontWeight: '600' },
    secondaryBtn: { height: 48, alignItems: 'center', justifyContent: 'center' },
    secondaryBtnText: { fontSize: 14, color: c.inkSoft },
    goHomeBtn: { marginTop: 20, height: 48, paddingHorizontal: 24, borderRadius: 16, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
    goHomeBtnText: { color: c.isDark ? c.background : c.white, fontSize: 14, fontWeight: '600' },
  });
}

export default function TicketScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? 60 : insets.top;
  const { activeBooking, confirmedBookingId } = useBooking();
  const { colors: c, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [boarded, setBoarded] = useState(false);
  const boardedAnim = useRef(new Animated.Value(0)).current;

  const checkScale = useRef(new Animated.Value(0.6)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const checkRotate = useRef(new Animated.Value(-20)).current;
  const cardY = useRef(new Animated.Value(30)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  const bookingId = confirmedBookingId ?? '';
  const qrValue = JSON.stringify({ bookingId, app: 'veego', v: 1 });

  useEffect(() => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(checkScale, { toValue: 1, damping: 12, stiffness: 140, useNativeDriver: true }),
      Animated.timing(checkOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(checkRotate, { toValue: 0, damping: 16, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(200),
        Animated.spring(cardY, { toValue: 0, damping: 22, stiffness: 130, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(cardOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  // Listen for booking:boarded socket event (passenger side)
  useEffect(() => {
    if (!bookingId || Platform.OS === 'web') return;
    let sub: { remove: () => void } | null = null;

    getSocket().then((socket) => {
      const handler = (data: { bookingId: string; timestamp: string }) => {
        const id = bookingId.replace(/^#/, '');
        if (data.bookingId === id || data.bookingId === bookingId) {
          setBoarded(true);
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Animated.spring(boardedAnim, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 180 }).start();
        }
      };
      socket.on('booking:boarded', handler);
      sub = { remove: () => socket.off('booking:boarded', handler) };
    }).catch(() => {});

    return () => { sub?.remove(); };
  }, [bookingId]);

  const rotateDeg = checkRotate.interpolate({ inputRange: [-20, 0], outputRange: ['-20deg', '0deg'] });

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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.scrollContent, { paddingBottom: 48 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.confirmBlock}>
          <View style={styles.sparkleHost}>
            {SPARKLE_DEGREES.map((deg, i) => <SparkleParticle key={deg} deg={deg} delay={SPARKLE_DELAYS[i]} color={c.ink} />)}
            <Animated.View style={[styles.checkCircle, { opacity: checkOpacity, transform: [{ scale: checkScale }, { rotate: rotateDeg }] }]}>
              <Check size={28} color={c.isDark ? c.background : '#ffffff'} />
            </Animated.View>
          </View>
          <Text style={styles.confirmedLabel}>{t('booking_confirmed')}</Text>
          <Text style={styles.bookingId}>{bookingId}</Text>
        </View>

        {/* Boarded confirmation banner */}
        {boarded && (
          <Animated.View style={[styles.boardedBanner, { transform: [{ scale: boardedAnim }] }]}>
            <CheckCircle size={24} color="#ffffff" />
            <Text style={styles.boardedBannerText}>You've been boarded! Have a great trip.</Text>
          </Animated.View>
        )}

        <Animated.View style={[styles.ticketCard, { opacity: cardOpacity, transform: [{ translateY: cardY }] }]}>
          <LinearGradient colors={[c.ink, c.isDark ? '#2a2a4a' : '#2a2a3e']} style={styles.ticketHeader} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.ticketHeaderGlow} />
            <View style={styles.ticketHeaderContent}>
              <View>
                <Text style={styles.ticketCodeLabel}>{t('line')}</Text>
                <Text style={styles.ticketCode}>{booking.route.code}</Text>
              </View>
              <View style={styles.ticketHeaderMid}>
                <Text style={styles.ticketRouteName}>{booking.route.name}</Text>
                <View style={styles.ticketRouteRow}>
                  <View style={styles.ticketStation}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffffff', flexShrink: 0 }} />
                    <Text style={styles.ticketStationText} numberOfLines={1}>{booking.route.path[booking.fromIdx].name}</Text>
                  </View>
                  <ArrowRight size={10} color="rgba(255,255,255,0.5)" />
                  <View style={styles.ticketStation}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accentMint, flexShrink: 0 }} />
                    <Text style={styles.ticketStationText} numberOfLines={1}>{booking.route.path[booking.toIdx].name}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.ticketTimeBox}>
                <Text style={styles.ticketTimeLabel}>{t('dep')}</Text>
                <Text style={styles.ticketTime}>{booking.time}</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.perforationRow}>
            <View style={styles.punchLeft} />
            <View style={styles.perforationLine} />
            <View style={styles.punchRight} />
          </View>

          <View style={styles.ticketBody}>
            <View style={styles.ticketGrid}>
              {[
                { label: t('date'), value: booking.date },
                { label: t('passengers'), value: booking.passengers.toString() },
                { label: t('total'), value: `${booking.price} ${t('egp')}` },
              ].map((item) => (
                <View key={item.label} style={styles.ticketGridItem}>
                  <Text style={styles.ticketItemLabel}>{item.label}</Text>
                  <Text style={styles.ticketItemValue}>{item.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.qrSection}>
              <QRDisplay
                value={qrValue}
                bg={c.isDark ? c.mist : c.snow}
                fg={c.isDark ? c.ink : '#1e1e28'}
              />
              <View style={styles.qrRight}>
                <Text style={styles.qrText}>{t('scan_boarding')}</Text>
                <Text style={styles.qrSub}>{t('show_driver')}</Text>
                <View style={styles.qrLiveBadge}>
                  <View style={styles.qrLiveDot} />
                  <Text style={styles.qrLiveText}>{boarded ? 'Boarded' : t('active')}</Text>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.9} onPress={() => router.replace('/(tabs)/trips')}>
            <Text style={styles.primaryBtnText}>{t('view_all_trips')}</Text>
            <Ticket size={16} color={c.isDark ? c.background : '#ffffff'} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.secondaryBtnText}>{t('back_home')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
