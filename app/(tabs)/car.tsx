import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing,
  ScrollView, TextInput, Platform, Dimensions, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Car, ShieldCheck, ShieldAlert, ChevronUp, ChevronDown, Search, Check, Star, Banknote, PlusCircle, AlertTriangle, Clock, Navigation, ArrowLeft, ArrowRight, CheckCircle, PhoneCall, X, MessageCircle, Tag } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { C, S, glassStyle } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';
import { useRide } from '@/src/hooks/car/useRide';
import api from '@/src/api/client';
import { RatingSheet } from '@/components/shared/RatingSheet';
import { ChatModal } from '@/components/car/ChatModal';
import { PassengerTrackingMap } from '@/components/shared/PassengerTrackingMap';
import { usePromos } from '@/src/hooks/shared/usePromos';
import { SafetySheet } from '@/components/shared/SafetySheet';
import { CancelReasonSheet } from '@/components/shared/CancelReasonSheet';
import { getErrorMessage } from '@/src/utils/errorMessages';

const haptic = {
  selection: () => { if (Platform.OS !== 'web') Haptics.selectionAsync(); },
  impact: (style = Haptics.ImpactFeedbackStyle.Medium) => { if (Platform.OS !== 'web') Haptics.impactAsync(style); },
  notify: (type: Haptics.NotificationFeedbackType) => { if (Platform.OS !== 'web') Haptics.notificationAsync(type); },
};

const { width: SW } = Dimensions.get('window');
const MAP_H = 270;

const GEOFENCE = { minLat: 22.5, maxLat: 28.5, minLon: 25.0, maxLon: 33.5 };
function isInGeofence(lat: number, lon: number) {
  return lat >= GEOFENCE.minLat && lat <= GEOFENCE.maxLat
    && lon >= GEOFENCE.minLon && lon <= GEOFENCE.maxLon;
}

const WG_PLACES: string[] = [];

const WG_COORDS: Record<string, { latitude: number; longitude: number }> = {};

type Phase = 'request' | 'finding' | 'active' | 'arrived' | 'in_trip' | 'completed' | 'error';

const USER_X = SW * 0.46;
const USER_Y = MAP_H * 0.54;
const DEST_X = SW * 0.68;
const DEST_Y = MAP_H * 0.25;

function SearchRing({ anim }: { anim: Animated.Value }) {
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 3.8] });
  const opacity = anim.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.55, 0] });
  return (
    <Animated.View
      style={[
        styles.searchRing,
        { left: USER_X - 28, top: USER_Y - 28, transform: [{ scale }], opacity },
      ]}
    />
  );
}

function RideMap({ phase }: { phase: Phase }) {
  const { t } = useTheme();
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const driverX = useRef(new Animated.Value((SW - 32) * 0.74)).current;
  const driverY = useRef(new Animated.Value(MAP_H * 0.26)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1300, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1300, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    if (phase !== 'finding') return;
    function makeRing(a: Animated.Value, delay: number) {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(a, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(a, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    }
    driverX.setValue((SW - 32) * 0.74);
    driverY.setValue(MAP_H * 0.26);
    const l1 = makeRing(ring1, 0);
    const l2 = makeRing(ring2, 730);
    const l3 = makeRing(ring3, 1460);
    l1.start(); l2.start(); l3.start();
    return () => { l1.stop(); l2.stop(); l3.stop(); };
  }, [phase]);

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <View style={styles.mapContainer}>
      <LinearGradient colors={['#1b1f38', '#232847']} style={StyleSheet.absoluteFillObject} />

      {[0.22, 0.44, 0.66, 0.88].map((f) => (
        <View key={`h${f}`} style={[styles.gridLine, { top: MAP_H * f, width: '100%', height: 1 }]} />
      ))}
      {[0.18, 0.36, 0.54, 0.72, 0.88].map((f) => (
        <View key={`v${f}`} style={[styles.gridLine, { left: SW * f, height: MAP_H, width: 1 }]} />
      ))}

      <View style={[styles.road, { top: MAP_H * 0.38, width: '100%', height: 6 }]} />
      <View style={[styles.road, { top: MAP_H * 0.68, width: '65%', height: 4 }]} />
      <View style={[styles.road, { left: SW * 0.44, height: '100%', width: 6 }]} />
      <View style={[styles.road, { left: SW * 0.7, height: '55%', width: 4, top: 0 }]} />

      {(phase === 'active' || phase === 'finding' || phase === 'arrived' || phase === 'in_trip') && (
        <View
          style={[
            styles.routeLine,
            {
              left: USER_X,
              top: DEST_Y,
              width: DEST_X - USER_X,
              height: USER_Y - DEST_Y,
            },
          ]}
        />
      )}

      {(phase === 'request' || phase === 'active' || phase === 'finding' || phase === 'arrived' || phase === 'in_trip') && (
        <View style={[styles.destMarker, { left: DEST_X - 11, top: DEST_Y - 24 }]}>
          <MapPin size={22} color={C.accentMint} />
        </View>
      )}

      {phase === 'finding' && (
        <>
          <SearchRing anim={ring1} />
          <SearchRing anim={ring2} />
          <SearchRing anim={ring3} />
        </>
      )}

      <Animated.View
        style={[
          styles.userPulse,
          { left: USER_X - 16, top: USER_Y - 16, transform: [{ scale: pulseScale }], opacity: pulseOpacity },
        ]}
      />
      <View style={[styles.userDot, { left: USER_X - 9, top: USER_Y - 9 }]} />

      <View style={styles.geofenceBadge}>
        <ShieldCheck size={10} color={C.accentMint} />
        <Text style={styles.geofenceText}>{t('wadi_only')}</Text>
      </View>
    </View>
  );
}

function PlacePicker({
  label, value, onSelect,
}: { label: string; value: string; onSelect: (p: string) => void }) {
  const { t, isRTL } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = WG_PLACES.filter((p) =>
    p.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <View style={{ zIndex: open ? 20 : 1 }}>
      <TouchableOpacity
        style={[glassStyle, styles.placeRow]}
        onPress={() => { setOpen((o) => !o); haptic.selection(); }}
        activeOpacity={0.8}
      >
        <View style={[styles.placeDot, value ? styles.placeDotActive : {}]} />
        <Text style={[styles.placeText, !value && styles.placeTextPlaceholder]}>
          {value || label}
        </Text>
        {open ? <ChevronUp size={14} color={C.inkSoft} /> : <ChevronDown size={14} color={C.inkSoft} />}
      </TouchableOpacity>
      {open && (
        <View style={[styles.dropdown, S.float]}>
          <View style={styles.dropSearch}>
            <Search size={13} color={C.inkSoft} />
            <TextInput
              style={styles.dropInput}
              placeholder={t('search_wadi')}
              placeholderTextColor={C.inkSoft}
              value={query}
              onChangeText={setQuery}
              textAlign={isRTL ? 'right' : 'left'}
              autoFocus
            />
          </View>
          <ScrollView style={{ maxHeight: 190 }} showsVerticalScrollIndicator={false}>
            {filtered.map((p) => (
              <TouchableOpacity
                key={p}
                style={styles.dropItem}
                onPress={() => { onSelect(p); setOpen(false); setQuery(''); haptic.selection(); }}
                activeOpacity={0.7}
              >
                <MapPin size={13} color={C.inkSoft} />
                <Text style={styles.dropItemText}>{p}</Text>
              </TouchableOpacity>
            ))}
            {filtered.length === 0 && (
              <Text style={styles.dropEmpty}>{t('no_locations')}</Text>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function CarScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? 60 : insets.top;
  const { t, isRTL } = useTheme();

  const [phase, setPhase] = useState<Phase>('request');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');

  const pickupRef = useRef('');
  pickupRef.current = pickup;
  const dropoffRef = useRef('');
  dropoffRef.current = dropoff;
  const [outsideZone, setOutsideZone] = useState(false);
  const [priceEstimate, setPriceEstimate] = useState<number | null>(null);
  const [estimateDistance, setEstimateDistance] = useState<number | null>(null);
  const [estimateDuration, setEstimateDuration] = useState<number | null>(null);
  const [estimateSurge, setEstimateSurge] = useState(false);
  const [estimateUnavailable, setEstimateUnavailable] = useState(false);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  const { validateCode } = usePromos();
  const [promoInput, setPromoInput] = useState('');
  const [promoStatus, setPromoStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');
  const [promoDiscount, setPromoDiscount] = useState('');
  const [promoError, setPromoError] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState('');

  const handleApplyPromo = useCallback(async () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoStatus('loading');
    setPromoError('');
    const result = await validateCode(code, priceEstimate ?? 0);
    if (result.valid) {
      setPromoStatus('valid');
      setPromoDiscount(result.discount ?? '');
      setAppliedPromoCode(code);
      haptic.notify(Haptics.NotificationFeedbackType.Success);
    } else {
      setPromoStatus('invalid');
      setPromoError(result.message ?? t('invalid_promo_code'));
      haptic.notify(Haptics.NotificationFeedbackType.Error);
    }
  }, [promoInput, priceEstimate, validateCode]);

  const clearPromo = useCallback(() => {
    setPromoInput('');
    setPromoStatus('idle');
    setPromoDiscount('');
    setPromoError('');
    setAppliedPromoCode('');
  }, []);

  const { rideState, requesting, requestRide, cancelRide: hookCancelRide, clearDeviationWarning, resetRide: hookResetRide } = useRide();
  const rideStateRef = useRef(rideState);
  rideStateRef.current = rideState;

  const [ratingVisible, setRatingVisible] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [safetyVisible, setSafetyVisible] = useState(false);
  const [cancelSheetVisible, setCancelSheetVisible] = useState(false);
  const ratedRideIds = useRef<Set<string>>(new Set());

  // Auto-show rating sheet when ride completes (once per rideId)
  useEffect(() => {
    if (phase === 'completed' && rideState.rideId && !ratedRideIds.current.has(rideState.rideId)) {
      setRatingVisible(true);
    }
  }, [phase, rideState.rideId]);

  const handleRatingSubmit = useCallback(async (stars: number, comment: string) => {
    setRatingVisible(false);
    if (!rideState.rideId) return;
    ratedRideIds.current.add(rideState.rideId);
    try {
      await api.post(`/rides/${rideState.rideId}/rate-driver`, { rating: stars, comment });
    } catch {
      // silently ignore — rating already dismissed for the user
    }
  }, [rideState.rideId]);

  const handleRatingSkip = useCallback(() => {
    setRatingVisible(false);
    if (rideState.rideId) ratedRideIds.current.add(rideState.rideId);
  }, [rideState.rideId]);

  // Map rideState.status → local phase
  useEffect(() => {
    const s = rideState.status;
    if (!s) return;
    if (s === 'driver_assigned') {
      setPhase('active');
      haptic.notify(Haptics.NotificationFeedbackType.Success);
    } else if (s === 'arrived' || s === 'driver_arrived') {
      setPhase('arrived');
      haptic.notify(Haptics.NotificationFeedbackType.Success);
    } else if (s === 'started' || s === 'active') {
      setPhase('in_trip');
    } else if (s === 'completed') {
      setPhase('completed');
      haptic.notify(Haptics.NotificationFeedbackType.Success);
      const rs = rideStateRef.current;
      router.push({
        pathname: '/receipt',
        params: {
          rideId: rs.rideId ?? '',
          pickup: pickupRef.current,
          dropoff: dropoffRef.current,
          fare: String(rs.fare ?? ''),
          driverName: rs.driver?.name ?? '',
          driverRating: String(rs.driver?.rating ?? ''),
        },
      } as any);
    } else if (s === 'cancelled' || s === 'timeout') {
      setPhase('error');
    }
  }, [rideState.status]);

  // Task 1: Fetch price estimate via GET when both locations are set
  useEffect(() => {
    if (!pickup || !dropoff) {
      setPriceEstimate(null);
      setEstimateDistance(null);
      setEstimateDuration(null);
      setEstimateSurge(false);
      setEstimateUnavailable(false);
      return;
    }
    const pickupCoords = WG_COORDS[pickup];
    const dropoffCoords = WG_COORDS[dropoff];
    if (!pickupCoords || !dropoffCoords) return;

    let cancelled = false;
    setLoadingEstimate(true);
    setEstimateUnavailable(false);
    api.get('/rides/estimate', {
      params: {
        pickupLat:   pickupCoords.latitude,
        pickupLng:   pickupCoords.longitude,
        dropoffLat:  dropoffCoords.latitude,
        dropoffLng:  dropoffCoords.longitude,
        serviceType: 'car',
      },
    }).then((res) => {
      if (!cancelled) {
        const d = res.data?.data ?? res.data;
        setPriceEstimate(d?.estimatedPrice ?? d?.price ?? null);
        setEstimateDistance(d?.distance ?? d?.distanceKm ?? null);
        setEstimateDuration(d?.duration ?? d?.durationMin ?? d?.durationMinutes ?? null);
        setEstimateSurge(!!(d?.surgeMultiplier && d.surgeMultiplier > 1));
      }
    }).catch(() => {
      if (!cancelled) {
        setPriceEstimate(null);
        setEstimateUnavailable(true);
      }
    }).finally(() => {
      if (!cancelled) setLoadingEstimate(false);
    });

    return () => { cancelled = true; };
  }, [pickup, dropoff]);

  // Check GPS position for geofence
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return;
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((loc) => {
        setOutsideZone(!isInGeofence(loc.coords.latitude, loc.coords.longitude));
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  const startFinding = useCallback(async () => {
    if (!pickup || !dropoff) {
      Alert.alert(t('select_locations'), t('select_both'));
      return;
    }
    const pickupCoords = WG_COORDS[pickup];
    const dropoffCoords = WG_COORDS[dropoff];
    if (!pickupCoords || !dropoffCoords) {
      Alert.alert(t('location_error'), t('location_error_msg'));
      return;
    }
    haptic.impact();
    setPhase('finding');
    await requestRide({
      type: 'car',
      pickup:  { ...pickupCoords,  address: pickup },
      dropoff: { ...dropoffCoords, address: dropoff },
      ...(appliedPromoCode ? { promoCode: appliedPromoCode } : {}),
    });
  }, [pickup, dropoff, requestRide, appliedPromoCode]);

  const openCancelSheet = useCallback(() => {
    haptic.selection();
    setCancelSheetVisible(true);
  }, []);

  const confirmCancelRide = useCallback(async (reason: string) => {
    haptic.notify(Haptics.NotificationFeedbackType.Warning);
    await hookCancelRide(reason);
    setCancelSheetVisible(false);
    setPhase('request');
  }, [hookCancelRide]);

  const resetRide = useCallback(() => {
    hookResetRide();
    setPhase('request');
    setPickup('');
    setDropoff('');
    setPriceEstimate(null);
  }, [hookResetRide]);

  const openSafety = useCallback(() => {
    haptic.impact(Haptics.ImpactFeedbackStyle.Heavy);
    setSafetyVisible(true);
  }, []);

  // Auto-dismiss deviation warning after 30 seconds
  useEffect(() => {
    if (!rideState.deviationWarning) return;
    const timer = setTimeout(() => { clearDeviationWarning(); }, 30000);
    return () => clearTimeout(timer);
  }, [rideState.deviationWarning, clearDeviationWarning]);

  const driverInitials = rideState.driver
    ? rideState.driver.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  if (phase === 'completed') {
    const fare = rideState.fare ?? priceEstimate;
    return (
      <LinearGradient colors={C.luxeSoftGrad} style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <View style={[styles.arrivedScreen, { paddingTop: top + 40 }]}>
            <LinearGradient colors={[C.accentMint, '#3daa80']} style={styles.successCircle}>
              <Check size={38} color={C.white} />
            </LinearGradient>
            <Text style={styles.arrivedTitle}>{t('trip_complete')}</Text>
            <Text style={styles.arrivedSub}>{pickup}  →  {dropoff}</Text>

            {rideState.driver && (
              <View style={[glassStyle, styles.arrivedCard, S.luxe]}>
                <View style={styles.arrivedRow}>
                  <View style={styles.driverAvatarSm}>
                    <Text style={styles.driverAvatarSmText}>{driverInitials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.arrivedDriverName}>{rideState.driver.name}</Text>
                    <Text style={styles.arrivedDriverCar}>{rideState.driver.vehicle}</Text>
                  </View>
                  <View style={styles.ratingBadge}>
                    <Star size={11} color="#f5a623" fill="#f5a623" />
                    <Text style={styles.ratingText}>{rideState.driver.rating?.toFixed(1) ?? '—'}</Text>
                  </View>
                </View>
                {fare != null && (
                  <>
                    <View style={styles.arrivedDivider} />
                    <View style={styles.arrivedPayRow}>
                      <Banknote size={16} color={C.inkSoft} />
                      <Text style={styles.arrivedPayText}>{t('cash_paid').replace('{p}', String(fare.toFixed(2)))}</Text>
                      <View style={styles.paidBadge}>
                        <Text style={styles.paidBadgeText}>{t('cash_only')}</Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
            )}

            <TouchableOpacity style={[styles.primaryBtn, { marginTop: 28 }]} onPress={resetRide} activeOpacity={0.85}>
              <PlusCircle size={16} color={C.white} />
              <Text style={styles.primaryBtnText}>{t('book_another')}</Text>
            </TouchableOpacity>
          </View>

          <RatingSheet
            visible={ratingVisible}
            driverName={rideState.driver?.name ?? t('your_driver')}
            driverInitials={driverInitials}
            driverColor="#3A7BD5"
            onSubmit={handleRatingSubmit}
            onSkip={handleRatingSkip}
          />
        </View>
      </LinearGradient>
    );
  }

  if (phase === 'error') {
    return (
      <LinearGradient colors={C.luxeSoftGrad} style={{ flex: 1 }}>
        <View style={[styles.arrivedScreen, { paddingTop: top + 40 }]}>
          <View style={[styles.successCircle, { backgroundColor: C.badge }]}>
            <X size={38} color={C.white} />
          </View>
          <Text style={styles.arrivedTitle}>{t('ride_cancelled_title')}</Text>
          <Text style={styles.arrivedSub}>
            {rideState.cancelReason === 'timeout'
              ? t('no_drivers_msg')
              : rideState.cancelReason ?? t('ride_cancelled_msg')}
          </Text>
          <TouchableOpacity style={[styles.primaryBtn, { marginTop: 28 }]} onPress={resetRide} activeOpacity={0.85}>
            <Navigation size={15} color={C.white} />
            <Text style={styles.primaryBtnText}>{t('try_again')}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={C.luxeSoftGrad} style={{ flex: 1 }}>
      <View style={{ paddingTop: top + 8, paddingHorizontal: 20, paddingBottom: 8 }}>
        <Text style={styles.screenTitle}>{t('car')}</Text>
        <Text style={styles.screenSub}>{t('car_subtitle')}</Text>
      </View>

      {rideState.driverLocation && (phase === 'active' || phase === 'arrived' || phase === 'in_trip')
        ? (
          <View style={{ height: MAP_H, overflow: 'hidden' }}>
            <PassengerTrackingMap
              pickup={WG_COORDS[pickup] ?? null}
              dropoff={WG_COORDS[dropoff] ?? null}
              driverLocation={rideState.driverLocation}
            />
          </View>
        )
        : <RideMap phase={phase} />
      }

      {outsideZone && phase === 'request' && (
        <View style={styles.zoneBanner}>
          <AlertTriangle size={13} color={C.badge} />
          <Text style={styles.zoneBannerText}>{t('outside_zone')}</Text>
        </View>
      )}

      {phase === 'request' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.sheet}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t('book_a_ride')}</Text>

          <View style={{ gap: 10, marginTop: 16 }}>
            <PlacePicker label={t('pickup_label')} value={pickup} onSelect={setPickup} />
            <PlacePicker label={t('dropoff_label')} value={dropoff} onSelect={setDropoff} />
          </View>

          {(priceEstimate !== null || loadingEstimate || estimateUnavailable) && (
            <View style={[glassStyle, styles.priceCard, S.luxe]}>
              {estimateSurge && (
                <View style={styles.surgeBanner}>
                  <AlertTriangle size={12} color="#92400e" />
                  <Text style={styles.surgeBannerText}>{t('surge_pricing')}</Text>
                </View>
              )}
              <View style={styles.priceRow}>
                <View style={styles.priceIcon}>
                  <Car size={17} color={C.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.priceLabel}>{t('economy_ride')}</Text>
                  <Text style={styles.priceSub}>{t('passengers_hint')}</Text>
                </View>
                {loadingEstimate ? (
                  <ActivityIndicator size="small" color={C.ink} />
                ) : estimateUnavailable ? (
                  <Text style={[styles.priceAmount, { color: C.inkSoft, fontSize: 13 }]}>{t('price_unavailable')}</Text>
                ) : (
                  <Text style={styles.priceAmount}>{`EGP ${priceEstimate?.toFixed(2)}`}</Text>
                )}
              </View>
              {!loadingEstimate && !estimateUnavailable && (
                <View style={styles.priceMeta}>
                  {estimateDuration != null && (
                    <>
                      <Clock size={11} color={C.inkSoft} />
                      <Text style={styles.priceMetaText}>~{Math.round(estimateDuration)} min</Text>
                      <View style={styles.priceSep} />
                    </>
                  )}
                  {estimateDistance != null && (
                    <>
                      <Navigation size={11} color={C.inkSoft} />
                      <Text style={styles.priceMetaText}>{estimateDistance.toFixed(1)} km</Text>
                      <View style={styles.priceSep} />
                    </>
                  )}
                  <Banknote size={11} color={C.inkSoft} />
                  <Text style={styles.priceMetaText}>{t('cash_payment_label')}</Text>
                </View>
              )}
            </View>
          )}

          <View style={[glassStyle, styles.promoSection, S.luxe]}>
            <View style={styles.promoInputRow}>
              <Tag size={15} color={C.inkSoft} />
              <TextInput
                style={styles.promoInput}
                placeholder={t('enter_promo')}
                placeholderTextColor={C.inkSoft}
                value={promoInput}
                onChangeText={(v) => { setPromoInput(v); if (promoStatus === 'invalid') setPromoStatus('idle'); }}
                textAlign={isRTL ? 'right' : 'left'}
                autoCapitalize="characters"
                editable={promoStatus !== 'valid' && promoStatus !== 'loading'}
                returnKeyType="done"
                onSubmitEditing={handleApplyPromo}
              />
              <TouchableOpacity
                style={[styles.promoApplyBtn, (promoInput.trim().length === 0 || promoStatus === 'loading' || promoStatus === 'valid') && styles.promoApplyBtnDisabled]}
                onPress={handleApplyPromo}
                disabled={promoInput.trim().length === 0 || promoStatus === 'loading' || promoStatus === 'valid'}
                activeOpacity={0.8}
              >
                <Text style={styles.promoApplyText}>{promoStatus === 'loading' ? '...' : t('promo_apply')}</Text>
              </TouchableOpacity>
            </View>
            {promoStatus === 'valid' && (
              <View style={styles.promoSuccess}>
                <Text style={styles.promoSuccessText}>{t('discount_applied').replace('{amount}', String(promoDiscount))}</Text>
                <TouchableOpacity onPress={clearPromo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={14} color="#22a06b" />
                </TouchableOpacity>
              </View>
            )}
            {promoStatus === 'invalid' && (
              <Text style={styles.promoError}>{promoError}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, (!pickup || !dropoff || requesting) && styles.primaryBtnDisabled]}
            onPress={startFinding}
            disabled={!pickup || !dropoff || requesting}
            activeOpacity={0.85}
          >
            <Navigation size={15} color={C.white} />
            <Text style={styles.primaryBtnText}>
              {requesting ? t('requesting') : t('confirm_ride')}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {rideState.deviationWarning && (phase === 'active' || phase === 'arrived' || phase === 'in_trip') && (
        <View style={styles.deviationBanner}>
          <AlertTriangle size={14} color="#92400e" />
          <Text style={styles.deviationBannerText}>{t('deviation_warning')}</Text>
          <TouchableOpacity
            onPress={clearDeviationWarning}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.deviationDismiss}
          >
            <Text style={styles.deviationDismissText}>{t('dismiss')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'finding' && (
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.findingHeader}>
            <View>
              <Text style={styles.sheetTitle}>{t('finding_driver')}</Text>
              <Text style={styles.sheetSub}>{t('driver_arriving')}</Text>
            </View>
            <View style={styles.etaBubble}>
              <Text style={styles.etaText}>…</Text>
            </View>
          </View>

          <View style={[glassStyle, styles.tripSummaryRow, S.luxe, { marginTop: 16 }]}>
            <View style={[styles.tripDot, { backgroundColor: C.ink }]} />
            <Text style={styles.tripStopText} numberOfLines={1}>{pickup}</Text>
            {isRTL ? <ArrowLeft size={11} color={C.inkSoft} style={{ marginHorizontal: 6 }} /> : <ArrowRight size={11} color={C.inkSoft} style={{ marginHorizontal: 6 }} />}
            <View style={[styles.tripDot, { backgroundColor: C.accentMint }]} />
            <Text style={styles.tripStopText} numberOfLines={1}>{dropoff}</Text>
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={openCancelSheet} activeOpacity={0.8}>
            <Text style={styles.cancelBtnText}>{t('cancel_ride')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'active' && (
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.findingHeader}>
            <View>
              <Text style={styles.sheetTitle}>{t('finding_driver')}</Text>
              <Text style={styles.sheetSub}>
                {rideState.driver?.eta != null
                  ? `${t('arrives_in')} ~${rideState.driver.eta} min`
                  : t('driver_arriving')}
              </Text>
            </View>
            {rideState.driver?.eta != null && (
              <View style={styles.etaBubble}>
                <Text style={styles.etaText}>{rideState.driver.eta}m</Text>
              </View>
            )}
          </View>

          <View style={[glassStyle, styles.driverCard, S.luxe]}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>{driverInitials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{rideState.driver?.name ?? t('driver_label')}</Text>
              <Text style={styles.driverCarText}>{rideState.driver?.vehicle ?? ''}</Text>
              <View style={styles.ratingRow}>
                <Star size={11} color="#f5a623" fill="#f5a623" />
                <Text style={styles.ratingText}>{rideState.driver?.rating?.toFixed(1) ?? '—'}</Text>
              </View>
            </View>
            {rideState.driver?.phone ? (
              <TouchableOpacity style={styles.callBtn} activeOpacity={0.8}>
                <PhoneCall size={15} color={C.accentMint} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.callBtn, { marginLeft: 6 }]}
              activeOpacity={0.8}
              onPress={() => { haptic.selection(); setChatOpen(true); }}
            >
              <MessageCircle size={15} color={C.accentMint} />
            </TouchableOpacity>
          </View>

          {(rideState.waitingChargeStatus === 'active' || rideState.waitingChargeStatus === 'capped') && (
            <View style={[styles.waitingBanner, rideState.waitingChargeStatus === 'capped' && styles.waitingBannerCapped]}>
              <Clock size={13} color={rideState.waitingChargeStatus === 'capped' ? '#ea580c' : '#92400e'} />
              <Text style={[styles.waitingBannerText, rideState.waitingChargeStatus === 'capped' && styles.waitingBannerTextCapped]}>
                {rideState.waitingChargeStatus === 'capped'
                  ? t('max_waiting_msg').replace('{amount}', (rideState.waitingCharge ?? 0).toFixed(2))
                  : rideState.waitingRatePerMinute != null
                    ? t('waiting_msg_rate').replace('{rate}', String(rideState.waitingRatePerMinute)).replace('{amount}', (rideState.waitingCharge ?? 0).toFixed(2))
                    : t('waiting_msg').replace('{amount}', (rideState.waitingCharge ?? 0).toFixed(2))}
              </Text>
            </View>
          )}

          <View style={styles.tripSummaryRow}>
            <View style={[styles.tripDot, { backgroundColor: C.ink }]} />
            <Text style={styles.tripStopText} numberOfLines={1}>{pickup}</Text>
            {isRTL ? <ArrowLeft size={11} color={C.inkSoft} style={{ marginHorizontal: 6 }} /> : <ArrowRight size={11} color={C.inkSoft} style={{ marginHorizontal: 6 }} />}
            <View style={[styles.tripDot, { backgroundColor: C.accentMint }]} />
            <Text style={styles.tripStopText} numberOfLines={1}>{dropoff}</Text>
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={openCancelSheet} activeOpacity={0.8}>
            <Text style={styles.cancelBtnText}>{t('cancel_ride')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sosBtn} onPress={openSafety} activeOpacity={0.85}>
            <ShieldAlert size={16} color="#ffffff" />
            <Text style={styles.sosBtnText}>{t('safety_title').toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'arrived' && (
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={[glassStyle, styles.arrivedBanner, S.luxe]}>
            <CheckCircle size={22} color={C.accentMint} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{t('driver_arrived_title')}</Text>
              <Text style={styles.sheetSub}>{t('driver_waiting_msg')}</Text>
            </View>
          </View>

          {(rideState.waitingChargeStatus === 'active' || rideState.waitingChargeStatus === 'capped') && (
            <View style={[styles.waitingBanner, rideState.waitingChargeStatus === 'capped' && styles.waitingBannerCapped]}>
              <Clock size={13} color={rideState.waitingChargeStatus === 'capped' ? '#ea580c' : '#92400e'} />
              <Text style={[styles.waitingBannerText, rideState.waitingChargeStatus === 'capped' && styles.waitingBannerTextCapped]}>
                {rideState.waitingChargeStatus === 'capped'
                  ? t('max_waiting_msg').replace('{amount}', (rideState.waitingCharge ?? 0).toFixed(2))
                  : rideState.waitingRatePerMinute != null
                    ? t('waiting_msg_rate').replace('{rate}', String(rideState.waitingRatePerMinute)).replace('{amount}', (rideState.waitingCharge ?? 0).toFixed(2))
                    : t('waiting_msg').replace('{amount}', (rideState.waitingCharge ?? 0).toFixed(2))}
              </Text>
            </View>
          )}

          <View style={[glassStyle, styles.driverCard, S.luxe, { marginTop: 12 }]}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>{driverInitials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{rideState.driver?.name ?? t('driver_label')}</Text>
              <Text style={styles.driverCarText}>{rideState.driver?.vehicle ?? ''}</Text>
            </View>
            {rideState.driver?.phone ? (
              <TouchableOpacity style={styles.callBtn} activeOpacity={0.8}>
                <PhoneCall size={15} color={C.accentMint} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.callBtn, { marginStart: 6 }]}
              activeOpacity={0.8}
              onPress={() => { haptic.selection(); setChatOpen(true); }}
            >
              <MessageCircle size={15} color={C.accentMint} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.sosBtn} onPress={openSafety} activeOpacity={0.85}>
            <ShieldAlert size={16} color="#ffffff" />
            <Text style={styles.sosBtnText}>{t('safety_title').toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ChatModal
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        driverName={rideState.driver?.name ?? t('your_driver')}
        tripId={rideState.rideId}
      />

      {phase === 'in_trip' && (
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.findingHeader}>
            <View>
              <Text style={styles.sheetTitle}>{t('on_your_way')}</Text>
              <Text style={styles.sheetSub}>{dropoff}</Text>
            </View>
            <LinearGradient colors={[C.accentMint, '#3daa80']} style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>LIVE</Text>
            </LinearGradient>
          </View>

          <View style={[glassStyle, styles.driverCard, S.luxe]}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>{driverInitials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{rideState.driver?.name ?? t('driver_label')}</Text>
              <Text style={styles.driverCarText}>{rideState.driver?.vehicle ?? ''}</Text>
            </View>
            <TouchableOpacity
              style={[styles.callBtn, { marginEnd: 6 }]}
              activeOpacity={0.8}
              onPress={() => { haptic.selection(); setChatOpen(true); }}
            >
              <MessageCircle size={15} color={C.accentMint} />
            </TouchableOpacity>
            {priceEstimate !== null && (
              <View style={styles.tripPriceBadge}>
                <Text style={styles.tripPriceLabel}>EGP</Text>
                <Text style={styles.tripPriceAmount}>{priceEstimate?.toFixed(2)}</Text>
              </View>
            )}
          </View>

          {(rideState.waitingChargeStatus === 'active' || rideState.waitingChargeStatus === 'capped') && (
            <View style={[styles.waitingBanner, rideState.waitingChargeStatus === 'capped' && styles.waitingBannerCapped]}>
              <Clock size={13} color={rideState.waitingChargeStatus === 'capped' ? '#ea580c' : '#92400e'} />
              <Text style={[styles.waitingBannerText, rideState.waitingChargeStatus === 'capped' && styles.waitingBannerTextCapped]}>
                {rideState.waitingChargeStatus === 'capped'
                  ? t('max_waiting_msg').replace('{amount}', (rideState.waitingCharge ?? 0).toFixed(2))
                  : rideState.waitingRatePerMinute != null
                    ? t('waiting_msg_rate').replace('{rate}', String(rideState.waitingRatePerMinute)).replace('{amount}', (rideState.waitingCharge ?? 0).toFixed(2))
                    : t('waiting_msg').replace('{amount}', (rideState.waitingCharge ?? 0).toFixed(2))}
              </Text>
            </View>
          )}

          <View style={[glassStyle, styles.routeCard, S.luxe]}>
            <View style={styles.routeRow}>
              <View style={[styles.tripDot, { backgroundColor: C.ink }]} />
              <Text style={styles.routeText}>{pickup}</Text>
            </View>
            <View style={styles.routeConnector} />
            <View style={styles.routeRow}>
              <View style={[styles.tripDot, { backgroundColor: C.accentMint }]} />
              <Text style={styles.routeText}>{dropoff}</Text>
            </View>
            <View style={styles.routePayRow}>
              <Banknote size={12} color={C.inkSoft} />
              <Text style={styles.routePayText}>
                {priceEstimate != null
                  ? t('cash_fare').replace('{p}', priceEstimate.toFixed(2))
                  : t('calculating_fare')}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.sosBtn} onPress={openSafety} activeOpacity={0.85}>
            <ShieldAlert size={16} color="#ffffff" />
            <Text style={styles.sosBtnText}>{t('safety_title').toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
      )}

      <SafetySheet
        visible={safetyVisible}
        onClose={() => setSafetyVisible(false)}
        rideId={rideState.rideId}
        driverName={rideState.driver?.name}
        vehicle={rideState.driver?.vehicle}
        plate={rideState.driver?.plateNumber}
      />

      <CancelReasonSheet
        visible={cancelSheetVisible}
        onClose={() => setCancelSheetVisible(false)}
        onConfirm={confirmCancelRide}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screenTitle: { fontSize: 26, fontWeight: '700', color: C.ink, letterSpacing: -0.8 },
  screenSub: { fontSize: 12, color: C.inkSoft, marginTop: 2 },

  mapContainer: {
    height: MAP_H,
    overflow: 'hidden',
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  road: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.11)',
    borderRadius: 3,
  },
  routeLine: {
    position: 'absolute',
    borderLeftWidth: 2,
    borderTopWidth: 2,
    borderColor: C.accentMint,
    borderStyle: 'dashed',
    opacity: 0.7,
  },
  destMarker: {
    position: 'absolute',
  },
  userPulse: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(85,196,154,0.35)',
  },
  userDot: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.accentMint,
    borderWidth: 3,
    borderColor: C.white,
  },
  searchRing: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: C.accentMint,
  },
  geofenceBadge: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  geofenceText: {
    fontSize: 10,
    color: C.accentMint,
    fontWeight: '600',
    letterSpacing: 0.4,
  },

  zoneBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: 'rgba(217,92,53,0.10)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(217,92,53,0.2)',
    padding: 10,
  },
  zoneBannerText: { flex: 1, fontSize: 11.5, color: C.badge, lineHeight: 16 },

  sheet: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: C.ink, letterSpacing: -0.5 },
  sheetSub: { fontSize: 12, color: C.inkSoft, marginTop: 2 },

  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 18,
    paddingHorizontal: 14,
    gap: 10,
  },
  placeDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: C.border,
  },
  placeDotActive: { backgroundColor: C.accentMint },
  placeText: { flex: 1, fontSize: 14, color: C.ink, fontWeight: '500' },
  placeTextPlaceholder: { color: C.inkSoft },

  dropdown: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: C.snow,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  dropSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 8,
  },
  dropInput: { flex: 1, fontSize: 13, color: C.ink, paddingVertical: 2 },
  dropItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  dropItemText: { fontSize: 13.5, color: C.ink },
  dropEmpty: { textAlign: 'center', color: C.inkSoft, padding: 16, fontSize: 13 },

  priceCard: {
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
  },
  surgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  surgeBannerText: { flex: 1, fontSize: 11.5, color: '#92400e', fontWeight: '500' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  priceIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: C.mist,
    alignItems: 'center', justifyContent: 'center',
  },
  priceLabel: { fontSize: 14, fontWeight: '600', color: C.ink },
  priceSub: { fontSize: 11, color: C.inkSoft, marginTop: 1 },
  priceAmount: { fontSize: 18, fontWeight: '700', color: C.ink },
  priceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  priceMetaText: { fontSize: 11, color: C.inkSoft },
  priceSep: { width: 1, height: 10, backgroundColor: C.border },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: C.ink,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: C.white },

  promoSection: { borderRadius: 16, padding: 14, marginTop: 12, gap: 10 },
  promoInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promoInput: { flex: 1, height: 40, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, fontSize: 13, color: C.ink, backgroundColor: C.snow },
  promoApplyBtn: { height: 40, paddingHorizontal: 16, borderRadius: 12, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  promoApplyBtnDisabled: { opacity: 0.4 },
  promoApplyText: { fontSize: 12, fontWeight: '700', color: C.white },
  promoSuccess: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(34,160,107,0.12)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  promoSuccessText: { fontSize: 12.5, fontWeight: '600', color: '#22a06b', flex: 1 },
  promoError: { fontSize: 12, color: '#e0584a', paddingHorizontal: 2 },

  findingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  etaBubble: {
    width: 52, height: 52,
    borderRadius: 26,
    backgroundColor: C.accentMint,
    alignItems: 'center', justifyContent: 'center',
  },
  etaText: { fontSize: 13, fontWeight: '700', color: C.white },

  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
  },
  driverAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: C.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  driverAvatarText: { fontSize: 16, fontWeight: '700', color: C.white },
  driverName: { fontSize: 15, fontWeight: '700', color: C.ink },
  driverCarText: { fontSize: 12, color: C.inkSoft, marginTop: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  ratingText: { fontSize: 11, color: C.ink, fontWeight: '600' },
  callBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.mist,
    alignItems: 'center', justifyContent: 'center',
  },
  plateBadge: {
    backgroundColor: C.mist,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  plateText: { fontSize: 12, color: C.ink, fontWeight: '600' },

  tripSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  tripDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  tripStopText: { flex: 1, fontSize: 12, color: C.ink, marginStart: 6 },

  cancelBtn: {
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: C.inkSoft },

  sosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: '#dc2626',
  },
  sosBtnText: { fontSize: 14, fontWeight: '800', color: '#ffffff', letterSpacing: 1 },

  waitingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    borderStartWidth: 3,
    borderStartColor: '#f59e0b',
  },
  waitingBannerCapped: {
    backgroundColor: '#fff7ed',
    borderStartColor: '#ea580c',
  },
  waitingBannerText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#92400e',
  },
  waitingBannerTextCapped: {
    color: '#9a3412',
  },

  liveBadge: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 99,
  },
  liveBadgeText: { fontSize: 10, fontWeight: '800', color: C.white, letterSpacing: 1 },

  tripPriceBadge: { alignItems: 'flex-end' },
  tripPriceLabel: { fontSize: 10, color: C.inkSoft },
  tripPriceAmount: { fontSize: 18, fontWeight: '700', color: C.ink },

  routeCard: { borderRadius: 16, padding: 14, marginTop: 12 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeConnector: {
    width: 1, height: 14, backgroundColor: C.border,
    marginStart: 4, marginVertical: 3,
  },
  routeText: { flex: 1, fontSize: 13, color: C.ink, fontWeight: '500' },
  routePayRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border,
  },
  routePayText: { fontSize: 11, color: C.inkSoft },

  arrivedScreen: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  successCircle: {
    width: 90, height: 90, borderRadius: 45,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  arrivedTitle: { fontSize: 26, fontWeight: '800', color: C.ink, textAlign: 'center', letterSpacing: -0.6 },
  arrivedSub: { fontSize: 13, color: C.inkSoft, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  arrivedCard: { width: '100%', borderRadius: 20, padding: 16 },
  arrivedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatarSm: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  driverAvatarSmText: { fontSize: 14, fontWeight: '700', color: C.white },
  arrivedDriverName: { fontSize: 15, fontWeight: '700', color: C.ink },
  arrivedDriverCar: { fontSize: 12, color: C.inkSoft, marginTop: 1 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  arrivedDivider: { height: 1, backgroundColor: C.border, marginVertical: 12 },
  arrivedPayRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrivedPayText: { flex: 1, fontSize: 13, color: C.ink, fontWeight: '500' },
  paidBadge: {
    backgroundColor: 'rgba(85,196,154,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  paidBadgeText: { fontSize: 11, color: C.accentMint, fontWeight: '600' },

  arrivedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 14,
    marginBottom: 4,
  },

  deviationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#fffbeb',
    borderStartWidth: 3,
    borderStartColor: '#f59e0b',
  },
  deviationBannerText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#78350f',
    lineHeight: 17,
  },
  deviationDismiss: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  deviationDismissText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#b45309',
  },
});
