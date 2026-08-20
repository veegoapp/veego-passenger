import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MapPin, Clock, Users, Zap } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors, S } from '@/constants/colors';
import type { Route } from '@/constants/data';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

// RouteCard uses t() from useTheme so it must call hook inside component

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: { backgroundColor: c.white, borderRadius: Radius.xl, overflow: 'hidden', ...S.luxe },
    cardGrad: { padding: Spacing.lg },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    codeBox: { width: 44, height: 44, borderRadius: Radius.lg, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
    codeText: { color: c.isDark ? c.background : c.white, fontSize: 11, fontWeight: Typography.weight.semibold },
    cardMeta: { flex: 1 },
    routeName: { fontSize: 14.5, fontWeight: Typography.weight.semibold, color: c.ink },
    routePath: { fontSize: 11, color: c.inkSoft, marginTop: 2 },
    priceBox: { alignItems: 'flex-end' },
    priceText: { fontSize: 15, fontWeight: Typography.weight.semibold, color: c.ink },
    priceLabel: { fontSize: 10, color: c.inkSoft },
    cardStats: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: Spacing.md },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    statRight: { marginStart: 'auto' },
    statText: { fontSize: 11, color: c.inkSoft },
    fillBar: { height: 4, borderRadius: 2, backgroundColor: c.mist, marginTop: Spacing.md, overflow: 'hidden' },
    fillBarFill: { height: '100%' as any, backgroundColor: c.ink, borderRadius: 2 },
  });
}

export function RouteCard({ route, onPress }: { route: Route; onPress: () => void }) {
  const { colors: c, t, language } = useTheme();
  const isAr = language === 'ar';
  const styles = useMemo(() => makeStyles(c), [c]);
  const fill = (route.totalSeats - route.seatsLeft) / route.totalSeats;

  const displayName = isAr ? (route.nameAr ?? route.name) : route.name;
  const displayFrom = isAr ? (route.fromAr ?? route.from) : route.from;
  const displayTo   = isAr ? (route.toAr   ?? route.to)   : route.to;
  const arrow = isAr ? '←' : '→';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      <LinearGradient
        colors={c.cardGrad}
        style={styles.cardGrad}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <View style={styles.cardTop}>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{route.code}</Text>
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.routeName}>{displayName}</Text>
            <Text style={styles.routePath}>{displayFrom} {arrow} {displayTo}</Text>
          </View>
          <View style={styles.priceBox}>
            {route.pricingModel === 'tiered' && route.startingPrice != null ? (
              <>
                <Text style={styles.priceText}>{route.startingPrice} {t('egp')}</Text>
                <Text style={styles.priceLabel}>{t('starting_from')}</Text>
              </>
            ) : (
              <>
                <Text style={styles.priceText}>{route.price} {t('egp')}</Text>
                <Text style={styles.priceLabel}>{t('full_route')}</Text>
              </>
            )}
          </View>
        </View>
        <View style={styles.cardStats}>
          <View style={styles.statItem}>
            <MapPin size={12} color={c.inkSoft} />
            <Text style={styles.statText}>{route.stations} {t('stops')}</Text>
          </View>
          <View style={styles.statItem}>
            <Clock size={12} color={c.inkSoft} />
            <Text style={styles.statText}>{route.duration}</Text>
          </View>
          <View style={styles.statItem}>
            <Users size={12} color={c.inkSoft} />
            <Text style={styles.statText}>{route.seatsLeft} {t('seats_left')}</Text>
          </View>
          <View style={[styles.statItem, styles.statRight]}>
            <Zap size={12} color={c.ink} />
            <Text style={[styles.statText, { color: c.ink, fontWeight: Typography.weight.semibold }]}>{route.nextDeparture}</Text>
          </View>
        </View>
        <View style={styles.fillBar}>
          <View style={[styles.fillBarFill, { width: `${fill * 100}%` as any }]} />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}
