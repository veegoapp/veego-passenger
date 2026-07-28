import { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Linking, Easing } from 'react-native';
import { MessageCircle, Phone, X, AlertTriangle, Star, Navigation } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTabBar } from '@/context/TabBarContext';
import { useTheme } from '@/context/ThemeContext';
import { GlassView } from '@/components/ui/GlassView';
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
    Linking.openURL(`tel:${driver.phone}`).catch(() => {});
  };

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] });
  const isDark = c.isDark;
  // Circular action buttons use a primary-tint background — same treatment
  // as the Driver app's message/call buttons (`colors.primary + '26'`).
  const surfaceBg = c.primary + (isDark ? '26' : '14');
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  const avatarColor = driver?.vehicleColor ?? c.primary;
  const initials = driver?.name
    ? driver.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const isStarted = rideStatus === 'started';
  const isArrived = rideStatus === 'arrived';

  // Star rating display (up to 5) — mint accent, matching the Driver app's
  // rating stars in both the request card and the completed-ride sheet.
  const rating = driver?.rating ?? null;
  const fullStars = rating != null ? Math.floor(rating) : 0;

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          opacity: slideAnim,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <GlassView strong borderRadius={28} style={[styles.sheetGlass, { paddingBottom: tabBarHeight + 20 }]}>
      <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)' }]} />

      {/* ════════════════════════════════════════════
          ACTIVE RIDE — compact cockpit layout
      ════════════════════════════════════════════ */}
      {isStarted ? (
        <View style={styles.cockpit}>

          {/* Status strip */}
          <View style={[styles.cockpitStatus, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: borderCol }]}>
            <View style={styles.cockpitStatusLeft}>
              <Animated.View style={[styles.enRouteDot, { opacity: enRouteDot, backgroundColor: c.primary }]} />
              <Text style={[styles.cockpitStatusLabel, { color: c.primary }]}>
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
              <View style={[styles.cockpitWait, { backgroundColor: c.warning + '1F', borderColor: c.warning }]}>
                <Text style={[styles.cockpitWaitText, { color: c.warning }]}>
                  +{waitingCharge.toFixed(2)} {t('egp')}
                </Text>
              </View>
            )}
          </View>

          {/* Cockpit actions */}
          <View style={styles.cockpitActions}>
            <TouchableOpacity
              style={[styles.cockpitIconBtn, { backgroundColor: surfaceBg, borderColor: 'transparent' }]}
              onPress={() => { Haptics.selectionAsync(); setChatOpen(true); }}
              activeOpacity={0.78}
            >
              <MessageCircle size={18} color={c.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.cockpitIconBtn,
                { backgroundColor: surfaceBg, borderColor: 'transparent', opacity: driver?.phone ? 1 : 0.38 },
              ]}
              onPress={handleCall}
              disabled={!driver?.phone}
              activeOpacity={0.78}
            >
              <Phone size={18} color={c.primary} />
            </TouchableOpacity>

            {/* SOS — dominant, full label, same solid destructive treatment
                the Driver app uses for its own SOS button. */}
            <TouchableOpacity
              style={[styles.sosBtn, { backgroundColor: c.error }]}
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
                { backgroundColor: c.success + '1F', borderColor: c.success + '59', transform: [{ scale: arrivedPulse }] },
              ]}
            >
              <View style={[styles.arrivedDot, { backgroundColor: c.success }]} />
              <Text style={[styles.arrivedText, { color: c.success }]}>
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
                {/* Economy / Premium badge — Car rides only. Same accent split
                    as the ride-options sheet: mint for economy, ink for premium. */}
                {serviceType === 'car' && (rideType === 'economy' || rideType === 'premium') && (
                  <View style={[
                    styles.tierBadge,
                    rideType === 'premium'
                      ? { backgroundColor: (isDark ? 'rgba(232,232,242,0.10)' : 'rgba(30,30,40,0.06)'), borderColor: (isDark ? 'rgba(232,232,242,0.35)' : 'rgba(30,30,40,0.28)') }
                      : { backgroundColor: c.accent + '1A', borderColor: c.accent + '59' },
                  ]}>
                    <Text style={[
                      styles.tierBadgeText,
                      { color: rideType === 'premium' ? c.primary : c.accent },
                    ]}>
                      {rideType === 'premium' ? t('premium') : t('economy')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Star rating — mint accent, same as the Driver app */}
              <View style={styles.starsRow}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={13}
                    color={c.accent}
                    fill={i < fullStars ? c.accent : 'transparent'}
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

          {/* Waiting charge — same amber/warning treatment as the Driver
              app's waiting-fee ticker on the ride screen. */}
          {waitingChargeStatus === 'active' && waitingCharge != null && (
            <View style={[styles.waitingBanner, { backgroundColor: c.warning + '14', borderColor: c.warning + '4D' }]}>
              <View style={[styles.waitingDot, { backgroundColor: c.warning }]} />
              <Text style={[styles.waitingText, { color: c.warning }]}>
                {t('waiting_charge')}: {waitingCharge.toFixed(2)} {t('egp')}
              </Text>
            </View>
          )}

          {/* ── Actions ── */}
          <View style={[styles.actionRow, { borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }]}>
            {/* Chat — primary-tint circular treatment, same as the Driver app */}
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: surfaceBg, borderColor: 'transparent' }]}
              onPress={() => { Haptics.selectionAsync(); setChatOpen(true); }}
              activeOpacity={0.78}
            >
              <MessageCircle size={20} color={c.primary} />
              <Text style={[styles.actionLabel, { color: c.primary }]}>
                {t('chat')}
              </Text>
            </TouchableOpacity>

            {/* Call */}
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: surfaceBg, borderColor: 'transparent', opacity: driver?.phone ? 1 : 0.35 },
              ]}
              onPress={handleCall}
              disabled={!driver?.phone}
              activeOpacity={0.78}
            >
              <Phone size={20} color={c.primary} />
              <Text style={[styles.actionLabel, { color: c.primary }]}>
                {t('call') ?? 'Call'}
              </Text>
            </TouchableOpacity>

            {/* Cancel — plain destructive tint, same family as the Driver
                app's error color. */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.cancelBtn, { borderColor: c.error + '40', backgroundColor: c.error + '12' }]}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                onCancel();
              }}
              activeOpacity={0.78}
            >
              <X size={20} color={c.error} />
              <Text style={[styles.actionLabel, { color: c.error }]}>
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
      </GlassView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: -14 },
    shadowOpacity: 0.32, shadowRadius: 30, elevation: 26,
    zIndex: 999,
  },
  sheetGlass: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0,
    paddingTop: 8,
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
    width: 8, height: 8, borderRadius: 4,
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
    width: 10, height: 10, borderRadius: 5,
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
  waitingDot: { width: 8, height: 8, borderRadius: 4 },
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
