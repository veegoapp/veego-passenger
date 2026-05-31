import { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { ChatModal } from './ChatModal';

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
  onCancel: () => void;
  onStart: () => void;
}

export function DriverAssignedCard({ visible, rideType, destination, onCancel, onStart }: DriverAssignedCardProps) {
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
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = `tel:${MOCK_DRIVER.phone}`;
    Linking.canOpenURL(url)
      .then((ok) => { if (ok) Linking.openURL(url); })
      .catch(() => {});
  };

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] });
  const sheetBg = c.isDark ? 'rgba(16,16,32,0.98)' : 'rgba(250,250,252,0.98)';
  const borderCol = c.isDark ? 'rgba(90,95,160,0.25)' : 'rgba(255,255,255,0.8)';

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          backgroundColor: sheetBg,
          borderTopColor: borderCol,
          paddingBottom: Platform.OS === 'web' ? 20 : insets.bottom + 16,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View style={styles.handle} />

      <View style={styles.container}>
        {/* ETA row */}
        <View style={styles.etaRow}>
          <View style={[styles.pulseDot, { backgroundColor: '#55c49a' }]} />
          <Text style={[styles.etaText, { color: c.ink }]}>
            {t('driver_arriving')} {MOCK_DRIVER.eta} {t('min')}
          </Text>
          <View style={[styles.etaSep, { backgroundColor: c.border }]} />
          <Text style={[styles.etaDest, { color: c.inkSoft }]} numberOfLines={1}>
            {destination || '...'}
          </Text>
        </View>

        {/* Driver badge */}
        <View style={[styles.driverCard, { backgroundColor: c.white, borderColor: c.border }]}>
          <View style={[styles.avatarWrap, { backgroundColor: MOCK_DRIVER.color }]}>
            <Text style={styles.avatarText}>{MOCK_DRIVER.initials}</Text>
          </View>
          <View style={styles.driverMeta}>
            <Text style={[styles.driverName, { color: c.ink }]}>{MOCK_DRIVER.name}</Text>
            <View style={styles.driverStats}>
              <Ionicons name="star" size={13} color="#FFB000" />
              <Text style={[styles.statVal, { color: c.ink }]}>{MOCK_DRIVER.rating}</Text>
              <View style={[styles.sep, { backgroundColor: c.silver }]} />
              <Text style={[styles.statVal, { color: c.inkSoft }]}>
                {MOCK_DRIVER.trips} {t('total_trips_label')}
              </Text>
            </View>
          </View>
          <View style={styles.vehicleBlock}>
            <Text style={[styles.vehicleText, { color: c.inkSoft }]} numberOfLines={2}>
              {MOCK_DRIVER.vehicle}
            </Text>
            <View style={[styles.plateBadge, { backgroundColor: c.mist }]}>
              <Text style={[styles.plateText, { color: c.ink }]}>{MOCK_DRIVER.plate}</Text>
            </View>
          </View>
        </View>

        {/* Action row */}
        <View style={[styles.actionRow, { borderTopColor: c.border }]}>
          {/* Chat */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: c.mist }]}
            activeOpacity={0.8}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync();
              setChatOpen(true);
            }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={c.ink} />
          </TouchableOpacity>

          {/* Call */}
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: c.mist }]} activeOpacity={0.8} onPress={handleCall}>
            <Ionicons name="call-outline" size={18} color={c.ink} />
          </TouchableOpacity>

          {/* Cancel */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: c.isDark ? 'rgba(235,90,90,0.15)' : 'rgba(235,90,90,0.08)' }]}
            activeOpacity={0.8}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              Alert.alert(
                t('cancel_trip'),
                t('cancel_trip_q'),
                [
                  { text: t('no_back'), style: 'cancel' },
                  { text: t('yes_cancel'), style: 'destructive', onPress: () => onCancel() },
                ]
              );
            }}
          >
            <Ionicons name="close-outline" size={20} color="#eb5a5a" />
          </TouchableOpacity>
        </View>

        {/* I'm Boarded button */}
        <TouchableOpacity
          style={[styles.boardedBtn, { backgroundColor: c.ink }]}
          activeOpacity={0.9}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onStart();
          }}
        >
          <Ionicons name="checkmark-circle" size={18} color={c.isDark ? c.background : c.white} />
          <Text style={[styles.boardedTxt, { color: c.isDark ? c.background : c.white }]}>I'm Boarded — Start Trip</Text>
        </TouchableOpacity>
      </View>

      <ChatModal visible={chatOpen} onClose={() => setChatOpen(false)} driverName={MOCK_DRIVER.name} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
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
  vehicleText: { fontSize: 10.5, maxWidth: 100 },
  plateBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  plateText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderTopWidth: 1, paddingTop: 12,
  },
  iconBtn: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  boardedBtn: {
    height: 52, borderRadius: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginBottom: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
  },
  boardedTxt: { fontSize: 14, fontWeight: '700' },
});
