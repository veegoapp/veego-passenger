import { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, ActivityIndicator, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RefreshCw, Bus, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteCard } from '@/components/RouteCard';
import { useBooking } from '@/context/BookingContext';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { useRoutes } from '@/src/hooks/useRoutes';

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: {
      paddingHorizontal: 20, paddingBottom: 12,
    },
    headerTopRow: {
      flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12
    },
    headerTitle: { fontSize: 26, fontWeight: '700', color: c.ink, letterSpacing: -0.8 },
    headerSub: { fontSize: 12, color: c.inkSoft, marginTop: 2 },
    iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

    searchContainer: {
      flexDirection: 'row', alignItems: 'center', height: 46, borderRadius: 23,
      paddingHorizontal: 16, marginBottom: 0, borderWidth: 1
    },
    searchInput: { flex: 1, fontSize: 14, fontWeight: '500', paddingVertical: 0, marginStart: 8 },
    list: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12, paddingTop: 40 },
    emptyIcon: { width: 72, height: 72, borderRadius: 28, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: c.ink },
    emptySub: { fontSize: 13, color: c.inkSoft, textAlign: 'center', lineHeight: 20 },
  });
}

export default function RoutesScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? 60 : insets.top;
  const [searchQuery, setSearchQuery] = useState('');
  const { openRoute } = useBooking();
  const { colors: c, glassStyle: gs, t, language, isRTL } = useTheme();
  const isAr = language === 'ar';
  const styles = useMemo(() => makeStyles(c), [c]);

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
    <LinearGradient colors={c.luxeGrad} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>{t('routes_title')}</Text>
            <Text style={styles.headerSub}>{routes.length} {t('lines_available')}</Text>
          </View>
          <TouchableOpacity style={[gs, styles.iconBtn]} onPress={refresh} activeOpacity={0.8}>
            <RefreshCw size={16} color={c.ink} />
          </TouchableOpacity>
        </View>

        {/* 🔍 بار البحث الذكي والجديد كلياً */}
        <View style={[styles.searchContainer, { backgroundColor: c.white, borderColor: c.border }]}>
          <Search size={18} color={c.inkSoft} />
          <TextInput
            style={[styles.searchInput, { color: c.ink }]}
            placeholder={t('search_route_station')}
            placeholderTextColor={c.inkSoft}
            value={searchQuery}
            onChangeText={setSearchQuery}
            textAlign={isRTL ? 'right' : 'left'}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={c.inkSoft} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={c.ink} size="large" />
        </View>
      ) : error || filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Bus size={30} color={c.silver} />
          </View>
          <Text style={styles.emptyTitle}>{error ? t('error') : t('no_routes')}</Text>
          <Text style={styles.emptySub}>{error ?? (searchQuery ? t('search_no_match') : t('routes_empty_msg'))}</Text>
          <TouchableOpacity onPress={refresh} activeOpacity={0.85}>
            <Text style={{ color: c.ink, fontWeight: '600', fontSize: 14 }}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {filtered.map((r) => (
            <RouteCard key={r.id} route={r} onPress={() => openRoute(r)} />
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </LinearGradient>
  );
}