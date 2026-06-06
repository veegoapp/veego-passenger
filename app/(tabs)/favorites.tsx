import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Home, GraduationCap, Cross, Store, Heart, Clock, GitCommit, Navigation, Ticket, Bike } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useFavorites } from '@/context/FavoritesContext';
import { useBooking } from '@/context/BookingContext';
import { ThemeColors, S } from '@/constants/colors';
import { routes } from '@/constants/data';

const CAR_DESTINATIONS: { id: string; name: string; icon: (props: any) => any; fare: number; dist: string; eta: string; color: string }[] = [];

const BIKE_TRIPS: { id: string; from: string; to: string; dist: string; duration: string; price: number; color: string }[] = [];

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: 16 },
    headerTitle: { fontSize: 28, fontWeight: '700', color: c.ink, letterSpacing: -1, fontFamily: 'Inter_700Bold' },
    headerSub: { fontSize: 12, color: c.inkSoft, marginTop: 3 },
    content: { paddingHorizontal: 20, gap: 24 },

    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionTitle: { fontSize: 13, fontWeight: '600', color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 1.1 },
    sectionAction: { fontSize: 12, fontWeight: '600', color: c.ink },

    shuttleCard: { backgroundColor: c.white, borderRadius: 24, padding: 16, overflow: 'hidden', ...S.luxe },
    cardAccent: { position: 'absolute', top: -40, right: -40, width: 130, height: 130, borderRadius: 65, opacity: 0.5 },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    codeBox: { width: 44, height: 44, borderRadius: 16, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
    codeText: { color: c.isDark ? c.background : c.white, fontSize: 11, fontWeight: '700' },
    cardMeta: { flex: 1, gap: 2 },
    routeName: { fontSize: 14, fontWeight: '600', color: c.ink },
    routePath: { fontSize: 11, color: c.inkSoft },
    priceBox: { alignItems: 'flex-end' },
    priceText: { fontSize: 15, fontWeight: '700', color: c.ink },
    priceLabel: { fontSize: 10, color: c.inkSoft },
    cardStats: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 14 },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText: { fontSize: 11, color: c.inkSoft },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
    rebookBtn: { flex: 1, height: 42, borderRadius: 14, backgroundColor: c.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    rebookText: { color: c.isDark ? c.background : c.white, fontSize: 13, fontWeight: '600' },
    removeBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },

    emptyShuttle: { backgroundColor: c.mist, borderRadius: 20, padding: 20, alignItems: 'center', gap: 8 },
    emptyIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    emptyTitle: { fontSize: 14, fontWeight: '600', color: c.ink },
    emptySub: { fontSize: 12, color: c.inkSoft, textAlign: 'center', lineHeight: 18 },
    emptyBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: c.ink },
    emptyBtnText: { color: c.isDark ? c.background : c.white, fontSize: 12, fontWeight: '600' },

    carGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    carCard: { width: '47%', backgroundColor: c.white, borderRadius: 20, padding: 14, overflow: 'hidden', ...S.float },
    carCardAccent: { position: 'absolute', bottom: -20, right: -20, width: 70, height: 70, borderRadius: 35, opacity: 0.12 },
    carIconBox: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    carDestName: { fontSize: 12, fontWeight: '600', color: c.ink, lineHeight: 16 },
    carFare: { fontSize: 11, color: c.inkSoft, marginTop: 3 },
    carEta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    carEtaText: { fontSize: 11, color: c.inkSoft },
    carBookBtn: { marginTop: 10, height: 34, borderRadius: 10, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
    carBookText: { color: c.isDark ? c.background : c.white, fontSize: 11, fontWeight: '600' },

    bikeCard: { backgroundColor: c.white, borderRadius: 20, padding: 16, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 14, ...S.float },
    bikeAccent: { position: 'absolute', right: -30, top: -30, width: 100, height: 100, borderRadius: 50, opacity: 0.08 },
    bikeIconBox: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    bikeMeta: { flex: 1 },
    bikeRoute: { fontSize: 12, fontWeight: '600', color: c.ink },
    bikeDetail: { fontSize: 11, color: c.inkSoft, marginTop: 2 },
    bikePrice: { fontSize: 14, fontWeight: '700', color: c.ink },
    bikePriceLabel: { fontSize: 10, color: c.inkSoft, textAlign: 'right' },
    bikeRight: { alignItems: 'flex-end', gap: 6 },
    bikeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: c.ink },
    bikeBtnText: { color: c.isDark ? c.background : c.white, fontSize: 11, fontWeight: '600' },
  });
}

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? 60 : insets.top;
  const { colors: c, glassStyle: gs, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { openRoute } = useBooking();

  const favoriteRoutes = routes.filter((r) => isFavorite(r.id));

  const handleCarBook = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Car Booking', 'Opening car booking flow…');
  };

  const handleBikeBook = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Bike Booking', 'Opening bike booking flow…');
  };

  return (
    <LinearGradient colors={c.luxeSoftGrad} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <Text style={styles.headerTitle}>{t('favorites')}</Text>
        <Text style={styles.headerSub}>{t('fav_page_sub')}</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('fav_shuttle_section')}</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/index')} activeOpacity={0.75}>
              <Text style={styles.sectionAction}>{t('go_to_routes')}</Text>
            </TouchableOpacity>
          </View>

          {favoriteRoutes.length === 0 ? (
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
            <View style={{ gap: 12 }}>
              {favoriteRoutes.map((route) => (
                <View key={route.id} style={[gs, styles.shuttleCard]}>
                  <View style={[styles.cardAccent, { backgroundColor: route.color }]} />
                  <View style={styles.cardTop}>
                    <View style={styles.codeBox}>
                      <Text style={styles.codeText}>{route.code}</Text>
                    </View>
                    <View style={styles.cardMeta}>
                      <Text style={styles.routeName}>{route.name}</Text>
                      <Text style={styles.routePath}>{route.from} → {route.to}</Text>
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
                        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
                        if (Platform.OS !== 'web') Haptics.selectionAsync();
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

        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('fav_car_section')}</Text>
          </View>
          <View style={styles.carGrid}>
            {CAR_DESTINATIONS.map((dest) => (
              <TouchableOpacity
                key={dest.id}
                style={[gs, styles.carCard]}
                activeOpacity={0.85}
                onPress={handleCarBook}
              >
                <View style={[styles.carCardAccent, { backgroundColor: dest.color }]} />
                <View style={[styles.carIconBox, { backgroundColor: `${dest.color}18` }]}>
                  <dest.icon size={20} color={dest.color} />
                </View>
                <Text style={styles.carDestName} numberOfLines={2}>{dest.name}</Text>
                <Text style={styles.carFare}>{dest.fare} {t('egp')}</Text>
                <View style={styles.carEta}>
                  <Clock size={11} color={c.inkSoft} />
                  <Text style={styles.carEtaText}>{dest.eta}</Text>
                  <Text style={[styles.carEtaText, { marginLeft: 2 }]}>• {dest.dist}</Text>
                </View>
                <View style={styles.carBookBtn}>
                  <Text style={styles.carBookText}>{t('book_car')}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('fav_bike_section')}</Text>
          </View>
          <View style={{ gap: 10 }}>
            {BIKE_TRIPS.map((trip) => (
              <TouchableOpacity
                key={trip.id}
                style={[gs, styles.bikeCard]}
                activeOpacity={0.85}
                onPress={handleBikeBook}
              >
                <View style={[styles.bikeAccent, { backgroundColor: trip.color }]} />
                <View style={[styles.bikeIconBox, { backgroundColor: `${trip.color}18` }]}>
                  <Bike size={22} color={trip.color} />
                </View>
                <View style={styles.bikeMeta}>
                  <Text style={styles.bikeRoute} numberOfLines={1}>{trip.from}</Text>
                  <Text style={[styles.bikeRoute, { color: c.inkSoft, fontWeight: '400' }]} numberOfLines={1}>→ {trip.to}</Text>
                  <Text style={styles.bikeDetail}>{trip.dist} · {trip.duration}</Text>
                </View>
                <View style={styles.bikeRight}>
                  <View>
                    <Text style={styles.bikePrice}>{trip.price} {t('egp')}</Text>
                    <Text style={styles.bikePriceLabel}>{t('approx_fare')}</Text>
                  </View>
                  <View style={styles.bikeBtn}>
                    <Text style={styles.bikeBtnText}>{t('book_bike')}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
