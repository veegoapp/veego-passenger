import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import type { Route } from '@/constants/data';

// RouteCard uses t() from useTheme so it must call hook inside component

const C_PANEL = '#14151A';
const C_TEAL = '#0E9F8E';
const C_MINT = '#3DDC97';
const C_CAP = '#9AA0A6';
const C_INK = '#14151A';
const C_INK_SOFT = '#6B7178';
const C_MIST = '#F0F2F3';

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: {
      borderRadius: 24, overflow: 'hidden', flexDirection: 'row',
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: c.isDark ? 0.3 : 0.1, shadowRadius: 20, elevation: 6,
    },
    leftPanel: { width: 104, flexShrink: 0, backgroundColor: C_PANEL, padding: 16, paddingVertical: 16 },
    cap: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: C_CAP },
    codeText: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 3 },
    priceCap: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: C_CAP },
    priceBig: { fontSize: 22, fontWeight: '800', color: C_MINT, marginTop: 1, lineHeight: 24 },
    priceUnit: { fontSize: 11, color: C_CAP, fontWeight: '700' },

    rightPanel: { flex: 1, backgroundColor: c.white, padding: 16, paddingVertical: 14 },
    routeName: { fontSize: 15, fontWeight: '800', color: C_INK, letterSpacing: -0.2 },
    routePath: { fontSize: 12, fontWeight: '600', color: C_INK_SOFT, marginTop: 2 },
    statsRow: { flexDirection: 'row', gap: 14, marginTop: 12 },
    statVal: { fontSize: 12.5, fontWeight: '800', color: C_INK },
    statCap: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: C_CAP, marginTop: 1 },
    fillRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
    fillSeats: { fontSize: 11, fontWeight: '700', color: C_INK_SOFT },
    fillPct: { fontSize: 11, fontWeight: '700', color: C_TEAL },
    fillBar: { height: 6, borderRadius: 3, backgroundColor: C_MIST, marginTop: 6, overflow: 'hidden' },
    fillBarFill: { height: '100%' as any, backgroundColor: C_TEAL, borderRadius: 3 },
  });
}

export function RouteCard({ route, onPress }: { route: Route; onPress: () => void }) {
  const { colors: c, t, language } = useTheme();
  const isAr = language === 'ar';
  const styles = useMemo(() => makeStyles(c), [c]);
  const fillPct = Math.round(((route.totalSeats - route.seatsLeft) / route.totalSeats) * 100);

  const displayName = isAr ? (route.nameAr ?? route.name) : route.name;
  const displayFrom = isAr ? (route.fromAr ?? route.from) : route.from;
  const displayTo   = isAr ? (route.toAr   ?? route.to)   : route.to;
  const arrow = isAr ? '←' : '→';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.leftPanel}>
        <Text style={styles.cap}>{t('route_label')}</Text>
        <Text style={styles.codeText}>{route.code}</Text>
        <View style={{ flex: 1, minHeight: 12 }} />
        {route.pricingModel === 'tiered' && route.startingPrice != null ? (
          <>
            <Text style={styles.priceCap}>{t('starting_from')}</Text>
            <Text style={styles.priceBig}>{route.startingPrice}<Text style={styles.priceUnit}> {t('egp')}</Text></Text>
          </>
        ) : (
          <>
            <Text style={styles.priceCap}>{t('full_route')}</Text>
            <Text style={styles.priceBig}>{route.price}<Text style={styles.priceUnit}> {t('egp')}</Text></Text>
          </>
        )}
      </View>

      <View style={styles.rightPanel}>
        <Text style={styles.routeName} numberOfLines={1}>{displayName}</Text>
        <Text style={styles.routePath} numberOfLines={1}>{displayFrom} {arrow} {displayTo}</Text>

        <View style={styles.statsRow}>
          <View>
            <Text style={styles.statVal}>{route.stations}</Text>
            <Text style={styles.statCap}>{t('stops')}</Text>
          </View>
          <View>
            <Text style={styles.statVal}>{route.duration}</Text>
            <Text style={styles.statCap}>{t('trip_duration')}</Text>
          </View>
          <View>
            <Text style={styles.statVal}>{route.nextDeparture}</Text>
            <Text style={styles.statCap}>{t('departure')}</Text>
          </View>
        </View>

        <View style={styles.fillRow}>
          <Text style={styles.fillSeats}>{route.seatsLeft} {t('seats_left')}</Text>
          <Text style={styles.fillPct}>{fillPct}%</Text>
        </View>
        <View style={styles.fillBar}>
          <View style={[styles.fillBarFill, { width: `${fillPct}%` as any }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}
