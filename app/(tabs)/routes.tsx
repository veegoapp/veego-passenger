import { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, ActivityIndicator, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RefreshCw, Bus, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
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

    // ستايل بار البحث الجديد المتناسق مع الهوم
    searchContainer: {
      flexDirection: 'row', alignItems: 'center', height: 46, borderRadius: 23,
      paddingHorizontal: 16, marginBottom: 16, borderWidth: 1
    },
    searchInput: { flex: 1, fontSize: 14, fontWeight: '500', paddingVertical: 0, marginStart: 8 },

    filterScroll: { flexGrow: 0, marginBottom: 16 },
    filterChip: { height: 38, paddingHorizontal: 16, borderRadius: 99, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    filterChipActive: { backgroundColor: c.ink, borderColor: c.ink },
    filterChipInactive: { backgroundColor: c.white, borderColor: c.border },
    filterText: { fontSize: 13, fontWeight: '500' },
    filterTextActive: { color: c.isDark ? c.background : c.white },
    filterTextInactive: { color: c.inkSoft },
    list: { paddingHorizontal: 20, gap: 12 },
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
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState(''); // ستيت البحث الجديد
  const { openRoute } = useBooking();
  const { colors: c, glassStyle: gs, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const { routes, loading, error, refresh } = useRoutes();

  const routeCodes = ['all', ...Array.from(new Set(routes.map((r) => r.code)))];

  // فلترة حقيقية مركبة: بتفلتر بناءً على الكود المختار + نص البحث الحقيقي (لايف من السيرفر)
  const filtered = useMemo(() => {
    let result = routes;

    // 1. الفلترة بالـ Chip
    if (activeFilter !== 'all') {
      result = result.filter((r) => r.code === activeFilter);
    }

    // 2. الفلترة بمربع البحث (اسم الخط أو المحطات داخله)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((route) => {
        const matchName = route.name?.toLowerCase().includes(query);
        const matchCode = route.code?.toLowerCase().includes(query);
        const matchStation = route.path?.some((station: any) => 
          station.name?.toLowerCase().includes(query)
        );
        return matchName || matchCode || matchStation;
      });
    }

    return result;
  }, [routes, activeFilter, searchQuery]);

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
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={c.inkSoft} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {routes.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {routeCodes.map((code) => {
            const active = activeFilter === code;
            const label = code === 'all' ? t('all_lines') : code;
            return (
              <TouchableOpacity
                key={code}
                style={[styles.filterChip, active ? styles.filterChipActive : styles.filterChipInactive]}
                onPress={() => { setActiveFilter(code); if (Platform.OS !== 'web') Haptics.selectionAsync(); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterText, active ? styles.filterTextActive : styles.filterTextInactive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

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