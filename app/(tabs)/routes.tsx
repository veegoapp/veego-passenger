import { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { AppLoader } from '@/components/ui/AppLoader';
import { RefreshCw, Bus, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteCard } from '@/components/shuttle/RouteCard';
import { useBooking } from '@/context/BookingContext';
import { useTheme } from '@/context/ThemeContext';
import { useRoutes } from '@/src/hooks/shuttle/useRoutes';
import { useTabBar } from '@/context/TabBarContext';
import { Spacing } from '@/constants/spacing';
import { useSplitColors, type SplitColors } from '@/constants/splitTheme';

// ── C · Split Panel — fixed palette, independent of the app's light/dark theme.

function makeStyles(S: SplitColors) {
  return StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: Spacing.md },
    headerTopRow: {
      flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.md,
    },
    headerTitle: { fontSize: 24, color: S.ink, letterSpacing: -0.6, fontWeight: '800' },
    headerSub: { fontSize: 12, color: S.inkSoft, marginTop: 2, fontWeight: '600' },
    iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: S.card, borderWidth: 1, borderColor: S.hair },

    searchContainer: {
      flexDirection: 'row', alignItems: 'center', height: 46, borderRadius: 23,
      paddingHorizontal: Spacing.lg, marginBottom: 0, borderWidth: 1.5,
      backgroundColor: S.card, borderColor: S.hair,
    },
    searchInput: { flex: 1, fontSize: 13.5, fontWeight: '600', paddingVertical: 0, marginStart: 8, color: S.ink },
    list: { paddingHorizontal: 20, paddingTop: Spacing.lg, gap: Spacing.md },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl, gap: Spacing.md, paddingTop: 40 },
    emptyIcon: { width: 72, height: 72, borderRadius: 28, backgroundColor: S.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: S.ink },
    emptySub: { fontSize: 13, color: S.inkSoft, textAlign: 'center', lineHeight: 20 },
  });
}

export default function RoutesScreen() {
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const { tabBarHeight } = useTabBar();
  const [searchQuery, setSearchQuery] = useState('');
  const { openRoute } = useBooking();
  const { t, language, isRTL } = useTheme();
  const isAr = language === 'ar';
  const S = useSplitColors();
  const styles = useMemo(() => makeStyles(S), [S]);

  const { routes, loading, error, refresh } = useRoutes();

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return routes;
    const query = searchQuery.toLowerCase();
    return routes.filter((route) => {
      const matchName = route.name?.toLowerCase().includes(query)
        || (isAr && route.nameAr?.toLowerCase().includes(query));
      const matchCode = route.code?.toLowerCase().includes(query);
      const matchFrom = route.from?.toLowerCase().includes(query)
        || (isAr && route.fromAr?.toLowerCase().includes(query));
      const matchTo = route.to?.toLowerCase().includes(query)
        || (isAr && route.toAr?.toLowerCase().includes(query));
      const matchStation = route.path?.some((station: any) =>
        station.name?.toLowerCase().includes(query)
        || (isAr && station.nameAr?.toLowerCase().includes(query))
      );
      return matchName || matchCode || matchFrom || matchTo || matchStation;
    });
  }, [routes, searchQuery, isAr]);

  return (
    <View style={{ flex: 1, backgroundColor: S.bg }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>{t('routes_title')}</Text>
            <Text style={styles.headerSub}>{routes.length} {t('lines_available')}</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={refresh} activeOpacity={0.8}>
            <RefreshCw size={16} color={S.ink} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Search size={18} color={S.inkSoft} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('search_route_station')}
            placeholderTextColor={S.cap}
            value={searchQuery}
            onChangeText={setSearchQuery}
            textAlign={isRTL ? 'right' : 'left'}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={S.inkSoft} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <AppLoader />
        </View>
      ) : error || filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Bus size={30} color={S.cap} />
          </View>
          <Text style={styles.emptyTitle}>{error ? t('error') : t('no_routes')}</Text>
          <Text style={styles.emptySub}>{error ?? (searchQuery ? t('search_no_match') : t('routes_empty_msg'))}</Text>
          <TouchableOpacity onPress={refresh} activeOpacity={0.85}>
            <Text style={{ color: S.ink, fontWeight: '700', fontSize: 13.5 }}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight }]} showsVerticalScrollIndicator={false}>
          {filtered.map((r) => (
            <RouteCard key={r.id} route={r} onPress={() => openRoute(r)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
