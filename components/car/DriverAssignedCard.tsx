import { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Linking, Easing } from 'react-native';
import { MessageCircle, Phone, X, AlertTriangle, Star, Navigation } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTabBar } from '@/context/TabBarContext';
import { useTheme } from '@/context/ThemeContext';
import { Animation } from '@/constants/animations';
import { ChatModal } from './ChatModal';
import type { DriverInfo } from '@/src/hooks/car/useRide';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

interface DriverAssignedCardProps {
  visible: boolean;
  rideType: 'economy' | 'premium' | 'standard' | null;
  serviceType?: 'car' | 'scooter' | 'delivery';
  destination: string | null;
  driver?: DriverInfo | null;
  rideId?: string | null;
  rideStatus?: string;
  waitingCharge?: number | null;
  waitingChargeStatus?: 'none' | 'active' | 'capped';
  onCancel: () => void;
  onStart?: () => void;
  onSOS?: () => void;
}

export function DriverAssignedCard({
  visible, rideType, serviceType, destination, driver, rideId, rideStatus,
  waitingCharge, waitingChargeStatus, onCancel, onStart, onSOS,
}: DriverAssignedCardProps) {
  const { colors: c, t, isRTL } = useTheme();
  const { tabBarHeight } = useTabBar();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const arrivedPulse = useRef(new Animated.Value(1)).current;
  const enRouteDot = useRef(new Animated.Value(1)).current;
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      ...Animation.spring.sheet,
      mass: 0.85,
    }).start();
  }, [visible]);

  // Pulse animation for "arrived" badge
  useEffect(() => {
    let pulse: Animated.CompositeAnimation | null = null;
    if (rideStatus === 'arrived') {
      pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(arrivedPulse, { toValue: 1.18, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(arrivedPulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      pulse.start();
    } else {
      arrivedPulse.setValue(1);
    }
    return () => { pulse?.stop(); };
  }, [rideStatus]);

  // Blink animation for en-route status dot
  useEffect(() => {
    let blink: Animated.CompositeAnimation | null = null;
    if (rideStatus === 'started') {
      blink = Animated.loop(
        Animated.sequence([
          Animated.timing(enRouteDot, { toValue: 0.25, duration: 600, useNativeDriver: true }),
          Animated.timing(enRouteDot, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      blink.start();
    } else {
      enRouteDot.setValue(1);
    }
    return () => { blink?.stop(); };
  }, [rideStatus]);

  const handleCall = () => {
    if (!driver?.phone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = `tel:${driver.phone}`;
    Linking.canOpenURL(url).then((ok: boolean) => { if (ok) Linking.openURL(url); }).catch(() => {});
  };

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] });
  const isDark = c.isDark;
  const panelBg = isDark ? 'rgba(10,10,22,0.98)' : 'rgba(250,250,254,0.98)';
  const surfaceBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  const avatarColor = driver?.vehicleColor ?? '#3B82F6';
  const initials = driver?.name
    ? driver.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const isStarted = rideStatus === 'started';
  const isArrived = rideStatus === 'arrived';

  // Star rating display (up to 5)
  const rating = driver?.rating ?? null;
  const fullStars = rating != null ? Math.floor(rating) : 0;

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          backgroundColor: panelBg,
          paddingBottom: tabBarHeight + 20,
          opacity: slideAnim,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)' }]} />

      {/* ════════════════════════════════════════════
          ACTIVE RIDE — compact cockpit layout
      ════════════════════════════════════════════ */}
      {isStarted ? (
        <View style={styles.cockpit}>

          {/* Status strip */}
          <View style={[styles.cockpitStatus, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
            <View style={styles.cockpitStatusLeft}>
              <Animated.View style={[styles.enRouteDot, { opacity: enRouteDot }]} />
              <Text style={[styles.cockpitStatusLabel, { color: '#3B82F6' }]}>
                {t('driver_en_route')}
              </Text>
            </View>
            <View style={styles.cockpitStatusRight}>
              <Navigation size={12} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
              <Text style={[styles.cockpitDest, { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }]} numberOfLines={1}>
                {destination ?? '—'}
              </Text>
            </View>
          </View>

          {/* Driver mini-strip */}
          <View style={styles.cockpitDriverRow}>
            {/* Avatar */}
            <View style={[styles.cockpitAvatar, { backgroundColor: avatarColor }]}>
              <Text style={styles.cockpitAvatarText}>{initials}</Text>
            </View>

            <View style={styles.cockpitDriverMeta}>
              <Text style={[styles.cockpitDriverName, { color: isDark ? '#e8e8f2' : '#1e1e28' }]}>
                {driver?.name ?? '—'}
              </Text>
              <Text style={[styles.cockpitVehicle, { color: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.42)' }]} numberOfLines={1}>
                {[driver?.vehicle, driver?.plateNumber].filter(Boolean).join(' · ') || '—'}
              </Text>
            </View>

            {/* Waiting charge */}
            {waitingChargeStatus === 'active' && waitingCharge != null && (
              <View style={[styles.cockpitWait, { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: '#f59e0b' }]}>
                <Text style={[styles.cockpitWaitText, { color: '#d97706' }]}>
                  +{waitingCharge.toFixed(2)} {t('egp')}
                </Text>
              </View>
            )}
          </View>

          {/* Cockpit actions */}
          <View style={styles.cockpitActions}>
            <TouchableOpacity
              style={[styles.cockpitIconBtn, { backgroundColor: surfaceBg, borderColor: borderCol }]}
              onPress={() => { Haptics.selectionAsync(); setChatOpen(true); }}
              activeOpacity={0.78}
            >
              <MessageCircle size={18} color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)'} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.cockpitIconBtn,
                { backgroundColor: surfaceBg, borderColor: borderCol, opacity: driver?.phone ? 1 : 0.38 },
              ]}
              onPress={handleCall}
              disabled={!driver?.phone}
              activeOpacity={0.78}
            >
              <Phone size={18} color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)'} />
            </TouchableOpacity>

            {/* SOS — dominant, full label */}
            <TouchableOpacity
              style={styles.sosBtn}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                onSOS?.();
              }}
              activeOpacity={0.82}
              accessibilityLabel="Send SOS"
            >
              <AlertTriangle size={16} color="#ffffff" />
              <Text style={styles.sosBtnText}>SOS</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* ════════════════════════════════════════════
           DRIVER ASSIGNED / ARRIVED — identity card
        ════════════════════════════════════════════ */
        <View style={styles.assignedBody}>

          {/* ── ETA hero ── */}
          {isArrived ? (
            <Animated.View
              style={[
                styles.arrivedBadge,
                { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.35)', transform: [{ scale: arrivedPulse }] },
              ]}
            >
              <View style={styles.arrivedDot} />
              <Text style={[styles.arrivedText, { color: '#16A34A' }]}>
                {t('status_driver_arrived')}
              </Text>
            </Animated.View>
          ) : (
            <View style={styles.etaHero}>
              <View style={styles.etaNumberRow}>
                <Text style={[styles.etaNumber, { color: isDark ? '#e8e8f2' : '#1e1e28' }]}>
                  {driver?.eta ?? '—'}
                </Text>
                <View style={styles.etaUnit}>
                  <Text style={[styles.etaUnitTop, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }]}>
                    {t('min')}
                  </Text>
                  <Text style={[styles.etaUnitBottom, { color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }]}>
                    {t('driver_arriving')}
                  </Text>
                </View>
              </View>
              {destination && (
                <Text style={[styles.etaDest, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }]} numberOfLines={1}>
                  → {destination}
                </Text>
              )}
            </View>
          )}

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }]} />

          {/* ── Driver identity ── */}
          <View style={styles.driverBlock}>
            {/* Avatar with ring */}
            <View style={styles.avatarWrap}>
              <View style={[styles.avatarRing, { borderColor: avatarColor }]}>
                <View style={[styles.avatarCircle, { backgroundColor: avatarColor }]}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              </View>
            </View>

            {/* Driver info */}
            <View style={styles.driverInfo}>
              <View style={styles.driverNameRow}>
                <Text style={[styles.driverName, { color: isDark ? '#e8e8f2' : '#1e1e28' }]}>
                  {driver?.name ?? '—'}
                </Text>
                {/* Economy / Premium badge — Car rides only */}
                {serviceType === 'car' && (rideType === 'economy' || rideType === 'premium') && (
                  <View style={[
                    styles.tierBadge,
                    rideType === 'premium'
                      ? { backgroundColor: 'rgba(245,158,11,0.13)', borderColor: 'rgba(245,158,11,0.4)' }
                      : { backgroundColor: 'rgba(59,130,246,0.10)', borderColor: 'rgba(59,130,246,0.35)' },
                  ]}>
                    <Text style={[
                      styles.tierBadgeText,
                      { color: rideType === 'premium' ? '#D97706' : '#3B82F6' },
                    ]}>
                      {rideType === 'premium' ? t('premium') : t('economy')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Star rating */}
              <View style={styles.starsRow}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={13}
                    color="#F59E0B"
                    fill={i < fullStars ? '#F59E0B' : 'transparent'}
                  />
                ))}
                {rating != null && (
                  <Text style={[styles.ratingText, { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }]}>
                    {rating.toFixed(1)}
                  </Text>
                )}
              </View>

              {/* Vehicle info */}
              {driver?.vehicle && (
                <Text style={[styles.vehicleText, { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.5)' }]}>
                  {driver.vehicle}
                </Text>
              )}
            </View>

            {/* Plate badge */}
            {driver?.plateNumber && (
              <View style={[styles.plateBadge, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#F3F4F6',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E5E7EB',
              }]}>
                <View style={[styles.plateStripe, { backgroundColor: avatarColor }]} />
                <Text style={[styles.plateText, { color: isDark ? '#e8e8f2' : '#1e1e28' }]}>
                  {driver.plateNumber}
                </Text>
              </View>
            )}
          </View>

          {/* Waiting charge */}
          {waitingChargeStatus === 'active' && waitingCharge != null && (
            <View style={[styles.waitingBanner, { backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)' }]}>
              <View style={styles.waitingDot} />
              <Text style={[styles.waitingText, { color: '#B45309' }]}>
                {t('waiting_charge')}: {waitingCharge.toFixed(2)} {t('egp')}
              </Text>
            </View>
          )}

          {/* ── Actions ── */}
          <View style={[styles.actionRow, { borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }]}>
            {/* Chat */}
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: surfaceBg, borderColor: borderCol }]}
              onPress={() => { Haptics.selectionAsync(); setChatOpen(true); }}
              activeOpacity={0.78}
            >
              <MessageCircle size={20} color={isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)'} />
              <Text style={[styles.actionLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]}>
                {t('chat')}
              </Text>
            </TouchableOpacity>

            {/* Call */}
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: surfaceBg, borderColor: borderCol, opacity: driver?.phone ? 1 : 0.35 },
              ]}
              onPress={handleCall}
              disabled={!driver?.phone}
              activeOpacity={0.78}
            >
              <Phone size={20} color={isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)'} />
              <Text style={[styles.actionLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]}>
                {t('call') ?? 'Call'}
              </Text>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.cancelBtn, { borderColor: 'rgba(239,68,68,0.25)', backgroundColor: 'rgba(239,68,68,0.07)' }]}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                onCancel();
              }}
              activeOpacity={0.78}
            >
              <X size={20} color="#EF4444" />
              <Text style={[styles.actionLabel, { color: '#EF4444' }]}>
                {t('cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: -14 },
    shadowOpacity: 0.32, shadowRadius: 30, elevation: 26,
    paddingTop: 8, zIndex: 999,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: Spacing.lg,
  },

  // ── Active ride cockpit ──────────────────────────────────────────
  cockpit: {
    paddingHorizontal: 18, gap: 14, paddingBottom: Spacing.xs,
  },
  cockpitStatus: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: Radius.lg, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1,
  },
  cockpitStatusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  enRouteDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6',
  },
  cockpitStatusLabel: {
    fontSize: 11, fontWeight: '700' as any, letterSpacing: 1.2,
    textTransform: 'uppercase' as any,
  },
  cockpitStatusRight: {
    flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1,
    justifyContent: 'flex-end',
  },
  cockpitDest: { fontSize: 12, fontWeight: '500' as any, flex: 1, textAlign: 'right' },
  cockpitDriverRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  cockpitAvatar: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cockpitAvatarText: {
    color: '#fff', fontSize: 14, fontWeight: '700' as any,
  },
  cockpitDriverMeta: { flex: 1 },
  cockpitDriverName: { fontSize: 15, fontWeight: '700' as any, letterSpacing: -0.2 },
  cockpitVehicle: { fontSize: 12, fontWeight: '500' as any, marginTop: 2 },
  cockpitWait: {
    borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1,
  },
  cockpitWaitText: { fontSize: 11, fontWeight: '700' as any },
  cockpitActions: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
  },
  cockpitIconBtn: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  sosBtn: {
    flex: 1, height: 48, borderRadius: 14,
    backgroundColor: '#DC2626',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  sosBtnText: {
    color: '#ffffff', fontSize: 14, fontWeight: '800' as any, letterSpacing: 0.5,
  },

  // ── Driver assigned / arrived ───────────────────────────────────
  assignedBody: {
    paddingHorizontal: 18, gap: 16, paddingBottom: Spacing.xs,
  },

  // ETA hero
  etaHero: { gap: 4 },
  etaNumberRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  etaNumber: {
    fontSize: 52, fontWeight: '800' as any, letterSpacing: -2, lineHeight: 56,
    fontFamily: 'Inter_700Bold',
  },
  etaUnit: { paddingBottom: 8, gap: 2 },
  etaUnitTop: { fontSize: 15, fontWeight: '600' as any },
  etaUnitBottom: { fontSize: 11, fontWeight: '500' as any },
  etaDest: { fontSize: 12.5, fontWeight: '500' as any },

  // Arrived badge
  arrivedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: Radius.lg, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, alignSelf: 'stretch',
  },
  arrivedDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E',
  },
  arrivedText: { fontSize: 15, fontWeight: '700' as any },

  // Divider
  divider: { height: 1 },

  // Driver block
  driverBlock: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  avatarWrap: { flexShrink: 0 },
  avatarRing: {
    width: 72, height: 72, borderRadius: 22,
    borderWidth: 2.5, alignItems: 'center', justifyContent: 'center',
    padding: 3,
  },
  avatarCircle: {
    flex: 1, width: '100%', borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: {
    color: '#ffffff', fontSize: 22, fontWeight: '800' as any, letterSpacing: -0.5,
  },
  driverInfo: { flex: 1, gap: 4 },
  driverNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  driverName: {
    fontSize: 20, fontWeight: '700' as any, letterSpacing: -0.4,
  },
  tierBadge: {
    borderRadius: 6, borderWidth: 1,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  tierBadgeText: {
    fontSize: 10, fontWeight: '700' as any, letterSpacing: 0.5, textTransform: 'uppercase' as any,
  },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 12, fontWeight: '600' as any, marginLeft: 4 },
  vehicleText: { fontSize: 12.5, fontWeight: '500' as any },

  // Plate badge
  plateBadge: {
    borderRadius: 10, borderWidth: 1,
    overflow: 'hidden', alignItems: 'center',
    flexShrink: 0, minWidth: 66,
  },
  plateStripe: { height: 5, width: '100%' },
  plateText: {
    fontSize: 12, fontWeight: '800' as any, letterSpacing: 1.2,
    paddingHorizontal: 10, paddingVertical: 5,
  },

  // Waiting charge
  waitingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderWidth: 1,
  },
  waitingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' },
  waitingText: { fontSize: 12.5, fontWeight: '600' as any },

  // Action row
  actionRow: {
    flexDirection: 'row', gap: 10,
    borderTopWidth: 1, paddingTop: 14,
  },
  actionBtn: {
    flex: 1, height: 54, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    gap: 5, borderWidth: 1,
  },
  cancelBtn: {},
  actionLabel: {
    fontSize: 11, fontWeight: '600' as any, letterSpacing: 0.2,
  },
});
