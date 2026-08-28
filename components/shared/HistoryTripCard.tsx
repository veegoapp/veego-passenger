import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Bus, Car, Bike as ScooterIcon, Package } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { shuttleStatusLabel, type Trip, type TripType } from '@/constants/data';
import { useSplitColors, type SplitColors } from '@/constants/splitTheme';

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
function statusColor(status: string): string {
  if (isActiveTripStatus(status)) return '#3DDC97';
  if (isPendingTripStatus(status)) return '#f59e0b';
  return '#9AA0A6';
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
export function HistoryTripCard({ trip, onPress }: HistoryTripCardProps) {
  const { t, language } = useTheme();
  const isAr = language === 'ar';
  const S = useSplitColors();
  const styles = useMemo(() => makeStyles(S), [S]);

  const routeName = (isAr ? trip.routeNameAr ?? trip.routeName : trip.routeName) || '—';
  const from      = (isAr ? trip.fromAr ?? trip.from : trip.from) || '—';
  const to        = (isAr ? trip.toAr ?? trip.to : trip.to) || '—';
  const TripTypeIcon = TYPE_ICONS[trip.type];
  const statusLabel = isActiveTripStatus(trip.status)
    ? t('trip_status_active')
    : isPendingTripStatus(trip.status)
    ? t('trip_status_pending')
    : shuttleStatusLabel(trip.status, isAr ? 'ar' : 'en');

  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={0.9} style={styles.card}>
      <View style={styles.leftPanel}>
        <View style={styles.typeIconBox}>
          <TripTypeIcon size={17} color="#fff" />
        </View>
        <View style={{ marginTop: 12 }}>
          <Text style={styles.cap}>{t('date_label')}</Text>
          <Text style={styles.dateVal}>{trip.date}</Text>
        </View>
        <View style={{ marginTop: 8 }}>
          <Text style={styles.cap}>{t('time_label')}</Text>
          <Text style={styles.dateVal}>{trip.time}</Text>
        </View>
      </View>

      <View style={styles.rightPanel}>
        <View style={styles.titleRow}>
          <Text style={styles.routeName} numberOfLines={1}>{routeName}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor(trip.status) }]} />
            <Text style={styles.statusText} numberOfLines={1}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.route}>
          <View style={styles.stationLine}>
            <View style={[styles.dot, { backgroundColor: S.ink }]} />
            <View style={styles.line} />
            <View style={[styles.dot, styles.dotOutline]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stationText} numberOfLines={1}>{from}</Text>
            <View style={{ height: 10 }} />
            <Text style={[styles.stationText, { color: S.inkSoft }]} numberOfLines={1}>{to}</Text>
          </View>
        </View>

        <View style={styles.bottom}>
          <View style={styles.typeBadge}>
            <TripTypeIcon size={10} color={S.inkSoft} />
            <Text style={styles.typeBadgeText}>{t(`trip_type_${trip.type}` as any)}</Text>
          </View>
          <Text style={styles.price}>{trip.price} {t('egp')}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(S: SplitColors) {
  return StyleSheet.create({
    card: {
      borderRadius: 24, overflow: 'hidden', flexDirection: 'row',
      shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
    },
    leftPanel: { width: 92, flexShrink: 0, backgroundColor: S.panel, padding: 14, paddingVertical: 16 },
    typeIconBox: { width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
    cap: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: S.cap },
    dateVal: { fontSize: 12.5, fontWeight: '800', color: '#fff', marginTop: 1 },

    rightPanel: { flex: 1, backgroundColor: S.card, padding: 16, paddingVertical: 14, gap: 10 },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
    routeName: { flex: 1, fontSize: 14.5, fontWeight: '800', color: S.ink, letterSpacing: -0.2 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 10.5, fontWeight: '700', color: S.inkSoft },

    route: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
    stationLine: { alignItems: 'center', width: 8, paddingTop: 3 },
    dot: { width: 7, height: 7, borderRadius: 3.5 },
    dotOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#C7CBCF' },
    line: { width: 2, flex: 1, minHeight: 14, backgroundColor: '#EEF0F1', marginVertical: 2 },
    stationText: { fontSize: 12, fontWeight: '700', color: S.ink },

    bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: S.surfaceMuted },
    typeBadgeText: { fontSize: 10, fontWeight: '700', color: S.inkSoft },
    price: { fontSize: 14.5, fontWeight: '800', color: S.ink },
  });
}
