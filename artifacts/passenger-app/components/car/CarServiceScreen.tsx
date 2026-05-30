import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  TextInput, FlatList, Animated, Modal,
} from 'react-native';
import { ArrowLeft, ArrowRight, Bell, XCircle, Search, Clock, MapPin, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { CarMap, MOCK_DESTINATIONS } from './CarMap';
import { RideOptionsSheet } from './RideOptionsSheet';
import { DriverSearching } from './DriverSearching';
import { DriverAssignedCard, MOCK_DRIVER } from './DriverAssignedCard';
import { RatingSheet } from '@/components/shared/RatingSheet';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { useRide } from '@/src/hooks/useRide';

type CarPhase = 'idle' | 'selecting' | 'ride_options' | 'searching' | 'driver_assigned' | 'completed';

interface CarServiceScreenProps {
  onBack: () => void;
  embedded?: boolean;
}

const WADI_LOCS = Object.keys(MOCK_DESTINATIONS);
const CURRENT_LOCATION_EN = 'Wadi El Gedid — My location';
const CURRENT_LOCATION_AR = 'وادي الجديد — موقعي الحالي';

function makeStyles(c: ThemeColors, insetTop: number) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0d0e22' },
    topOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
      paddingTop: insetTop + 8,
    },
    topBar: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 16, paddingBottom: 10,
    },
    backBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
    },
    titleBlock: { flex: 1 },
    topTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '500' },
    topSubtitle: { color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
    notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },

    searchCard: {
      marginHorizontal: 16,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: 'rgba(20,22,45,0.92)',
      borderWidth: 1,
      borderColor: 'rgba(85,196,154,0.18)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 12,
    },
    fromRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    },
    fromDot: {
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: '#55c49a',
      borderWidth: 2, borderColor: 'rgba(85,196,154,0.35)',
    },
    fromText: { flex: 1, fontSize: 13.5, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
    dividerRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingLeft: 38, paddingRight: 16,
    },
    dashedLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
    toRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    },
    toDot: {
      width: 10, height: 10, borderRadius: 2,
      backgroundColor: c.badge,
    },
    toText: { flex: 1, fontSize: 13.5, fontWeight: '500' },
    destTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    destTagText: { fontSize: 13.5, color: '#55c49a', fontWeight: '600', flex: 1 },
    clearBtn: { padding: 4 },

    modalRoot: { flex: 1, backgroundColor: c.isDark ? '#0c0c1c' : '#f4f4f8' },
    modalTop: {
      backgroundColor: c.isDark ? '#131325' : '#ffffff',
      paddingTop: Platform.OS === 'web' ? 20 : insetTop + 8,
      paddingBottom: 16,
      paddingHorizontal: 16,
      gap: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.isDark ? 'rgba(85,196,154,0.1)' : c.border,
    },
    modalHeaderRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
    },
    modalBackBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.mist,
      alignItems: 'center', justifyContent: 'center',
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: c.ink, flex: 1 },
    fieldBox: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderRadius: 14, paddingHorizontal: 14, height: 46,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.05)' : c.mist,
      borderWidth: 1, borderColor: c.isDark ? 'rgba(255,255,255,0.08)' : c.border,
    },
    fieldBoxFocused: {
      borderColor: '#55c49a',
      backgroundColor: c.isDark ? 'rgba(85,196,154,0.07)' : 'rgba(85,196,154,0.06)',
    },
    fieldInput: { flex: 1, fontSize: 14, color: c.ink },
    fieldDot: {
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: '#55c49a',
    },
    fieldSquare: {
      width: 8, height: 8, borderRadius: 2,
      backgroundColor: c.badge,
    },
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8,
    },
    sectionTitle: {
      fontSize: 11, fontWeight: '700', color: c.inkSoft,
      textTransform: 'uppercase', letterSpacing: 1.1,
    },
    clearAllBtn: { paddingHorizontal: 4, paddingVertical: 2 },
    clearAllText: { fontSize: 12, fontWeight: '600', color: '#55c49a' },
    divider: { height: 1, backgroundColor: c.border, marginHorizontal: 20, marginTop: 4, marginBottom: 2, opacity: 0.5 },
    locItem: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: c.isDark ? 'rgba(255,255,255,0.05)' : c.border,
    },
    locIcon: {
      width: 36, height: 36, borderRadius: 12,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.mist,
      alignItems: 'center', justifyContent: 'center',
    },
    locIconRecent: {
      width: 36, height: 36, borderRadius: 12,
      backgroundColor: c.isDark ? 'rgba(85,196,154,0.1)' : 'rgba(85,196,154,0.08)',
      alignItems: 'center', justifyContent: 'center',
    },
    locText: { flex: 1, fontSize: 13.5, color: c.ink, fontWeight: '500' },
    emptyTip: { paddingHorizontal: 20, paddingTop: 40, alignItems: 'center', gap: 10 },
    emptyTipText: { fontSize: 13.5, color: c.inkSoft, textAlign: 'center' },
  });
}

export function CarServiceScreen({ onBack, embedded }: CarServiceScreenProps) {
  const { colors: c, t, isRTL, language } = useTheme();
  const insets = useSafeAreaInsets();
  const insetTop = Platform.OS === 'web' ? 60 : insets.top;
  const styles = useMemo(() => makeStyles(c, insetTop), [c, insetTop]);
  const isAr = language === 'ar';

  const [phase, setPhase] = useState<CarPhase>('idle');
  const [destination, setDestination] = useState<string | null>(null);
  const [fromText, setFromText] = useState(isAr ? CURRENT_LOCATION_AR : CURRENT_LOCATION_EN);
  const [toQuery, setToQuery] = useState('');
  const [selectedRide, setSelectedRide] = useState<'economy' | 'premium' | null>(null);
  const [fromFocused, setFromFocused] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketResponded = useRef(false);
  const router = useRouter();
  const { recents, addRecent, clearRecents } = useRecentSearches('car');
  const { requestRide, rideState, cancelRide: cancelRideHook, resetRide } = useRide();

  const PICKUP_COORDS = { latitude: 25.4449, longitude: 30.5597 };

  const handleTrackMap = () => {
    const destKey = destination ?? '';
    const destCoords = MOCK_DESTINATIONS[destKey] ?? PICKUP_COORDS;
    const params: Record<string, string> = {
      rideId: rideState.rideId ?? 'demo',
      pickupLat: String(PICKUP_COORDS.latitude),
      pickupLng: String(PICKUP_COORDS.longitude),
      dropoffLat: String(destCoords.latitude),
      dropoffLng: String(destCoords.longitude),
    };
    if (rideState.driverLocation) {
      params.driverLat = String(rideState.driverLocation.latitude);
      params.driverLng = String(rideState.driverLocation.longitude);
    }
    if (rideState.driver?.name) params.driverName = rideState.driver.name;
    if (rideState.driver?.vehicle) params.driverVehicle = rideState.driver.vehicle;
    if (rideState.driver?.rating) params.driverRating = String(rideState.driver.rating);
    if (rideState.driver?.phone) params.driverPhone = rideState.driver.phone;
    router.push({ pathname: '/trip-tracking', params });
  };

  // Map rideState.status → local CarPhase
  useEffect(() => {
    const s = rideState.status;

    if ((s === 'driver_assigned' || s === 'driver_en_route' || s === 'arrived' || s === 'started') && phase === 'searching') {
      socketResponded.current = true;
      if (searchTimer.current) clearTimeout(searchTimer.current);
      setPhase('driver_assigned');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    if (s === 'arrived' && phase === 'driver_assigned') {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    if (s === 'completed' && phase === 'driver_assigned') {
      setPhase('completed');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    if ((s === 'cancelled' || s === 'timeout') && phase === 'searching') {
      if (!socketResponded.current) {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
          setPhase('driver_assigned');
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 3500);
      }
    }
  }, [rideState.status]);

  const filteredLocs = toQuery.trim()
    ? WADI_LOCS.filter(l => l.toLowerCase().includes(toQuery.toLowerCase()))
    : WADI_LOCS;

  const handleSelectDestination = (loc: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    addRecent(loc);
    setDestination(loc);
    setToQuery('');
    setPhase('ride_options');
  };

  const handleConfirmRide = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('searching');
    socketResponded.current = false;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    requestRide({
      type: 'car',
      pickup: { latitude: 25.4449, longitude: 30.5597, address: fromText },
      dropoff: { latitude: 25.4449, longitude: 30.5597, address: destination ?? '' },
    }).then((result) => {
      if (!result.success && !socketResponded.current) {
        searchTimer.current = setTimeout(() => {
          if (!socketResponded.current) {
            setPhase('driver_assigned');
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }, 3500);
      }
    });
    searchTimer.current = setTimeout(() => {
      if (!socketResponded.current) {
        setPhase('driver_assigned');
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 4000);
  };

  const handleCancel = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    cancelRideHook();
    setPhase('idle');
    setDestination(null);
    setSelectedRide(null);
    socketResponded.current = false;
  };

  const handleComplete = () => {
    setPhase('completed');
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleRatingDone = () => {
    resetRide();
    setPhase('idle');
    setDestination(null);
    setSelectedRide(null);
    socketResponded.current = false;
  };

  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);

  // Determine the map phase (includes arrived/started)
  const mapPhase = (() => {
    if (phase !== 'driver_assigned') return phase;
    const s = rideState.status;
    if (s === 'arrived') return 'arrived' as const;
    if (s === 'started') return 'started' as const;
    return 'driver_assigned' as const;
  })();

  type ListItem =
    | { kind: 'recent_header' }
    | { kind: 'recent'; value: string }
    | { kind: 'divider' }
    | { kind: 'all_header' }
    | { kind: 'dest'; value: string }
    | { kind: 'empty' };

  const listData: ListItem[] = toQuery.trim()
    ? filteredLocs.length > 0
      ? filteredLocs.map(v => ({ kind: 'dest', value: v }))
      : [{ kind: 'empty' }]
    : [
        ...(recents.length > 0 ? [{ kind: 'recent_header' } as ListItem] : []),
        ...recents.map(v => ({ kind: 'recent', value: v } as ListItem)),
        ...(recents.length > 0 ? [{ kind: 'divider' } as ListItem, { kind: 'all_header' } as ListItem] : []),
        ...WADI_LOCS.map(v => ({ kind: 'dest', value: v } as ListItem)),
      ];

  return (
    <View style={styles.root}>
      <CarMap
        phase={mapPhase}
        destination={destination}
        driverLocation={rideState.driverLocation}
      />

      <View style={[styles.topOverlay, embedded && { paddingTop: 8 }]}>
        {!embedded && (
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.85}>
              {isRTL ? <ArrowRight size={18} color="#ffffff" /> : <ArrowLeft size={18} color="#ffffff" />}
            </TouchableOpacity>
            <View style={styles.titleBlock}>
              <Text style={styles.topTitle}>{t('good_morning')}</Text>
              <Text style={styles.topSubtitle}>VeeGo Car</Text>
            </View>
            <TouchableOpacity style={styles.notifBtn} activeOpacity={0.85}>
              <Bell size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Premium From / To card */}
        <TouchableOpacity
          style={styles.searchCard}
          activeOpacity={0.92}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.selectionAsync();
            setToQuery('');
            setPhase('selecting');
          }}
        >
          <View style={styles.fromRow}>
            <View style={styles.fromDot} />
            <Text style={styles.fromText} numberOfLines={1}>{fromText}</Text>
          </View>
          <View style={styles.dividerRow}>
            <View style={styles.dashedLine} />
          </View>
          <View style={styles.toRow}>
            <View style={styles.toDot} />
            {destination ? (
              <View style={styles.destTagRow}>
                <Text style={styles.destTagText} numberOfLines={1}>{destination}</Text>
                <TouchableOpacity style={styles.clearBtn} onPress={handleCancel}>
                  <XCircle size={18} color="rgba(255,255,255,0.35)" />
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[styles.toText, { color: 'rgba(255,255,255,0.4)' }]}>{t('where_going_car')}</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Full-screen destination modal */}
      <Modal
        visible={phase === 'selecting'}
        animationType="slide"
        onRequestClose={() => setPhase('idle')}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalTop}>
            <View style={styles.modalHeaderRow}>
              <TouchableOpacity style={styles.modalBackBtn} onPress={() => setPhase('idle')} activeOpacity={0.8}>
                {isRTL ? <ArrowRight size={18} color={c.ink} /> : <ArrowLeft size={18} color={c.ink} />}
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t('choose_dest')}</Text>
            </View>

            <View style={[styles.fieldBox, fromFocused && styles.fieldBoxFocused]}>
              <View style={styles.fieldDot} />
              <TextInput
                style={styles.fieldInput}
                value={fromText}
                onChangeText={setFromText}
                onFocus={() => setFromFocused(true)}
                onBlur={() => setFromFocused(false)}
                placeholderTextColor={c.inkSoft}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            <View style={[styles.fieldBox, styles.fieldBoxFocused]}>
              <View style={styles.fieldSquare} />
              <TextInput
                style={styles.fieldInput}
                value={toQuery}
                onChangeText={setToQuery}
                placeholder={t('search_dest')}
                placeholderTextColor={c.inkSoft}
                autoFocus
                textAlign={isRTL ? 'right' : 'left'}
              />
              {toQuery.length > 0 && (
                <TouchableOpacity onPress={() => setToQuery('')}>
                  <XCircle size={16} color={c.silver} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <FlatList
            data={listData}
            keyExtractor={(item, i) => `${item.kind}-${i}`}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              if (item.kind === 'recent_header') {
                return (
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('recent_searches')}</Text>
                    <TouchableOpacity style={styles.clearAllBtn} onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync(); clearRecents(); }}>
                      <Text style={styles.clearAllText}>{t('clear_all')}</Text>
                    </TouchableOpacity>
                  </View>
                );
              }
              if (item.kind === 'divider') return <View style={styles.divider} />;
              if (item.kind === 'all_header') {
                return (
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('all_destinations')}</Text>
                  </View>
                );
              }
              if (item.kind === 'empty') {
                return (
                  <View style={styles.emptyTip}>
                    <Search size={32} color={c.silver} />
                    <Text style={styles.emptyTipText}>{t('no_results')}</Text>
                  </View>
                );
              }
              const isRecent = item.kind === 'recent';
              return (
                <TouchableOpacity
                  style={styles.locItem}
                  onPress={() => handleSelectDestination(item.value)}
                  activeOpacity={0.8}
                >
                  <View style={isRecent ? styles.locIconRecent : styles.locIcon}>
                    {isRecent ? <Clock size={16} color="#55c49a" /> : <MapPin size={16} color={c.inkSoft} />}
                  </View>
                  <Text style={styles.locText}>{item.value}</Text>
                  {isRTL ? <ChevronLeft size={14} color={c.silver} /> : <ChevronRight size={14} color={c.silver} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>

      <RideOptionsSheet
        visible={phase === 'ride_options'}
        destination={destination}
        selected={selectedRide}
        onSelect={setSelectedRide}
        onConfirm={handleConfirmRide}
        onDismiss={handleCancel}
      />

      <DriverSearching visible={phase === 'searching'} />

      <DriverAssignedCard
        visible={phase === 'driver_assigned'}
        rideType={selectedRide}
        destination={destination}
        rideStatus={rideState.status}
        etaMinutes={rideState.driver?.eta ?? null}
        driverName={rideState.driver?.name ?? null}
        driverVehicle={rideState.driver?.vehicle ?? null}
        driverRating={rideState.driver?.rating ?? null}
        driverPhone={rideState.driver?.phone ?? null}
        onCancel={handleCancel}
        onComplete={handleComplete}
        onTrackMap={handleTrackMap}
      />

      <RatingSheet
        visible={phase === 'completed'}
        driverName={rideState.driver?.name ?? MOCK_DRIVER.name}
        driverInitials={MOCK_DRIVER.initials}
        driverColor={MOCK_DRIVER.color}
        onSubmit={handleRatingDone}
        onSkip={handleRatingDone}
      />
    </View>
  );
}
