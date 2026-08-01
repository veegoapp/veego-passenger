import { memo, useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Linking, Easing } from 'react-native';
import { MessageCircle, Phone, X, AlertTriangle, Star, Navigation } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTabBar } from '@/context/TabBarContext';
import { useTheme } from '@/context/ThemeContext';
import { Animation } from '@/constants/animations';
import { ChatModal } from './ChatModal';
import type { DriverInfo } from '@/src/hooks/car/useRide';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

interface DriverAssignedCardProps {
  visible: boolean;
  /** Selected car category's display name (e.g. "Economy Plus"), straight from
   *  the estimate response — null/undefined for scooter/delivery or when no
   *  category was resolved. Was previously a hardcoded 'economy' | 'premium'
   *  id that couldn't represent a 3rd (or Nth) category. */
  carCategoryName?: string | null;
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

function DriverAssignedCardBase({
  visible, carCategoryName, serviceType, destination, driver, rideId, rideStatus,
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
          Animated.timing(arrivedPulse, { toValue: 1.08, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
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
  const sheetBg = isDark ? '#16162a' : '#ffffff';
  const borderColor = isDark ? '#2c2c46' : '#e5e5ea';
  const mutedText = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.4)';
  const surfaceBg = isDark ? '#1e1e32' : '#f8f8fb';

  const avatarColor = driver?.vehicleColor ?? c.primary;
  const initials = driver?.name
    ? driver.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const isStarted = rideStatus === 'started';
  const isArrived = rideStatus === 'arrived';

  const rating = driver?.rating ?? null;
  const fullStars = rating != null ? Math.floor(rating) : 0;

  return (
    <Animated.View
      style={[
        styles.sheet,
        { opacity: slideAnim, transform: [{ translateY }] },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View style={[styles.sheetSurface, { backgroundColor: sheetBg, paddingBottom: tabBarHeight + 20 }]}>
        <View style={[styles.handle, { backgroundColor: borderColor }]} />

        {/* ════════════════════════════════════════════
            ACTIVE RIDE — cockpit layout (started)
        ════════════════════════════════════════════ */}
        {isStarted ? (
          <View style={styles.cockpit}>

            {/* Status strip */}
            <View style={[styles.cockpitStatus, { backgroundColor: surfaceBg, borderColor }]}>
              <View style={styles.cockpitStatusLeft}>
                <Animated.View style={[styles.enRouteDot, { opacity: enRouteDot, backgroundColor: c.accent }]} />
                <Text style={[styles.cockpitStatusLabel, { color: c.accent }]}>
                  {t('driver_en_route')}
                </Text>
              </View>
              <View style={styles.cockpitStatusRight}>
                <Navigation size={12} color={mutedText} />
                <Text style={[styles.cockpitDest, { color: mutedText }]} numberOfLines={1}>
                  {destination ?? '—'}
                </Text>
              </View>
            </View>

            {/* Driver mini-strip */}
            <View style={[styles.cockpitDriverRow, { backgroundColor: surfaceBg, borderColor }]}>
              <View style={[styles.cockpitAvatar, { backgroundColor: avatarColor }]}>
                <Text style={styles.cockpitAvatarText}>{initials}</Text>
              </View>
              <View style={styles.cockpitDriverMeta}>
                <Text style={[styles.cockpitDriverName, { color: c.ink }]}>
                  {driver?.name ?? '—'}
                </Text>
                <Text style={[styles.cockpitVehicle, { color: mutedText }]} numberOfLines={1}>
                  {[driver?.vehicle, driver?.plateNumber].filter(Boolean).join(' · ') || '—'}
                </Text>
              </View>
              {waitingChargeStatus === 'active' && waitingCharge != null && (
                <View style={[styles.waitBadge, { backgroundColor: c.warning + '1F', borderColor: c.warning + '4D' }]}>
                  <Text style={[styles.waitBadgeText, { color: c.warning }]}>
                    +{waitingCharge.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>

            {/* Cockpit actions */}
            <View style={styles.cockpitActions}>
              <TouchableOpacity
                style={[styles.cockpitIconBtn, { backgroundColor: surfaceBg, borderColor }]}
                onPress={() => { Haptics.selectionAsync(); setChatOpen(true); }}
                activeOpacity={0.78}
              >
                <MessageCircle size={18} color={c.ink} strokeWidth={1.8} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.cockpitIconBtn,
                  { backgroundColor: surfaceBg, borderColor, opacity: driver?.phone ? 1 : 0.38 },
                ]}
                onPress={handleCall}
                disabled={!driver?.phone}
                activeOpacity={0.78}
              >
                <Phone size={18} color={c.ink} strokeWidth={1.8} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sosBtn]}
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

            {/* ── ETA / Arrived hero ── */}
            {isArrived ? (
              <Animated.View
                style={[
                  styles.arrivedBadge,
                  { backgroundColor: c.success + '18', borderColor: c.success + '50', transform: [{ scale: arrivedPulse }] },
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
                  <Text style={[styles.etaNumber, { color: c.ink }]}>
                    {driver?.eta ?? '—'}
                  </Text>
                  <View style={styles.etaUnit}>
                    <Text style={[styles.etaUnitTop, { color: mutedText }]}>{t('min')}</Text>
                    <Text style={[styles.etaUnitBottom, { color: mutedText }]}>{t('driver_arriving')}</Text>
                  </View>
                </View>
                {destination && (
                  <Text style={[styles.etaDest, { color: mutedText }]} numberOfLines={1}>
                    → {destination}
                  </Text>
                )}
              </View>
            )}

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            {/* ── Driver identity card ── */}
            <View style={[styles.driverCard, { backgroundColor: surfaceBg, borderColor }]}>
              {/* Avatar */}
              <View style={[styles.avatarCircle, { backgroundColor: avatarColor }]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>

              {/* Info */}
              <View style={styles.driverInfo}>
                <View style={styles.driverNameRow}>
                  <Text style={[styles.driverName, { color: c.ink }]}>
                    {driver?.name ?? '—'}
                  </Text>
                  {serviceType === 'car' && !!carCategoryName && (
                    <View style={[styles.categoryBadge, { backgroundColor: c.accent + '18', borderColor: c.accent + '50' }]}>
                      <Text style={[styles.categoryBadgeText, { color: c.accent }]}>
                        {carCategoryName}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Stars */}
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
                    <Text style={[styles.ratingText, { color: mutedText }]}>
                      {rating.toFixed(1)}
                    </Text>
                  )}
                </View>

                {/* Vehicle */}
                {driver?.vehicle && (
                  <Text style={[styles.vehicleText, { color: mutedText }]}>
                    {driver.vehicle}
                  </Text>
                )}
              </View>

              {/* Plate */}
              {driver?.plateNumber && (
                <View style={[styles.plateBadge, { backgroundColor: isDark ? '#2c2c46' : '#f2f2f5', borderColor }]}>
                  <View style={[styles.plateStripe, { backgroundColor: avatarColor }]} />
                  <Text style={[styles.plateText, { color: c.ink }]}>
                    {driver.plateNumber}
                  </Text>
                </View>
              )}
            </View>

            {/* Waiting charge banner */}
            {waitingChargeStatus === 'active' && waitingCharge != null && (
              <View style={[styles.waitingBanner, { backgroundColor: c.warning + '12', borderColor: c.warning + '40' }]}>
                <View style={[styles.waitingDot, { backgroundColor: c.warning }]} />
                <Text style={[styles.waitingText, { color: c.warning }]}>
                  {t('waiting_charge')}: {waitingCharge.toFixed(2)} {t('egp')}
                </Text>
              </View>
            )}

            {/* ── Action buttons ── */}
            <View style={[styles.actionRow, { borderTopColor: borderColor }]}>
              {/* Chat */}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: surfaceBg, borderColor }]}
                onPress={() => { Haptics.selectionAsync(); setChatOpen(true); }}
                activeOpacity={0.78}
              >
                <MessageCircle size={20} color={c.ink} strokeWidth={1.8} />
                <Text style={[styles.actionLabel, { color: c.inkSoft }]}>
                  {t('chat')}
                </Text>
              </TouchableOpacity>

              {/* Call */}
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: surfaceBg, borderColor, opacity: driver?.phone ? 1 : 0.35 },
                ]}
                onPress={handleCall}
                disabled={!driver?.phone}
                activeOpacity={0.78}
              >
                <Phone size={20} color={c.ink} strokeWidth={1.8} />
                <Text style={[styles.actionLabel, { color: c.inkSoft }]}>
                  {t('call') ?? 'Call'}
                </Text>
              </TouchableOpacity>

              {/* Cancel */}
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: c.error + '40', backgroundColor: c.error + '10' }]}
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
      </View>
    </Animated.View>
  );
}

// CarServiceScreen re-renders on every driver-location tick; memoize to avoid
// re-rendering on every location update.
export const DriverAssignedCard = memo(DriverAssignedCardBase);

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 26,
    zIndex: 999,
  },
  sheetSurface: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 16,
  },

  // ── Active ride cockpit ──────────────────────────────────────────
  cockpit: {
    paddingHorizontal: 16, gap: 10, paddingBottom: Spacing.xs,
  },
  cockpitStatus: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1,
  },
  cockpitStatusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  enRouteDot: { width: 8, height: 8, borderRadius: 4 },
  cockpitStatusLabel: {
    fontSize: 11, fontWeight: '700' as any, letterSpacing: 1.0, textTransform: 'uppercase' as any,
  },
  cockpitStatusRight: {
    flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1,
    justifyContent: 'flex-end',
  },
  cockpitDest: { fontSize: 12, fontWeight: '500' as any, flex: 1, textAlign: 'right' },
  cockpitDriverRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1,
  },
  cockpitAvatar: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cockpitAvatarText: { color: '#fff', fontSize: 14, fontWeight: '700' as any },
  cockpitDriverMeta: { flex: 1 },
  cockpitDriverName: { fontSize: 15, fontWeight: '700' as any, letterSpacing: -0.2 },
  cockpitVehicle: { fontSize: 12, fontWeight: '500' as any, marginTop: 2 },
  waitBadge: {
    borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1,
  },
  waitBadgeText: { fontSize: 11, fontWeight: '700' as any },
  cockpitActions: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
  },
  cockpitIconBtn: {
    width: 50, height: 50, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    elevation: 0,
  },
  sosBtn: {
    flex: 1, height: 50, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#E85454',
    shadowColor: '#E85454',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sosBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' as any, letterSpacing: 0.5 },

  // ── Driver assigned / arrived ───────────────────────────────────
  assignedBody: {
    paddingHorizontal: 16, gap: 14, paddingBottom: Spacing.xs,
  },

  // ETA hero
  etaHero: { gap: 4 },
  etaNumberRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  etaNumber: {
    fontSize: 52, fontWeight: '800' as any, letterSpacing: -2, lineHeight: 56,
  },
  etaUnit: { paddingBottom: 8, gap: 2 },
  etaUnitTop: { fontSize: 15, fontWeight: '600' as any },
  etaUnitBottom: { fontSize: 11, fontWeight: '500' as any },
  etaDest: { fontSize: 12.5, fontWeight: '500' as any },

  // Arrived badge
  arrivedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, alignSelf: 'stretch',
  },
  arrivedDot: { width: 10, height: 10, borderRadius: 5 },
  arrivedText: { fontSize: 15, fontWeight: '700' as any },

  // Divider
  divider: { height: 1 },

  // Driver identity card
  driverCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1,
  },
  avatarCircle: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarInitials: { color: '#ffffff', fontSize: 18, fontWeight: '800' as any },
  driverInfo: { flex: 1, gap: 4 },
  driverNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  driverName: { fontSize: 17, fontWeight: '700' as any, letterSpacing: -0.3 },
  categoryBadge: {
    borderRadius: 6, borderWidth: 1,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  categoryBadgeText: { fontSize: 10, fontWeight: '700' as any, letterSpacing: 0.5, textTransform: 'uppercase' as any },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 12, fontWeight: '600' as any, marginLeft: 4 },
  vehicleText: { fontSize: 12.5, fontWeight: '500' as any },
  plateBadge: {
    borderRadius: 10, borderWidth: 1,
    overflow: 'hidden', alignItems: 'center',
    flexShrink: 0, minWidth: 62,
  },
  plateStripe: { height: 4, width: '100%' },
  plateText: { fontSize: 12, fontWeight: '800' as any, letterSpacing: 1.2, paddingHorizontal: 8, paddingVertical: 5 },

  // Waiting charge
  waitingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10,
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
    elevation: 0,
  },
  actionLabel: {
    fontSize: 11, fontWeight: '600' as any, letterSpacing: 0.2,
  },
});
