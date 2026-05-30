import { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform, Linking, Alert } from 'react-native';
import { Navigation, Flag, Star, MessageCircle, Phone, Map } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { ChatModal } from './ChatModal';
import type { RideStatus } from '@/src/api/socket';

function fmtSecs(s: number): string {
  if (s <= 0) return '0:00';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const MOCK_DRIVER = {
  name: 'Ahmed Hassan',
  initials: 'AH',
  vehicle: 'Toyota Camry 2022',
  plate: 'WG 1234',
  rating: 4.8,
  trips: 1247,
  eta: 3,
  phone: '+201234567890',
  color: '#3A7BD5',
};

interface DriverAssignedCardProps {
  visible: boolean;
  rideType: 'economy' | 'premium' | null;
  destination: string | null;
  rideStatus?: RideStatus | null;
  etaMinutes?: number | null;
  driverName?: string | null;
  driverVehicle?: string | null;
  driverRating?: number | null;
  driverPhone?: string | null;
  onCancel: () => void;
  onComplete: () => void;
  onTrackMap?: () => void;
}

export function DriverAssignedCard({
  visible,
  rideType,
  destination,
  rideStatus,
  etaMinutes,
  driverName,
  driverVehicle,
  driverRating,
  driverPhone,
  onCancel,
  onComplete,
  onTrackMap,
}: DriverAssignedCardProps) {
  const { colors: c, t } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const dotPulse = useRef(new Animated.Value(1)).current;
  const [chatOpen, setChatOpen] = useState(false);
  const initialEta = (etaMinutes ?? MOCK_DRIVER.eta) * 60;
  const [secsLeft, setSecsLeft] = useState(initialEta);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const BOTTOM_HEADER_HEIGHT = 70;

  const name = driverName ?? MOCK_DRIVER.name;
  const vehicle = driverVehicle ?? MOCK_DRIVER.vehicle;
  const rating = driverRating ?? MOCK_DRIVER.rating;
  const phone = driverPhone ?? MOCK_DRIVER.phone;

  // Derive display label from rideStatus
  const status = rideStatus ?? 'driver_assigned';
  const isArrived = status === 'arrived';
  const isStarted = status === 'started';

  const etaLabel = (() => {
    if (isStarted) return t('on_your_way');
    if (isArrived) return t('driver_arriving');
    return secsLeft > 0
      ? `${t('driver_arriving')} ${fmtSecs(secsLeft)}`
      : t('driver_arriving');
  })();

  // Update ETA when etaMinutes prop changes (from polling)
  useEffect(() => {
    if (etaMinutes != null && visible) {
      setSecsLeft(etaMinutes * 60);
    }
  }, [etaMinutes]);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 200,
      mass: 0.85,
    }).start();

    if (visible) {
      setSecsLeft((etaMinutes ?? MOCK_DRIVER.eta) * 60);
      intervalRef.current = setInterval(() => {
        setSecsLeft(prev => {
          if (prev <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(dotPulse, { toValue: 0.25, duration: 700, useNativeDriver: true }),
          Animated.timing(dotPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => { pulse.stop(); if (intervalRef.current) clearInterval(intervalRef.current); };
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      dotPulse.setValue(1);
    }
  }, [visible]);

  // Auto-complete when countdown hits zero and not yet started
  useEffect(() => {
    if (secsLeft === 0 && visible && !isStarted && !isArrived) {
      const timer = setTimeout(() => onComplete(), 1500);
      return () => clearTimeout(timer);
    }
  }, [secsLeft, visible, isStarted, isArrived]);

  // Auto-complete when ride status becomes completed
  useEffect(() => {
    if (status === 'completed' && visible) {
      onComplete();
    }
  }, [status, visible]);

  const handleCall = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = `tel:${phone}`;
    Linking.canOpenURL(url)
      .then(supported => { if (supported) Linking.openURL(url); else Alert.alert(t('error'), t('call_not_supported')); })
      .catch(() => {});
  };

  const handleCancelPress = () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      t('cancel_trip'), t('cancel_trip_q'),
      [
        { text: t('no_back'), style: 'cancel' },
        { text: t('yes_cancel'), style: 'destructive', onPress: () => onCancel() },
      ]
    );
  };

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });

  const dotColor = isStarted ? '#4d9ef6' : isArrived ? '#FFB000' : '#55c49a';

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          backgroundColor: c.isDark ? '#0f0f22' : '#ffffff',
          borderTopColor: c.isDark ? 'rgba(85,196,154,0.15)' : 'rgba(0,0,0,0.06)',
          paddingBottom: Platform.OS === 'web' ? 20 : insets.bottom + 16 + BOTTOM_HEADER_HEIGHT,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View style={styles.handle} />

      <View style={styles.container}>
        {/* ETA / Status row */}
        <View style={styles.etaRow}>
          <Animated.View style={[styles.pulseDot, { opacity: dotPulse, backgroundColor: dotColor }]} />
          <Text style={[styles.etaText, { color: dotColor }]}>{etaLabel}</Text>
          <View style={[styles.etaSep, { backgroundColor: c.border }]} />
          <Text style={[styles.etaDest, { color: c.inkSoft }]} numberOfLines={1}>
            {destination || '...'}
          </Text>
        </View>

        {/* Phase badge */}
        {(isArrived || isStarted) && (
          <View style={[styles.phaseBadge, { backgroundColor: isStarted ? 'rgba(77,158,246,0.12)' : 'rgba(255,176,0,0.12)' }]}>
            {isStarted ? <Navigation size={13} color="#4d9ef6" /> : <Flag size={13} color="#FFB000" />}
            <Text style={[styles.phaseText, { color: isStarted ? '#4d9ef6' : '#FFB000' }]}>
              {isStarted ? t('on_your_way') : t('driver_arriving')}
            </Text>
          </View>
        )}

        {/* Driver card */}
        <View style={[styles.driverCard, { backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : c.mist, borderColor: c.border }]}>
          <View style={[styles.avatarWrap, { backgroundColor: MOCK_DRIVER.color }]}>
            <Text style={styles.avatarText}>{MOCK_DRIVER.initials}</Text>
          </View>
          <View style={styles.driverMeta}>
            <Text style={[styles.driverName, { color: c.ink }]}>{name}</Text>
            <View style={styles.driverStats}>
              <Star size={13} color="#FFB000" />
              <Text style={[styles.statVal, { color: c.ink }]}>{rating}</Text>
              <View style={[styles.sep, { backgroundColor: c.border }]} />
              <Text style={[styles.statVal, { color: c.inkSoft }]}>{MOCK_DRIVER.trips} {t('total_trips_label')}</Text>
            </View>
          </View>
          <View style={styles.vehicleBlock}>
            <Text style={[styles.vehicleText, { color: c.inkSoft }]} numberOfLines={2}>{vehicle}</Text>
            <View style={[styles.plateBadge, { backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : c.border }]}>
              <Text style={[styles.plateText, { color: c.ink }]}>{MOCK_DRIVER.plate}</Text>
            </View>
          </View>
        </View>

        {/* Action row: Chat + Call + Track */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.chatBtn, { backgroundColor: '#55c49a' }]}
            activeOpacity={0.85}
            onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync(); setChatOpen(true); }}
          >
            <MessageCircle size={18} color="#ffffff" />
            <Text style={[styles.chatBtnText, { color: '#ffffff' }]}>{t('chat')}</Text>
          </TouchableOpacity>
          {onTrackMap && (
            <TouchableOpacity
              style={[styles.callBtn, { backgroundColor: 'rgba(37,99,235,0.12)', borderWidth: 1, borderColor: 'rgba(37,99,235,0.3)' }]}
              activeOpacity={0.8}
              onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync(); onTrackMap(); }}
            >
              <Map size={20} color="#2563eb" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.callBtn, { backgroundColor: c.isDark ? 'rgba(255,255,255,0.07)' : c.mist }]}
            activeOpacity={0.8}
            onPress={handleCall}
          >
            <Phone size={20} color={c.ink} />
          </TouchableOpacity>
        </View>

        {/* Cancel — hidden during active ride */}
        {!isStarted && (
          <TouchableOpacity style={styles.cancelRow} onPress={handleCancelPress} activeOpacity={0.7}>
            <Text style={styles.cancelText}>{t('cancel_trip')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ChatModal visible={chatOpen} onClose={() => setChatOpen(false)} driverName={name} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 24,
    paddingTop: 6,
    zIndex: 999,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(150,150,180,0.35)', alignSelf: 'center', marginBottom: 16 },
  container: { paddingHorizontal: 18, gap: 12 },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pulseDot: { width: 8, height: 8, borderRadius: 4 },
  etaText: { fontSize: 13.5, fontWeight: '700' },
  etaSep: { width: 1, height: 14, marginHorizontal: 2 },
  etaDest: { fontSize: 12.5, flex: 1 },
  phaseBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  phaseText: { fontSize: 12, fontWeight: '700' },
  driverCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14, borderWidth: 1 },
  avatarWrap: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  driverMeta: { flex: 1, gap: 4 },
  driverName: { fontSize: 15.5, fontWeight: '700', letterSpacing: -0.3 },
  driverStats: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statVal: { fontSize: 12, fontWeight: '500' },
  sep: { width: 1, height: 12 },
  vehicleBlock: { alignItems: 'flex-end', gap: 5 },
  vehicleText: { fontSize: 10.5, maxWidth: 95, textAlign: 'right' },
  plateBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  plateText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  actionRow: { flexDirection: 'row', gap: 10 },
  chatBtn: { flex: 1, height: 50, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  chatBtnText: { fontSize: 15, fontWeight: '700' },
  callBtn: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cancelRow: { alignItems: 'center', paddingVertical: 6 },
  cancelText: { fontSize: 14, fontWeight: '600', color: '#e0584a' },
});
