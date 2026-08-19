import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Bus, Car, Bike as ScooterIcon, Package } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';
import { Typography } from '@/constants/typography';
import { shuttleStatusLabel, type Trip, type TripType } from '@/constants/data';
import { GlassView } from '@/components/ui/GlassView';

const TYPE_ICONS: Record<TripType, React.ComponentType<{ size?: number; color?: string }>> = {
  shuttle: Bus,
  car: Car,
  scooter: ScooterIcon,
  delivery: Package,
};

function isActiveTripStatus(status: string): boolean {
  return status === 'active' || status === 'boarding';
}
function isPendingTripStatus(status: string): boolean {
  return ['scheduled', 'upcoming', 'waiting_driver', 'driver_assigned', 'pending'].includes(status);
}

interface HistoryTripCardProps {
  /** Normalized trip — shuttle (serviceType 'shuttle') or on-demand (car/scooter/delivery), already merged by useTrips(). */
  trip: Trip;
  accentColor: string;
  /** Omit (or pass undefined) when the trip has no navigable detail target — the card stays non-clickable. */
  onPress?: () => void;
}

/**
 * Past/completed trip card for the My Trips History tab. Presentational only —
 * reads the already-normalized `Trip` model; no API calls, no cancel action.
 */
export function HistoryTripCard({ trip, accentColor, onPress }: HistoryTripCardProps) {
  const { colors: c, t, language } = useTheme();
  const isAr = language === 'ar';
  const styles = useMemo(() => makeStyles(c), [c]);

  const routeName = (isAr ? trip.routeNameAr ?? trip.routeName : trip.routeName) || '—';
  const from      = (isAr ? trip.fromAr ?? trip.from : trip.from) || '—';
  const to        = (isAr ? trip.toAr ?? trip.to : trip.to) || '—';
  const TripTypeIcon = TYPE_ICONS[trip.type];

  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={0.9}>
      <GlassView style={styles.card} borderRadius={Radius.xl}>
        <View style={[styles.accent, { backgroundColor: accentColor }]} />

        <View style={styles.top}>
          <View style={styles.iconBox}>
            <TripTypeIcon size={18} color={c.isDark ? c.background : c.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeName} numberOfLines={1}>{routeName}</Text>
            <Text style={styles.dateText}>{trip.date} · {trip.time}</Text>
          </View>
          <TripStatusBadge status={trip.status} c={c} t={t} isAr={isAr} />
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

        <View style={styles.bottom}>
          <View style={styles.typeBadge}>
            <TripTypeIcon size={10} color={c.inkSoft} />
            <Text style={styles.typeBadgeText}>{t(`trip_type_${trip.type}` as any)}</Text>
          </View>
          <Text style={styles.price}>{trip.price} {t('egp')}</Text>
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
      <View style={[badgeStyles.badge, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC', borderWidth: 1 }]}>
        <View style={[badgeStyles.dot, { backgroundColor: '#55c49a' }]} />
        <Text style={[badgeStyles.text, { color: '#2d9e72' }]}>{t('trip_status_active')}</Text>
      </View>
    );
  }
  if (isPendingTripStatus(status)) {
    return (
      <View style={[badgeStyles.badge, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D', borderWidth: 1 }]}>
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
    top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    iconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
    routeName: { fontSize: Typography.size.sm, fontFamily: 'Inter_700Bold', color: c.ink },
    dateText: { fontSize: 11.5, color: c.inkSoft, marginTop: 1, fontFamily: 'Inter_600SemiBold' },
    route: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    station: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    stationText: { fontSize: Typography.size.xs, fontFamily: 'Inter_600SemiBold', color: c.ink },
    line: { flex: 1, height: 1, backgroundColor: c.silver, opacity: 0.7 },
    bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    typeBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.06)' },
    typeBadgeText: { fontSize: 10, fontWeight: Typography.weight.semibold, color: c.inkSoft },
    price: { fontSize: Typography.size.sm, fontFamily: 'Inter_700Bold', color: c.ink },
  });
}
