import { memo, useRef, useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, Pressable, StyleSheet, Animated, Linking, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MessageCircle, Phone, BadgeCheck, ChevronRight, ShieldAlert, LifeBuoy, Star,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { Animation } from '@/constants/animations';
import { GlassView } from '@/components/ui/GlassView';
import { ChatModal } from './ChatModal';
import { Stars } from '@/components/ui/Stars';
import { VehicleIcon, mapServiceTypeToVehicleType } from '@/components/shared/VehicleIcon';
import type { DriverInfo } from '@/src/hooks/car/useRide';

interface DriverAssignedCardProps {
  visible: boolean;
  carCategoryName?: string | null;
  serviceType?: 'car' | 'scooter' | 'delivery';
  destination: string | null;
  driver?: DriverInfo | null;
  rideId?: string | null;
  rideStatus?: string;
  /** Live ETA (minutes) shown in the card's dark panel while the driver is
   *  en route. Sourced from CarMap's onEtaChange via CarServiceScreen. */
  etaMinutes?: number | null;
  waitingCharge?: number | null;
  waitingChargeStatus?: 'none' | 'active' | 'capped';
  onCancel: () => void;
  onStart?: () => void;
  onSOS?: () => void;
}

// Fixed brand treatment for the icon action buttons and "Need Help" —
// charcoal + metallic gold, independent of the app's light/dark theme,
// matching the driver app's minimalist icon-button style.
const GOLD = '#D5B23D';
const CHARCOAL_SURFACE = '#26262A';
const GOLD_BORDER = 'rgba(213,178,61,0.4)';
// Call/Chat circles: neutral gray fill, no border, white icon — independent
// of the app's light/dark theme like the rest of this card's fixed palette.
const ICON_BTN_GRAY = '#8E8E93';
// How much of the card stays visible when it's lowered to a peek (handle +
// status header + trip title). The rest slides below the screen edge.
const PEEK_HEIGHT = 132;

// ── "C · Split Panel" fixed palette (the approved driver-card design) ────────
// Deliberately theme-independent so the card reads identically over any map.
const C_PANEL = '#14151A';   // dark left panel
const C_CARD = '#FFFFFF';    // white content
const C_INK = '#14151A';
const C_INK_SOFT = '#6B7178';
const C_CAP = '#9AA0A6';
const C_HAIR = '#EEF0F1';
const C_TEAL = '#0E9F8E';     // accent (call button, verified)
const C_MINT = '#3DDC97';     // status dot / route
const C_STAR = '#F5A623';     // rating star
const C_RED = '#E5484D';      // cancel
const C_ARRIVED = '#D5B23D';  // arrived accent (gold)

/* ─── FilledButton ───────────────────────────────────────────────────────── */
// Every action CTA (SOS, Need Help) is a fully filled, compact pill — no
// more outlined/tinted "ghost" buttons — so the card reads as vibrant and
// decisive rather than washed out. Call/Chat use IconCircleButton instead
// (icon-only, driver-app parity — see below).
function FilledButton({
  onPress, disabled, tone = 'primary', icon, label, flex, compact,
}: {
  onPress?: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'danger' | 'neutral';
  icon: React.ReactNode;
  label: string;
  flex?: number;
  /** Shrinks height/padding/font — used when two pills share a row (SOS + Need Help). */
  compact?: boolean;
}) {
  const { colors: c } = useTheme();

  const bg = tone === 'danger' ? c.error : tone === 'neutral' ? CHARCOAL_SURFACE : c.primary;
  const borderColor = tone === 'neutral' ? GOLD_BORDER : 'transparent';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        styles.filledBtn,
        compact ? styles.filledBtnCompact : null,
        flex ? { flex } : {},
        { backgroundColor: bg, borderColor, borderWidth: tone === 'neutral' ? 1.5 : 0, opacity: disabled ? 0.5 : 1 },
      ]}
    >
      {icon}
      <Text style={[styles.filledBtnText, compact ? styles.filledBtnTextCompact : null]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* ─── IconCircleButton ───────────────────────────────────────────────────── */
// Icon-only circular Call/Chat buttons — driver-app parity: dark charcoal
// fill, gold icon + ring, no text label.
function IconCircleButton({
  onPress, disabled, icon, size = 48,
}: { onPress?: () => void; disabled?: boolean; icon: React.ReactNode; size?: number }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.82}
      style={[
        styles.iconCircleBtn,
        { width: size, height: size, borderRadius: size / 2, opacity: disabled ? 0.4 : 1 },
      ]}
    >
      {icon}
    </TouchableOpacity>
  );
}

/* ─── DriverAvatar ───────────────────────────────────────────────────────── */
// Circular avatar backed by the driver's real profile photo (fetched from
// the ride API), falling back to initials-on-tint when there's no photo yet
// or the image fails to load — never an empty/broken circle.
function DriverAvatar({ uri, initials, size, ring }: { uri?: string | null; initials: string; size: number; ring?: string }) {
  const { colors: c } = useTheme();
  const [failed, setFailed] = useState(false);
  // Reset the failure flag whenever the URL itself changes — otherwise one
  // failed load (e.g. a slow first paint before a freshly signed URL is
  // reachable) permanently locks this avatar instance to initials for the
  // rest of the ride, even once a valid uri comes through.
  useEffect(() => { setFailed(false); }, [uri]);
  const showImage = !!uri && !failed;

  return (
    <View
      style={[
        styles.avatarWrap,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: c.surfaceMuted, borderColor: ring ?? c.border },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[styles.avatarInitials, { color: c.ink, fontSize: size * 0.32 }]}>{initials}</Text>
      )}
    </View>
  );
}

/* ─── PrimaryButton ──────────────────────────────────────────────────────── */
// Driver-app parity: every primary CTA in the driver ride screen (Start/
// Complete trip, Accept, Submit rating) is this exact two-stop gradient, not a
// flat fill.
function PrimaryButton({ onPress, label }: { onPress?: () => void; label: string }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={styles.primaryBtnWrap}>
      <LinearGradient
        colors={['#2d2d42', '#1e1e28']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.primaryBtn}
      >
        <Text style={styles.primaryBtnText}>{label}</Text>
        <ChevronRight size={18} color="#ffffff" strokeWidth={2.2} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
function DriverAssignedCardBase({
  visible, carCategoryName, serviceType, destination, driver, rideId, rideStatus,
  etaMinutes, waitingCharge, waitingChargeStatus, onCancel, onStart, onSOS,
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

  // ══════════════════════════════════════════════════════════════════════════
  // DRIVER ASSIGNED / ARRIVED — "C · Split Panel" card (approved design)
  // Dark left panel (status · ETA · route · real vehicle image) + white right
  // content (avatar bubble breaking the top edge, name, rating, vehicle+plate,
  // chat/call, start/cancel).
  // ══════════════════════════════════════════════════════════════════════════
  if (!isStarted) {
    return (
      <Animated.View
        style={[styles.sheet, { opacity: slideAnim, transform: [{ translateY }] }]}
        pointerEvents={visible ? 'box-none' : 'none'}
      >
        <View style={styles.splitCard}>
          {/* left dark panel */}
          <View style={styles.leftPanel}>
            <View style={styles.rowCenter}>
              <View style={[styles.statusDot, { backgroundColor: isArrived ? C_ARRIVED : C_MINT }]} />
              <Text style={styles.panelCap}>
                {isArrived ? (t('status_driver_arrived') ?? 'Arrived') : 'Arriving'}
              </Text>
            </View>
            <View style={{ marginTop: 12 }}>
              <Text style={styles.etaNum}>{etaMinutes != null ? String(etaMinutes) : '—'}</Text>
              <Text style={styles.panelCap}>{t('min') ? `${t('min')} away` : 'min away'}</Text>
            </View>
            <View style={styles.miniRoute}>
              <View style={styles.miniDotO} />
              <View style={styles.miniLine} />
              <View style={styles.miniDotSq} />
            </View>
            <View style={styles.panelCar}>
              <VehicleIcon vehicleType={mapServiceTypeToVehicleType(serviceType)} colorHex={driver?.vehicleColorHex} size={44} />
            </View>
          </View>

          {/* right content */}
          <View style={styles.rightPanel}>
            <View style={styles.bubble}>
              <DriverAvatar uri={driver?.avatar} initials={initials} size={72} ring="#EBEDEE" />
            </View>

            <View style={styles.nameRowC}>
              <Text style={styles.driverNameC} numberOfLines={1}>{driver?.name ?? '—'}</Text>
              <BadgeCheck size={16} color={C_TEAL} strokeWidth={2} />
            </View>

            <View style={styles.ratingRowC}>
              <Star size={13} color={C_STAR} fill={C_STAR} strokeWidth={0} />
              <Text style={styles.ratingNumC}>{rating != null ? rating.toFixed(1) : '—'}</Text>
              {carCategoryName ? <Text style={styles.dotSepC}>·</Text> : null}
              {carCategoryName ? <Text style={styles.metaC}>{carCategoryName}</Text> : null}
            </View>

            <View style={styles.vehLineC}>
              <Text style={styles.vehNameC} numberOfLines={1}>{driver?.vehicle ?? '—'}</Text>
              {driver?.vehicleColor ? <Text style={styles.dotSepC}>·</Text> : null}
              {driver?.vehicleColor ? <Text style={styles.metaC} numberOfLines={1}>{driver.vehicleColor}</Text> : null}
              {driver?.plateNumber ? (
                <View style={styles.plateC}>
                  <Text style={styles.plateCText} numberOfLines={1}>{driver.plateNumber}</Text>
                </View>
              ) : null}
            </View>

            {waitingChargeStatus === 'active' && waitingCharge != null ? (
              <View style={styles.waitC}>
                <Text style={styles.waitCText} numberOfLines={1}>
                  {t('waiting_charge')}: {waitingCharge.toFixed(2)} {t('egp')}
                </Text>
              </View>
            ) : null}

            <View style={styles.actionsC}>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); setChatOpen(true); }}
                activeOpacity={0.85}
                style={[styles.icBtnC, { backgroundColor: C_TEAL }]}
              >
                <MessageCircle size={17} color="#ffffff" strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCall}
                disabled={!driver?.phone}
                activeOpacity={0.85}
                style={[styles.icBtnC, styles.icBtnGhostC, { opacity: driver?.phone ? 1 : 0.4 }]}
              >
                <Phone size={17} color={C_INK} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {(isArrived || rideStatus === 'driver_assigned') && onStart ? (
              <TouchableOpacity onPress={onStart} activeOpacity={0.88} style={styles.startBtnC}>
                <Text style={styles.startBtnCText}>{t('start_trip') ?? 'Start Trip'}</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); onCancel(); }}
              activeOpacity={0.78}
              style={styles.cancelC}
            >
              <Text style={styles.cancelCText}>{'Cancel Ride'}</Text>
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

  // ══════════════════════════════════════════════════════════════════════════
  // ACTIVE RIDE (started) — in-progress cockpit (unchanged behavior)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <Animated.View
      style={[styles.sheet, { opacity: slideAnim, transform: [{ translateY }, { translateY: collapseTranslate }] }]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <GlassView
        strong
        borderRadius={28}
        onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
        style={[styles.sheetSurface, { paddingBottom: insets.bottom + 8 }]}
      >
        <Pressable
          onPress={() => setCollapsed((v) => !v)}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? 'Raise trip card' : 'Lower trip card'}
        >
          <View style={[styles.handle, { backgroundColor: borderCol }]} />
        </Pressable>

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
          </View>

          {/* Progress bar placeholder */}
          <View style={[styles.progressTrack, { backgroundColor: surfaceBg }]}>
            <View style={[styles.progressFill, { backgroundColor: c.primary, width: '60%' }]} />
          </View>

          {/* Driver identity — avatar + name aligned on top, vehicle details underneath */}
          <View style={[styles.driverMiniRow, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <View style={styles.driverMiniTopRow}>
              <DriverAvatar uri={driver?.avatar} initials={initials} size={44} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.driverMiniName, { color: c.ink }]} numberOfLines={1}>
                  {driver?.name ?? '—'}
                </Text>
                {rating != null ? <Stars value={rating} /> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <IconCircleButton
                  onPress={() => { Haptics.selectionAsync(); setChatOpen(true); }}
                  icon={<MessageCircle size={17} color="#ffffff" strokeWidth={2} />}
                  size={40}
                />
                <IconCircleButton
                  onPress={handleCall}
                  disabled={!driver?.phone}
                  icon={<Phone size={17} color="#ffffff" strokeWidth={2} />}
                  size={40}
                />
              </View>
            </View>
            <View style={styles.driverMiniVehicleRow}>
              <VehicleIcon vehicleType={mapServiceTypeToVehicleType(serviceType)} colorHex={driver?.vehicleColorHex} size={40} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.driverMiniVehicleName, { color: c.ink }]} numberOfLines={1}>
                  {driver?.vehicle ?? '—'}
                </Text>
                <View style={styles.vehicleMetaRow}>
                  {driver?.vehicleColor ? (
                    <Text style={[styles.driverMiniVehicleColor, { color: c.ink }]} numberOfLines={1}>
                      {driver.vehicleColor}
                    </Text>
                  ) : null}
                  {driver?.plateNumber ? (
                    <View style={styles.plateBadge}>
                      <Text style={styles.plateText} numberOfLines={1}>{driver.plateNumber}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          </View>

          {/* Action buttons row — SOS + Need Help side by side, compact */}
          <View style={styles.actionsRow}>
            <FilledButton
              onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); onSOS?.(); }}
              tone="danger"
              icon={<ShieldAlert size={14} color="#ffffff" strokeWidth={2} />}
              label={t('sos_label')}
              flex={1}
              compact
            />
            <FilledButton
              onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); onSOS?.(); }}
              tone="neutral"
              icon={<LifeBuoy size={14} color={GOLD} strokeWidth={2} />}
              label={t('need_help')}
              flex={1}
              compact
            />
          </View>
        </View>

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

export const DriverAssignedCard = memo(DriverAssignedCardBase);

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 26,
    zIndex: 999,
  },
  sheetSurface: {
    paddingTop: 10,
  },
  handle: {
    width: 40, height: 5, borderRadius: 3,
    alignSelf: 'center', marginBottom: 20,
  },
  body: {
    paddingHorizontal: 20, gap: 12, paddingBottom: 4,
  },

  /* ── C · Split Panel (assigned / arrived) ── */
  splitCard: {
    flexDirection: 'row',
    backgroundColor: C_CARD,
    borderRadius: 22,
    shadowColor: '#000', shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18, shadowRadius: 40, elevation: 20,
  },
  leftPanel: {
    width: 116,
    backgroundColor: C_PANEL,
    borderTopLeftRadius: 22, borderBottomLeftRadius: 22,
    paddingHorizontal: 14, paddingVertical: 16,
  },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  panelCap: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.4,
    textTransform: 'uppercase', color: C_CAP,
  },
  etaNum: { fontSize: 44, fontWeight: '800', color: '#ffffff', lineHeight: 44, letterSpacing: -1 },
  miniRoute: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  miniDotO: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: C_MINT },
  miniLine: { flex: 1, height: 1.5, backgroundColor: '#333640' },
  miniDotSq: { width: 8, height: 8, borderRadius: 2, backgroundColor: C_MINT },
  panelCar: { marginTop: 'auto', alignItems: 'center', paddingTop: 14 },

  rightPanel: {
    flex: 1, minWidth: 0,
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16,
    alignItems: 'center',
  },
  bubble: { marginTop: -36, marginBottom: 8 },
  nameRowC: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  driverNameC: { fontSize: 18, fontWeight: '800', color: C_INK, letterSpacing: -0.2 },
  ratingRowC: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  ratingNumC: { fontSize: 13, fontWeight: '700', color: C_INK },
  dotSepC: { fontSize: 13, color: '#C9CDD2' },
  metaC: { fontSize: 13, fontWeight: '600', color: C_INK_SOFT },
  vehLineC: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center',
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C_HAIR, alignSelf: 'stretch',
  },
  vehNameC: { fontSize: 15, fontWeight: '800', color: C_INK },
  plateC: {
    backgroundColor: '#ffffff', borderRadius: 6, borderWidth: 1, borderColor: '#D3CDBE',
    paddingHorizontal: 9, paddingVertical: 4,
  },
  plateCText: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: '#16150F' },
  waitC: {
    marginTop: 10, backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'stretch',
  },
  waitCText: { fontSize: 12.5, fontWeight: '700', color: '#B45309', textAlign: 'center' },
  actionsC: { flexDirection: 'row', gap: 10, marginTop: 14, alignSelf: 'stretch' },
  icBtnC: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  icBtnGhostC: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#E2E5E8' },
  startBtnC: {
    height: 50, borderRadius: 14, backgroundColor: C_INK,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', marginTop: 12,
  },
  startBtnCText: { fontSize: 14, fontWeight: '700', color: '#ffffff', letterSpacing: 0.4 },
  cancelC: { marginTop: 12, paddingVertical: 4 },
  cancelCText: { fontSize: 12.5, fontWeight: '700', color: C_RED },

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
  progressTrack: {
    height: 6, borderRadius: 3, width: '100%', overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 3,
  },
  driverMiniRow: {
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 14, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 0,
  },
  driverMiniTopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  driverMiniVehicleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  driverMiniName: { fontSize: 15, fontWeight: '600', letterSpacing: -0.15, marginBottom: 3 },
  driverMiniVehicleName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.15 },
  driverMiniVehicleColor: { fontSize: 13, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 8 },

  /* ── Assigned/Arrived (legacy styles kept for shared bits) ── */
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
  avatarWrap: {
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, overflow: 'hidden',
  },
  avatarInitials: { fontWeight: '700' },
  driverName: { fontSize: 16, fontWeight: '600', letterSpacing: -0.15 },
  ratingText: { fontSize: 13, fontWeight: '500' },
  tripsText: { fontSize: 12 },

  vehicleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  vehicleName: { fontSize: 15, fontWeight: '800' },
  vehicleSub: { fontSize: 13, fontWeight: '700' },
  vehicleMetaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3,
  },
  plateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f4f4f2', borderRadius: 6, borderWidth: 2, borderColor: '#1C1C1E',
    paddingHorizontal: 10, paddingVertical: 4,
  },
  plateText: { fontSize: 14, fontWeight: '800', letterSpacing: 1.6, color: '#1C1C1E' },

  waitBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1,
  },
  waitDot: { width: 8, height: 8, borderRadius: 4 },
  waitText: { fontSize: 13, fontWeight: '600' },

  filledBtn: {
    height: 46, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingHorizontal: 10,
  },
  filledBtnText: { fontSize: 13.5, fontWeight: '700', color: '#ffffff' },
  filledBtnCompact: { height: 36, borderRadius: 11, gap: 5, paddingHorizontal: 6 },
  filledBtnTextCompact: { fontSize: 12 },

  iconCircleBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: ICON_BTN_GRAY,
    alignItems: 'center', justifyContent: 'center',
  },

  primaryBtnWrap: {
    borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 6,
  },
  primaryBtn: {
    height: 56, borderRadius: 16, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  primaryBtnText: {
    fontSize: 15.5, fontWeight: '600', color: '#ffffff', letterSpacing: -0.15,
  },

  cancelBtn: {
    height: 48, borderRadius: 14, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnLabel: {
    fontSize: 14.5, fontWeight: '700',
  },
});
