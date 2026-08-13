import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Bus, User, Star, X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';
import { Typography } from '@/constants/typography';
import { shuttleStatusLabel, type Trip, type BookingStatus } from '@/constants/data';
import { GlassView } from '@/components/ui/GlassView';

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
  accentColor,
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
  const capacityColor = capacityPct >= 100 ? '#55c49a' : capacityPct >= 50 ? '#4d9ef6' : '#f59e0b';
  const capacityText = t('capacity_passengers')
    .replace('{current}', String(passengerCount))
    .replace('{max}', String(trip.totalSeats));

  const bookingLabel = trip.bookingStatus ? BOOKING_STATUS_LABEL[trip.bookingStatus]?.[isAr ? 'ar' : 'en'] : null;

  // Not yet populated by the My Trips data layer — hidden until the backend
  // contract for /shuttle/my-trips exposes driver info on upcoming bookings.
  const driverName   = (trip as { driverName?: string | null }).driverName;
  const driverRating = (trip as { driverRating?: number | null }).driverRating;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <GlassView style={styles.card} borderRadius={Radius.xl}>
        <View style={[styles.accent, { backgroundColor: accentColor }]} />

        <View style={styles.top}>
          <View style={styles.iconBox}>
            <Bus size={18} color={c.isDark ? c.background : c.white} />
            {isLive && (
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeName} numberOfLines={1}>{routeName}</Text>
            <Text style={styles.dateText}>{trip.date} · {trip.time}</Text>
          </View>
          <View style={styles.statusStack}>
            <TripStatusBadge status={tripStatus} c={c} t={t} isAr={isAr} />
            {!!bookingLabel && (
              <View style={[styles.bookingBadge, { borderColor: c.border }]}>
                <Text style={styles.bookingBadgeText}>{bookingLabel}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.route}>
          <View style={styles.station}>
            <View style={[styles.dot, { backgroundColor: c.ink }]} />
            <Text style={styles.stationText} numberOfLines={1}>{from}</Text>
          </View>
          <View style={styles.line} />
          <View style={styles.station}>
            <View style={[styles.dot, { backgroundColor: c.accentMint }]} />
            <Text style={styles.stationText} numberOfLines={1}>{to}</Text>
          </View>
        </View>

        {hasCapacity && (
          <View style={styles.capacityWrap}>
            <View style={styles.capacityLabelRow}>
              <Text style={styles.capacityLabel}>{t('passengers')}</Text>
              <Text style={styles.capacityCount}>{capacityText}</Text>
            </View>
            <View style={styles.capacityTrack}>
              <View style={[styles.capacityFill, { width: `${capacityPct}%` as any, backgroundColor: capacityColor }]} />
            </View>
          </View>
        )}

        {!!driverName && (
          <View style={styles.driverRow}>
            <User size={13} color={c.inkSoft} />
            <Text style={styles.driverName} numberOfLines={1}>{driverName}</Text>
            {typeof driverRating === 'number' && (
              <View style={styles.ratingRow}>
                <Star size={12} color={c.accent} fill={c.accent} />
                <Text style={styles.ratingText}>{driverRating.toFixed(1)}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.bottom}>
          <Text style={styles.price}>{trip.price} {t('egp')}</Text>
          {canCancel && (
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: c.badge, opacity: isCancelling ? 0.5 : 1 }]}
              onPress={(e) => { (e as any).stopPropagation?.(); onCancelPress(); }}
              disabled={isCancelling}
              activeOpacity={0.7}
            >
              <X size={12} color={c.badge} strokeWidth={2.5} />
              <Text style={[styles.cancelBtnText, { color: c.badge }]}>
                {isCancelling ? `${t('cancel_trip')}...` : t('cancel_trip')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </GlassView>
    </TouchableOpacity>
  );
}

function TripStatusBadge({ status, c, t, isAr }: {
  status: string;
  c: ThemeColors;
  t: (key: any) => string;
  isAr: boolean;
}) {
  if (isActiveTripStatus(status)) {
    return (
      <View style={[badgeStyles.badge, { backgroundColor: 'rgba(85,196,154,0.14)' }]}>
        <View style={[badgeStyles.dot, { backgroundColor: '#55c49a' }]} />
        <Text style={[badgeStyles.text, { color: '#2d9e72' }]}>{t('trip_status_active')}</Text>
      </View>
    );
  }
  if (isPendingTripStatus(status)) {
    return (
      <View style={[badgeStyles.badge, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
        <View style={[badgeStyles.dot, { backgroundColor: '#f59e0b' }]} />
        <Text style={[badgeStyles.text, { color: '#b97b10' }]}>{t('trip_status_pending')}</Text>
      </View>
    );
  }
  return (
    <View style={[badgeStyles.badge, { backgroundColor: c.mist }]}>
      <View style={[badgeStyles.dot, { backgroundColor: c.silver }]} />
      <Text style={[badgeStyles.text, { color: c.inkSoft }]}>{shuttleStatusLabel(status, isAr ? 'ar' : 'en')}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 },
  dot:   { width: 6, height: 6, borderRadius: 3 },
  text:  { fontSize: 11, fontWeight: Typography.weight.semibold },
});

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    // GlassView (same primitive the Driver app's trips.tsx card uses) now owns
    // the background/border — this only needs inner layout.
    card: {
      padding: Spacing.lg,
      overflow: 'hidden',
      gap: Spacing.md,
    },
    // 4px left-edge accent stripe (mirrors Driver's tripCardAccent) instead of
    // the old soft corner blob — a clearer status/route-color indicator.
    accent: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 4, borderRadius: 2 },
    top: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    iconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
    liveIndicator: { position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center' },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#55c49a' },
    routeName: { fontSize: Typography.size.sm, fontFamily: 'Inter_700Bold', color: c.ink },
    dateText: { fontSize: 11.5, color: c.inkSoft, marginTop: 1, fontFamily: 'Inter_600SemiBold' },
    statusStack: { alignItems: 'flex-end', gap: 5 },
    bookingBadge: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
    bookingBadgeText: { fontSize: 10, fontWeight: Typography.weight.medium, color: c.inkSoft },
    route: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    station: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    stationText: { fontSize: Typography.size.xs, fontFamily: 'Inter_600SemiBold', color: c.ink },
    line: { flex: 1, height: 1, backgroundColor: c.silver, opacity: 0.7 },
    capacityWrap: { gap: 5 },
    capacityLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    capacityLabel: { fontSize: 11, color: c.inkSoft },
    capacityCount: { fontSize: 11, fontWeight: Typography.weight.semibold, color: c.inkSoft },
    capacityTrack: { height: 5, borderRadius: 99, backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', overflow: 'hidden' },
    capacityFill: { height: 5, borderRadius: 99 },
    driverRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    driverName: { flex: 1, fontSize: 12, color: c.inkSoft },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    ratingText: { fontSize: 11, fontWeight: Typography.weight.semibold, color: c.inkSoft },
    bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    price: { fontSize: Typography.size.sm, fontFamily: 'Inter_700Bold', color: c.ink },
    cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: Spacing.md, paddingVertical: 7 },
    cancelBtnText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold },
  });
}
