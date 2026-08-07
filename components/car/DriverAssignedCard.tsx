import { memo, useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, Animated, Linking, Easing } from 'react-native';
import {
  MessageCircle, Phone, X, AlertTriangle,
  Navigation, BadgeCheck, ChevronRight, ShieldAlert, LifeBuoy,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { Animation } from '@/constants/animations';
import { ChatModal } from './ChatModal';
import { Stars } from '@/components/ui/Stars';
import type { DriverInfo } from '@/src/hooks/car/useRide';

interface DriverAssignedCardProps {
  visible: boolean;
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

// Navy (كحلي) fill for the ride action buttons.
const NAVY = '#1e3a8a';
// How much of the card stays visible when it's lowered to a peek (handle +
// status header + trip title). The rest slides below the screen edge.
const PEEK_HEIGHT = 132;

/* ─── GhostButton ────────────────────────────────────────────────────────── */
function GhostButton({
  onPress, disabled, tone = 'neutral', icon, label, flex,
}: {
  onPress?: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'danger' | 'navy';
  icon: React.ReactNode;
  label: string;
  flex?: number;
}) {
  const { colors: c } = useTheme();
  const borderCol = c.border;
  const surfaceBg = c.surfaceMuted;

  const toneStyle =
    tone === 'danger'
      ? { borderColor: `${c.error}40`, backgroundColor: `${c.error}0F` }
      : tone === 'navy'
      ? { borderColor: NAVY, backgroundColor: NAVY }
      : { borderColor: borderCol, backgroundColor: surfaceBg };

  const textColor = tone === 'danger' ? c.error : tone === 'navy' ? '#ffffff' : c.ink;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.78}
      style={[styles.ghostBtn, flex ? { flex } : {}, toneStyle]}
    >
      {icon}
      <Text style={[styles.ghostBtnText, { color: textColor }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* ─── PrimaryButton ──────────────────────────────────────────────────────── */
function PrimaryButton({ onPress, label }: { onPress?: () => void; label: string }) {
  const { colors: c } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[styles.primaryBtn, { backgroundColor: NAVY }]}
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
      <ChevronRight size={18} color="#ffffff" strokeWidth={2.2} />
    </TouchableOpacity>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
function DriverAssignedCardBase({
  visible, carCategoryName, serviceType, destination, driver, rideId, rideStatus,
  waitingCharge, waitingChargeStatus, onCancel, onStart, onSOS,
}: DriverAssignedCardProps) {
  const { colors: c, t, isRTL } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim   = useRef(new Animated.Value(0)).current;
  const arrivedPulse = useRef(new Animated.Value(1)).current;
  const enRouteDot  = useRef(new Animated.Value(1)).current;
  const [chatOpen, setChatOpen] = useState(false);
  // Peek/expand state for the active-ride card (mirrors the driver app).
  const [collapsed, setCollapsed] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  const collapseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      ...Animation.spring.sheet,
      mass: 0.85,
    }).start();
  }, [visible]);

  useEffect(() => {
    let pulse: Animated.CompositeAnimation | null = null;
    if (rideStatus === 'arrived') {
      pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(arrivedPulse, { toValue: 1.06, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(arrivedPulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      pulse.start();
    } else {
      arrivedPulse.setValue(1);
    }
    return () => { pulse?.stop(); };
  }, [rideStatus]);

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

  const cardBg    = c.white;
  const surfaceBg = c.surfaceMuted;
  const borderCol = c.border;

  const initials = driver?.name
    ? driver.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const rating = driver?.rating ?? null;

  const isStarted = rideStatus === 'started';
  const isArrived = rideStatus === 'arrived';

  // Active-ride card lowers to a peek so the map is unobstructed; auto-lower
  // when the trip goes active, and let the rider tap the handle to raise it
  // back up for the full controls. Only the 'started' phase is collapsible.
  useEffect(() => { setCollapsed(isStarted); }, [isStarted]);
  useEffect(() => {
    Animated.spring(collapseAnim, {
      toValue: collapsed ? 1 : 0,
      useNativeDriver: true,
      ...Animation.spring.sheet,
    }).start();
  }, [collapsed]);

  const collapseTranslate = collapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, sheetHeight - PEEK_HEIGHT)],
  });

  return (
    <Animated.View
      style={[styles.sheet, { opacity: slideAnim, transform: [{ translateY }, { translateY: collapseTranslate }] }]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View
        onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
        style={[styles.sheetSurface, { backgroundColor: cardBg, paddingBottom: insets.bottom + 20 }]}
      >
        <Pressable
          onPress={() => { if (isStarted) setCollapsed((v) => !v); }}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? 'Raise trip card' : 'Lower trip card'}
        >
          <View style={[styles.handle, { backgroundColor: borderCol }]} />
        </Pressable>

        {/* ══════════════════════════════════════════
            ACTIVE RIDE (started) — In-progress cockpit
        ══════════════════════════════════════════ */}
        {isStarted ? (
          <View style={styles.body}>
            {/* Status header */}
            <View style={styles.inProgressHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Animated.View style={[styles.enRouteDotIndicator, { backgroundColor: c.success, opacity: enRouteDot }]} />
                  <Text style={[styles.statusLabel, { color: c.inkSoft }]}>{t('driver_en_route') ?? 'On trip'}</Text>
                </View>
                <Text style={[styles.inProgressTitle, { color: c.ink }]} numberOfLines={1}>
                  {'Heading to'} {destination ? destination : '—'}
                </Text>
              </View>
              {/* ETA chip */}
              <View style={[styles.etaChip, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
                <Text style={[styles.etaChipValue, { color: c.ink }]}>{driver?.eta ?? '—'}</Text>
                <Text style={[styles.etaChipUnit, { color: c.inkSoft }]}>{t('min')}</Text>
              </View>
            </View>

            {/* Progress bar placeholder */}
            <View style={[styles.progressTrack, { backgroundColor: surfaceBg }]}>
              <View style={[styles.progressFill, { backgroundColor: c.primary, width: '60%' }]} />
            </View>

            {/* Driver mini row */}
            <View style={[styles.driverMiniRow, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <View style={[styles.driverMiniIcon, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
                <Navigation size={18} color={c.ink} strokeWidth={1.7} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.driverMiniName, { color: c.ink }]} numberOfLines={1}>
                  {driver?.name ?? '—'}
                </Text>
                <Text style={[styles.driverMiniSub, { color: c.inkSoft }]} numberOfLines={1}>
                  {[driver?.vehicle, driver?.plateNumber].filter(Boolean).join(' · ') || '—'}
                </Text>
              </View>
              {rating != null ? <Stars value={rating} /> : null}
            </View>

            {/* Action buttons row */}
            <View style={styles.actionsRow}>
              <GhostButton
                onPress={() => { Haptics.selectionAsync(); setChatOpen(true); }}
                tone="navy"
                icon={<MessageCircle size={18} color="#ffffff" strokeWidth={1.8} />}
                label={t('chat')}
                flex={1}
              />
              <GhostButton
                onPress={handleCall}
                disabled={!driver?.phone}
                tone="navy"
                icon={<Phone size={18} color="#ffffff" strokeWidth={1.8} />}
                label={t('call') ?? 'Call'}
                flex={1}
              />
              <GhostButton
                onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); onSOS?.(); }}
                tone="danger"
                icon={<ShieldAlert size={18} color={c.error} strokeWidth={1.9} />}
                label="SOS"
                flex={1}
              />
            </View>

            {/* Need Help — routes to SafetySheet via onSOS */}
            <GhostButton
              onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); onSOS?.(); }}
              tone="navy"
              icon={<LifeBuoy size={18} color="#ffffff" strokeWidth={1.9} />}
              label={'Need Help'}
            />
          </View>

        ) : (
          /* ══════════════════════════════════════════
             DRIVER ASSIGNED / ARRIVED — identity card
          ══════════════════════════════════════════ */
          <View style={styles.body}>
            {/* ── ETA / Arrived header ── */}
            {isArrived ? (
              <Animated.View
                style={[
                  styles.arrivedBadge,
                  { backgroundColor: `${c.success}18`, borderColor: `${c.success}50`, transform: [{ scale: arrivedPulse }] },
                ]}
              >
                <View style={[styles.arrivedDot, { backgroundColor: c.success }]} />
                <Text style={[styles.arrivedText, { color: c.success }]}>
                  {t('status_driver_arrived')}
                </Text>
              </Animated.View>
            ) : (
              <View style={styles.etaHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.etaHeaderLabel, { color: c.inkSoft }]}>
                    {'Driver on the way'}
                  </Text>
                  <Text style={[styles.etaHeaderValue, { color: c.ink }]}>
                    {'Arrives in'} {driver?.eta ?? '—'} {t('min')}
                  </Text>
                </View>
                <View style={[styles.confirmedBadge, { backgroundColor: `${c.success}15`, borderColor: `${c.success}30` }]}>
                  <Text style={[styles.confirmedText, { color: c.success }]}>{'Confirmed'}</Text>
                </View>
              </View>
            )}

            {/* ── Driver identity card ── */}
            <View style={[styles.driverCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
              {/* Avatar */}
              <View style={[styles.avatar, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
                <Text style={[styles.avatarInitials, { color: c.ink }]}>{initials}</Text>
              </View>

              {/* Info */}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.driverName, { color: c.ink }]} numberOfLines={1}>
                    {driver?.name ?? '—'}
                  </Text>
                  <BadgeCheck size={16} color={c.primary} strokeWidth={2} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  {rating != null ? <Stars value={rating} /> : null}
                  {rating != null ? (
                    <Text style={[styles.ratingText, { color: c.ink }]}>{rating.toFixed(1)}</Text>
                  ) : null}
                  {driver && (
                    <Text style={[styles.tripsText, { color: c.inkSoft }]}>
                      {carCategoryName ? `· ${carCategoryName}` : ''}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* ── Vehicle row ── */}
            <View style={[styles.vehicleRow, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
              <View style={[styles.vehicleIconBox, { backgroundColor: cardBg, borderColor: borderCol }]}>
                <Navigation size={18} color={c.ink} strokeWidth={1.7} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.vehicleName, { color: c.ink }]} numberOfLines={1}>
                  {driver?.vehicle ?? '—'}
                </Text>
                <Text style={[styles.vehicleSub, { color: c.inkSoft }]}>
                  {serviceType === 'car' ? 'Car' : serviceType === 'scooter' ? 'Scooter' : 'Delivery'}
                </Text>
              </View>
              {driver?.plateNumber ? (
                <View style={[styles.plateBadge, { backgroundColor: cardBg, borderColor: borderCol }]}>
                  <Text style={[styles.plateText, { color: c.ink }]}>{driver.plateNumber}</Text>
                </View>
              ) : null}
            </View>

            {/* ── Waiting charge banner ── */}
            {waitingChargeStatus === 'active' && waitingCharge != null && (
              <View style={[styles.waitBanner, { backgroundColor: `${c.warning}12`, borderColor: `${c.warning}40` }]}>
                <View style={[styles.waitDot, { backgroundColor: c.warning }]} />
                <Text style={[styles.waitText, { color: c.warning }]}>
                  {t('waiting_charge')}: {waitingCharge.toFixed(2)} {t('egp')}
                </Text>
              </View>
            )}

            {/* ── Call / Message row ── */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <GhostButton
                onPress={handleCall}
                disabled={!driver?.phone}
                tone="navy"
                icon={<Phone size={18} color="#ffffff" strokeWidth={1.9} />}
                label={t('call') ?? 'Call'}
                flex={1}
              />
              <GhostButton
                onPress={() => { Haptics.selectionAsync(); setChatOpen(true); }}
                tone="navy"
                icon={<MessageCircle size={18} color="#ffffff" strokeWidth={1.9} />}
                label={t('chat')}
                flex={1}
              />
            </View>

            {/* ── Primary action (Start trip / shown when arrived) ── */}
            {(isArrived || rideStatus === 'driver_assigned') && onStart && (
              <PrimaryButton onPress={onStart} label={'Start trip'} />
            )}

            {/* ── Cancel ── */}
            <TouchableOpacity
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                onCancel();
              }}
              activeOpacity={0.78}
              style={styles.cancelTextBtn}
            >
              <Text style={[styles.cancelTextBtnLabel, { color: c.error }]}>
                {'Cancel Ride'}
              </Text>
            </TouchableOpacity>
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

export const DriverAssignedCard = memo(DriverAssignedCardBase);

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
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
    width: 40, height: 5, borderRadius: 3,
    alignSelf: 'center', marginBottom: 20,
  },
  body: {
    paddingHorizontal: 20, gap: 12, paddingBottom: 4,
  },

  /* ── In-progress ── */
  inProgressHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  statusLabel: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase',
  },
  enRouteDotIndicator: {
    width: 6, height: 6, borderRadius: 3,
  },
  inProgressTitle: {
    fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginTop: 4,
  },
  etaChip: {
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, alignItems: 'flex-end',
  },
  etaChipValue: { fontSize: 15, fontWeight: '700' },
  etaChipUnit: { fontSize: 11 },
  progressTrack: {
    height: 6, borderRadius: 3, width: '100%', overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 3,
  },
  driverMiniRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 0,
  },
  driverMiniIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  driverMiniName: { fontSize: 15, fontWeight: '600', letterSpacing: -0.15 },
  driverMiniSub: { fontSize: 13, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: 8 },

  /* ── Assigned/Arrived ── */
  etaHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  etaHeaderLabel: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase',
  },
  etaHeaderValue: {
    fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginTop: 4,
  },
  confirmedBadge: {
    borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1,
  },
  confirmedText: { fontSize: 12, fontWeight: '600' },

  arrivedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1,
  },
  arrivedDot: { width: 10, height: 10, borderRadius: 5 },
  arrivedText: { fontSize: 15, fontWeight: '700' },

  driverCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 0,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarInitials: { fontSize: 16, fontWeight: '700' },
  driverName: { fontSize: 16, fontWeight: '600', letterSpacing: -0.15 },
  ratingText: { fontSize: 13, fontWeight: '500' },
  tripsText: { fontSize: 12 },

  vehicleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  vehicleIconBox: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  vehicleName: { fontSize: 15, fontWeight: '600' },
  vehicleSub: { fontSize: 13, marginTop: 2 },
  plateBadge: {
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  plateText: { fontSize: 13, fontWeight: '700', letterSpacing: 1.2 },

  waitBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1,
  },
  waitDot: { width: 8, height: 8, borderRadius: 4 },
  waitText: { fontSize: 13, fontWeight: '600' },

  ghostBtn: {
    height: 56, borderRadius: 16, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  ghostBtnText: { fontSize: 14, fontWeight: '600' },

  primaryBtn: {
    height: 56, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 6,
  },
  primaryBtnText: {
    fontSize: 15.5, fontWeight: '600', color: '#ffffff', letterSpacing: -0.15,
  },

  cancelTextBtn: {
    height: 44, alignItems: 'center', justifyContent: 'center',
  },
  cancelTextBtnLabel: {
    fontSize: 14, fontWeight: '600',
  },
});
