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

// ── C · Split Panel — fixed palette, independent of the app's light/dark theme.
const C_BG = '#EEF0F2';
const C_INK = '#14151A';
const C_INK_SOFT = '#6B7178';
const C_CAP = '#9AA0A6';
const C_HAIR = '#EEF0F1';
const C_MIST = '#F0F2F3';

function makeStyles() {
  return StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: Spacing.md },
    headerTopRow: {
      flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.md,
    },
    headerTitle: { fontSize: 24, color: C_INK, letterSpacing: -0.6, fontWeight: '800' },
    headerSub: { fontSize: 12, color: C_INK_SOFT, marginTop: 2, fontWeight: '600' },
    iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: C_HAIR },

    searchContainer: {
      flexDirection: 'row', alignItems: 'center', height: 46, borderRadius: 23,
      paddingHorizontal: Spacing.lg, marginBottom: 0, borderWidth: 1.5,
      backgroundColor: '#fff', borderColor: C_HAIR,
    },
    searchInput: { flex: 1, fontSize: 13.5, fontWeight: '600', paddingVertical: 0, marginStart: 8, color: C_INK },
    list: { paddingHorizontal: 20, paddingTop: Spacing.lg, gap: Spacing.md },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl, gap: Spacing.md, paddingTop: 40 },
    emptyIcon: { width: 72, height: 72, borderRadius: 28, backgroundColor: C_MIST, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: C_INK },
    emptySub: { fontSize: 13, color: C_INK_SOFT, textAlign: 'center', lineHeight: 20 },
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
  const styles = useMemo(() => makeStyles(), []);

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
    <View style={{ flex: 1, backgroundColor: C_BG }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>{t('routes_title')}</Text>
            <Text style={styles.headerSub}>{routes.length} {t('lines_available')}</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={refresh} activeOpacity={0.8}>
            <RefreshCw size={16} color={C_INK} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Search size={18} color={C_INK_SOFT} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('search_route_station')}
            placeholderTextColor={C_CAP}
            value={searchQuery}
            onChangeText={setSearchQuery}
            textAlign={isRTL ? 'right' : 'left'}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={C_INK_SOFT} />
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
            <Bus size={30} color={C_CAP} />
          </View>
          <Text style={styles.emptyTitle}>{error ? t('error') : t('no_routes')}</Text>
          <Text style={styles.emptySub}>{error ?? (searchQuery ? t('search_no_match') : t('routes_empty_msg'))}</Text>
          <TouchableOpacity onPress={refresh} activeOpacity={0.85}>
            <Text style={{ color: C_INK, fontWeight: '700', fontSize: 13.5 }}>{t('retry')}</Text>
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
