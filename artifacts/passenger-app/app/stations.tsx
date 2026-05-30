import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, MapPin } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { stations } from '@/constants/data';
import { MapMockView } from '@/components/Shared';

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
  });
}

export default function StationsScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? 60 : insets.top;
  const { colors: c, glassStyle: gs, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <LinearGradient colors={c.luxeGrad} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <TouchableOpacity style={[gs, styles.backBtn]} onPress={() => router.back()} activeOpacity={0.8}>
          <ArrowLeft size={18} color={c.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('stations_title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.mapWrap}>
        <MapMockView
          stationMarkers={stations
            .filter((s) => s.latitude != null && s.longitude != null)
            .map((s) => ({ id: s.id, name: s.name, latitude: s.latitude!, longitude: s.longitude! }))}
          defaultCenter={{ latitude: 25.4456, longitude: 30.5480 }}
        />
        <View style={styles.mapOverlay}>
          <View style={[gs, styles.mapLabel]}>
            <MapPin size={12} color={c.ink} />
            <Text style={styles.mapLabelText}>3 {t('nearby')}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <Text style={styles.listTitle}>{t('all_stations')}</Text>
        {stations.map((s, i) => (
          <TouchableOpacity key={s.id} style={[gs, styles.stationCard]} activeOpacity={0.85}>
            <View style={styles.stationLeft}>
              <View style={styles.stationIndex}>
                <Text style={styles.stationIndexText}>{(i + 1).toString().padStart(2, '0')}</Text>
              </View>
              <View style={styles.stationInfo}>
                <Text style={styles.stationName}>{s.name}</Text>
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
    </LinearGradient>
  );
}
