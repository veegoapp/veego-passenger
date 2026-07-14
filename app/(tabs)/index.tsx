import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, TextInput, RefreshControl, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Bus, Car, Bike as ScooterIcon, Package, Bell, Search, MapPin, ArrowRight, ArrowLeft, Navigation, Flame, Wrench, AlertCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors, S } from '@/constants/colors';
import { useRoutes } from '@/src/hooks/shuttle/useRoutes';
import { RouteCard, FeaturedOffers } from '@/components/shuttle/RouteCard';
import { usePromos } from '@/src/hooks/shared/usePromos';
import { SectionHeader } from '@/components/shared/Shared';
import { useBooking } from '@/context/BookingContext';
import { useTabBar } from '@/context/TabBarContext';
import { CarServiceScreen, CarServiceScreenHandle } from '@/components/car/CarServiceScreen';
import { ScooterMap } from '@/components/scooter/ScooterMap';
import { useServiceControl, ServiceType } from '@/context/ServiceControlContext';
import { useMyDebt } from '@/src/hooks/shared/useMyDebt';
import { useProfile } from '@/src/hooks/shared/useProfile';
import api from '@/src/api/client';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

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

const SERVICES = [
  { id: 'shuttle' as const, labelKey: 'shuttle' as const, icon: Bus },
  { id: 'car' as const, labelKey: 'car' as const, icon: Car },
  { id: 'scooter' as const, labelKey: 'scooter' as const, icon: ScooterIcon },
  { id: 'delivery' as const, labelKey: 'delivery' as const, icon: Package },
];

interface SavedLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  label?: string;
  isDefault?: boolean;
}

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
  });
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const [mode, setMode] = useState<ServiceMode>('shuttle');
  const soonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { openRoute, activeBooking } = useBooking();
  const { colors: c, glassStyle: gs, t, isRTL, language } = useTheme();
  const isAr = language === 'ar';
  const styles = useMemo(() => makeStyles(c), [c]);
  const { routes, refresh: refreshRoutes } = useRoutes();
  const { setVisible: setTabBarVisible } = useTabBar();
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
  const [nominatimResults, setNominatimResults] = useState<SavedLocation[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [searchScreenOpen, setSearchScreenOpen] = useState(false);
  const carServiceRef = useRef<CarServiceScreenHandle>(null);

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
    setTabBarVisible(true);
  }, [setTabBarVisible]);

  const handleServicePress = (id: string) => {
    handleServiceTap(id as ServiceType, () => {
      Haptics.selectionAsync();
      if (id === 'shuttle' || id === 'car' || id === 'scooter' || id === 'delivery') {
        setMode(id as ServiceMode);
        setActiveSearchField(null);
        setDestinationLocation('');
      }
    });
  };

  // Geocoding suggestions when typing — proxied through the backend
  // (GET /geocode/search) instead of calling Nominatim directly.
  useEffect(() => {
    if (!typedText || typedText.trim().length < 2) { setNominatimResults([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/geocode/search', {
          params: { q: typedText, lang: language === 'ar' ? 'ar' : 'en' },
          signal: controller.signal,
        });
        const results: any[] = Array.isArray(data?.data) ? data.data : [];
        setNominatimResults(results.map((item: any, i: number) => ({
          id: `nom-${i}`,
          name: item.name ?? item.address,
          address: item.address,
          latitude: item.latitude,
          longitude: item.longitude,
        })));
      } catch {}
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [typedText, language]);

  const filteredSuggestions = useMemo(() => {
    if (!typedText) return savedLocations;
    const lower = typedText.toLowerCase();
    const saved = savedLocations.filter(
      loc => loc.name.toLowerCase().includes(lower) || loc.address.toLowerCase().includes(lower),
    );
    return [...saved, ...nominatimResults.filter(n => !saved.some(s => s.name === n.name))];
  }, [typedText, savedLocations, nominatimResults]);

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
    setSearchScreenOpen(true);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setActiveSearchField(null);
    setTypedText('');
    setSearchScreenOpen(false);
  }, []);

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
              <Text style={styles.greeting}>{t(greetingKey)}</Text>
              <Text style={styles.greetingName}>{firstName}</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={[gs, styles.iconBtn]} onPress={() => router.push('/notifications')}>
                <Bell size={18} color={c.ink} />
                {unreadCount > 0 && <View style={styles.notifDot} />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.avatar} onPress={() => router.push('/(tabs)/profile')}>
                <Text style={styles.avatarText}>{avatarInitials}</Text>
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

              const badgeText = isComingSoon
                ? t('soon')
                : isMaintenance
                ? (ctrl?.maintenanceEta ? `${t('back_label')} ${ctrl.maintenanceEta}` : t('maintenance_badge'))
                : isUnavailable
                ? t('service_unavailable')
                : null;

              const labelColor = active ? (c.isDark ? c.background : c.white) : c.ink;

              return (
                <TouchableOpacity
                  key={svc.id}
                  style={[styles.serviceBtn, btnStyle]}
                  onPress={() => !isDisabled && handleServicePress(svc.id)}
                  activeOpacity={isDisabled ? 1 : 0.8}
                >
                  {badgeText ? (
                    <View style={styles.soonBadgeFloat}>
                      <Text style={styles.soonBadgeText}>{badgeText}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.serviceIconBox, active && styles.serviceIconBoxActive]}>
                    {isMaintenance
                      ? <Wrench size={15} color={c.inkSoft} />
                      : <svc.icon size={15} color={iconColor} />
                    }
                  </View>
                  <Text
                    style={[styles.serviceLabel, { color: labelColor }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {t(svc.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* §21.7: Outstanding debt banner — shown above everything when hasDebt is true */}
          {debt?.hasDebt && (
            <View style={{
              marginHorizontal: 20,
              marginBottom: Spacing.sm,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 10,
              backgroundColor: c.isDark ? 'rgba(220,38,38,0.15)' : 'rgba(220,38,38,0.08)',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: c.isDark ? 'rgba(220,38,38,0.35)' : 'rgba(220,38,38,0.25)',
              padding: Spacing.md,
            }}>
              <AlertCircle size={16} color="#dc2626" style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: Typography.weight.bold, color: '#dc2626', marginBottom: 2 }}>
                  {t('debt_banner_title')}
                </Text>
                <Text style={{ fontSize: Typography.size.xs, color: c.isDark ? 'rgba(220,38,38,0.8)' : '#7f1d1d', lineHeight: 17 }}>
                  {t('debt_banner_body')}
                </Text>
              </View>
            </View>
          )}

          {/* Debt check failed — distinct from "no debt" / "has debt" states, with retry */}
          {!debt?.hasDebt && debtError && (
            <View style={{
              marginHorizontal: 20,
              marginBottom: Spacing.sm,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderRadius: 14,
              padding: Spacing.md,
            }}>
              <AlertCircle size={16} color={c.inkSoft} />
              <Text style={{ flex: 1, fontSize: Typography.size.xs, color: c.inkSoft, lineHeight: 17 }}>
                {t('debt_check_failed')}
              </Text>
              <TouchableOpacity onPress={refreshDebt} activeOpacity={0.75}>
                <Text style={{ fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold, color: c.ink }}>
                  {t('retry')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Shuttle search */}
          {mode === 'shuttle' && (
            <View style={styles.stickySearch}>
              <TouchableOpacity style={[gs, styles.searchBar]} onPress={() => router.push('/routes')} activeOpacity={0.85}>
                <Search size={16} color={c.inkSoft} />
                <Text style={styles.searchPlaceholder}>{t('search_route_station')}</Text>
                <View style={styles.searchDivider} />
                <MapPin size={16} color={c.ink} />
              </TouchableOpacity>
            </View>
          )}

          {/* ═══ تم نقل السيكشن الأصلي والكلمة هنا بالظبط بنفس ستايلها القديم ═══ */}
          {mode === 'shuttle' && (
            <View style={styles.routesSectionHeader}>
              <Text style={{ fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: c.ink }}>{t('shuttle_routes_heading')}</Text>
              <TouchableOpacity onPress={() => router.push('/routes')}>
                <Text style={styles.viewAllBtn}>{t('view_all_routes')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Zone-filtered services banner */}
          {(() => {
            const hiddenCount = SERVICES.filter(svc => !isServiceVisibleForZone(svc.id as ServiceType)).length;
            if (hiddenCount === 0 || userZoneId === undefined) return null;
            return (
              <View style={{
                marginHorizontal: 20, marginTop: -4, marginBottom: Spacing.sm,
                flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
                backgroundColor: c.isDark ? 'rgba(255,180,0,0.10)' : 'rgba(245,158,11,0.08)',
                borderRadius: Radius.md, borderWidth: 1,
                borderColor: c.isDark ? 'rgba(255,180,0,0.20)' : 'rgba(245,158,11,0.2)',
                padding: 10,
              }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b', marginTop: 5 }} />
                <Text style={{ flex: 1, fontSize: 11.5, color: c.isDark ? '#f59e0b' : '#92400e', lineHeight: 16 }}>
                  {hiddenCount === 1
                    ? t('service_not_available_1')
                    : t('services_not_available_n').replace('{n}', String(hiddenCount))}
                </Text>
              </View>
            );
          })()}


        </LinearGradient>
      </View>

      {/* ═══ "Where to?" entry bar — sits directly above the bottom nav ═══ */}
      {mode !== 'shuttle' && (
        <TouchableOpacity
          style={[styles.whereToBar, { bottom: insets.bottom + 78 }]}
          activeOpacity={0.85}
          onPress={handleOpenSearch}
        >
          <Search size={16} color={c.inkSoft} />
          <Text style={styles.whereToBarText} numberOfLines={1}>
            {destinationLocation || t('where_to_short')}
          </Text>
        </TouchableOpacity>
      )}

      {/* ═══ Dedicated destination search screen ═══ */}
      {searchScreenOpen && (
        <Modal visible animationType="slide" onRequestClose={handleCloseSearch}>
          <View style={[styles.searchScreenRoot, { paddingTop: top + 8 }]}>
            <View style={styles.searchScreenHeader}>
              <TouchableOpacity style={styles.searchScreenBackBtn} onPress={handleCloseSearch} activeOpacity={0.8}>
                {isRTL ? <ArrowRight size={18} color={c.ink} /> : <ArrowLeft size={18} color={c.ink} />}
              </TouchableOpacity>
              <Text style={styles.searchScreenTitle}>{t('choose_dest')}</Text>
            </View>

            <View style={[styles.mapSearchBox, { marginHorizontal: Spacing.md }]}>
              {/* A) Current pickup location */}
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
                    placeholder={t('enter_pickup')}
                    placeholderTextColor={c.inkSoft}
                    textAlign={isRTL ? 'right' : 'left'}
                    autoFocus
                  />
                ) : (
                  <Text style={styles.mapInputText} numberOfLines={1}>{pickupLocation || t('current_location')}</Text>
                )}
              </TouchableOpacity>

              <View style={styles.mapInputDivider} />

              {/* B) Destination input field */}
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
                    placeholder={t('where_to')}
                    placeholderTextColor={c.inkSoft}
                    textAlign={isRTL ? 'right' : 'left'}
                    autoFocus
                  />
                ) : (
                  <Text
                    style={[styles.mapInputText, !destinationLocation && styles.mapInputPlaceholder]}
                    numberOfLines={1}
                  >
                    {destinationLocation || t('where_to')}
                  </Text>
                )}
                <Search size={14} color={c.inkSoft} />
              </TouchableOpacity>
            </View>

            {/* C) Previously used destinations */}
            <Text style={styles.savedSectionLabel}>{t('saved_locations')}</Text>
            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
              {filteredSuggestions.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: c.inkSoft, textAlign: 'center', lineHeight: 19 }}>
                    {typedText.trim().length >= 2 ? t('no_results_found') : t('no_saved_locations')}
                  </Text>
                </View>
              ) : (
                filteredSuggestions.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderBottomColor: c.border }}
                    onPress={() => {
                      const wasDestination = activeSearchField === 'to';
                      handleSelectLocation(item);
                      if (wasDestination) {
                        setSearchScreenOpen(false);
                        // Ride, Scooter, and Delivery all route through
                        // CarServiceScreen (parameterized by serviceType) and
                        // share the same fare-estimate → confirm flow.
                        if (mode !== 'shuttle') carServiceRef.current?.selectDestination(item.name);
                      }
                    }}
                  >
                    <Navigation size={15} color={c.inkSoft} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: Typography.weight.medium, color: c.ink }}>{item.name}</Text>
                      {!!item.address && <Text style={{ fontSize: 11.5, color: c.inkSoft }} numberOfLines={1}>{item.address}</Text>}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* ═══ المحتوى ═══ */}

      {/* Shuttle */}
      {mode === 'shuttle' && (
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
          {activeBooking && (
            <TouchableOpacity activeOpacity={0.92} onPress={() => router.push('/ticket')}>
              <LinearGradient colors={[c.ink, c.isDark ? '#2a2a4a' : '#2e2e3e']} style={styles.heroCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={styles.heroGlow} />
                <View style={styles.heroTop}>
                  <View>
                    <Text style={styles.heroLabel}>{t('next_departure')}</Text>
                    <Text style={styles.heroRouteName}>{isAr ? (activeBooking.route.nameAr ?? activeBooking.route.name) : activeBooking.route.name}</Text>
                  </View>
                  <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>{activeBooking.time}</Text></View>
                </View>
                <View style={styles.heroBottom}>
                  <View style={styles.heroStation}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffffff' }} />
                    <Text style={styles.heroStationName}>
                      {isAr ? (activeBooking.route.path[activeBooking.fromIdx].nameAr ?? activeBooking.route.path[activeBooking.fromIdx].name) : activeBooking.route.path[activeBooking.fromIdx].name}
                    </Text>
                  </View>
                  {isRTL ? <ArrowLeft size={12} color="rgba(255,255,255,0.5)" /> : <ArrowRight size={12} color="rgba(255,255,255,0.5)" />}
                  <View style={styles.heroStation}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#55c49a' }} />
                    <Text style={styles.heroStationName}>
                      {isAr ? (activeBooking.route.path[activeBooking.toIdx].nameAr ?? activeBooking.route.path[activeBooking.toIdx].name) : activeBooking.route.path[activeBooking.toIdx].name}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {promos.length > 0 && (
            <>
              <SectionHeader title={t('featured_offers')} />
              <FeaturedOffers />
            </>
          )}

          {/* عرض الـ Most Booked لـ 5 خطوط كحد أقصى */}
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

          {/* تم إزالة قائمة المسارات الطويلة بالكامل من هنا لسرعة التحميل والتخلص من الثقل */}
        </ScrollView>
      )}

      {/* Car */}
      {mode === 'car' && (
        <View style={{ flex: 1 }}>
          <CarServiceScreen ref={carServiceRef} onBack={() => setDestinationLocation('')} />
        </View>
      )}

      {/* Scooter */}
      {mode === 'scooter' && (
        <View style={{ flex: 1 }}>
          <CarServiceScreen ref={carServiceRef} serviceType="scooter" onBack={() => setDestinationLocation('')} />
        </View>
      )}

      {/* Delivery */}
      {mode === 'delivery' && (
        <View style={{ flex: 1 }}>
          <CarServiceScreen ref={carServiceRef} serviceType="delivery" onBack={() => setDestinationLocation('')} />
        </View>
      )}

    </View>
  );
}
