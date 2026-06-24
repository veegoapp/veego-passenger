import { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated,  Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { ChatModal } from './ChatModal';
import type { DriverInfo } from '@/src/hooks/car/useRide';

interface DriverAssignedCardProps {
  visible: boolean;
  rideType: 'economy' | 'premium' | null;
  destination: string | null;
  driver?: DriverInfo | null;
  rideId?: string | null;
  rideStatus?: string;
  waitingCharge?: number | null;
  waitingChargeStatus?: 'none' | 'active' | 'capped';
  onCancel: () => void;
  onStart?: () => void;
}

export function DriverAssignedCard({
  visible, rideType, destination, driver, rideId, rideStatus,
  waitingCharge, waitingChargeStatus, onCancel, onStart,
}: DriverAssignedCardProps) {
  const { colors: c, t, isRTL } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 200,
      mass: 0.85,
    }).start();
  }, [visible]);

  const handleCall = () => {
    if (!driver?.phone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = `tel:${driver.phone}`;
    Linking.canOpenURL(url).then((ok: boolean) => { if (ok) Linking.openURL(url); }).catch(() => {});
  };

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] });
  const sheetBg  = c.isDark ? 'rgba(16,16,32,0.98)' : 'rgba(250,250,252,0.98)';
  const borderCol = c.isDark ? 'rgba(90,95,160,0.25)' : 'rgba(255,255,255,0.8)';

  const avatarColor = driver?.vehicleColor ?? '#55c49a';
  const initials = driver?.name
    ? driver.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const isStarted = rideStatus === 'started';
  const isArrived = rideStatus === 'arrived';

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          backgroundColor: sheetBg,
          borderTopColor: borderCol,
          paddingBottom: insets.bottom + 16,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View style={styles.handle} />

      <View style={styles.container}>
        {/* ETA / status row */}
        <View style={styles.etaRow}>
          <View style={[styles.pulseDot, { backgroundColor: isStarted ? '#4d9ef6' : '#55c49a' }]} />
          <Text style={[styles.etaText, { color: c.ink }]}>
            {isStarted
              ? t('trip_status_active')
              : isArrived
              ? t('status_driver_arrived')
              : `${t('driver_arriving')} ${driver?.eta ?? '—'} ${t('min')}`}
          </Text>
          {destination && (
            <>
              <View style={[styles.etaSep, { backgroundColor: c.border }]} />
              <Text style={[styles.etaDest, { color: c.inkSoft }]} numberOfLines={1}>{destination}</Text>
            </>
          )}
        </View>

        {/* Driver card */}
        <View style={[styles.driverCard, { backgroundColor: c.white, borderColor: c.border }]}>
          <View style={[styles.avatarWrap, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.driverMeta}>
            <Text style={[styles.driverName, { color: c.ink }]}>{driver?.name ?? '—'}</Text>
            <View style={styles.driverStats}>
              <Ionicons name="star" size={13} color="#FFB000" />
              <Text style={[styles.statVal, { color: c.ink }]}>{driver?.rating?.toFixed(1) ?? '—'}</Text>
              <View style={[styles.sep, { backgroundColor: c.silver }]} />
              <Text style={[styles.statVal, { color: c.inkSoft }]}>
                {driver?.vehicle ?? '—'}
              </Text>
            </View>
          </View>
          <View style={styles.vehicleBlock}>
            {driver?.plateNumber ? (
              <View style={[styles.plateBadge, { backgroundColor: c.mist }]}>
                <Text style={[styles.plateText, { color: c.ink }]}>{driver.plateNumber}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Waiting charge banner */}
        {waitingChargeStatus === 'active' && waitingCharge != null && (
          <View style={[styles.waitingBanner, { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: '#f59e0b' }]}>
            <Ionicons name="time-outline" size={14} color="#f59e0b" />
            <Text style={[styles.waitingText, { color: '#b97b10' }]}>
              {t('waiting_charge') ?? 'Waiting charge'}: {waitingCharge.toFixed(2)} {t('egp')}
            </Text>
          </View>
        )}

        {/* Action row */}
        <View style={[styles.actionRow, { borderTopColor: c.border }]}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: c.mist }]}
            activeOpacity={0.8}
            onPress={() => {
              Haptics.selectionAsync();
              setChatOpen(true);
            }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={c.ink} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: c.mist, opacity: driver?.phone ? 1 : 0.4 }]}
            activeOpacity={0.8}
            onPress={handleCall}
            disabled={!driver?.phone}
          >
            <Ionicons name="call-outline" size={18} color={c.ink} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: c.isDark ? 'rgba(235,90,90,0.15)' : 'rgba(235,90,90,0.08)' }]}
            activeOpacity={0.8}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              onCancel();
            }}
          >
            <Ionicons name="close-outline" size={20} color="#eb5a5a" />
          </TouchableOpacity>
        </View>
      </View>

      <ChatModal
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        driverName={driver?.name ?? ''}
        tripId={rideId ?? null}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.3, shadowRadius: 28, elevation: 24, paddingTop: 6, zIndex: 999,
  },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(150,150,180,0.4)', alignSelf: 'center', marginBottom: 12 },
  container: { paddingHorizontal: 20, gap: 12 },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  pulseDot: { width: 7, height: 7, borderRadius: 3.5 },
  etaText: { fontSize: 13, fontWeight: '600' },
  etaSep: { width: 1, height: 14, marginHorizontal: 2 },
  etaDest: { fontSize: 12, flex: 1 },
  driverCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 20, padding: 14, borderWidth: 1,
  },
  avatarWrap: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  driverMeta: { flex: 1, gap: 4 },
  driverName: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
  driverStats: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statVal: { fontSize: 12, fontWeight: '500' },
  sep: { width: 1, height: 12 },
  vehicleBlock: { alignItems: 'flex-end', gap: 4 },
  plateBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  plateText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  waitingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1,
  },
  waitingText: { fontSize: 12.5, fontWeight: '600' },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderTopWidth: 1, paddingTop: 12, paddingBottom: 4,
  },
  iconBtn: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
