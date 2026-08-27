import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { shuttleStatusLabel, type Trip, type BookingStatus } from '@/constants/data';

const C_PANEL = '#14151A';
const C_CAP = '#9AA0A6';
const C_INK = '#14151A';
const C_INK_SOFT = '#6B7178';
const C_MIST = '#F0F2F3';
const C_HAIR = '#EEF0F1';

const BOOKING_STATUS_LABEL: Record<BookingStatus, { en: string; ar: string }> = {
  pending:   { en: 'Pending',   ar: 'قيد الانتظار' },
  confirmed: { en: 'Confirmed', ar: 'مؤكدة' },
  boarded:   { en: 'Boarded',   ar: 'تم الركوب' },
  absent:    { en: 'Absent',    ar: 'غائب' },
  completed: { en: 'Completed', ar: 'مكتملة' },
  cancelled: { en: 'Cancelled', ar: 'ملغية' },
};

function isActiveTripStatus(status: string): boolean {
  return status === 'active' || status === 'boarding';
}
function isPendingTripStatus(status: string): boolean {
  return ['scheduled', 'upcoming', 'waiting_driver', 'driver_assigned', 'pending'].includes(status);
}
function statusColor(status: string): string {
  if (isActiveTripStatus(status)) return '#3DDC97';
  if (isPendingTripStatus(status)) return '#f59e0b';
  return '#9AA0A6';
}

interface UpcomingTripCardProps {
  trip: Trip;
  /** Trip status, patched with any live socket update — see trips screen. */
  tripStatus: string;
  passengerCount?: number;
  isLive?: boolean;
  canCancel: boolean;
  isCancelling?: boolean;
  accentColor: string;
  onPress: () => void;
  onCancelPress: () => void;
}

/**
 * Upcoming shuttle trip card. Presentational only — all data comes from the
 * normalized `Trip` model (My Trips data layer); no API calls are made here.
 */
export function UpcomingTripCard({
  trip,
  tripStatus,
  passengerCount,
  isLive,
  canCancel,
  isCancelling,
  onPress,
  onCancelPress,
}: UpcomingTripCardProps) {
  const { colors: c, t, language } = useTheme();
  const isAr = language === 'ar';
  const styles = useMemo(() => makeStyles(c), [c]);

  const routeName = (isAr ? trip.routeNameAr ?? trip.routeName : trip.routeName) || '—';
  const from      = (isAr ? trip.fromAr ?? trip.from : trip.from) || '—';
  const to        = (isAr ? trip.toAr ?? trip.to : trip.to) || '—';

  const hasCapacity = typeof passengerCount === 'number' && typeof trip.totalSeats === 'number' && trip.totalSeats > 0;
  const capacityPct = hasCapacity ? Math.min(100, Math.max(0, (passengerCount! / trip.totalSeats!) * 100)) : 0;
  const capacityColor = capacityPct >= 100 ? '#3DDC97' : capacityPct >= 50 ? '#4d9ef6' : '#f59e0b';
  const capacityText = t('capacity_passengers')
    .replace('{current}', String(passengerCount))
    .replace('{max}', String(trip.totalSeats));

  const bookingLabel = trip.bookingStatus ? BOOKING_STATUS_LABEL[trip.bookingStatus]?.[isAr ? 'ar' : 'en'] : null;
  const statusLabel = isActiveTripStatus(tripStatus)
    ? t('trip_status_active')
    : isPendingTripStatus(tripStatus)
    ? t('trip_status_pending')
    : shuttleStatusLabel(tripStatus, isAr ? 'ar' : 'en');

  const driverName   = trip.driverName;
  const driverRating = trip.driverRating;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.card}>
      <View style={styles.leftPanel}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(tripStatus) }]} />
          <Text style={styles.statusText} numberOfLines={1}>{statusLabel}</Text>
          {isLive && (
            <View style={styles.livePill}>
              <Text style={styles.livePillText}>{t('live_badge')}</Text>
            </View>
          )}
        </View>

        <View style={{ marginTop: 12 }}>
          <Text style={styles.cap}>{t('time_label')}</Text>
          <Text style={styles.bigVal}>{trip.time}</Text>
        </View>

        <View style={{ flex: 1, minHeight: 8 }} />

        <Text style={styles.cap}>{t('seat_label')}</Text>
        <Text style={styles.seatVal}>{trip.seat}</Text>
      </View>

      <View style={styles.rightPanel}>
        <View style={styles.titleRow}>
          <Text style={styles.routeName} numberOfLines={1}>{routeName}</Text>
          {!!bookingLabel && (
            <View style={styles.bookingBadge}>
              <Text style={styles.bookingBadgeText}>{bookingLabel}</Text>
            </View>
          )}
        </View>
        <Text style={styles.dateText}>{trip.date}</Text>

        <View style={styles.route}>
          <View style={styles.stationLine}>
            <View style={[styles.dot, { backgroundColor: C_INK }]} />
            <View style={styles.line} />
            <View style={[styles.dot, styles.dotOutline]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stationText} numberOfLines={1}>{from}</Text>
            <View style={{ height: 10 }} />
            <Text style={[styles.stationText, { color: C_INK_SOFT }]} numberOfLines={1}>{to}</Text>
          </View>
        </View>

        {hasCapacity && (
          <View style={styles.capacityWrap}>
            <Text style={styles.capacityCount}>{capacityText}</Text>
            <View style={styles.capacityTrack}>
              <View style={[styles.capacityFill, { width: `${capacityPct}%` as any, backgroundColor: capacityColor }]} />
            </View>
          </View>
        )}

        {!!driverName && (
          <Text style={styles.driverRow} numberOfLines={1}>
            {driverName}
            {typeof driverRating === 'number' && (
              <Text style={styles.ratingText}>  ★ {driverRating.toFixed(1)}</Text>
            )}
          </Text>
        )}

        <View style={styles.bottom}>
          <Text style={styles.price}>{trip.price} {t('egp')}</Text>
          {canCancel && (
            <TouchableOpacity
              style={[styles.cancelBtn, { opacity: isCancelling ? 0.5 : 1 }]}
              onPress={(e) => { (e as any).stopPropagation?.(); onCancelPress(); }}
              disabled={isCancelling}
              activeOpacity={0.85}
            >
              <X size={12} color={c.badge} strokeWidth={2.5} />
              <Text style={[styles.cancelBtnText, { color: c.badge }]}>
                {isCancelling ? `${t('cancel_trip')}...` : t('cancel_trip')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: {
      borderRadius: 24, overflow: 'hidden', flexDirection: 'row',
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: c.isDark ? 0.3 : 0.1, shadowRadius: 20, elevation: 6,
    },
    leftPanel: { width: 104, flexShrink: 0, backgroundColor: C_PANEL, padding: 14, paddingVertical: 16 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    statusDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
    statusText: { fontSize: 10.5, fontWeight: '700', color: '#fff', flexShrink: 1 },
    livePill: { marginStart: 2 },
    livePillText: { fontSize: 8.5, fontWeight: '800', color: '#3DDC97', textTransform: 'uppercase' },
    cap: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: C_CAP },
    bigVal: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 2, letterSpacing: -0.3 },
    seatVal: { fontSize: 14, fontWeight: '800', color: '#fff', marginTop: 1 },

    rightPanel: { flex: 1, backgroundColor: c.white, padding: 16, paddingVertical: 14, gap: 10 },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
    routeName: { flex: 1, fontSize: 15, fontWeight: '800', color: C_INK, letterSpacing: -0.2 },
    bookingBadge: { backgroundColor: C_MIST, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
    bookingBadgeText: { fontSize: 10, fontWeight: '700', color: C_INK_SOFT },
    dateText: { fontSize: 12, fontWeight: '600', color: C_CAP, marginTop: -6 },

    route: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
    stationLine: { alignItems: 'center', width: 8, paddingTop: 3 },
    dot: { width: 7, height: 7, borderRadius: 3.5 },
    dotOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#C7CBCF' },
    line: { width: 2, flex: 1, minHeight: 16, backgroundColor: C_HAIR, marginVertical: 2 },
    stationText: { fontSize: 12, fontWeight: '700', color: C_INK },

    capacityWrap: { gap: 5 },
    capacityCount: { fontSize: 11, fontWeight: '700', color: C_INK_SOFT },
    capacityTrack: { height: 6, borderRadius: 3, backgroundColor: C_MIST, overflow: 'hidden' },
    capacityFill: { height: 6, borderRadius: 3 },

    driverRow: { fontSize: 12, fontWeight: '600', color: C_INK_SOFT },
    ratingText: { fontSize: 12, fontWeight: '700', color: C_INK },

    bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    price: { fontSize: 15, fontWeight: '800', color: C_INK },
    cancelBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      height: 34, borderRadius: 999, borderWidth: 1.5, borderColor: '#F3C6C2', paddingHorizontal: 14,
    },
    cancelBtnText: { fontSize: 11.5, fontWeight: '700' },
  });
}
