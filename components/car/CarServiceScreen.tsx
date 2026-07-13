import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  TextInput, Animated, Modal, Alert,
} from 'react-native';
import { AppLoader } from '@/components/ui/AppLoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { CheckCircle2, XCircle, ArrowLeft, ArrowRight, Search, MapPin, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { useRide } from '@/src/hooks/car/useRide';
import api from '@/src/api/client';
import { CarMap } from './CarMap';
import { RideOptionsSheet } from './RideOptionsSheet';
import { DriverSearching } from './DriverSearching';
import { DriverAssignedCard } from './DriverAssignedCard';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';
import { Shadows } from '@/constants/shadows';
import { VeeGoButton } from '@/components/ui/VeeGoButton';

interface Coords { latitude: number; longitude: number }
interface RideEstimate { economy: { price: number; eta: number }; premium: { price: number; eta: number } }

type CarPhase = 'idle' | 'selecting' | 'ride_options' | 'in_ride' | 'completed' | 'cancelled';

interface CarServiceScreenProps {
  onBack: () => void;
}

function makeStyles(c: ThemeColors, insetTop: number) {
  const inputBg     = c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)';
  const inputBorder = c.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)';
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0d0e22' },
    topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30, paddingTop: insetTop + 8 },
    topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.lg, paddingBottom: 10 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    titleBlock: { flex: 1 },
    topTitle: { color: 'rgba(255,255,255,0.75)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: Typography.weight.medium },
    topSubtitle: { color: '#ffffff', fontSize: Typography.size.md, fontWeight: Typography.weight.semibold, letterSpacing: -0.3 },
    notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    searchWrap: { paddingHorizontal: Spacing.lg, paddingBottom: 0 },
    searchBox: {
      flexDirection: 'row', alignItems: 'center', height: 52,
      borderRadius: 18, paddingHorizontal: Spacing.lg, gap: 10,
      backgroundColor: inputBg, borderWidth: 1.5, borderColor: inputBorder,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25, shadowRadius: 12, elevation: Shadows.large.elevation,
    },
    searchPlaceholder: { flex: 1, fontSize: Typography.size.sm, color: 'rgba(255,255,255,0.5)', fontWeight: Typography.weight.regular },
    destTag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(85,196,154,0.2)', borderRadius: 10, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
    destTagText: { fontSize: 11.5, color: '#55c49a', fontWeight: Typography.weight.medium, maxWidth: 120 },
    clearBtn: { padding: Spacing.xs },
    selectingModal: { flex: 1, backgroundColor: c.isDark ? '#0f0f1e' : '#f4f4f8' },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
      paddingTop: insetTop + 8,
      backgroundColor: c.isDark ? '#1a1a2e' : '#ffffff',
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    modalBackBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' },
    modalTitle: { fontSize: 17, fontWeight: Typography.weight.semibold, color: c.ink, flex: 1 },
    searchInputRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginHorizontal: Spacing.lg, marginVertical: Spacing.md, height: 48,
      borderRadius: Radius.lg, paddingHorizontal: 14, borderWidth: 1,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.white,
      borderColor: c.border,
    },
    searchInput: { flex: 1, fontSize: Typography.size.sm, color: c.ink },
    locItem: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      paddingHorizontal: 20, paddingVertical: 15,
      borderBottomWidth: 1, borderBottomColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.border,
    },
    locIcon: { width: 36, height: 36, borderRadius: Radius.md, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' },
    locText: { flex: 1, fontSize: 13.5, color: c.ink, fontWeight: Typography.weight.medium },
    emptyTip: { paddingHorizontal: 20, paddingTop: 40, alignItems: 'center', gap: 10 },
    emptyTipText: { fontSize: 13, color: c.inkSoft, textAlign: 'center' },
    card: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: c.isDark ? 'rgba(16,16,32,0.98)' : '#ffffff',
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      padding: Spacing.xl,
      elevation: 10, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16,
      shadowOffset: { width: 0, height: -4 },
      zIndex: 999,
    },
    cardInner: { alignItems: 'center', gap: 6 },
    cardTitle: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, letterSpacing: -0.3, fontFamily: 'Inter_700Bold' },
    cardSub: { fontSize: 13, textAlign: 'center' },
    invoice: { width: '100%', borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', marginVertical: Spacing.md },
    invoiceLabel: { fontSize: Typography.size.xs, fontWeight: Typography.weight.medium },
    invoiceAmount: { fontSize: 26, fontWeight: '800', color: '#10b981', marginTop: 2, letterSpacing: -0.5 },
    actionBtn: { width: '100%', height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xs },
    actionBtnTxt: { fontSize: 15, fontWeight: Typography.weight.bold },
    resumeOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 999, backgroundColor: 'rgba(13,14,34,0.82)',
      alignItems: 'center', justifyContent: 'center', gap: 14,
    },
    resumeText: { color: 'rgba(255,255,255,0.75)', fontSize: Typography.size.sm, fontWeight: Typography.weight.medium },
  });
}

function getGreetingKey(hour: number): 'good_morning' | 'good_afternoon' | 'good_evening' {
  if (hour >= 5 && hour < 12) return 'good_morning';
  if (hour >= 12 && hour < 17) return 'good_afternoon';
  return 'good_evening';
}

export function CarServiceScreen({ onBack }: CarServiceScreenProps) {
  const { colors: c, t, isRTL } = useTheme();
  const insets    = useSafeAreaInsets();
  const insetTop  = insets.top;
  const styles    = useMemo(() => makeStyles(c, insetTop), [c, insetTop]);

  const [phase, setPhase]               = useState<CarPhase>('idle');
  const [destination, setDestination]   = useState<string | null>(null);
  const [destCoords, setDestCoords]     = useState<Coords | null>(null);
  const [userCoords, setUserCoords]     = useState<Coords | null>(null);
  const [searchQuery, setSearchQuery]   = useState('');
  const [selectedRide, setSelectedRide] = useState<'economy' | 'premium' | null>(null);
  const [estimate, setEstimate]         = useState<RideEstimate | null>(null);
  const [estimateLoading, setEstLoading]= useState(false);
  const userCoordsRef = useRef<Coords | null>(null);

  const { rideState, requesting, requestRide, cancelRide, resetRide, resumeActiveRide } = useRide();
  const [resuming, setResuming] = useState(false);

  // On mount: check if there's an active ride in the backend and resume it
  useEffect(() => {
    let cancelled = false;
    setResuming(true);
    resumeActiveRide().then((resumed) => {
      if (cancelled) return;
      if (resumed?.dropoffAddress) setDestination(resumed.dropoffAddress);
    }).finally(() => {
      if (!cancelled) setResuming(false);
    });
    return () => { cancelled = true; };
  }, []);

  // Map rideState.status → phase (guard: only act when a real ride exists)
  useEffect(() => {
    const s = rideState.status;
    if (!rideState.rideId) return;
    if (['searching', 'driver_assigned', 'arrived', 'started'].includes(s)) {
      setPhase('in_ride');
    } else if (s === 'completed') {
      setPhase('completed');
    } else if (s === 'cancelled' || s === 'timeout') {
      setPhase('cancelled');
    }
  }, [rideState.status, rideState.rideId]);

  const fetchEstimate = useCallback(async (pickup: Coords, dropoff: Coords) => {
    setEstLoading(true);
    try {
      const { data } = await api.get('/rides/estimate', {
        params: {
          pickupLat: pickup.latitude, pickupLng: pickup.longitude,
          dropoffLat: dropoff.latitude, dropoffLng: dropoff.longitude,
        },
      });
      setEstimate({
        economy: { price: data.economy?.price ?? 0, eta: data.economy?.eta ?? 5 },
        premium: { price: data.premium?.price ?? 0, eta: data.premium?.eta ?? 8 },
      });
    } catch {
      setEstimate(null);
    } finally {
      setEstLoading(false);
    }
  }, []);

  const handleUserLocation = useCallback((loc: Coords) => {
    setUserCoords(loc);
    userCoordsRef.current = loc;
  }, []);

  const handleSelectDestination = useCallback(async (loc: string) => {
    Haptics.selectionAsync();
    setDestination(loc);
    setPhase('ride_options');

    try {
      const results = await Location.geocodeAsync(loc);
      if (results.length > 0) {
        const coords: Coords = { latitude: results[0].latitude, longitude: results[0].longitude };
        setDestCoords(coords);
        const pickup = userCoordsRef.current;
        if (pickup) fetchEstimate(pickup, coords);
      }
    } catch {}
  }, [fetchEstimate]);

  const handleConfirmRide = useCallback(async () => {
    if (!selectedRide) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const pickup = userCoordsRef.current;
    const dropoff = destCoords;
    if (!pickup || !dropoff) {
      Alert.alert(t('location_error'), t('location_error_msg'));
      return;
    }

    // Backend requires a non-empty pickupAddress — reverse-geocode the pickup
    // coordinates, falling back to a coordinate string if that fails.
    let pickupAddress = '';
    try {
      const results = await Location.reverseGeocodeAsync(pickup);
      if (results.length > 0) {
        const r = results[0];
        pickupAddress = [r.name, r.street, r.city].filter(Boolean).join(', ');
      }
    } catch {}
    if (!pickupAddress) {
      pickupAddress = `${pickup.latitude.toFixed(5)}, ${pickup.longitude.toFixed(5)}`;
    }

    const result = await requestRide({
      type: 'car',
      pickup:  { ...pickup,  address: pickupAddress },
      dropoff: { ...dropoff, address: destination ?? '' },
      notes: selectedRide,
    });

    if (!result.success) {
      Alert.alert(t('error'), result.error ?? t('request_ride_failed'));
    }
  }, [selectedRide, destCoords, destination, requestRide, t]);

  const handleReset = useCallback(() => {
    resetRide();
    setPhase('idle');
    setDestination(null);
    setDestCoords(null);
    setSelectedRide(null);
    setEstimate(null);
    setSearchQuery('');
  }, [resetRide]);

  const handleCancel = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (phase === 'in_ride' && rideState.rideId) {
      await cancelRide('Cancelled by passenger');
    }
    handleReset();
  }, [phase, rideState.rideId, cancelRide, handleReset]);

  const showDriverMarker = ['driver_assigned', 'arrived', 'started'].includes(rideState.status);

  return (
    <View style={styles.root}>
      {/* Resume overlay — shown briefly while checking for an active ride */}
      {resuming && (
        <View style={styles.resumeOverlay}>
          <AppLoader />
          <Text style={styles.resumeText}>{t('checking_active_ride')}</Text>
        </View>
      )}

      <CarMap
        driverLocation={rideState.driverLocation}
        destCoords={destCoords}
        showDriverMarker={showDriverMarker}
        onUserLocation={handleUserLocation}
      />


      {/* Destination modal */}
      <Modal visible={phase === 'selecting'} animationType="slide" onRequestClose={() => setPhase('idle')}>
        <View style={styles.selectingModal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.modalBackBtn} onPress={() => setPhase('idle')} activeOpacity={0.8}>
              {isRTL ? <ArrowRight size={18} color={c.ink} /> : <ArrowLeft size={18} color={c.ink} />}
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('choose_dest')}</Text>
          </View>

          <View style={styles.searchInputRow}>
            <Search size={15} color={c.inkSoft} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('search_dest')}
              placeholderTextColor={c.inkSoft}
              autoFocus
              textAlign={isRTL ? 'right' : 'left'}
              returnKeyType="go"
              onSubmitEditing={() => { if (searchQuery.trim()) handleSelectDestination(searchQuery.trim()); }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <XCircle size={16} color={c.silver} />
              </TouchableOpacity>
            )}
          </View>

          {searchQuery.trim().length > 0 ? (
            <TouchableOpacity style={styles.locItem} onPress={() => handleSelectDestination(searchQuery.trim())} activeOpacity={0.8}>
              <View style={styles.locIcon}>
                <MapPin size={16} color={c.inkSoft} />
              </View>
              <Text style={styles.locText}>{searchQuery.trim()}</Text>
              {isRTL ? <ChevronLeft size={14} color={c.silver} /> : <ChevronRight size={14} color={c.silver} />}
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyTip}>
              <Search size={28} color={c.silver} />
              <Text style={styles.emptyTipText}>{t('search_dest')}</Text>
            </View>
          )}
        </View>
      </Modal>

      {/* Ride options */}
      <RideOptionsSheet
        visible={phase === 'ride_options'}
        destination={destination}
        selected={selectedRide}
        onSelect={setSelectedRide}
        onConfirm={handleConfirmRide}
        onDismiss={handleReset}
        estimate={estimate}
        estimateLoading={estimateLoading}
        confirming={requesting}
      />

      {/* Searching */}
      <DriverSearching
        visible={phase === 'in_ride' && rideState.status === 'searching'}
        onCancel={handleCancel}
      />

      {/* Driver assigned / arrived / started */}
      <DriverAssignedCard
        visible={phase === 'in_ride' && ['driver_assigned', 'arrived', 'started'].includes(rideState.status)}
        rideType={selectedRide}
        destination={destination}
        driver={rideState.driver}
        rideId={rideState.rideId}
        rideStatus={rideState.status}
        waitingCharge={rideState.waitingCharge}
        waitingChargeStatus={rideState.waitingChargeStatus}
        onCancel={() => {
          Alert.alert(t('cancel_trip'), t('cancel_trip_q'), [
            { text: t('no_back'), style: 'cancel' },
            { text: t('yes_cancel'), style: 'destructive', onPress: handleCancel },
          ]);
        }}
      />

      {/* Completed */}
      {phase === 'completed' && (
        <View style={styles.card}>
          <View style={styles.cardInner}>
            <CheckCircle2 size={48} color="#10b981" />
            <Text style={[styles.cardTitle, { color: c.ink, marginTop: Spacing.sm }]}>{t('trip_complete')}</Text>
            <Text style={[styles.cardSub, { color: c.inkSoft }]}>{t('payment_paid')}</Text>
            {rideState.fare != null && (
              <View style={[styles.invoice, { backgroundColor: c.mist }]}>
                <Text style={[styles.invoiceLabel, { color: c.inkSoft }]}>{t('total_fare')}</Text>
                <Text style={styles.invoiceAmount}>{rideState.fare.toFixed(2)} {t('egp')}</Text>
              </View>
            )}
            <VeeGoButton
              title={t('done')}
              onPress={handleReset}
              variant="primary"
              size="large"
              style={{ width: '100%', height: 52, borderRadius: 18, marginTop: Spacing.xs, elevation: 0 }}
            />
          </View>
        </View>
      )}

      {/* Cancelled / Timeout */}
      {phase === 'cancelled' && (
        <View style={styles.card}>
          <View style={styles.cardInner}>
            <XCircle size={48} color="#ef4444" />
            <Text style={[styles.cardTitle, { color: c.ink, marginTop: Spacing.sm }]}>{t('cancel_trip')}</Text>
            {rideState.cancelReason ? (
              <Text style={[styles.cardSub, { color: c.inkSoft }]}>{rideState.cancelReason}</Text>
            ) : null}
            <VeeGoButton
              title={t('try_again')}
              onPress={handleReset}
              variant="primary"
              size="large"
              style={{ width: '100%', height: 52, borderRadius: 18, marginTop: Spacing.sm, elevation: 0 }}
            />
          </View>
        </View>
      )}
    </View>
  );
}
