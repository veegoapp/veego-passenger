import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing,
  ScrollView, TextInput, Platform, Alert, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Car, ShieldCheck, ChevronUp, ChevronDown, Search, Check, Star, Banknote, PlusCircle, AlertTriangle, Clock, Navigation, ArrowRight, CheckCircle, PhoneCall, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { C, S, glassStyle } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';
import { useRide } from '@/src/hooks/useRide';
import api from '@/src/api/client';

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

const WG_PLACES = [
  'Kharga Central Station',
  'Al Nasser Square',
  'Al Mochtat',
  'Hiraiz District',
  'Al Qasaba',
  'Baris Town Center',
  'Al Qasr Village',
  'Dakhla Medical Center',
  'New Valley University',
  'Al Farafra Hospital',
  'Kharga Market',
  'Government Complex',
  'Al Kharga Airport',
  'Tiba Mall',
];

const WG_COORDS: Record<string, { latitude: number; longitude: number }> = {
  'Kharga Central Station': { latitude: 25.4444, longitude: 30.5503 },
  'Al Nasser Square':       { latitude: 25.4500, longitude: 30.5480 },
  'Al Mochtat':             { latitude: 25.4350, longitude: 30.5400 },
  'Hiraiz District':        { latitude: 25.4600, longitude: 30.5520 },
  'Al Qasaba':              { latitude: 25.4420, longitude: 30.5550 },
  'Baris Town Center':      { latitude: 24.4500, longitude: 30.6167 },
  'Al Qasr Village':        { latitude: 25.6900, longitude: 28.8800 },
  'Dakhla Medical Center':  { latitude: 25.4900, longitude: 28.9800 },
  'New Valley University':  { latitude: 25.4555, longitude: 30.5522 },
  'Al Farafra Hospital':    { latitude: 27.0564, longitude: 27.9731 },
  'Kharga Market':          { latitude: 25.4455, longitude: 30.5490 },
  'Government Complex':     { latitude: 25.4480, longitude: 30.5510 },
  'Al Kharga Airport':      { latitude: 25.4736, longitude: 30.5978 },
  'Tiba Mall':              { latitude: 25.4422, longitude: 30.5460 },
};

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
        <Text style={styles.geofenceText}>Wadi El Gedid only</Text>
      </View>
    </View>
  );
}

function PlacePicker({
  label, value, onSelect,
}: { label: string; value: string; onSelect: (p: string) => void }) {
  const { t } = useTheme();
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
  const { t } = useTheme();

  const [phase, setPhase] = useState<Phase>('request');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [outsideZone, setOutsideZone] = useState(false);
  const [priceEstimate, setPriceEstimate] = useState<number | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  const { rideState, requesting, requestRide, cancelRide: hookCancelRide, resetRide: hookResetRide } = useRide();

  // Map rideState.status → local phase
  useEffect(() => {
    const s = rideState.status;
    if (!s) return;
    if (s === 'driver_assigned' || s === 'driver_en_route') {
      setPhase('active');
      haptic.notify(Haptics.NotificationFeedbackType.Success);
    } else if (s === 'arrived') {
      setPhase('arrived');
      haptic.notify(Haptics.NotificationFeedbackType.Success);
    } else if (s === 'started') {
      setPhase('in_trip');
    } else if (s === 'completed') {
      setPhase('completed');
      haptic.notify(Haptics.NotificationFeedbackType.Success);
    } else if (s === 'cancelled' || s === 'timeout') {
      setPhase('error');
    }
  }, [rideState.status]);

  // Fetch price estimate from the real API when both locations are set
  useEffect(() => {
    if (!pickup || !dropoff) { setPriceEstimate(null); return; }
    const pickupCoords = WG_COORDS[pickup];
    const dropoffCoords = WG_COORDS[dropoff];
    if (!pickupCoords || !dropoffCoords) return;

    let cancelled = false;
    setLoadingEstimate(true);
    api.post('/rides/estimate', {
      vehicleType:       'car',
      pickupLatitude:    pickupCoords.latitude,
      pickupLongitude:   pickupCoords.longitude,
      dropoffLatitude:   dropoffCoords.latitude,
      dropoffLongitude:  dropoffCoords.longitude,
    }).then((res) => {
      if (!cancelled) {
        setPriceEstimate(res.data?.data?.estimatedPrice ?? res.data?.estimatedPrice ?? null);
      }
    }).catch(() => {
      if (!cancelled) setPriceEstimate(null);
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
      Alert.alert('Select locations', 'Please select both pickup and drop-off.');
      return;
    }
    const pickupCoords = WG_COORDS[pickup];
    const dropoffCoords = WG_COORDS[dropoff];
    if (!pickupCoords || !dropoffCoords) {
      Alert.alert('Location error', 'Could not determine coordinates for selected location.');
      return;
    }
    haptic.impact();
    setPhase('finding');
    await requestRide({
      type: 'car',
      pickup:  { ...pickupCoords,  address: pickup },
      dropoff: { ...dropoffCoords, address: dropoff },
    });
  }, [pickup, dropoff, requestRide]);

  const cancelRide = useCallback(() => {
    haptic.notify(Haptics.NotificationFeedbackType.Warning);
    hookCancelRide();
    setPhase('request');
  }, [hookCancelRide]);

  const resetRide = useCallback(() => {
    hookResetRide();
    setPhase('request');
    setPickup('');
    setDropoff('');
    setPriceEstimate(null);
  }, [hookResetRide]);

  const driverInitials = rideState.driver
    ? rideState.driver.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  if (phase === 'completed') {
    const fare = rideState.fare ?? priceEstimate;
    return (
      <LinearGradient colors={C.luxeSoftGrad} style={{ flex: 1 }}>
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
          <Text style={styles.arrivedTitle}>Ride Cancelled</Text>
          <Text style={styles.arrivedSub}>
            {rideState.cancelReason === 'timeout'
              ? 'No drivers were available. Please try again.'
              : rideState.cancelReason ?? 'Your ride was cancelled.'}
          </Text>
          <TouchableOpacity style={[styles.primaryBtn, { marginTop: 28 }]} onPress={resetRide} activeOpacity={0.85}>
            <Navigation size={15} color={C.white} />
            <Text style={styles.primaryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={C.luxeSoftGrad} style={{ flex: 1 }}>
      <View style={{ paddingTop: top + 8, paddingHorizontal: 20, paddingBottom: 8 }}>
        <Text style={styles.screenTitle}>Car</Text>
        <Text style={styles.screenSub}>Ride-hailing · Wadi El Gedid</Text>
      </View>

      <RideMap phase={phase} />

      {outsideZone && phase === 'request' && (
        <View style={styles.zoneBanner}>
          <AlertTriangle size={13} color={C.badge} />
          <Text style={styles.zoneBannerText}>
            Outside service area — rides available in Wadi El Gedid only.
          </Text>
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
          <Text style={styles.sheetTitle}>Book a ride</Text>

          <View style={{ gap: 10, marginTop: 16 }}>
            <PlacePicker label="📍  Pickup location" value={pickup} onSelect={setPickup} />
            <PlacePicker label="🏁  Where to?" value={dropoff} onSelect={setDropoff} />
          </View>

          {(priceEstimate !== null || loadingEstimate) && (
            <View style={[glassStyle, styles.priceCard, S.luxe]}>
              <View style={styles.priceRow}>
                <View style={styles.priceIcon}>
                  <Car size={17} color={C.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.priceLabel}>Economy ride</Text>
                  <Text style={styles.priceSub}>1–4 passengers</Text>
                </View>
                <Text style={styles.priceAmount}>
                  {loadingEstimate ? '…' : `EGP ${priceEstimate?.toFixed(2)}`}
                </Text>
              </View>
              {priceEstimate !== null && (
                <View style={styles.priceMeta}>
                  <Clock size={11} color={C.inkSoft} />
                  <Text style={styles.priceMetaText}>~{Math.ceil(priceEstimate / 12)} min away</Text>
                  <View style={styles.priceSep} />
                  <Banknote size={11} color={C.inkSoft} />
                  <Text style={styles.priceMetaText}>Wallet payment</Text>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, (!pickup || !dropoff || requesting) && styles.primaryBtnDisabled]}
            onPress={startFinding}
            disabled={!pickup || !dropoff || requesting}
            activeOpacity={0.85}
          >
            <Navigation size={15} color={C.white} />
            <Text style={styles.primaryBtnText}>
              {requesting ? 'Requesting…' : 'Confirm ride'}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
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
            <ArrowRight size={11} color={C.inkSoft} style={{ marginHorizontal: 6 }} />
            <View style={[styles.tripDot, { backgroundColor: C.accentMint }]} />
            <Text style={styles.tripStopText} numberOfLines={1}>{dropoff}</Text>
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={cancelRide} activeOpacity={0.8}>
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
              <Text style={styles.driverName}>{rideState.driver?.name ?? 'Driver'}</Text>
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
          </View>

          <View style={styles.tripSummaryRow}>
            <View style={[styles.tripDot, { backgroundColor: C.ink }]} />
            <Text style={styles.tripStopText} numberOfLines={1}>{pickup}</Text>
            <ArrowRight size={11} color={C.inkSoft} style={{ marginHorizontal: 6 }} />
            <View style={[styles.tripDot, { backgroundColor: C.accentMint }]} />
            <Text style={styles.tripStopText} numberOfLines={1}>{dropoff}</Text>
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={cancelRide} activeOpacity={0.8}>
            <Text style={styles.cancelBtnText}>{t('cancel_ride')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'arrived' && (
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={[glassStyle, styles.arrivedBanner, S.luxe]}>
            <CheckCircle size={22} color={C.accentMint} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>Driver has arrived!</Text>
              <Text style={styles.sheetSub}>Your driver is waiting at the pickup point.</Text>
            </View>
          </View>

          <View style={[glassStyle, styles.driverCard, S.luxe, { marginTop: 12 }]}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>{driverInitials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{rideState.driver?.name ?? 'Driver'}</Text>
              <Text style={styles.driverCarText}>{rideState.driver?.vehicle ?? ''}</Text>
            </View>
            {rideState.driver?.phone ? (
              <TouchableOpacity style={styles.callBtn} activeOpacity={0.8}>
                <PhoneCall size={15} color={C.accentMint} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}

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
              <Text style={styles.driverName}>{rideState.driver?.name ?? 'Driver'}</Text>
              <Text style={styles.driverCarText}>{rideState.driver?.vehicle ?? ''}</Text>
            </View>
            {priceEstimate !== null && (
              <View style={styles.tripPriceBadge}>
                <Text style={styles.tripPriceLabel}>EGP</Text>
                <Text style={styles.tripPriceAmount}>{priceEstimate?.toFixed(2)}</Text>
              </View>
            )}
          </View>

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
                  ? `Wallet · EGP ${priceEstimate.toFixed(2)}`
                  : 'Calculating fare…'}
              </Text>
            </View>
          </View>
        </View>
      )}
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
  tripStopText: { flex: 1, fontSize: 12, color: C.ink, marginLeft: 6 },

  cancelBtn: {
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: C.inkSoft },

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
    marginLeft: 4, marginVertical: 3,
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
});
