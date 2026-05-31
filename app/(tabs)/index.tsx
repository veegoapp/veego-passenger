import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Bus, Car, Bike, Package, Clock, Bell, Search, MapPin, ArrowRight, Heart, Ticket, FileText, Calendar } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { useFavorites } from '@/context/FavoritesContext';
import { ThemeColors, S } from '@/constants/colors';
import { useRoutes } from '@/src/hooks/useRoutes';
import { useTrips } from '@/src/hooks/useTrips';
import { RouteCard, FeaturedOffers } from '@/components/RouteCard';
import { SectionHeader } from '@/components/Shared';
import { useBooking } from '@/context/BookingContext';
import { useTabBar } from '@/context/TabBarContext';
import { CarMap } from '@/components/car/CarMap';
import { BikeMap } from '@/components/bike/BikeMap';

type ServiceMode = 'shuttle' | 'car' | 'bike';

const ROUTE_FILTERS = ['all_lines', 'L01', 'L02', 'L03', 'L04'] as const;

const SERVICES = [
  { id: 'shuttle' as const, labelKey: 'shuttle' as const, icon: Bus },
  { id: 'car' as const, labelKey: 'car' as const, icon: Car },
  { id: 'bike' as const, labelKey: 'bike' as const, icon: Bike },
  { id: 'delivery' as const, labelKey: 'delivery' as const, icon: Package, soon: true },
];

function SoonToast({ visible, label }: { visible: boolean; label: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -10, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View
      style={[
        { opacity, transform: [{ translateY }] },
        { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, alignItems: 'center', pointerEvents: 'none' as any },
      ]}
    >
      <View style={{ backgroundColor: 'rgba(30,30,40,0.88)', borderRadius: 24, paddingHorizontal: 28, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 }}>
        <Clock size={18} color="#ffffff" />
        <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>{label}</Text>
      </View>
    </Animated.View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, zIndex: 10 },
    greeting: { fontSize: 11, color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '500' },
    greetingName: { fontSize: 20, fontWeight: '600', color: c.ink, letterSpacing: -0.5, fontFamily: 'Inter_600SemiBold' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    notifDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: c.badge, borderWidth: 1.5, borderColor: c.white },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: c.isDark ? c.background : c.white, fontSize: 12, fontWeight: '600' },

    serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
    serviceBtn: { width: '48%', height: 52, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, flex: 1 },
    serviceBtnActive: { backgroundColor: c.ink, borderColor: c.ink },
    serviceBtnInactive: { backgroundColor: c.white, borderColor: c.border },
    serviceBtnInactiveDark: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' },
    serviceBtnSoon: { backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.mist, borderColor: c.border, opacity: 0.9 },
    serviceBtnSoonDark: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', opacity: 0.9 },
    serviceLabel: { fontSize: 12.5, fontWeight: '500' },
    soonBadge: { backgroundColor: c.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
    soonBadgeText: { fontSize: 8.5, fontWeight: '600', color: c.inkSoft, letterSpacing: 0.3 },

    stickySearch: { paddingHorizontal: 20, marginBottom: 10 },
    searchBar: { flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 20, paddingHorizontal: 16, gap: 10 },
    searchPlaceholder: { flex: 1, fontSize: 13.5, color: c.inkSoft },
    searchDivider: { width: 1, height: 16, backgroundColor: c.border },

    scrollContent: { paddingHorizontal: 20, paddingTop: 0, gap: 0 },
    heroCard: { borderRadius: 28, padding: 20, marginBottom: 8, overflow: 'hidden', ...S.float },
    heroGlow: { position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)' },
    heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
    heroLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1.2 },
    heroRouteName: { fontSize: 16, fontWeight: '600', color: '#ffffff', marginTop: 2 },
    heroBadge: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
    heroBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
    heroBottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    heroStation: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    heroStationName: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
    heroTicket: { marginLeft: 'auto', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
    heroTicketText: { fontSize: 11, fontWeight: '500', color: '#ffffff' },
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
    quickItem: { width: '47%', borderRadius: 22, padding: 16, gap: 10 },
    quickIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' },
    quickLabel: { fontSize: 12.5, fontWeight: '500', color: c.ink },
    stationCard: { width: 148, borderRadius: 24, padding: 14, gap: 4 },
    stationIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    stationName: { fontSize: 12.5, fontWeight: '600', color: c.ink },
    stationDist: { fontSize: 11, color: c.inkSoft },
    stationEta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    stationEtaText: { fontSize: 10.5, color: c.inkSoft },
    filterScroll: { flexGrow: 0, marginBottom: 12 },
    filterChip: { height: 36, paddingHorizontal: 16, borderRadius: 99, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    filterChipActive: { backgroundColor: c.ink, borderColor: c.ink },
    filterChipInactive: { backgroundColor: c.white, borderColor: c.border },
    filterText: { fontSize: 12.5, fontWeight: '500' },
    filterTextActive: { color: c.isDark ? c.background : c.white },
    filterTextInactive: { color: c.inkSoft },
    routesList: { gap: 12 },
  });
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? 60 : insets.top;
  const [mode, setMode] = useState<ServiceMode>('shuttle');
  const [soonVisible, setSoonVisible] = useState(false);
  const soonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { openRoute, activeBooking } = useBooking();
  const { colors: c, glassStyle: gs, t } = useTheme();
  const { isFavorite, toggleFavorite } = useFavorites();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [routeFilter, setRouteFilter] = useState('all_lines');
  const { routes } = useRoutes();
  const { upcomingTrips } = useTrips();
  const { setVisible: setTabBarVisible } = useTabBar();

  const filteredRoutes = routeFilter === 'all_lines' ? routes : routes.filter((r) => r.code === routeFilter);

  useEffect(() => {
    setTabBarVisible(true);
    return () => setTabBarVisible(true);
  }, [setTabBarVisible]);

  const showSoon = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setSoonVisible(true);
    if (soonTimer.current) clearTimeout(soonTimer.current);
    soonTimer.current = setTimeout(() => setSoonVisible(false), 2200);
  };

  const handleServicePress = (id: string, soon?: boolean) => {
    if (soon) { showSoon(); return; }
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setMode(id as ServiceMode);
  };

  useEffect(() => () => {
    if (soonTimer.current) clearTimeout(soonTimer.current);
  }, []);

  const isCarBike = mode === 'car' || mode === 'bike';

  const serviceGrid = (
    <View style={styles.serviceGrid}>
      {SERVICES.map((svc) => {
        const active = !svc.soon && mode === svc.id;
        const inactiveDark = isCarBike && !active;
        return (
          <TouchableOpacity
            key={svc.id}
            style={[
              styles.serviceBtn,
              active
                ? styles.serviceBtnActive
                : svc.soon
                  ? (isCarBike ? styles.serviceBtnSoonDark : styles.serviceBtnSoon)
                  : (isCarBike ? styles.serviceBtnInactiveDark : styles.serviceBtnInactive),
            ]}
            onPress={() => handleServicePress(svc.id, svc.soon)}
            activeOpacity={0.8}
          >
            <svc.icon
              size={15}
              color={active ? (c.isDark ? c.background : c.white) : inactiveDark ? 'rgba(255,255,255,0.55)' : c.inkSoft}
            />
            <Text style={[
              styles.serviceLabel,
              { color: active ? (c.isDark ? c.background : c.white) : inactiveDark ? 'rgba(255,255,255,0.55)' : c.inkSoft },
            ]}>
              {t(svc.labelKey)}
            </Text>
            {svc.soon && (
              <View style={styles.soonBadge}>
                <Text style={styles.soonBadgeText}>{t('soon')}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: isCarBike ? '#0d0e22' : undefined }}>
      <SoonToast visible={soonVisible} label={t('soon')} />

      {/* ── Top section: always visible (header + service grid) ── */}
      {!isCarBike ? (
        <LinearGradient colors={c.luxeSoftGrad} style={{ paddingTop: top + 12 }}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>{t('good_morning')}</Text>
              <Text style={styles.greetingName}>VeeGo</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={[gs, styles.iconBtn]} onPress={() => router.push('/notifications')} activeOpacity={0.8}>
                <Bell size={18} color={c.ink} />
                <View style={styles.notifDot} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.avatar} activeOpacity={0.85}>
                <Text style={styles.avatarText}>VG</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Service grid */}
          {serviceGrid}

          {/* Sticky search bar */}
          <View style={styles.stickySearch}>
            <TouchableOpacity
              style={[gs, styles.searchBar]}
              onPress={() => router.push('/stations')}
              activeOpacity={0.85}
            >
              <Search size={16} color={c.inkSoft} />
              <Text style={styles.searchPlaceholder}>{t('where_to')}</Text>
              <View style={styles.searchDivider} />
              <MapPin size={16} color={c.ink} />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      ) : (
        /* Dark header for car/bike */
        <View style={{ paddingTop: top + 8, backgroundColor: '#0d0e22' }}>
          {serviceGrid}
        </View>
      )}

      {/* ── Content area: shuttle scroll OR car/bike full screen ── */}
      {mode === 'shuttle' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Active booking hero card */}
          {activeBooking && (
            <TouchableOpacity activeOpacity={0.92} onPress={() => router.push('/ticket')}>
              <LinearGradient colors={[c.ink, c.isDark ? '#2a2a4a' : '#2e2e3e']} style={styles.heroCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={styles.heroGlow} />
                <View style={styles.heroTop}>
                  <View>
                    <Text style={styles.heroLabel}>{t('next_departure')}</Text>
                    <Text style={styles.heroRouteName}>{activeBooking.route.name}</Text>
                  </View>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>{activeBooking.time}</Text>
                  </View>
                </View>
                <View style={styles.heroBottom}>
                  <View style={styles.heroStation}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffffff' }} />
                    <Text style={styles.heroStationName}>{activeBooking.route.path[activeBooking.fromIdx].name}</Text>
                  </View>
                  <ArrowRight size={12} color="rgba(255,255,255,0.5)" />
                  <View style={styles.heroStation}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#55c49a' }} />
                    <Text style={styles.heroStationName}>{activeBooking.route.path[activeBooking.toIdx].name}</Text>
                  </View>
                  <TouchableOpacity style={styles.heroTicket} onPress={() => router.push('/ticket')} activeOpacity={0.8}>
                    <Text style={styles.heroTicketText}>{t('view_ticket')}</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Featured offers */}
          <SectionHeader title={t('featured_offers')} />
          <FeaturedOffers />

          {/* Quick actions */}
          <SectionHeader title={t('quick_actions')} />
          <View style={styles.quickGrid}>
            {[
              { icon: Ticket, label: t('book_a_ride'), onPress: () => openRoute(routes[0]) },
              { icon: FileText, label: t('my_tickets'), onPress: () => router.push('/ticket') },
              { icon: MapPin, label: t('stations'), onPress: () => router.push('/stations') },
              { icon: Calendar, label: t('schedule'), onPress: () => {} },
            ].map((item) => (
              <TouchableOpacity key={item.label} style={[gs, styles.quickItem]} onPress={item.onPress} activeOpacity={0.88}>
                <View style={styles.quickIcon}>
                  <item.icon size={18} color={c.ink} />
                </View>
                <Text style={styles.quickLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Upcoming trips */}
          <SectionHeader title={t('upcoming')} onMore={() => router.push('/(tabs)/trips')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20, gap: 10 }}>
            {upcomingTrips.map((trip) => {
              const TypeIconComp = trip.type === 'car' ? Car : trip.type === 'bike' ? Bike : Bus;
              const typeLabel = t(`trip_type_${trip.type}` as any);
              return (
                <TouchableOpacity key={trip.id} style={[gs, styles.stationCard]} onPress={() => router.push('/(tabs)/trips')} activeOpacity={0.88}>
                  <View style={styles.stationIcon}>
                    <TypeIconComp size={16} color={c.ink} />
                  </View>
                  <Text style={styles.stationName} numberOfLines={1}>{trip.routeName}</Text>
                  <Text style={styles.stationDist}>{trip.date} · {trip.time}</Text>
                  <View style={styles.stationEta}>
                    <Clock size={11} color={c.inkSoft} />
                    <Text style={styles.stationEtaText}>{typeLabel} · {trip.price} {t('egp')}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Shuttle routes */}
          <SectionHeader title={t('shuttle_routes')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={{ gap: 8, paddingRight: 4 }}
          >
            {ROUTE_FILTERS.map((f) => {
              const label = f === 'all_lines' ? t('all_lines') : f;
              const active = routeFilter === f;
              return (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, active ? styles.filterChipActive : styles.filterChipInactive]}
                  onPress={() => { setRouteFilter(f); if (Platform.OS !== 'web') Haptics.selectionAsync(); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterText, active ? styles.filterTextActive : styles.filterTextInactive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.routesList}>
            {filteredRoutes.map((route) => (
              <View key={route.id} style={{ position: 'relative' }}>
                <RouteCard route={route} onPress={() => openRoute(route)} />
                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                    toggleFavorite(route.id);
                  }}
                  style={{ position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }}
                  activeOpacity={0.8}
                >
                  <Heart size={16} color={isFavorite(route.id) ? '#e94e4e' : c.inkSoft} fill={isFavorite(route.id) ? '#e94e4e' : 'none'} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {mode === 'car' && (
        <View style={{ flex: 1, position: 'relative' }}>
          <CarMap phase="idle" destination={null} driverLocation={null} />
        </View>
      )}

      {mode === 'bike' && (
        <View style={{ flex: 1, position: 'relative' }}>
          <BikeMap phase="idle" destination={null} />
        </View>
      )}
    </View>
  );
}
