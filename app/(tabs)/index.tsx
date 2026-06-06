import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Bus, Car, Bike, Package, Bell, Search, MapPin, ArrowRight, Navigation, Flame, Wrench } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors, S } from '@/constants/colors';
import { useRoutes } from '@/src/hooks/useRoutes';
import { RouteCard, FeaturedOffers } from '@/components/RouteCard';
import { SectionHeader } from '@/components/Shared';
import { useBooking } from '@/context/BookingContext';
import { useTabBar } from '@/context/TabBarContext';
import { CarMap } from '@/components/car/CarMap';
import { BikeMap } from '@/components/bike/BikeMap';
import { useServiceControl, ServiceType } from '@/context/ServiceControlContext';

type ServiceMode = 'shuttle' | 'car' | 'bike';

const SERVICES = [
  { id: 'shuttle' as const, labelKey: 'shuttle' as const, icon: Bus },
  { id: 'car' as const, labelKey: 'car' as const, icon: Car },
  { id: 'bike' as const, labelKey: 'bike' as const, icon: Bike },
  { id: 'delivery' as const, labelKey: 'delivery' as const, icon: Package },
];

const MOCK_LOCATIONS: { id: string; name: string; description: string; lat: number; lng: number }[] = [];

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, zIndex: 10 },
    greeting: { fontSize: 11, color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '500' },
    greetingName: { fontSize: 20, fontWeight: '600', color: c.ink, letterSpacing: -0.5 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    notifDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: c.badge, borderWidth: 1.5, borderColor: c.white },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: c.isDark ? c.background : c.white, fontSize: 12, fontWeight: '600' },

    serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 12, zIndex: 20 },
    serviceBtn: { width: '48%', height: 52, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, flex: 1 },
    serviceBtnActive: { backgroundColor: c.ink, borderColor: c.ink },
    serviceBtnInactive: { backgroundColor: c.white, borderColor: c.border },
    serviceBtnSoon: { backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.mist, borderColor: c.border, opacity: 0.9 },
    serviceLabel: { fontSize: 12.5, fontWeight: '500' },
    soonBadge: { backgroundColor: c.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
    soonBadgeText: { fontSize: 8.5, fontWeight: '600', color: c.inkSoft, letterSpacing: 0.3 },

    stickySearch: { paddingHorizontal: 20, marginBottom: 10 },
    searchBar: { flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 20, paddingHorizontal: 16, gap: 10 },
    searchPlaceholder: { flex: 1, fontSize: 13.5, color: c.inkSoft },
    searchDivider: { width: 1, height: 16, backgroundColor: c.border },

    mapSearchBox: {
      marginHorizontal: 20,
      marginTop: 6,
      marginBottom: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: c.white,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: c.isDark ? 0.3 : 0.08,
      shadowRadius: 12,
      elevation: 4,
      borderWidth: 1,
      borderColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
    },
    mapInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 40, borderRadius: 10, paddingHorizontal: 8 },
    mapInputRowActive: { backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : '#f4f4f7' },
    mapInputText: { fontSize: 13.5, fontWeight: '500', color: c.ink, flex: 1 },
    mapInputPlaceholder: { fontSize: 13.5, fontWeight: '600', color: c.inkSoft, flex: 1 },
    mapInputDivider: { height: 1, backgroundColor: c.border, marginVertical: 4, marginLeft: 28, opacity: 0.5 },
    dotGreen: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
    dotRed: { width: 6, height: 6, borderRadius: 1.5, backgroundColor: c.badge },

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

    mostBookedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 8 },
    mostBookedTitle: { fontSize: 15, fontWeight: '700', color: c.ink, flexDirection: 'row', alignItems: 'center', gap: 4 },

    // رجعنا الاستايل الأصلي هنا ليكون متناسق
    routesSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 4, marginBottom: 12 },
    viewAllBtn: { fontSize: 13, fontWeight: '600', color: '#3b82f6' },
    routesList: { gap: 12 },
  });
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? 60 : insets.top;
  const [mode, setMode] = useState<ServiceMode>('shuttle');
  const soonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { openRoute, activeBooking } = useBooking();
  const { colors: c, glassStyle: gs, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { routes } = useRoutes();
  const { setVisible: setTabBarVisible } = useTabBar();
  const { getService, handleServiceTap, isServiceVisibleForZone, userZoneId } = useServiceControl();

  const [pickupLocation, setPickupLocation] = useState('Current Location');
  const [destinationLocation, setDestinationLocation] = useState('');
  const [activeSearchField, setActiveSearchField] = useState<'from' | 'to' | null>(null);
  const [typedText, setTypedText] = useState('');
  const [headerHeight, setHeaderHeight] = useState(220);

  // تحديث لـ 5 خطوط في الـ Most Booked
  const mostBookedRoutes = useMemo(() => {
    if (!routes || routes.length === 0) return [];
    return routes.slice(0, 5);
  }, [routes]);

  useEffect(() => {
    setTabBarVisible(true);
  }, [setTabBarVisible]);

  const handleServicePress = (id: string) => {
    handleServiceTap(id as ServiceType, () => {
      if (Platform.OS !== 'web') Haptics.selectionAsync();
      if (id === 'shuttle' || id === 'car' || id === 'bike') {
        setMode(id as ServiceMode);
        setActiveSearchField(null);
        setDestinationLocation('');
      }
    });
  };

  const filteredSuggestions = useMemo(() => {
    if (!typedText) return MOCK_LOCATIONS;
    return MOCK_LOCATIONS.filter(loc => loc.name.toLowerCase().includes(typedText.toLowerCase()));
  }, [typedText]);

  const handleSelectLocation = (location: typeof MOCK_LOCATIONS[0]) => {
    if (activeSearchField === 'from') {
      setPickupLocation(location.name);
    } else {
      setDestinationLocation(location.name);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setActiveSearchField(null);
    setTypedText('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>

      {/* ═══ الهيدر — دايمًا في الأعلى ═══ */}
      <View
        style={{ zIndex: 20 }}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <LinearGradient colors={c.luxeSoftGrad} style={{ paddingTop: top + 12 }}>

          {/* Greeting + icons */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>{t('good_morning')}</Text>
              <Text style={styles.greetingName}>VeeGo</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={[gs, styles.iconBtn]} onPress={() => router.push('/notifications')}>
                <Bell size={18} color={c.ink} />
                <View style={styles.notifDot} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.avatar}>
                <Text style={styles.avatarText}>VG</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Service tabs */}
          <View style={styles.serviceGrid}>
            {SERVICES.map((svc) => {
              const ctrl = getService(svc.id as ServiceType);
              const displayMode = ctrl?.displayMode ?? 'live';
              const isEnabled = ctrl?.isEnabled ?? true;

              // Zone check: hide service if user is outside all active zones
              if (!isServiceVisibleForZone(svc.id as ServiceType)) return null;

              // isEnabled = false → hide service completely (strict spec rule)
              if (ctrl && !isEnabled) return null;

              const active = mode === svc.id && displayMode === 'live';
              const isComingSoon = displayMode === 'coming_soon';
              const isMaintenance = displayMode === 'maintenance';
              const isUnavailable = displayMode === 'unavailable';
              const isDisabled = isComingSoon || isMaintenance || isUnavailable;

              const btnStyle = active
                ? styles.serviceBtnActive
                : isDisabled
                ? styles.serviceBtnSoon
                : styles.serviceBtnInactive;

              const iconColor = active
                ? (c.isDark ? c.background : c.white)
                : c.inkSoft;

              return (
                <TouchableOpacity
                  key={svc.id}
                  style={[styles.serviceBtn, btnStyle]}
                  onPress={() => handleServicePress(svc.id)}
                  activeOpacity={isDisabled ? 0.85 : 0.8}
                >
                  {isMaintenance
                    ? <Wrench size={15} color={c.inkSoft} />
                    : <svc.icon size={15} color={iconColor} />
                  }
                  <Text style={[styles.serviceLabel, { color: active ? (c.isDark ? c.background : c.white) : c.inkSoft }]}>
                    {t(svc.labelKey)}
                  </Text>
                  {isComingSoon && (
                    <View style={styles.soonBadge}>
                      <Text style={styles.soonBadgeText}>{t('soon')}</Text>
                    </View>
                  )}
                  {isMaintenance && (
                    <View style={styles.soonBadge}>
                      <Text style={styles.soonBadgeText}>
                        {ctrl?.maintenanceEta ? `Back ${ctrl.maintenanceEta}` : 'Maintenance'}
                      </Text>
                    </View>
                  )}
                  {isUnavailable && (
                    <View style={styles.soonBadge}>
                      <Text style={styles.soonBadgeText}>Unavailable</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Shuttle search */}
          {mode === 'shuttle' && (
            <View style={styles.stickySearch}>
              <TouchableOpacity style={[gs, styles.searchBar]} onPress={() => router.push('/routes')} activeOpacity={0.85}>
                <Search size={16} color={c.inkSoft} />
                <Text style={styles.searchPlaceholder}>Search for route or station</Text>
                <View style={styles.searchDivider} />
                <MapPin size={16} color={c.ink} />
              </TouchableOpacity>
            </View>
          )}

          {/* ═══ تم نقل السيكشن الأصلي والكلمة هنا بالظبط بنفس ستايلها القديم ═══ */}
          {mode === 'shuttle' && (
            <View style={styles.routesSectionHeader}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.ink }}>Shuttle Routes</Text>
              <TouchableOpacity onPress={() => router.push('/routes')}>
                <Text style={styles.viewAllBtn}>View all routes</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Zone-filtered services banner */}
          {(() => {
            const hiddenCount = SERVICES.filter(svc => !isServiceVisibleForZone(svc.id as ServiceType)).length;
            if (hiddenCount === 0 || userZoneId === undefined) return null;
            return (
              <View style={{
                marginHorizontal: 20, marginTop: -4, marginBottom: 8,
                flexDirection: 'row', alignItems: 'flex-start', gap: 8,
                backgroundColor: c.isDark ? 'rgba(255,180,0,0.10)' : 'rgba(245,158,11,0.08)',
                borderRadius: 12, borderWidth: 1,
                borderColor: c.isDark ? 'rgba(255,180,0,0.20)' : 'rgba(245,158,11,0.2)',
                padding: 10,
              }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b', marginTop: 5 }} />
                <Text style={{ flex: 1, fontSize: 11.5, color: c.isDark ? '#f59e0b' : '#92400e', lineHeight: 16 }}>
                  {hiddenCount === 1
                    ? '1 service is not available in your area'
                    : `${hiddenCount} services are not available in your area`}
                </Text>
              </View>
            );
          })()}

          {/* Car / Bike destination search */}
          {mode !== 'shuttle' && (
            <View style={styles.mapSearchBox}>
              {/* Pickup */}
              <TouchableOpacity
                style={[styles.mapInputRow, activeSearchField === 'from' && styles.mapInputRowActive]}
                onPress={() => { setActiveSearchField('from'); setTypedText(''); }}
              >
                <View style={{ width: 20, alignItems: 'center' }}><View style={styles.dotGreen} /></View>
                {activeSearchField === 'from' ? (
                  <TextInput
                    style={styles.mapInputText}
                    value={typedText}
                    onChangeText={setTypedText}
                    placeholder="Enter pickup location..."
                    placeholderTextColor={c.inkSoft}
                    autoFocus
                  />
                ) : (
                  <Text style={styles.mapInputText} numberOfLines={1}>{pickupLocation}</Text>
                )}
              </TouchableOpacity>

              <View style={styles.mapInputDivider} />

              {/* Destination */}
              <TouchableOpacity
                style={[styles.mapInputRow, activeSearchField === 'to' && styles.mapInputRowActive]}
                onPress={() => { setActiveSearchField('to'); setTypedText(''); }}
              >
                <View style={{ width: 20, alignItems: 'center' }}><View style={styles.dotRed} /></View>
                {activeSearchField === 'to' ? (
                  <TextInput
                    style={styles.mapInputText}
                    value={typedText}
                    onChangeText={setTypedText}
                    placeholder="Where are you going?"
                    placeholderTextColor={c.inkSoft}
                    autoFocus
                  />
                ) : (
                  <Text
                    style={[styles.mapInputText, !destinationLocation && styles.mapInputPlaceholder]}
                    numberOfLines={1}
                  >
                    {destinationLocation || 'Where are you going?'}
                  </Text>
                )}
                <Search size={14} color={c.inkSoft} />
              </TouchableOpacity>
            </View>
          )}

        </LinearGradient>
      </View>

      {/* ═══ Suggestions dropdown — فوق الخريطة ═══ */}
      {mode !== 'shuttle' && activeSearchField && (
        <View style={{
          position: 'absolute',
          top: headerHeight,
          left: 20,
          right: 20,
          zIndex: 999,
          backgroundColor: c.white,
          borderRadius: 16,
          maxHeight: 220,
          borderWidth: 1,
          borderColor: c.border,
          overflow: 'hidden',
          ...S.float,
        }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {filteredSuggestions.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: c.border }}
                onPress={() => handleSelectLocation(item)}
              >
                <Navigation size={15} color={c.inkSoft} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '500', color: c.ink }}>{item.name}</Text>
                  <Text style={{ fontSize: 11.5, color: c.inkSoft }}>{item.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ═══ المحتوى ═══ */}

      {/* Shuttle */}
      {mode === 'shuttle' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
          showsVerticalScrollIndicator={false}
        >
          {activeBooking && (
            <TouchableOpacity activeOpacity={0.92} onPress={() => router.push('/ticket')}>
              <LinearGradient colors={[c.ink, c.isDark ? '#2a2a4a' : '#2e2e3e']} style={styles.heroCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={styles.heroGlow} />
                <View style={styles.heroTop}>
                  <View>
                    <Text style={styles.heroLabel}>{t('next_departure')}</Text>
                    <Text style={styles.heroRouteName}>{activeBooking.route.name}</Text>
                  </View>
                  <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>{activeBooking.time}</Text></View>
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
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <SectionHeader title={t('featured_offers')} />
          <FeaturedOffers />

          {/* عرض الـ Most Booked لـ 5 خطوط كحد أقصى */}
          {mostBookedRoutes.length > 0 && (
            <View>
              <View style={styles.mostBookedHeader}>
                <Text style={styles.mostBookedTitle}>
                  <Flame size={16} color="#ef4444" fill="#ef4444" /> Most Booked
                </Text>
              </View>
              <View style={styles.routesList}>
                {mostBookedRoutes.map((route) => (
                  <RouteCard key={`mb-${route.id}`} route={route} onPress={() => openRoute(route)} />
                ))}
              </View>
            </View>
          )}

          {/* تم إزالة قائمة المسارات الطويلة بالكامل من هنا لسرعة التحميل والتخلص من الثقل */}
        </ScrollView>
      )}

      {/* Car — تملأ المساحة من تحت الهيدر فوق التاب بار */}
      {mode === 'car' && (
        <View style={{ flex: 1 }}>
          <CarMap
            destination={destinationLocation || null}
            onClose={() => setDestinationLocation('')}
          />
        </View>
      )}

      {/* Bike */}
      {mode === 'bike' && (
        <View style={{ flex: 1 }}>
          <BikeMap
            phase={destinationLocation ? 'driver_assigned' : 'idle'}
            destination={destinationLocation || null}
          />
        </View>
      )}

    </View>
  );
}