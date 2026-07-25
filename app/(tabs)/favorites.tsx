import { useMemo, useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { AppLoader } from '@/components/ui/AppLoader';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Clock, GitCommit, Navigation, Ticket, Car, Bus, RefreshCw, Bike as ScooterIcon, Package } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useFavorites } from '@/context/FavoritesContext';
import { useBooking } from '@/context/BookingContext';
import { useTabBar } from '@/context/TabBarContext';
import { ThemeColors, S } from '@/constants/colors';
import { useRoutes } from '@/src/hooks/shuttle/useRoutes';
import { useFavoriteDestinations } from '@/src/hooks/shared/useFavoriteDestinations';
import type { TripType } from '@/constants/data';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

const TYPE_ICON: Record<TripType, React.ComponentType<{ size?: number; color?: string }>> = {
  shuttle: Bus,
  car: Car,
  scooter: ScooterIcon,
  delivery: Package,
};

const TYPE_COLOR: Record<TripType, string> = {
  shuttle: '#d8ecf7',
  car: '#fde8d8',
  scooter: '#d8f5e8',
  delivery: '#e3daf5',
};

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: Spacing.lg },
    headerTitle: { fontSize: Typography.size.xxl, fontWeight: Typography.weight.bold, color: c.ink, letterSpacing: -1, fontFamily: 'Inter_700Bold' },
    headerSub: { fontSize: Typography.size.xs, color: c.inkSoft, marginTop: 3 },
    content: { paddingHorizontal: 20, gap: Spacing.xl },

    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
    sectionTitle: { fontSize: 13, fontWeight: Typography.weight.semibold, color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 1.1 },
    sectionAction: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold, color: c.ink },

    // Shuttle card
    shuttleCard: { backgroundColor: c.white, borderRadius: Radius.xl, padding: Spacing.lg, overflow: 'hidden', ...S.luxe },
    cardAccent: { position: 'absolute', top: -40, right: -40, width: 130, height: 130, borderRadius: 65, opacity: 0.5 },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    codeBox: { width: 44, height: 44, borderRadius: Radius.lg, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
    codeText: { color: c.isDark ? c.background : c.white, fontSize: 11, fontWeight: Typography.weight.bold },
    cardMeta: { flex: 1, gap: 2 },
    routeName: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: c.ink },
    routePath: { fontSize: 11, color: c.inkSoft },
    priceBox: { alignItems: 'flex-end' },
    priceText: { fontSize: 15, fontWeight: Typography.weight.bold, color: c.ink },
    priceLabel: { fontSize: 10, color: c.inkSoft },
    cardStats: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 14 },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    statText: { fontSize: 11, color: c.inkSoft },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
    rebookBtn: { flex: 1, height: 42, borderRadius: 14, backgroundColor: c.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    rebookText: { color: c.isDark ? c.background : c.white, fontSize: 13, fontWeight: Typography.weight.semibold },
    removeBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },

    // Frequent destination card
    destCard: { backgroundColor: c.white, borderRadius: 20, padding: Spacing.lg, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 14, ...S.float },
    destAccent: { position: 'absolute', right: -30, top: -30, width: 100, height: 100, borderRadius: 50, opacity: 0.08 },
    destIconBox: { width: 44, height: 44, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
    destMeta: { flex: 1 },
    destFrom: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold, color: c.ink },
    destTo: { fontSize: Typography.size.xs, color: c.inkSoft, marginTop: 1 },
    destDetail: { fontSize: 11, color: c.silver, marginTop: 3 },
    destRight: { alignItems: 'flex-end', gap: 6 },
    destPrice: { fontSize: Typography.size.sm, fontWeight: Typography.weight.bold, color: c.ink },
    destPriceLabel: { fontSize: 10, color: c.inkSoft },
    destBtn: { paddingHorizontal: 14, paddingVertical: Spacing.sm, borderRadius: Radius.md, backgroundColor: c.ink, flexDirection: 'row', alignItems: 'center', gap: 5 },
    destBtnText: { color: c.isDark ? c.background : c.white, fontSize: 11, fontWeight: Typography.weight.semibold },

    // Empty / loading
    emptyShuttle: { backgroundColor: c.mist, borderRadius: 20, padding: 20, alignItems: 'center', gap: Spacing.sm },
    emptyIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
    emptyTitle: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: c.ink },
    emptySub: { fontSize: Typography.size.xs, color: c.inkSoft, textAlign: 'center', lineHeight: 18 },
    emptyBtn: { marginTop: Spacing.sm, paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.md, backgroundColor: c.ink },
    emptyBtnText: { color: c.isDark ? c.background : c.white, fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold },
    loadingWrap: { paddingVertical: Spacing.xxl, alignItems: 'center' },
  });
}

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const { tabBarHeight } = useTabBar();
  const { colors: c, glassStyle: gs, t, language } = useTheme();
  const isAr = language === 'ar';
  const styles = useMemo(() => makeStyles(c), [c]);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { openRoute } = useBooking();

  // Real shuttle routes from backend — filtered by local favorites
  const { routes, loading: routesLoading, refresh: refreshRoutes } = useRoutes();
  const favoriteRoutes = useMemo(() => routes.filter((r) => isFavorite(r.id)), [routes, isFavorite]);

  // Frequent destinations derived from booking history
  const { destinations, loading: destLoading, error: destError, refresh: refreshDest } = useFavoriteDestinations();
  const carDest = useMemo(() => destinations.filter((d) => d.type === 'car'), [destinations]);
  const scooterDest = useMemo(() => destinations.filter((d) => d.type === 'scooter'), [destinations]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.selectionAsync();
    await Promise.allSettled([refreshRoutes(), refreshDest()]);
    setRefreshing(false);
  }, [refreshRoutes, refreshDest]);

  const handleBookAgain = (from: string, to: string, type: TripType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate to the appropriate service tab pre-filled with this route
    router.push(`/(tabs)` as any);
  };

  return (
    <LinearGradient colors={c.luxeSoftGrad} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <Text style={styles.headerTitle}>{t('favorites')}</Text>
        <Text style={styles.headerSub}>{t('fav_page_sub')}</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.ink}
            colors={[c.ink]}
          />
        }
      >
        {/* ── Shuttle Favorites ─────────────────────────────────── */}
        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('fav_shuttle_section')}</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/index')} activeOpacity={0.75}>
              <Text style={styles.sectionAction}>{t('go_to_routes')}</Text>
            </TouchableOpacity>
          </View>

          {routesLoading ? (
            <View style={styles.loadingWrap}>
              <AppLoader size={80} />
            </View>
          ) : favoriteRoutes.length === 0 ? (
            <View style={styles.emptyShuttle}>
              <View style={styles.emptyIcon}>
                <Heart size={24} color={c.silver} />
              </View>
              <Text style={styles.emptyTitle}>{t('fav_empty_shuttle')}</Text>
              <Text style={styles.emptySub}>{t('fav_empty_shuttle_sub')}</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/index')} activeOpacity={0.85}>
                <Text style={styles.emptyBtnText}>{t('browse_routes')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: Spacing.md }}>
              {favoriteRoutes.map((route) => (
                <View key={route.id} style={[gs, styles.shuttleCard]}>
                  <View style={[styles.cardAccent, { backgroundColor: route.color }]} />
                  <View style={styles.cardTop}>
                    <View style={styles.codeBox}>
                      <Text style={styles.codeText}>{route.code}</Text>
                    </View>
                    <View style={styles.cardMeta}>
                      <Text style={styles.routeName}>{isAr ? (route.nameAr ?? route.name) : route.name}</Text>
                      <Text style={styles.routePath}>
                        {isAr ? (route.fromAr ?? route.from) : route.from}
                        {isAr ? ' ← ' : ' → '}
                        {isAr ? (route.toAr ?? route.to) : route.to}
                      </Text>
                    </View>
                    <View style={styles.priceBox}>
                      <Text style={styles.priceText}>{route.price} {t('egp')}</Text>
                      <Text style={styles.priceLabel}>{t('base_fare')}</Text>
                    </View>
                  </View>
                  <View style={styles.cardStats}>
                    <View style={styles.statItem}>
                      <Clock size={12} color={c.inkSoft} />
                      <Text style={styles.statText}>{route.duration}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <GitCommit size={12} color={c.inkSoft} />
                      <Text style={styles.statText}>{route.stations} {t('segments')}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Navigation size={12} color={c.inkSoft} />
                      <Text style={styles.statText}>{route.nextDeparture}</Text>
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.rebookBtn}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        openRoute(route);
                      }}
                      activeOpacity={0.88}
                    >
                      <Ticket size={15} color={c.isDark ? c.background : c.white} />
                      <Text style={styles.rebookText}>{t('rebook')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => {
                        Haptics.selectionAsync();
                        toggleFavorite(route.id);
                      }}
                      activeOpacity={0.8}
                    >
                      <Heart size={17} color="#e94e4e" fill="#e94e4e" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Car Frequent Destinations ─────────────────────────── */}
        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('fav_car_section')}</Text>
          </View>

          {destLoading ? (
            <View style={styles.loadingWrap}>
              <AppLoader size={80} />
            </View>
          ) : destError ? (
            <View style={styles.emptyShuttle}>
              <View style={styles.emptyIcon}>
                <Car size={22} color={c.silver} />
              </View>
              <Text style={styles.emptyTitle}>{t('fav_load_error')}</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={refreshDest} activeOpacity={0.85}>
                <Text style={styles.emptyBtnText}>{t('retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : carDest.length === 0 ? (
            <View style={styles.emptyShuttle}>
              <View style={styles.emptyIcon}>
                <Car size={22} color={c.silver} />
              </View>
              <Text style={styles.emptyTitle}>{t('fav_empty_shuttle')}</Text>
              <Text style={styles.emptySub}>{t('car_dest_empty_sub')}</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {carDest.map((dest) => (
                <TouchableOpacity
                  key={dest.key}
                  style={[gs, styles.destCard]}
                  activeOpacity={0.85}
                  onPress={() => handleBookAgain(dest.from, dest.to, 'car')}
                >
                  <View style={[styles.destAccent, { backgroundColor: TYPE_COLOR.car }]} />
                  <View style={[styles.destIconBox, { backgroundColor: `${TYPE_COLOR.car}30` }]}>
                    <Car size={22} color="#d97706" />
                  </View>
                  <View style={styles.destMeta}>
                    <Text style={styles.destFrom} numberOfLines={1}>{dest.from}</Text>
                    <Text style={styles.destTo} numberOfLines={1}>{t('dest_to_arrow')} {dest.to}</Text>
                    {dest.lastUsed && (
                      <Text style={styles.destDetail}>{t('last_used_label')} {dest.lastUsed} · {dest.count}×</Text>
                    )}
                  </View>
                  <View style={styles.destRight}>
                    {dest.lastPrice > 0 && (
                      <>
                        <Text style={styles.destPrice}>{dest.lastPrice} {t('egp')}</Text>
                        <Text style={styles.destPriceLabel}>{t('approx_fare')}</Text>
                      </>
                    )}
                    <TouchableOpacity
                      style={styles.destBtn}
                      onPress={() => handleBookAgain(dest.from, dest.to, 'car')}
                      activeOpacity={0.85}
                    >
                      <RefreshCw size={11} color={c.isDark ? c.background : c.white} />
                      <Text style={styles.destBtnText}>{t('book_car')}</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Scooter Frequent Routes ───────────────────────────── */}
        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('fav_scooter_section')}</Text>
          </View>

          {destLoading ? (
            <View style={styles.loadingWrap}>
              <AppLoader size={80} />
            </View>
          ) : destError ? (
            <View style={styles.emptyShuttle}>
              <View style={styles.emptyIcon}>
                <ScooterIcon size={22} color={c.silver} />
              </View>
              <Text style={styles.emptyTitle}>{t('fav_load_error')}</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={refreshDest} activeOpacity={0.85}>
                <Text style={styles.emptyBtnText}>{t('retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : scooterDest.length === 0 ? (
            <View style={styles.emptyShuttle}>
              <View style={styles.emptyIcon}>
                <ScooterIcon size={22} color={c.silver} />
              </View>
              <Text style={styles.emptyTitle}>{t('fav_empty_shuttle')}</Text>
              <Text style={styles.emptySub}>{t('scooter_dest_empty_sub')}</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {scooterDest.map((dest) => (
                <TouchableOpacity
                  key={dest.key}
                  style={[gs, styles.destCard]}
                  activeOpacity={0.85}
                  onPress={() => handleBookAgain(dest.from, dest.to, 'scooter')}
                >
                  <View style={[styles.destAccent, { backgroundColor: TYPE_COLOR.scooter }]} />
                  <View style={[styles.destIconBox, { backgroundColor: `${TYPE_COLOR.scooter}30` }]}>
                    <ScooterIcon size={22} color="#16a34a" />
                  </View>
                  <View style={styles.destMeta}>
                    <Text style={styles.destFrom} numberOfLines={1}>{dest.from}</Text>
                    <Text style={styles.destTo} numberOfLines={1}>{t('dest_to_arrow')} {dest.to}</Text>
                    {dest.lastUsed && (
                      <Text style={styles.destDetail}>{t('last_used_label')} {dest.lastUsed} · {dest.count}×</Text>
                    )}
                  </View>
                  <View style={styles.destRight}>
                    {dest.lastPrice > 0 && (
                      <>
                        <Text style={styles.destPrice}>{dest.lastPrice} {t('egp')}</Text>
                        <Text style={styles.destPriceLabel}>{t('approx_fare')}</Text>
                      </>
                    )}
                    <TouchableOpacity
                      style={styles.destBtn}
                      onPress={() => handleBookAgain(dest.from, dest.to, 'scooter')}
                      activeOpacity={0.85}
                    >
                      <RefreshCw size={11} color={c.isDark ? c.background : c.white} />
                      <Text style={styles.destBtnText}>{t('book_scooter')}</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
