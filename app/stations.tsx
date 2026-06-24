import { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet,  ActivityIndicator, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ArrowRight, MapPin, RefreshCw, WifiOff, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { MapMockView } from '@/components/shared/Shared';
import api from '@/src/api/client';

interface StationItem {
  id: string;
  name: string;
  nameAr: string | null;     // Arabic name (§3, §21.5)
  area: string;
  distance: string;
  eta: string;
  latitude?: number;
  longitude?: number;
  segmentPrice?: number | null;
}

function mapApiStation(s: any): StationItem {
  return {
    id:           String(s.id ?? s._id ?? Math.random()),
    name:         s.name         ?? s.stationName  ?? s.station_name ?? '',
    nameAr:       s.nameAr       ?? s.name_ar      ?? null,
    area:         s.area         ?? s.district      ?? s.zone ?? '',
    distance:     s.distance     ?? '—',
    eta:          s.eta          ?? '—',
    latitude:     s.latitude     ?? s.lat           ?? undefined,
    longitude:    s.longitude    ?? s.lng           ?? s.lon ?? undefined,
    segmentPrice: s.segmentPrice ?? s.segment_price ?? null,
  };
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingBottom: 16,
    },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 16, fontWeight: '600', color: c.ink },
    mapWrap: { height: 200, marginHorizontal: 20, borderRadius: 28, overflow: 'hidden', marginBottom: 16, position: 'relative' },
    mapOverlay: { position: 'absolute', bottom: 12, left: 12 },
    mapLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8 },
    mapLabelText: { fontSize: 11.5, fontWeight: '600', color: c.ink },
    list: { paddingHorizontal: 20, gap: 10 },
    listTitle: { fontSize: 13, fontWeight: '600', color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 1.1, paddingLeft: 4 },
    stationCard: { borderRadius: 22, padding: 16, backgroundColor: c.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    stationLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    stationIndex: { width: 36, height: 36, borderRadius: 12, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' },
    stationIndexText: { fontSize: 11, fontWeight: '600', color: c.inkSoft },
    stationInfo: { flex: 1 },
    stationName: { fontSize: 13.5, fontWeight: '600', color: c.ink },
    stationArea: { fontSize: 11, color: c.inkSoft, marginTop: 1 },
    stationRight: { alignItems: 'flex-end', gap: 6 },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText: { fontSize: 11, color: c.inkSoft },
    etaTag: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: c.mist },
    etaTagNear: { backgroundColor: c.isDark ? 'rgba(85,196,154,0.15)' : 'rgba(85,196,154,0.15)' },
    etaText: { fontSize: 11, fontWeight: '500', color: c.inkSoft },
    etaTextNear: { color: '#2a9e6b' },
    searchContainer: {
      flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 22,
      paddingHorizontal: 14, marginHorizontal: 20, marginBottom: 12, borderWidth: 1,
    },
    searchInput: { flex: 1, fontSize: 13.5, fontWeight: '500', paddingVertical: 0, marginStart: 8 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 40 },
    fullErrorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    fullErrorCard: { width: '100%', borderRadius: 28, backgroundColor: c.white, padding: 32, alignItems: 'center', gap: 12 },
    fullErrorTitle: { fontSize: 17, fontWeight: '700', color: c.ink, marginTop: 4 },
    fullErrorText: { fontSize: 13.5, color: c.inkSoft, textAlign: 'center', lineHeight: 22 },
    retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 99, backgroundColor: c.ink, marginTop: 4 },
    retryText: { fontSize: 13, fontWeight: '600', color: c.isDark ? c.background : c.white },
  });
}

export default function StationsScreen() {
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const { colors: c, glassStyle: gs, t, language, isRTL } = useTheme();
  const isAr = language === 'ar';
  const styles = useMemo(() => makeStyles(c), [c]);
  const { routeId } = useLocalSearchParams<{ routeId?: string }>();

  const [stations, setStations] = useState<StationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchStations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/routes/${routeId}/stations`);
      const list: any[] = Array.isArray(data) ? data : data.data ?? data.stations ?? data.items ?? [];
      setStations(list.map(mapApiStation));
    } catch {
      setStations([]);
      setError(t('stations_load_error'));
    } finally {
      setLoading(false);
    }
  }, [routeId]);

  useEffect(() => { fetchStations(); }, [fetchStations]);

  const filteredStations = useMemo(() => {
    if (!searchQuery.trim()) return stations;
    const q = searchQuery.toLowerCase();
    return stations.filter((s) =>
      s.name?.toLowerCase().includes(q) ||
      (isAr && s.nameAr?.toLowerCase().includes(q)) ||
      s.area?.toLowerCase().includes(q)
    );
  }, [stations, searchQuery, isAr]);

  return (
    <LinearGradient colors={c.luxeGrad} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <TouchableOpacity style={[gs, styles.backBtn]} onPress={() => router.back()} activeOpacity={0.8}>
          {isRTL ? <ArrowRight size={18} color={c.ink} /> : <ArrowLeft size={18} color={c.ink} />}
        </TouchableOpacity>
        <Text style={styles.title}>{t('stations_title')}</Text>
        <TouchableOpacity style={[gs, styles.backBtn]} onPress={fetchStations} activeOpacity={0.8}>
          <RefreshCw size={16} color={c.ink} />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: c.white, borderColor: c.border }]}>
        <Search size={16} color={c.inkSoft} />
        <TextInput
          style={[styles.searchInput, { color: c.ink }]}
          placeholder={t('search_station')}
          placeholderTextColor={c.inkSoft}
          value={searchQuery}
          onChangeText={setSearchQuery}
          textAlign={isAr ? 'right' : 'left'}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
            <X size={14} color={c.inkSoft} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.mapWrap}>
        <MapMockView
          stationMarkers={stations
            .filter((s) => s.latitude != null && s.longitude != null)
            .map((s) => ({
              id: s.id,
              name: isAr ? (s.nameAr ?? s.name) : s.name,
              latitude: s.latitude!,
              longitude: s.longitude!,
            }))}
          defaultCenter={{ latitude: 25.4456, longitude: 30.5480 }}
        />
        <View style={styles.mapOverlay}>
          <View style={[gs, styles.mapLabel]}>
            <MapPin size={12} color={c.ink} />
            <Text style={styles.mapLabelText}>{stations.length} {t('stations_title')}</Text>
          </View>
        </View>
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator color={c.ink} size="large" />
        </View>
      )}

      {!loading && error && (
        <View style={styles.fullErrorWrap}>
          <View style={styles.fullErrorCard}>
            <WifiOff size={40} color={c.silver} />
            <Text style={styles.fullErrorTitle}>{t('error')}</Text>
            <Text style={styles.fullErrorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchStations} activeOpacity={0.8}>
              <RefreshCw size={14} color={c.ink} />
              <Text style={styles.retryText}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!loading && !error && (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <Text style={styles.listTitle}>{t('all_stations')}</Text>

        {filteredStations.map((s, i) => (
          <TouchableOpacity key={s.id} style={[gs, styles.stationCard]} activeOpacity={0.85}>
            <View style={styles.stationLeft}>
              <View style={styles.stationIndex}>
                <Text style={styles.stationIndexText}>{(i + 1).toString().padStart(2, '0')}</Text>
              </View>
              <View style={styles.stationInfo}>
                {/* Show Arabic name when Arabic locale (§3, §21.5) */}
                <Text style={styles.stationName}>
                  {isAr ? (s.nameAr ?? s.name) : s.name}
                </Text>
                <Text style={styles.stationArea}>{s.area}</Text>
              </View>
            </View>
            <View style={styles.stationRight}>
              <View style={styles.statItem}>
                <MapPin size={11} color={c.inkSoft} />
                <Text style={styles.statText}>{s.distance}</Text>
              </View>
              <View style={[styles.etaTag, i < 3 && styles.etaTagNear]}>
                <Text style={[styles.etaText, i < 3 && styles.etaTextNear]}>{s.eta}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
      )}
    </LinearGradient>
  );
}
