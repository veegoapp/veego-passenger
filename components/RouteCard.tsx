import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { MapPin, Clock, Users, Zap, Sparkles, Ticket, GraduationCap, Moon } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors, S } from '@/constants/colors';
import type { Route } from '@/constants/data';

// RouteCard uses t() from useTheme so it must call hook inside component

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: { backgroundColor: c.white, borderRadius: 24, padding: 16, overflow: 'hidden', ...S.luxe },
    cardAccent: { position: 'absolute', top: -48, right: -48, width: 160, height: 160, borderRadius: 80, opacity: 0.7 },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    codeBox: { width: 44, height: 44, borderRadius: 16, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
    codeText: { color: c.isDark ? c.background : c.white, fontSize: 11, fontWeight: '600' },
    cardMeta: { flex: 1 },
    routeName: { fontSize: 14.5, fontWeight: '600', color: c.ink },
    routePath: { fontSize: 11, color: c.inkSoft, marginTop: 2 },
    priceBox: { alignItems: 'flex-end' },
    priceText: { fontSize: 15, fontWeight: '600', color: c.ink },
    priceLabel: { fontSize: 10, color: c.inkSoft },
    cardStats: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 12 },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statRight: { marginLeft: 'auto' },
    statText: { fontSize: 11, color: c.inkSoft },
    fillBar: { height: 4, borderRadius: 2, backgroundColor: c.mist, marginTop: 12, overflow: 'hidden' },
    fillBarFill: { height: '100%' as any, backgroundColor: c.ink, borderRadius: 2 },
    offersScroll: { gap: 12, paddingRight: 4 },
    offerCard: { width: 230, borderRadius: 24, padding: 16, overflow: 'hidden', ...S.luxe },
    offerGlow: { position: 'absolute', top: -40, right: -40, width: 128, height: 128, borderRadius: 64, backgroundColor: 'rgba(255,255,255,0.4)' },
    offerTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    offerTag: { fontSize: 10, fontWeight: '600', color: 'rgba(30,30,40,0.7)', textTransform: 'uppercase', letterSpacing: 1.2 },
    offerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(30,30,40,0.3)' },
    offerTap: { fontSize: 10, color: 'rgba(30,30,40,0.6)' },
    offerBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10, gap: 12 },
    offerTextBox: { flex: 1 },
    offerTitle: { fontSize: 15, fontWeight: '600', color: '#1e1e28', lineHeight: 20 },
    offerSubtitle: { fontSize: 11, color: '#5e5e72', marginTop: 4 },
    offerIconBox: { width: 40, height: 40, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
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
      <View style={[styles.cardAccent, { backgroundColor: route.color }]} />
      <View style={styles.cardTop}>
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{route.code}</Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.routeName}>{displayName}</Text>
          <Text style={styles.routePath}>{displayFrom} {arrow} {displayTo}</Text>
        </View>
        <View style={styles.priceBox}>
          <Text style={styles.priceText}>{route.price} {t('egp')}</Text>
          <Text style={styles.priceLabel}>{t('full_route')}</Text>
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
          <Text style={[styles.statText, { color: c.ink, fontWeight: '600' }]}>{route.nextDeparture}</Text>
        </View>
      </View>
      <View style={styles.fillBar}>
        <View style={[styles.fillBarFill, { width: `${fill * 100}%` as any }]} />
      </View>
    </TouchableOpacity>
  );
}

type Offer = { id: string; tag: string; title: string; subtitle: string; colors: [string, string]; icon: React.ComponentType<{size?:number;color?:string}> };

const OFFERS: Offer[] = [
  { id: 'o1', tag: 'New rider', title: '50% off your first ride', subtitle: 'Auto-applied at checkout', colors: ['#ddeef8', '#ece5f8'], icon: Sparkles },
  { id: 'o2', tag: 'Weekly pass', title: 'Unlimited rides for 7 days', subtitle: 'Save up to 35%', colors: ['#d6f3e8', '#e0eef8'], icon: Ticket },
  { id: 'o3', tag: 'Student', title: '20% off with student ID', subtitle: 'Verify in profile', colors: ['#f8f0d5', '#f8e8d5'], icon: GraduationCap },
  { id: 'o4', tag: 'Limited', title: 'Night Owl — 45 EGP', subtitle: 'After 9pm, all lines', colors: ['#e8e0f5', '#e5eaf8'], icon: Moon },
];

export function FeaturedOffers() {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.offersScroll}>
      {OFFERS.map((o) => (
        <TouchableOpacity key={o.id} activeOpacity={0.9} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Alert.alert(o.title, o.subtitle); }}>
          <LinearGradient colors={o.colors} style={styles.offerCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.offerGlow} />
            <View style={styles.offerTop}>
              <Text style={styles.offerTag}>{o.tag}</Text>
              <View style={styles.offerDot} />
              <Text style={styles.offerTap}>Tap to apply</Text>
            </View>
            <View style={styles.offerBottom}>
              <View style={styles.offerTextBox}>
                <Text style={styles.offerTitle}>{o.title}</Text>
                <Text style={styles.offerSubtitle}>{o.subtitle}</Text>
              </View>
              <View style={styles.offerIconBox}>
                <o.icon size={16} color="#1e1e28" />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
