/**
 * Presentation sections extracted verbatim from TripSheet.tsx.
 *
 * These are pure presentation components: all state, derived values, and
 * handlers stay in TripSheet and arrive here as props (including the
 * makeStyles result, passed as `styles`). No logic, styling, or behavior
 * was changed during extraction.
 */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Heart, Clock, MapPin, AlertCircle, Ticket,
  ChevronRight, ChevronLeft, Bus,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { ThemeColors } from '@/constants/colors';
import type { Route } from '@/constants/data';
import { DATES, formatCairoTime } from '@/constants/data';
import { Spacing } from '@/constants/spacing';
import {
  ACTIVE_STATUSES, isTripBookable, shuttleStatusColor, shuttleStatusLabel, formatTripDateUTC,
} from './tripSheetHelpers';

type T = (key: string) => string;

/** ── Route Hero: code box, favourite, route name, journey track ── */
export function RouteHero({ styles, route, isAr, lo, hi, pickStation, visibleStationIndices }: {
  styles: any; route: Route; isAr: boolean; lo: number; hi: number;
  pickStation: (idx: number) => void;
  /** Indices into route.path to render, already filtered to the selected trip's direction. */
  visibleStationIndices: number[];
}) {
  return (
    <View style={styles.routeHero}>
      <View style={styles.heroGlow} />
      <View style={styles.heroTopRow}>
        <View style={styles.heroCodeBox}>
          <Text style={styles.heroCodeText}>{route.code}</Text>
        </View>
        <TouchableOpacity
          style={styles.heroFavBtn}
          activeOpacity={0.7}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Heart size={16} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>
      <Text style={styles.heroRouteName}>
        {isAr ? (route.nameAr ?? route.name) : route.name}
      </Text>
      <Text style={styles.heroRoutePath}>
        {isAr ? (route.fromAr ?? route.from) : route.from}
        {isAr ? ' ← ' : ' → '}
        {isAr ? (route.toAr ?? route.to) : route.to}
      </Text>

      {/* Journey track visualization */}
      <View style={styles.journeyWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.journeyScroll}
        >
          <View style={styles.journeyRow}>
            {visibleStationIndices.map((i, pos) => {
              const s = route.path[i];
              const isActive = i >= lo && i <= hi;
              const isFirst = pos === 0;
              const isLast = pos === visibleStationIndices.length - 1;
              return (
                <React.Fragment key={s.id}>
                  <TouchableOpacity style={styles.journeyStop} onPress={() => pickStation(i)} activeOpacity={0.7}>
                    <View style={styles.journeyPin}>
                      <MapPin
                        size={isFirst || isLast ? 22 : 18}
                        color={isActive ? '#ffffff' : 'rgba(255,255,255,0.35)'}
                        strokeWidth={isActive ? 2.5 : 1.5}
                        fill={isActive ? 'rgba(255,255,255,0.15)' : 'transparent'}
                      />
                    </View>
                    <Text style={[styles.journeyLabel, isActive && styles.journeyLabelActive]} numberOfLines={2}>
                      {isAr ? (s.nameAr ?? s.name) : s.name}
                    </Text>
                  </TouchableOpacity>
                  {!isLast && (
                    <View style={[
                      styles.journeyConnector,
                      (i >= lo && i < hi) && styles.journeyConnectorActive,
                    ]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

/** ── Info stat cards (compact horizontal) ── */
export function StatsRow({ styles, c, t, route, visibleTripsCount }: {
  styles: any; c: ThemeColors; t: T; route: Route; visibleTripsCount: number;
}) {
  return (
    <View style={styles.statsRow}>
      <LinearGradient
        colors={c.isDark ? ['#1e1e3a', '#16162e'] : ['#ffffff', '#f7f7fc']}
        style={styles.statCard}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <View style={styles.statIconBox}>
          <Bus size={13} color={c.ink} />
        </View>
        <View>
          <Text style={styles.statValue}>{(route.departureCount ?? visibleTripsCount) || route.stations}</Text>
          <Text style={styles.statLabel}>{t('departure')}</Text>
        </View>
      </LinearGradient>
      <LinearGradient
        colors={c.isDark ? ['#1e1e3a', '#16162e'] : ['#ffffff', '#f7f7fc']}
        style={styles.statCard}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <View style={styles.statIconBox}>
          <Clock size={13} color={c.ink} />
        </View>
        <View>
          <Text style={styles.statValue}>{route.duration ?? '—'}</Text>
          <Text style={styles.statLabel}>{t('trip_duration')}</Text>
        </View>
      </LinearGradient>
      <LinearGradient
        colors={c.isDark ? ['#1e1e3a', '#16162e'] : ['#ffffff', '#f7f7fc']}
        style={styles.statCard}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <View style={styles.statIconBox}>
          <Ticket size={13} color={c.ink} />
        </View>
        <View>
          <Text style={styles.statValue}>{route.price}</Text>
          <Text style={styles.statLabel}>{t('egp')}</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

/** ── Date selector strip ── */
export function DateSelector({ styles, selectedDateIdx, onSelectDate }: {
  styles: any; selectedDateIdx: number; onSelectDate: (idx: number) => void;
}) {
  return (
    <View style={styles.dateSelectorWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingEnd: 12 }}
      >
        {DATES.map((d, i) => {
          const active = i === selectedDateIdx;
          return (
            <TouchableOpacity
              key={d.id}
              style={[styles.dateItem, active ? styles.dateItemActive : styles.dateItemInactive]}
              onPress={() => onSelectDate(i)}
              activeOpacity={0.75}
            >
              <Text style={[styles.dateDayLabel, active ? styles.dateDayLabelActive : styles.dateDayLabelInactive]}>
                {d.label}
              </Text>
              <Text style={[styles.dateDayNum, active ? styles.dateDayNumActive : styles.dateDayNumInactive]}>
                {d.day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** ── One trip card in the departures list ── */
export function TripCard({ styles, c, t, trip, index, active, onPress }: {
  styles: any; c: ThemeColors; t: T; trip: any; index: number; active: boolean;
  onPress: () => void;
}) {
  const bookable = isTripBookable(trip);
  const disabled = !bookable;
  const statusColor = shuttleStatusColor(trip);
  const statusLbl = shuttleStatusLabel(trip, t);
  const time = formatCairoTime(trip.departureTime ?? trip.departure_time ?? '');
  const date = formatTripDateUTC(trip.departureTime ?? trip.departure_time ?? '');
  const bookedSeats: number = trip.bookedSeats ?? 0;
  const totalSeats: number = trip.totalSeats ?? 14;
  const availableSeats: number = trip.availableSeats ?? 0;
  const minRequired: number = trip.minRequired ?? 7;
  const message: string = trip.message ?? '';
  const tripNum = String(index + 1).padStart(2, '0');
  const direction: 'outbound' | 'return' | undefined = trip.direction;

  const fillPct = totalSeats > 0 ? (bookedSeats / totalSeats) * 100 : 0;
  const activationPct = minRequired > 0 ? Math.min(100, (bookedSeats / minRequired) * 100) : 100;

  const tripStatus = (trip.status ?? trip.shuttleStatus ?? '').toLowerCase();
  const barColor = ACTIVE_STATUSES.includes(tripStatus)
    ? '#16a34a'
    : tripStatus === 'cancelled'
    ? '#dc2626'
    : '#d97706';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.tripCard,
        active && styles.tripCardActive,
        disabled && styles.tripCardDisabled,
      ]}
      activeOpacity={0.85}
    >
      {/* Top row: time + trip number */}
      <View style={styles.tripCardTopRow}>
        <View>
          <Text style={[styles.tripTime, active && styles.tripTimeActive]}>{time}</Text>
          <Text style={[styles.tripDateText, active && styles.tripDateTextActive]}>{date}</Text>
        </View>
        <View style={[styles.tripNumberBox, active && styles.tripNumberBoxActive]}>
          <Text style={[styles.tripNumberText, active && styles.tripNumberTextActive]}>
            #{tripNum}
          </Text>
        </View>
      </View>

      {/* Status badge */}
      <View style={styles.tripStatusRow}>
        <View style={[styles.tripStatusDot, { backgroundColor: active ? '#fff' : statusColor }]} />
        <Text style={[styles.tripStatusText, { color: active ? 'rgba(255,255,255,0.8)' : statusColor }]}>
          {statusLbl}
        </Text>
        {!!direction && (
          <Text style={[styles.tripStatusText, { color: active ? 'rgba(255,255,255,0.55)' : c.inkSoft }]}>
            {' · '}{direction === 'outbound' ? t('shuttle_direction_outbound') : t('shuttle_direction_return')}
          </Text>
        )}
      </View>

      {/* Seat bar */}
      <View style={styles.tripSeatsRow}>
        <Text style={[styles.tripSeatsFraction, active && styles.tripSeatsFractionActive]}>
          {bookedSeats} / {totalSeats}
        </Text>
        <Text style={[styles.tripSeatsLabel, active && styles.tripSeatsLabelActive]}>
          {t('seats_left').replace(/\d+/, String(availableSeats))}
        </Text>
      </View>
      <View style={styles.progressBarWrap}>
        <View
          style={[
            styles.progressBarFill,
            {
              width: `${ACTIVE_STATUSES.includes(tripStatus) ? fillPct : activationPct}%` as any,
              backgroundColor: active ? (c.isDark ? c.background : '#fff') : barColor,
            },
          ]}
        />
      </View>

      {/* Available seats pill */}
      <View style={styles.tripAvailRow}>
        <View style={[styles.tripAvailDot, { backgroundColor: active ? 'rgba(255,255,255,0.7)' : (availableSeats <= 3 ? '#dc2626' : '#16a34a') }]} />
        <Text style={[
          styles.tripAvailText,
          { color: active ? 'rgba(255,255,255,0.75)' : (availableSeats <= 3 ? '#dc2626' : '#16a34a') },
        ]}>
          {availableSeats} available
        </Text>
      </View>

      {!!message && (
        <Text style={[styles.tripMessage, active && styles.tripMessageActive]} numberOfLines={2}>
          {message}
        </Text>
      )}
    </TouchableOpacity>
  );
}

/** ── Station picker: from/to tabs + station timeline ── */
export function StationPicker({
  styles, gs, c, t, isAr, route, routeLoading, hasPath,
  pick, setPick, safeFrom, safeTo, lo, hi, pickStation, visibleStationIndices, onRetry,
}: {
  styles: any; gs: object; c: ThemeColors; t: T; isAr: boolean; route: Route;
  routeLoading: boolean; hasPath: boolean; pick: 'from' | 'to';
  setPick: (p: 'from' | 'to') => void; safeFrom: number; safeTo: number;
  lo: number; hi: number; pickStation: (idx: number) => void;
  /** Indices into route.path to render, already filtered to the selected trip's direction. */
  visibleStationIndices: number[];
  onRetry: () => void;
}) {
  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionTitle}>{t('boarding_dropoff')}</Text>

      {routeLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={c.ink} />
          <Text style={styles.loadingText}>{t('loading_stops')}</Text>
        </View>
      ) : !hasPath ? (
        <View style={styles.loadingWrap}>
          <AlertCircle size={28} color={c.silver} />
          <Text style={styles.errorText}>{t('stops_unavailable')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={[gs, styles.pickTabWrap]}>
            {(['from', 'to'] as const).map((p) => {
              const active = pick === p;
              const stationName = p === 'from'
                ? (isAr
                    ? (route.path[safeFrom]?.nameAr ?? route.path[safeFrom]?.name ?? route.fromAr ?? route.from)
                    : (route.path[safeFrom]?.name ?? route.from))
                : (isAr
                    ? (route.path[safeTo]?.nameAr ?? route.path[safeTo]?.name ?? route.toAr ?? route.to)
                    : (route.path[safeTo]?.name ?? route.to));
              return (
                <TouchableOpacity key={p} style={[styles.pickTab, active && styles.pickTabActive]} onPress={() => setPick(p)} activeOpacity={0.8}>
                  <Text style={[styles.pickTabText, { color: active ? (c.isDark ? c.background : c.white) : c.inkSoft }]} numberOfLines={1}>
                    {p === 'from' ? t('from') : t('to')} · {stationName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.timeline}>
            {visibleStationIndices.map((i, pos) => {
              const s = route.path[i];
              const inSegment = i >= lo && i <= hi;
              const isFrom = i === safeFrom;
              const isTo = i === safeTo;
              const isLast = pos === visibleStationIndices.length - 1;
              return (
                <TouchableOpacity key={s.id} style={styles.timelineRow} onPress={() => pickStation(i)} activeOpacity={0.7}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.tlDot, isFrom || isTo ? styles.tlDotActive : inSegment ? styles.tlDotSeg : styles.tlDotInactive]} />
                    {!isLast && (
                      <View style={[styles.tlLine, i >= lo && i < hi ? styles.tlLineActive : styles.tlLineInactive]} />
                    )}
                  </View>
                  <View style={styles.timelineRight}>
                    <View style={styles.timelineTextRow}>
                      <Text style={[styles.tlName, { color: inSegment ? c.ink : c.inkSoft }]}>
                      {isAr ? (s.nameAr ?? s.name) : s.name}
                    </Text>
                      {(isFrom || isTo) && (
                        <View style={styles.tlBadge}>
                          <Text style={styles.tlBadgeText}>{isFrom ? t('from') : t('to')}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.tlArea}>{s.area}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

/** ── Price summary card ── */
export function PriceSummary({
  styles, c, t, isAr, isRTL, route, safeFrom, safeTo, seatCount, total,
}: {
  styles: any; c: ThemeColors; t: T; isAr: boolean; isRTL: boolean; route: Route;
  safeFrom: number; safeTo: number; seatCount: number; total: number;
}) {
  return (
    <View style={[styles.priceSummary, { marginHorizontal: Spacing.md, marginTop: Spacing.md }]}>
      <View style={styles.priceIcon}>
        <Ticket size={22} color={c.isDark ? c.background : c.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.priceSegLabel}>
          {isAr
            ? (route.path[safeFrom]?.nameAr ?? route.path[safeFrom]?.name ?? route.fromAr ?? route.from)
            : (route.path[safeFrom]?.name ?? route.from)}
          {' → '}
          {isAr
            ? (route.path[safeTo]?.nameAr ?? route.path[safeTo]?.name ?? route.toAr ?? route.to)
            : (route.path[safeTo]?.name ?? route.to)}
          {seatCount > 1 ? ` · ${seatCount} ${t('seat_count')}` : ''}
        </Text>
        <Text style={styles.priceTotal}>{total} {t('egp')}</Text>
      </View>
      {isRTL ? <ChevronLeft size={16} color={c.inkSoft} /> : <ChevronRight size={16} color={c.inkSoft} />}
    </View>
  );
}
