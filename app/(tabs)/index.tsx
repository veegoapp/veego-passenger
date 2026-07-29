import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, RefreshControl, Alert,
  Animated, Dimensions, useWindowDimensions, BackHandler,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, MapPin, Flame, ArrowLeft, ArrowRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors, S } from '@/constants/colors';
import { useRoutes } from '@/src/hooks/shuttle/useRoutes';
import { RouteCard, FeaturedOffers } from '@/components/shuttle/RouteCard';
import { usePromos } from '@/src/hooks/shared/usePromos';
import { SectionHeader } from '@/components/shared/Shared';
import { useBooking } from '@/context/BookingContext';
import { useActiveSession } from '@/context/ActiveSessionContext';
import { formatCairoDateTime } from '@/constants/data';
import { useTabBar } from '@/context/TabBarContext';
import { CarServiceScreen, CarServiceScreenHandle } from '@/components/car/CarServiceScreen';
import { CarMap } from '@/components/car/CarMap';
import { useServiceControl, ServiceType } from '@/context/ServiceControlContext';
import { useMyDebt } from '@/src/hooks/shared/useMyDebt';
import { useProfile } from '@/src/hooks/shared/useProfile';
import api from '@/src/api/client';
import { getPlaceAutocomplete, getPlaceDetails, generateSessionToken } from '@/src/api/placesService';
import { onSavedLocationsEvent } from '@/src/api/savedLocationsEvents';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';
import {
  SERVICES, type SavedLocation,
  HomeHeader, ServiceGrid, ServiceCards, DebtBanner, DebtErrorBanner,
  ZoneServicesBanner, ActiveBookingHero, DestinationSearchModal,
} from '@/components/home/HomeSections';

function getGreetingKey(hour: number): 'good_morning' | 'good_afternoon' | 'good_evening' {
  if (hour >= 5 && hour < 12) return 'good_morning';
  if (hour >= 12 && hour < 17) return 'good_afternoon';
  return 'good_evening';
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'VG';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getFirstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts[0] : 'VeeGo';
}

type ServiceMode = 'shuttle' | 'car' | 'scooter' | 'delivery';

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: Spacing.md, zIndex: 10 },
    greeting: { fontSize: 11, color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: Typography.weight.medium },
    greetingName: { fontSize: 20, fontWeight: Typography.weight.semibold, color: c.ink, letterSpacing: -0.5 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    notifDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: c.badge, borderWidth: 1.5, borderColor: c.white },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: c.isDark ? c.background : c.white, fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold },

    serviceGrid: { flexDirection: 'row', flexWrap: 'nowrap', gap: 7, paddingHorizontal: 20, marginBottom: Spacing.md, zIndex: 20 },
    serviceBtn: { flex: 1, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: 6, gap: 6 },
    serviceBtnActive: { backgroundColor: c.ink, borderColor: c.ink },
    serviceBtnInactive: { backgroundColor: c.white, borderColor: c.border },
    serviceBtnSoon: { backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.mist, borderColor: c.border, opacity: 0.9 },
    serviceBtnColumn: {},
    serviceIconBox: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.05)' },
    serviceIconBoxActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
    serviceTextCol: { flex: 1, minWidth: 0 },
    serviceLabel: { fontSize: 13, fontWeight: Typography.weight.semibold, letterSpacing: -0.2, flexShrink: 1 },
    serviceSub: { fontSize: 10, fontWeight: Typography.weight.medium, color: c.inkSoft },
    soonBadgeFloat: {
      position: 'absolute',
      top: 5,
      right: 5,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.07)',
      borderRadius: 5,
      paddingHorizontal: 5,
      paddingVertical: 2,
      zIndex: 5,
    },
    soonBadgeText: { fontSize: 8, fontWeight: Typography.weight.bold, color: c.inkSoft, letterSpacing: 0.3 },

    stickySearch: { paddingHorizontal: 20, marginBottom: 10 },
    searchBar: { flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 20, paddingHorizontal: Spacing.lg, gap: 10 },
    searchPlaceholder: { flex: 1, fontSize: 13.5, color: c.inkSoft },
    searchDivider: { width: 1, height: 16, backgroundColor: c.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' },

    mapSearchBox: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: Radius.lg,
      backgroundColor: c.isDark ? 'rgba(26,28,50,0.5)' : 'rgba(255,255,255,0.5)',
      borderWidth: 1.5,
      borderColor: c.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.2)',
    },
    mapInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, height: 40, borderRadius: 10, paddingHorizontal: Spacing.sm },
    mapInputRowActive: { backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
    mapInputText: { fontSize: 13.5, fontWeight: Typography.weight.bold, color: c.ink, flex: 1 },
    mapInputPlaceholder: { fontSize: 13.5, fontWeight: Typography.weight.bold, color: c.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)', flex: 1 },
    mapInputDivider: { height: 1, backgroundColor: c.border, marginVertical: Spacing.xs, marginLeft: 28, opacity: 0.5 },
    dotGreen: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
    dotRed: { width: 6, height: 6, borderRadius: 1.5, backgroundColor: c.badge },

    whereToBar: {
      position: 'absolute', left: 20, right: 20,
      flexDirection: 'row', alignItems: 'center', gap: 10,
      height: 52, borderRadius: 26, paddingHorizontal: Spacing.lg,
      backgroundColor: c.white, borderWidth: 1, borderColor: c.border,
      zIndex: 999, ...S.float,
    },
    whereToBarText: { flex: 1, fontSize: 13.5, color: c.inkSoft, fontWeight: Typography.weight.medium },

    searchScreenRoot: { flex: 1, backgroundColor: c.background },
    searchScreenHeader: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    },
    searchScreenBackBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' },
    searchScreenTitle: { fontSize: 17, fontWeight: Typography.weight.semibold, color: c.ink },
    savedSectionLabel: {
      fontSize: 12, fontWeight: Typography.weight.semibold, color: c.inkSoft,
      textTransform: 'uppercase', letterSpacing: 0.6,
      paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xs,
    },

    scrollContent: { paddingHorizontal: 20, paddingTop: 0, gap: 0 },
    heroCard: { borderRadius: 28, padding: 20, marginBottom: Spacing.sm, overflow: 'hidden', ...S.float },
    heroGlow: { position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)' },
    heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.lg },
    heroLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1.2 },
    heroRouteName: { fontSize: Typography.size.md, fontWeight: Typography.weight.semibold, color: '#ffffff', marginTop: 2 },
    heroBadge: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 99, paddingHorizontal: Spacing.md, paddingVertical: 6 },
    heroBadgeText: { color: '#ffffff', fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold },
    heroBottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    heroStation: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    heroStationName: { fontSize: Typography.size.xs, color: 'rgba(255,255,255,0.85)', fontWeight: Typography.weight.medium },

    mostBookedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md, marginBottom: Spacing.sm },
    mostBookedTitle: { fontSize: 15, fontWeight: Typography.weight.bold, color: c.ink, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },

    // رجعنا الاستايل الأصلي هنا ليكون متناسق
    routesSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: Spacing.xs, marginBottom: Spacing.md },
    viewAllBtn: { fontSize: 13, fontWeight: Typography.weight.semibold, color: '#3b82f6' },
    routesList: { gap: Spacing.md },
    sheetHeader: {
      flexDirection: 'row', alignItems: 'center',
      position: 'absolute', top: 0, left: 0, right: 0,
      paddingTop: 14, paddingHorizontal: 16, paddingBottom: 10,
      gap: 12, zIndex: 50,
    },
    sheetBackBtn: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center',
    },
    sheetTitle: {
      fontSize: 17, fontWeight: Typography.weight.semibold as any, letterSpacing: -0.3,
    },
  });
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const top = insets.top;
  // resumeService is seeded by ActiveSession recovery navigation (app/index.tsx →
  // getActiveSessionRecoveryDestination). It selects the correct initial service
  // mode before hooks initialise, avoiding a shuttle-UI flash on ride recovery.
  // CarServiceScreen's resumeActiveRide() then takes over once mounted.
  const { resumeService } = useLocalSearchParams<{ resumeService?: string }>();
  const [mode, setMode] = useState<ServiceMode>(() => (
    resumeService === 'car' || resumeService === 'scooter' || resumeService === 'delivery'
      ? resumeService
      : 'shuttle'
  ));
  const soonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { openRoute } = useBooking();
  const { session: activeSession } = useActiveSession();
  const shuttleHeroSession = activeSession?.kind === 'shuttle' ? activeSession : null;
  const { time: heroTime } = shuttleHeroSession
    ? formatCairoDateTime(shuttleHeroSession.trip.departureTime)
    : { time: '' };
  const { colors: c, glassStyle: gs, t, isRTL, language } = useTheme();
  const isAr = language === 'ar';
  const styles = useMemo(() => makeStyles(c), [c]);
  const { routes, refresh: refreshRoutes } = useRoutes();
  const { setVisible: setTabBarVisible, tabBarHeight } = useTabBar();
  const { getService, handleServiceTap, isServiceVisibleForZone, userZoneId } = useServiceControl();
  const { debt, error: debtError, refresh: refreshDebt } = useMyDebt();
  const { profile } = useProfile();
  const { promos } = usePromos();

  const greetingKey = getGreetingKey(new Date().getHours());
  const firstName = getFirstName(profile.name);
  const avatarInitials = getInitials(profile.name);

  const [pickupLocation, setPickupLocation] = useState('');
  const [destinationLocation, setDestinationLocation] = useState('');
  const [activeSearchField, setActiveSearchField] = useState<'from' | 'to' | null>(null);
  const [typedText, setTypedText] = useState('');
  const [headerHeight, setHeaderHeight] = useState(220);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [placesResults, setPlacesResults] = useState<SavedLocation[]>([]);
  const [placesSessionToken, setPlacesSessionToken] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [searchScreenOpen, setSearchScreenOpen] = useState(false);
  const carServiceRef = useRef<CarServiceScreenHandle>(null);
  const { height: screenHeight } = useWindowDimensions();
  const [serviceOpen, setServiceOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const cardsOpacity = useRef(new Animated.Value(1)).current;

  const fetchSavedLocations = useCallback(() => {
    return api.get('/user/locations')
      .then(({ data }) => {
        const raw = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
        setSavedLocations(raw.map((item: any) => ({
          id: String(item.id ?? Math.random()),
          name: item.name ?? item.label ?? '',
          address: item.address ?? '',
          latitude: item.latitude ?? 0,
          longitude: item.longitude ?? 0,
          label: item.label,
          isDefault: item.isDefault ?? false,
        })));
      })
      .catch((err) => {
        // Saved locations are a convenience shortcut — failing to load them
        // should never block the home screen, but we log in dev so a
        // recurring failure isn't invisible.
        if (__DEV__) console.warn('[Home] failed to load saved locations:', err?.message);
      });
  }, []);

  const fetchUnreadCount = useCallback(() => {
    return api.get('/notifications?limit=20')
      .then(({ data }) => {
        const list: any[] = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
        setUnreadCount(list.filter((n) => n.isRead === false).length);
      })
      .catch((err) => {
        if (__DEV__) console.warn('[Home] failed to load notification count:', err?.message);
      });
  }, []);

  // Fetch saved locations on mount
  useEffect(() => {
    fetchSavedLocations();
  }, [fetchSavedLocations]);

  // Re-fetch whenever a saved location is created/updated/deleted elsewhere
  // (e.g. Profile's SavedLocationsModal) — Home stays mounted across tab
  // switches, so this is the only way it learns about the change.
  useEffect(() => {
    return onSavedLocationsEvent('savedLocations:changed', () => {
      fetchSavedLocations();
    });
  }, [fetchSavedLocations]);

  // Fetch unread notification count
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.selectionAsync();
    await Promise.allSettled([refreshRoutes(), fetchSavedLocations(), fetchUnreadCount()]);
    setRefreshing(false);
  }, [refreshRoutes, fetchSavedLocations, fetchUnreadCount]);

  // تحديث لـ 5 خطوط في الـ Most Booked
  const mostBookedRoutes = useMemo(() => {
    if (!routes || routes.length === 0) return [];
    return routes.slice(0, 5);
  }, [routes]);

  useEffect(() => {
    setTabBarVisible(!serviceOpen);
  }, [serviceOpen, setTabBarVisible]);

  const openService = useCallback((id: string) => {
    if (id !== 'shuttle' && id !== 'car' && id !== 'scooter' && id !== 'delivery') return;
    handleServiceTap(id as ServiceType, () => {
      Haptics.selectionAsync();
      setMode(id as ServiceMode);
      setActiveSearchField(null);
      setDestinationLocation('');
      setServiceOpen(true);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
        Animated.timing(cardsOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  }, [handleServiceTap, slideAnim, cardsOpacity]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeService = useCallback(() => {
    // Fix 4: show tab bar immediately with animation, not after it completes
    setTabBarVisible(true);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: screenHeight, useNativeDriver: true, tension: 60, friction: 10 }),
      Animated.timing(cardsOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setServiceOpen(false);
      setDestinationLocation('');
    });
  }, [slideAnim, cardsOpacity, screenHeight, setTabBarVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fix 1: intercept Android hardware back button while a service sheet is open
  useEffect(() => {
    if (!serviceOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeService();
      return true; // prevent default (exit app)
    });
    return () => sub.remove();
  }, [serviceOpen, closeService]);

  // Destination-search suggestions while typing — proxied through the
  // backend Google Places Autocomplete endpoint. Each result only carries a
  // placeId at this stage; real coordinates are resolved via /places/details
  // once the passenger taps a suggestion (see onPickSuggestion below).
  useEffect(() => {
    if (!typedText || typedText.trim().length < 2) { setPlacesResults([]); return; }
    if (!placesSessionToken) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const suggestions = await getPlaceAutocomplete(
          typedText,
          placesSessionToken,
          language === 'ar' ? 'ar' : 'en',
          undefined,
          controller.signal,
          mode,
        );
        setPlacesResults(suggestions.map((s) => ({
          id: `place-${s.placeId}`,
          name: s.mainText || s.description,
          address: s.secondaryText || s.description,
          latitude: 0,
          longitude: 0,
          placeId: s.placeId,
        })));
      } catch (err: any) {
        if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
        console.error('[places autocomplete] failed', {
          status: err?.response?.status,
          data: err?.response?.data,
          message: err?.message,
        });
      }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [typedText, language, placesSessionToken, mode]);

  const filteredSuggestions = useMemo(() => {
    if (!typedText) return savedLocations;
    const lower = typedText.toLowerCase();
    const saved = savedLocations.filter(
      loc => loc.name.toLowerCase().includes(lower) || loc.address.toLowerCase().includes(lower),
    );
    return [...saved, ...placesResults.filter(n => !saved.some(s => s.name === n.name))];
  }, [typedText, savedLocations, placesResults]);

  const handleSelectLocation = useCallback((location: SavedLocation) => {
    if (activeSearchField === 'from') {
      setPickupLocation(location.name);
    } else {
      setDestinationLocation(location.name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setActiveSearchField(null);
    setTypedText('');
  }, [activeSearchField]);

  // Opens the dedicated destination search screen. Destination is the
  // default focused field so the keyboard appears only once the screen is
  // shown, never on the home screen itself.
  const handleOpenSearch = useCallback(() => {
    setActiveSearchField('to');
    setTypedText('');
    // New Places Autocomplete session for this search visit — reused across
    // keystrokes and the eventual /places/details call, discarded on close
    // or selection below.
    setPlacesSessionToken(generateSessionToken());
    setSearchScreenOpen(true);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setActiveSearchField(null);
    setTypedText('');
    setPlacesSessionToken(null);
    setSearchScreenOpen(false);
  }, []);

  return (
    <View style={{ flex: 1 }}>

      {/* ── 1. Background map (always visible) ─────────────────── */}
      <CarMap />

      {/* ── 2. Header — absolute, always on top ───────────────── */}
      <View
        style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30 }}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <View style={{ backgroundColor: c.background, paddingTop: top + 12 }}>
          <HomeHeader
            styles={styles} gs={gs} c={c} t={t as (key: string) => string}
            greetingKey={greetingKey} firstName={firstName} avatarInitials={avatarInitials}
            unreadCount={unreadCount}
            onNotifications={() => router.push('/notifications')}
            onProfile={() => router.push('/(tabs)/profile')}
          />
          {debt?.hasDebt && (
            <DebtBanner c={c} t={t as (key: string) => string} />
          )}
          {!debt?.hasDebt && debtError && (
            <DebtErrorBanner c={c} t={t as (key: string) => string} onRetry={refreshDebt} />
          )}
          <ZoneServicesBanner
            c={c} t={t as (key: string) => string}
            hiddenCount={SERVICES.filter(svc => !isServiceVisibleForZone(svc.id as ServiceType)).length}
            userZoneId={userZoneId}
          />
        </View>
      </View>

      {/* ── 3. Service sheet — slides up from below ─────────────── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { top: headerHeight, transform: [{ translateY: slideAnim }], zIndex: 20 },
        ]}
      >
        {/* Back button + service title — overlaid at the top of the sheet */}
        {serviceOpen && (
          <View style={[
            styles.sheetHeader,
            mode !== 'shuttle' ? {} : { backgroundColor: c.background },
          ]}>
            <TouchableOpacity
              style={[styles.sheetBackBtn, {
                backgroundColor: mode !== 'shuttle' ? 'rgba(0,0,0,0.45)' : c.mist,
              }]}
              onPress={closeService}
              activeOpacity={0.7}
            >
              {isRTL
                ? <ArrowRight size={20} color={mode !== 'shuttle' ? '#ffffff' : c.ink} />
                : <ArrowLeft  size={20} color={mode !== 'shuttle' ? '#ffffff' : c.ink} />
              }
            </TouchableOpacity>
            <Text style={[styles.sheetTitle, { color: mode !== 'shuttle' ? '#ffffff' : c.ink }]}>
              {t(mode)}
            </Text>
          </View>
        )}

        {/* ── Shuttle content ── */}
        {/* Fix 2: guard with serviceOpen so shuttle never flashes while opening another service */}
        {serviceOpen && mode === 'shuttle' && (
          <View style={{ flex: 1, backgroundColor: c.background }}>
            {/* Space reserved for the absolute-positioned sheetHeader (64 px) */}
            <View style={{ height: 64 }} />
            <View style={styles.stickySearch}>
              <TouchableOpacity style={[gs, styles.searchBar]} onPress={() => router.push('/routes')} activeOpacity={0.85}>
                <Search size={16} color={c.inkSoft} />
                <Text style={styles.searchPlaceholder}>{t('search_route_station')}</Text>
                <View style={styles.searchDivider} />
                <MapPin size={16} color={c.ink} />
              </TouchableOpacity>
            </View>
            <View style={styles.routesSectionHeader}>
              <Text style={{ fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: c.ink }}>{t('shuttle_routes_heading')}</Text>
              <TouchableOpacity onPress={() => router.push('/routes')}>
                <Text style={styles.viewAllBtn}>{t('view_all_routes')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
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
              {shuttleHeroSession && (
                <ActiveBookingHero
                  styles={styles} c={c} t={t as (key: string) => string}
                  isAr={isAr} isRTL={isRTL}
                  routeName={shuttleHeroSession.trip.route.name}
                  routeNameAr={shuttleHeroSession.trip.route.nameAr ?? null}
                  time={heroTime}
                  fromName={shuttleHeroSession.boardingStation?.name ?? shuttleHeroSession.trip.route.fromLocation}
                  fromNameAr={shuttleHeroSession.boardingStation?.nameAr ?? null}
                  toName={shuttleHeroSession.trip.route.toLocation}
                  onPress={() => router.push('/ticket')}
                />
              )}
              {promos.length > 0 && (
                <>
                  <SectionHeader title={t('featured_offers')} />
                  <FeaturedOffers />
                </>
              )}
              {mostBookedRoutes.length > 0 && (
                <View>
                  <View style={styles.mostBookedHeader}>
                    <Text style={styles.mostBookedTitle}>
                      <Flame size={16} color="#ef4444" fill="#ef4444" /> {t('most_booked')}
                    </Text>
                  </View>
                  <View style={styles.routesList}>
                    {mostBookedRoutes.map((route) => (
                      <RouteCard key={`mb-${route.id}`} route={route} onPress={() => openRoute(route)} />
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {/* ── Car ── */}
        {serviceOpen && mode === 'car' && (
          <CarServiceScreen ref={carServiceRef} onBack={closeService} sheetHeaderOffset={64} />
        )}

        {/* ── Scooter ── */}
        {serviceOpen && mode === 'scooter' && (
          <CarServiceScreen ref={carServiceRef} serviceType="scooter" onBack={closeService} sheetHeaderOffset={64} />
        )}

        {/* ── Delivery ── */}
        {serviceOpen && mode === 'delivery' && (
          <CarServiceScreen ref={carServiceRef} serviceType="delivery" onBack={closeService} sheetHeaderOffset={64} />
        )}
      </Animated.View>

      {/* ── 4. Bottom service cards — above tab bar ──────────────── */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: tabBarHeight + 12,
          left: 12,
          right: 12,
          opacity: cardsOpacity,
          zIndex: 25,
        }}
        pointerEvents={serviceOpen ? 'none' : 'box-none'}
      >
        <ServiceCards
          c={c} t={t as (key: string) => string}
          getService={getService}
          isServiceVisibleForZone={isServiceVisibleForZone}
          onServicePress={openService}
        />
      </Animated.View>

      {/* ── 5. Destination search modal (unchanged) ───────────────── */}
      {searchScreenOpen && (
        <DestinationSearchModal
          styles={styles} c={c} t={t as (key: string) => string} isRTL={isRTL} top={top}
          activeSearchField={activeSearchField} setActiveSearchField={setActiveSearchField}
          typedText={typedText} setTypedText={setTypedText}
          pickupLocation={pickupLocation} destinationLocation={destinationLocation}
          filteredSuggestions={filteredSuggestions}
          onClose={handleCloseSearch}
          onPickSuggestion={async (item) => {
            const wasDestination = activeSearchField === 'to';

            if (item.placeId) {
              const token = placesSessionToken;
              let details = null;
              try {
                details = token ? await getPlaceDetails(item.placeId, token, mode) : null;
              } catch {
                details = null;
              }
              if (!details) {
                Alert.alert(t('location_error'), t('location_error_msg'));
                return;
              }
              const resolved: SavedLocation = {
                id: item.id,
                name: details.name || item.name,
                address: details.address || item.address,
                latitude: details.latitude,
                longitude: details.longitude,
              };
              handleSelectLocation(resolved);
              setPlacesSessionToken(null);
              if (wasDestination) {
                setSearchScreenOpen(false);
                if (mode !== 'shuttle') {
                  carServiceRef.current?.selectDestination(resolved.name, {
                    latitude: resolved.latitude,
                    longitude: resolved.longitude,
                  });
                }
              }
              return;
            }

            handleSelectLocation(item);
            setPlacesSessionToken(null);
            if (wasDestination) {
              setSearchScreenOpen(false);
              if (mode !== 'shuttle') {
                carServiceRef.current?.selectDestination(item.name, {
                  latitude: item.latitude,
                  longitude: item.longitude,
                });
              }
            }
          }}
        />
      )}

    </View>
  );
}
