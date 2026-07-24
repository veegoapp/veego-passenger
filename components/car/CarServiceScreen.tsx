import { useState, useRef, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  TextInput, Animated, Alert, ScrollView, Dimensions, Keyboard,
  // Modal removed — pickup/destination editing now uses the unified inline sheet.
  // KeyboardAvoidingView removed — it caused a jitter loop fighting Animated.spring.
} from 'react-native';
import { router } from 'expo-router';
import { AppLoader } from '@/components/ui/AppLoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { CheckCircle2, XCircle, ArrowLeft, ArrowRight, Search, MapPin, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { usePaymentConfig } from '@/context/PaymentConfigContext';
import { useTabBar } from '@/context/TabBarContext';
import { useRide } from '@/src/hooks/car/useRide';
import { useNearbyDrivers } from '@/src/hooks/car/useNearbyDrivers';
import { getRideEstimate } from '@/src/api/rideService';
import { CarMap } from './CarMap';
import { RideOptionsSheet } from './RideOptionsSheet';
import { DriverSearching } from './DriverSearching';
import { DriverAssignedCard } from './DriverAssignedCard';
import { SafetySheet } from '@/components/shared/SafetySheet';
import { ConnectionBanner } from '@/components/shared/ConnectionBanner';
import { useRecentSearches } from '@/src/hooks/shared/useRecentSearches';
import { useSocketConnectionState } from '@/src/hooks/shared/useSocketConnectionState';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';
import { VeeGoButton } from '@/components/ui/VeeGoButton';

interface Coords { latitude: number; longitude: number }
interface RideEstimate {
  economy: { price: number; eta: number };
  premium: { price: number; eta: number };
  /** Real car-category slugs backing the economy/premium tiers, straight from
   *  the estimate response's `categories[]` (same cheapest/priciest positions
   *  the backend itself used to derive the economy/premium price fields). */
  economySlug?: string;
  premiumSlug?: string;
}

type CarPhase = 'idle' | 'ride_options' | 'in_ride' | 'completed' | 'cancelled';
// 'selecting' phase (old full-screen modal) is removed — pickup and destination
// editing both happen inside the unified inline expanded sheet.

interface CarServiceScreenProps {
  onBack: () => void;
  /** Defaults to 'car' — preserves existing Ride behavior unchanged. */
  serviceType?: 'car' | 'scooter' | 'delivery';
  /** Pixels to offset the top overlay downward when rendered inside a sheet
   *  that already has its own header bar (e.g. the home sheet header = 64px).
   *  Defaults to 0 (full-screen standalone usage). */
  sheetHeaderOffset?: number;
}

// Lets a parent (the home screen's destination search) hand off a selected
// destination to the ride flow without duplicating handleSelectDestination's
// geocode/estimate/phase logic. `coordinates` lets a caller that already
// resolved the address (e.g. Google Places Details) skip the internal
// re-geocode entirely.
export interface CarServiceScreenHandle {
  selectDestination: (address: string, coordinates?: { latitude: number; longitude: number }) => void;
}

function makeStyles(c: ThemeColors, insetTop: number, tabBarHeight: number, sheetHeaderOffset: number) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0d0e22' },

    // ── Bottom idle panel (glassmorphism) ─────────────────────────────
    bottomContainer: {
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
    },
    // Glassmorphic floating search card
    glassCard: {
      marginHorizontal: 14,
      marginBottom: 10,
      borderRadius: 20,
      backgroundColor: c.isDark ? 'rgba(18,20,40,0.92)' : 'rgba(255,255,255,0.92)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: c.isDark ? 0.45 : 0.14,
      shadowRadius: 22,
      elevation: 10,
      overflow: 'hidden',
    },
    bottomPanel: {
      backgroundColor: c.isDark ? 'rgba(18,18,32,0.94)' : 'rgba(255,255,255,0.94)',
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      paddingBottom: tabBarHeight,
      shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12, shadowRadius: 16, elevation: 12,
    },
    dragHandle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.15)',
      alignSelf: 'center', marginTop: 10, marginBottom: 6,
    },
    locationRow: {
      paddingHorizontal: 20, paddingVertical: 14,
    },
    locationLabel: {
      fontSize: 11, fontWeight: Typography.weight.medium as any,
      // Phase 1: #1A1A1A in light mode for crisp contrast
      color: c.isDark ? 'rgba(255,255,255,0.55)' : '#1A1A1A',
      marginBottom: 4, letterSpacing: 0.1,
    },
    locationAddress: {
      fontSize: 15, fontWeight: Typography.weight.semibold as any,
      // Phase 1: #1A1A1A in light mode for crisp contrast
      color: c.isDark ? '#ffffff' : '#1A1A1A',
      letterSpacing: -0.2,
    },
    fieldDivider: {
      height: 1,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
      marginHorizontal: 20,
    },
    whereToRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 20, paddingVertical: 18, gap: 10,
    },
    whereToText: {
      flex: 1, fontSize: 15,
      // Phase 1: #666666 in light mode for placeholder contrast
      color: c.isDark ? 'rgba(255,255,255,0.38)' : '#666666',
      fontWeight: Typography.weight.regular as any,
    },
    destinationText: {
      flex: 1, fontSize: 15, fontWeight: Typography.weight.semibold as any,
      color: c.isDark ? '#ffffff' : '#1A1A1A', letterSpacing: -0.2,
    },

    // ── Expanded inline destination search ───────────────────────────
    expandedHeader: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 10,
    },
    expandedBackBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
      alignItems: 'center', justifyContent: 'center',
    },
    expandedTitle: {
      fontSize: 16, fontWeight: Typography.weight.semibold as any,
      color: c.isDark ? '#ffffff' : '#1A1A1A', flex: 1,
    },
    expandedSearchRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginHorizontal: 16, marginBottom: 8, height: 48,
      borderRadius: Radius.lg, paddingHorizontal: 14,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
      borderWidth: 1,
      borderColor: c.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.09)',
    },
    expandedSearchInput: {
      flex: 1, fontSize: Typography.size.sm,
      color: c.isDark ? '#ffffff' : '#1A1A1A',
    },

    // ── Recents section (sits directly above the glass panel) ─────────
    recentsWrap: {
      backgroundColor: c.isDark ? 'rgba(18,18,32,0.82)' : 'rgba(255,255,255,0.82)',
      paddingTop: Spacing.sm,
    },
    recentsTitle: {
      fontSize: 13, fontWeight: Typography.weight.semibold as any,
      color: c.inkSoft, paddingHorizontal: 20, paddingBottom: Spacing.xs,
    },
    recentRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingHorizontal: 20, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
    },
    recentRowText: {
      flex: 1, fontSize: 14.5,
      fontWeight: Typography.weight.medium as any, color: c.ink,
    },
    // ── Two-field (pickup + destination) block inside the expanded sheet ──
    twoFieldBlock: {
      flexDirection: 'row', alignItems: 'stretch',
      marginHorizontal: 16, marginBottom: 4, gap: 10,
    },
    routeLineWrap: {
      width: 14, alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 14,
    },
    routeDot: { width: 10, height: 10, borderRadius: 5 },
    routeLine: {
      flex: 1, width: 2, marginVertical: 3,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
    },
    fieldRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      height: 46, borderRadius: Radius.lg, paddingHorizontal: 12,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
      borderWidth: 1.5,
      borderColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    },
    fieldRowActive: {
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    fieldInput: {
      flex: 1, fontSize: Typography.size.sm,
    },
    locItem: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      paddingHorizontal: 20, paddingVertical: 15,
      borderBottomWidth: 1, borderBottomColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.border,
    },
    locIcon: { width: 36, height: 36, borderRadius: Radius.md, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' },
    locText: { flex: 1, fontSize: 13.5, color: c.ink, fontWeight: Typography.weight.medium },
    emptyTip: { paddingHorizontal: 20, paddingTop: 40, alignItems: 'center', gap: 10 },
    recentsHeader: {
      fontSize: 12, fontWeight: Typography.weight.bold, color: c.inkSoft,
      textTransform: 'uppercase', letterSpacing: 0.6,
      paddingHorizontal: 20, paddingTop: Spacing.md, paddingBottom: Spacing.xs,
    },
    emptyTipText: { fontSize: 13, color: c.inkSoft, textAlign: 'center' },
    card: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: c.isDark ? 'rgba(16,16,32,0.98)' : '#ffffff',
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      padding: Spacing.xl,
      paddingBottom: tabBarHeight + Spacing.xl,
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

export const CarServiceScreen = forwardRef<CarServiceScreenHandle, CarServiceScreenProps>(function CarServiceScreen({ onBack, serviceType = 'car', sheetHeaderOffset = 0 }, ref) {
  const { colors: c, t, isRTL } = useTheme();
  const insets      = useSafeAreaInsets();
  const insetTop    = insets.top;
  const { tabBarHeight } = useTabBar();
  const styles    = useMemo(() => makeStyles(c, insetTop, tabBarHeight, sheetHeaderOffset), [c, insetTop, tabBarHeight, sheetHeaderOffset]);

  // Phase 1: screen height used for expanded-sheet animation
  const SCREEN_H = Dimensions.get('window').height;

  const [phase, setPhase]               = useState<CarPhase>('idle');
  const [destination, setDestination]   = useState<string | null>(null);
  const [destCoords, setDestCoords]     = useState<Coords | null>(null);
  const [userCoords, setUserCoords]     = useState<Coords | null>(null);
  // pickupQuery / destQuery / activeField replace the old single searchQuery — see expandSheet block below
  const [selectedRide, setSelectedRide] = useState<'economy' | 'premium' | 'standard' | null>(null);
  const [safetyOpen, setSafetyOpen]     = useState(false);
  const { recents, addRecent }          = useRecentSearches(serviceType);
  const [estimate, setEstimate]         = useState<RideEstimate | null>(null);
  const [singleEstimate, setSingleEstimate] = useState<{ price: number; eta: number } | null>(null);
  const [estimateLoading, setEstLoading]= useState(false);
  const [recipientName, setRecipientName]   = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [paymentMethod, setPaymentMethod]   = useState<'cash' | 'wallet'>('cash');
  const userCoordsRef = useRef<Coords | null>(null);

  // ── Unified inline location sheet ────────────────────────────────────────
  // Single sheet handles both pickup and destination editing.
  // `activeField` controls which row is focused and which handler fires on
  // suggestion tap. No old full-screen modal — everything lives here.
  const [isDestExpanded, setIsDestExpanded] = useState(false);
  const [activeField, setActiveField]       = useState<'pickup' | 'destination'>('destination');
  const [pickupQuery, setPickupQuery]       = useState('');
  const [destQuery, setDestQuery]           = useState('');
  const destSheetTop   = useRef(new Animated.Value(SCREEN_H)).current;
  const pickupInputRef = useRef<TextInput>(null);
  const destInputRef   = useRef<TextInput>(null);

  /** Slide the sheet up and focus the correct field after the animation
   *  completes — decouples keyboard from spring to prevent jitter. */
  const expandSheet = useCallback((field: 'pickup' | 'destination') => {
    setActiveField(field);
    setIsDestExpanded(true);
    Haptics.selectionAsync();
    Animated.spring(destSheetTop, {
      toValue: insetTop + 60,
      useNativeDriver: false,
      tension: 62,
      friction: 11,
    }).start(() => {
      if (field === 'pickup') {
        pickupInputRef.current?.focus();
      } else {
        destInputRef.current?.focus();
      }
    });
  }, [destSheetTop, insetTop]);

  const collapseSheet = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(destSheetTop, {
      toValue: SCREEN_H,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      setIsDestExpanded(false);
      setPickupQuery('');
      setDestQuery('');
      destSheetTop.setValue(SCREEN_H);
    });
  }, [destSheetTop, SCREEN_H]);

  /** User typed or picked a custom pickup address.
   *  Geocodes if needed, updates userCoords, then auto-advances to destination. */
  const handleSelectPickup = useCallback(async (address: string, knownCoords?: Coords) => {
    Haptics.selectionAsync();
    setPickupAddress(address);
    setPickupQuery('');

    const applyCoords = (coords: Coords) => {
      setUserCoords(coords);
      userCoordsRef.current = coords;
    };

    if (knownCoords) {
      applyCoords(knownCoords);
    } else {
      try {
        const results = await Location.geocodeAsync(address);
        if (results.length > 0) {
          applyCoords({ latitude: results[0].latitude, longitude: results[0].longitude });
        }
      } catch { /* use whatever coords we already have */ }
    }

    // Auto-advance: switch focus to the destination field so the user can
    // immediately type where they want to go.
    setActiveField('destination');
    destInputRef.current?.focus();
  }, []);

  // Reverse-geocode the user's position for the "Your Location" label.
  // Best-effort: never blocks the UI. Shows t('current_location') until resolved.
  const [pickupAddress, setPickupAddress] = useState<string>('');
  useEffect(() => {
    if (!userCoords) return;
    let cancelled = false;
    Location.reverseGeocodeAsync(userCoords)
      .then((results) => {
        if (cancelled || results.length === 0) return;
        const r = results[0];
        const addr = [r.name, r.street, r.city].filter(Boolean).join(', ');
        if (addr) setPickupAddress(addr);
      })
      .catch(() => { /* fail silently — UI falls back to t('current_location') */ });
    return () => { cancelled = true; };
  }, [userCoords]);

  const { walletFeature } = usePaymentConfig();
  const walletAvailable = walletFeature.isEnabled && walletFeature.displayMode === 'live';

  // Phase 2: pass serviceType so resumeActiveRide only picks up rides that
  // belong to this tab — prevents state leakage across car/scooter/delivery.
  const { rideState, requesting, requestRide, cancelRide, resetRide, resumeActiveRide, pollingStale } = useRide(serviceType);
  const [resuming, setResuming] = useState(false);
  const socketConnectionState = useSocketConnectionState();

  // Nearby-driver markers — pre-booking only. Stops the moment a ride is
  // requested or the phase moves past ride_options; CarServiceScreen itself
  // unmounts when the passenger leaves this service on Home, which tears the
  // hook's interval down via its own cleanup.
  const nearbyDriversActive = ['idle', 'ride_options'].includes(phase) && !requesting;
  const { drivers: nearbyDrivers } = useNearbyDrivers({
    isActive: nearbyDriversActive,
    location: userCoords,
    serviceType,
  });

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
      const data = await getRideEstimate(pickup, dropoff, serviceType);
      if (serviceType === 'car') {
        const categories: Array<{ slug: string }> | undefined = data.categories;
        setEstimate({
          economy: { price: data.economy?.price ?? 0, eta: data.economy?.eta ?? 5 },
          premium: { price: data.premium?.price ?? 0, eta: data.premium?.eta ?? 8 },
          economySlug: categories?.[0]?.slug,
          premiumSlug: categories?.[categories.length - 1]?.slug,
        });
      } else {
        // Scooter/delivery pricing is single-rate on the backend — no
        // economy/premium split, just one estimatedPrice.
        setSingleEstimate({ price: data.estimatedPrice ?? 0, eta: data.durationMinutes ?? 5 });
      }
    } catch {
      setEstimate(null);
      setSingleEstimate(null);
    } finally {
      setEstLoading(false);
    }
  }, [serviceType]);

  const handleUserLocation = useCallback((loc: Coords) => {
    setUserCoords(loc);
    userCoordsRef.current = loc;
  }, []);

  const handleSelectDestination = useCallback(async (loc: string, knownCoords?: Coords) => {
    Haptics.selectionAsync();
    // Collapse the inline sheet immediately before switching phase.
    setIsDestExpanded(false);
    destSheetTop.setValue(SCREEN_H);
    setDestQuery('');
    setPickupQuery('');
    setDestination(loc);
    setPhase('ride_options');
    // Scooter/delivery have a single pricing tier — no economy/premium pick
    // required, so pre-select it (car keeps requiring an explicit choice).
    if (serviceType !== 'car') setSelectedRide('standard');

    // A previously-resolved recent search already has coordinates — skip
    // re-geocoding and use them directly.
    if (knownCoords) {
      setDestCoords(knownCoords);
      addRecent(loc, knownCoords);
      const pickup = userCoordsRef.current;
      if (pickup) fetchEstimate(pickup, knownCoords);
      return;
    }

    try {
      const results = await Location.geocodeAsync(loc);
      if (results.length > 0) {
        const coords: Coords = { latitude: results[0].latitude, longitude: results[0].longitude };
        setDestCoords(coords);
        addRecent(loc, coords);
        const pickup = userCoordsRef.current;
        if (pickup) fetchEstimate(pickup, coords);
      } else {
        addRecent(loc);
      }
    } catch {
      addRecent(loc);
    }
  }, [fetchEstimate, serviceType, addRecent]);

  const handleConfirmRide = useCallback(async () => {
    if (!selectedRide) return;
    if (serviceType === 'delivery' && (!recipientName.trim() || !recipientPhone.trim())) return;
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

    // Map the selected tier to the real car-category slug the backend gave us
    // in the estimate response — 'standard' (scooter/delivery) has no category
    // split, so no categorySlug is sent for it (unchanged dispatch behavior).
    const categorySlug = selectedRide === 'economy' ? estimate?.economySlug
      : selectedRide === 'premium' ? estimate?.premiumSlug
      : undefined;

    const result = await requestRide({
      type: serviceType,
      pickup:  { ...pickup,  address: pickupAddress },
      dropoff: { ...dropoff, address: destination ?? '' },
      ...(categorySlug ? { categorySlug } : {}),
      ...(serviceType === 'delivery' ? { recipientName: recipientName.trim(), recipientPhone: recipientPhone.trim() } : {}),
      paymentMethod,
    });

    if (!result.success) {
      if (result.insufficientBalance) {
        Alert.alert(
          t('insufficient_balance_title'),
          t('insufficient_balance_msg')
            .replace('{required}', String(result.insufficientBalance.required))
            .replace('{balance}', String(result.insufficientBalance.balance)),
        );
      } else {
        Alert.alert(t('error'), result.error ?? t('request_ride_failed'));
      }
    }
  }, [selectedRide, estimate, destCoords, destination, requestRide, t, serviceType, recipientName, recipientPhone, paymentMethod]);

  const handleReset = useCallback(() => {
    resetRide();
    setPhase('idle');
    setDestination(null);
    setDestCoords(null);
    setSelectedRide(null);
    setEstimate(null);
    setSingleEstimate(null);
    setRecipientName('');
    setRecipientPhone('');
    setPaymentMethod('cash');
    setPickupQuery('');
    setDestQuery('');
    setIsDestExpanded(false);
    destSheetTop.setValue(SCREEN_H);
  }, [resetRide, destSheetTop, SCREEN_H]);

  // Reuses the existing receipt.tsx + RatingSheet flow (already wired to
  // POST /rides/:id/rate-driver) so a normal in-app ride completion, not just
  // the deep-link path, gives the passenger a chance to rate the driver.
  const handleFinishRide = useCallback(() => {
    const finishedRideId = rideState.rideId;
    if (finishedRideId) {
      router.push({
        pathname: '/receipt',
        params: {
          rideId: finishedRideId,
          ...(rideState.fare != null ? { fare: String(rideState.fare) } : {}),
          ...(destination ? { dropoff: destination } : {}),
          ...(rideState.driver?.name ? { driverName: rideState.driver.name } : {}),
          ...(rideState.driver?.rating != null ? { driverRating: String(rideState.driver.rating) } : {}),
        },
      } as any);
    }
    handleReset();
  }, [rideState.rideId, rideState.fare, rideState.driver, destination, handleReset]);

  const handleCancel = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (phase === 'in_ride' && rideState.rideId) {
      const result = await cancelRide('Cancelled by passenger');
      if (!result.success) {
        Alert.alert(t('error'), result.error ?? t('cancel_error'));
        return;
      }
      if (result.refundAmount && result.refundAmount > 0) {
        Alert.alert(
          t('ride_cancelled_title'),
          t('ride_refund_msg').replace('{amount}', String(result.refundAmount)),
        );
      }
    }
    handleReset();
  }, [phase, rideState.rideId, cancelRide, handleReset, t]);

  useImperativeHandle(ref, () => ({
    selectDestination: handleSelectDestination,
  }), [handleSelectDestination]);

  const showDriverMarker = ['driver_assigned', 'arrived', 'started'].includes(rideState.status);

  // F6: differentiate the terminal-cancelled card's title/message by cause
  // (driver cancelled / no-show / request timeout / passenger cancelled)
  // instead of always showing the same generic "Cancel Trip" text.
  const cancelTitle = rideState.terminationReason === 'timeout' ? t('status_request_timeout') : t('cancel_trip');
  const cancelSubtitleBase =
    rideState.cancelReason ??
    (rideState.terminationReason === 'driver' ? t('driver_cancelled_msg')
      : rideState.terminationReason === 'no_show' ? t('no_show_cancelled_msg')
      : rideState.terminationReason === 'passenger' ? t('passenger_cancelled_msg')
      : null);
  const cancelSubtitle =
    rideState.terminationReason === 'no_show' && rideState.refundAmount && rideState.refundAmount > 0
      ? `${cancelSubtitleBase ?? ''} ${t('ride_refund_msg').replace('{amount}', String(rideState.refundAmount))}`.trim()
      : cancelSubtitleBase;

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
        nearbyDrivers={showDriverMarker ? undefined : nearbyDrivers}
      />

      {/* ── Idle state: floating glassmorphic search card + inline expanded search ── */}
      {phase === 'idle' && (
        <Animated.View
          style={[
            styles.bottomContainer,
            // Phase 1: when expanded, animate `top` upward so the sheet
            // slides up over the map. When collapsed top is unset (natural height).
            isDestExpanded ? { top: destSheetTop } : {},
          ]}
        >
          {/* ── COLLAPSED STATE: recents above + glassmorphic card ── */}
          {!isDestExpanded && (
            <>
              {/* Recents sit directly above the glass card */}
              {recents.length > 0 && (
                <View style={styles.recentsWrap}>
                  <Text style={styles.recentsTitle}>{t('recent_searches')}</Text>
                  {recents.slice(0, 3).map((loc) => (
                    <TouchableOpacity
                      key={loc.address}
                      style={styles.recentRow}
                      onPress={() => handleSelectDestination(
                        loc.address,
                        loc.latitude != null && loc.longitude != null
                          ? { latitude: loc.latitude, longitude: loc.longitude }
                          : undefined,
                      )}
                      activeOpacity={0.75}
                    >
                      <MapPin size={15} color={c.inkSoft} />
                      <Text style={styles.recentRowText} numberOfLines={1}>{loc.address}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Glassmorphic floating search card */}
              <View style={styles.glassCard}>
                {/* Drag handle pill */}
                <View style={styles.dragHandle} />

                {/* Row 1: Your Location — opens unified sheet with pickup focused */}
                <TouchableOpacity
                  style={styles.locationRow}
                  onPress={() => expandSheet('pickup')}
                  activeOpacity={0.85}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                    <Text style={styles.locationLabel}>{t('your_location')}</Text>
                  </View>
                  <Text style={styles.locationAddress} numberOfLines={1}>
                    {pickupAddress || t('current_location')}
                  </Text>
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.fieldDivider} />

                {/* Row 2: Where to? — opens unified sheet with destination focused */}
                <TouchableOpacity
                  style={styles.whereToRow}
                  onPress={destination ? undefined : () => expandSheet('destination')}
                  activeOpacity={destination ? 1 : 0.82}
                >
                  <Search size={15} color={c.isDark ? 'rgba(255,255,255,0.4)' : '#999999'} />
                  {destination ? (
                    <>
                      <Text style={styles.destinationText} numberOfLines={1}>{destination}</Text>
                      <TouchableOpacity
                        onPress={() => { setDestination(null); setDestCoords(null); }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <XCircle size={16} color={c.inkSoft} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={styles.whereToText}>{t('where_to')}</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Bottom safe-area padding */}
              <View style={{ height: 8, backgroundColor: 'transparent' }} />
            </>
          )}

          {/* ── EXPANDED STATE: unified pickup + destination sheet ── */}
          {isDestExpanded && (
            // No KeyboardAvoidingView — sheet is position:absolute so keyboard
            // overlays from below without fighting the spring animation.
            <View style={{ flex: 1 }}>
              <View style={[styles.bottomPanel, { flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 0 }]}>
                {/* Drag handle */}
                <View style={styles.dragHandle} />

                {/* Header */}
                <View style={styles.expandedHeader}>
                  <TouchableOpacity style={styles.expandedBackBtn} onPress={collapseSheet} activeOpacity={0.75}>
                    {isRTL
                      ? <ArrowRight size={17} color={c.isDark ? '#ffffff' : '#1A1A1A'} />
                      : <ArrowLeft  size={17} color={c.isDark ? '#ffffff' : '#1A1A1A'} />
                    }
                  </TouchableOpacity>
                  <Text style={styles.expandedTitle}>{t('choose_dest')}</Text>
                </View>

                {/* Two-row input block: Pickup → Destination */}
                <View style={styles.twoFieldBlock}>
                  {/* Route line connector */}
                  <View style={styles.routeLineWrap}>
                    <View style={[styles.routeDot, { backgroundColor: '#10b981' }]} />
                    <View style={styles.routeLine} />
                    <View style={[styles.routeDot, { backgroundColor: c.badge ?? '#8B6FD4' }]} />
                  </View>

                  <View style={{ flex: 1, gap: 6 }}>
                    {/* ── Pickup row ── */}
                    <TouchableOpacity
                      activeOpacity={1}
                      onPress={() => { setActiveField('pickup'); pickupInputRef.current?.focus(); }}
                      style={[
                        styles.fieldRow,
                        activeField === 'pickup' && styles.fieldRowActive,
                        { borderColor: activeField === 'pickup' ? '#10b981' : (c.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)') },
                      ]}
                    >
                      <TextInput
                        ref={pickupInputRef}
                        style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left', color: c.isDark ? '#ffffff' : '#1A1A1A' }]}
                        value={pickupQuery}
                        onChangeText={setPickupQuery}
                        onFocus={() => setActiveField('pickup')}
                        placeholder={pickupAddress || t('current_location')}
                        placeholderTextColor={c.isDark ? 'rgba(255,255,255,0.4)' : '#888888'}
                        returnKeyType="next"
                        onSubmitEditing={() => {
                          if (pickupQuery.trim()) handleSelectPickup(pickupQuery.trim());
                          else destInputRef.current?.focus();
                        }}
                      />
                      {pickupQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setPickupQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <XCircle size={15} color={c.inkSoft} />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>

                    {/* ── Destination row ── */}
                    <TouchableOpacity
                      activeOpacity={1}
                      onPress={() => { setActiveField('destination'); destInputRef.current?.focus(); }}
                      style={[
                        styles.fieldRow,
                        activeField === 'destination' && styles.fieldRowActive,
                        { borderColor: activeField === 'destination' ? (c.badge ?? '#8B6FD4') : (c.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)') },
                      ]}
                    >
                      <TextInput
                        ref={destInputRef}
                        style={[styles.fieldInput, { textAlign: isRTL ? 'right' : 'left', color: c.isDark ? '#ffffff' : '#1A1A1A' }]}
                        value={destQuery}
                        onChangeText={setDestQuery}
                        onFocus={() => setActiveField('destination')}
                        placeholder={t('where_to')}
                        placeholderTextColor={c.isDark ? 'rgba(255,255,255,0.35)' : '#888888'}
                        returnKeyType="go"
                        onSubmitEditing={() => {
                          if (destQuery.trim()) handleSelectDestination(destQuery.trim());
                        }}
                      />
                      {destQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setDestQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <XCircle size={15} color={c.inkSoft} />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Suggestions list — filtered by active field's query */}
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingBottom: 40 }}
                  automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
                >
                  {activeField === 'pickup' ? (
                    /* ── Pickup suggestions ── */
                    pickupQuery.trim().length > 0 ? (
                      <>
                        {/* Use GPS option always available when typing a custom pickup */}
                        <TouchableOpacity
                          style={styles.locItem}
                          onPress={() => {
                            // Reset to GPS: clear custom pickup address so reverse-geocode label shows again
                            if (userCoordsRef.current) {
                              setPickupAddress('');
                              setPickupQuery('');
                              // Re-trigger reverse-geocode by nudging userCoords
                              setUserCoords({ ...userCoordsRef.current });
                              setActiveField('destination');
                              destInputRef.current?.focus();
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.locIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                            <MapPin size={16} color="#10b981" />
                          </View>
                          <Text style={[styles.locText, { color: '#10b981' }]}>{t('current_location')}</Text>
                          {isRTL ? <ChevronLeft size={14} color="#10b981" /> : <ChevronRight size={14} color="#10b981" />}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.locItem}
                          onPress={() => handleSelectPickup(pickupQuery.trim())}
                          activeOpacity={0.8}
                        >
                          <View style={styles.locIcon}><MapPin size={16} color={c.inkSoft} /></View>
                          <Text style={styles.locText}>{pickupQuery.trim()}</Text>
                          {isRTL ? <ChevronLeft size={14} color={c.silver} /> : <ChevronRight size={14} color={c.silver} />}
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        {/* Always show "Use current GPS location" at top for pickup */}
                        <TouchableOpacity
                          style={styles.locItem}
                          onPress={() => {
                            setPickupAddress('');
                            setPickupQuery('');
                            if (userCoordsRef.current) setUserCoords({ ...userCoordsRef.current });
                            setActiveField('destination');
                            destInputRef.current?.focus();
                          }}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.locIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                            <MapPin size={16} color="#10b981" />
                          </View>
                          <Text style={[styles.locText, { color: '#10b981' }]}>{t('current_location')}</Text>
                          {isRTL ? <ChevronLeft size={14} color="#10b981" /> : <ChevronRight size={14} color="#10b981" />}
                        </TouchableOpacity>
                        {recents.length > 0 && (
                          <>
                            <Text style={styles.recentsHeader}>{t('recent_searches')}</Text>
                            {recents.map((loc) => (
                              <TouchableOpacity
                                key={loc.address}
                                style={styles.locItem}
                                onPress={() => handleSelectPickup(
                                  loc.address,
                                  loc.latitude != null && loc.longitude != null
                                    ? { latitude: loc.latitude, longitude: loc.longitude }
                                    : undefined,
                                )}
                                activeOpacity={0.8}
                              >
                                <View style={styles.locIcon}><Search size={16} color={c.inkSoft} /></View>
                                <Text style={styles.locText}>{loc.address}</Text>
                                {isRTL ? <ChevronLeft size={14} color={c.silver} /> : <ChevronRight size={14} color={c.silver} />}
                              </TouchableOpacity>
                            ))}
                          </>
                        )}
                      </>
                    )
                  ) : (
                    /* ── Destination suggestions ── */
                    destQuery.trim().length > 0 ? (
                      <TouchableOpacity
                        style={styles.locItem}
                        onPress={() => handleSelectDestination(destQuery.trim())}
                        activeOpacity={0.8}
                      >
                        <View style={styles.locIcon}><MapPin size={16} color={c.inkSoft} /></View>
                        <Text style={styles.locText}>{destQuery.trim()}</Text>
                        {isRTL ? <ChevronLeft size={14} color={c.silver} /> : <ChevronRight size={14} color={c.silver} />}
                      </TouchableOpacity>
                    ) : recents.length > 0 ? (
                      <>
                        <Text style={styles.recentsHeader}>{t('recent_searches')}</Text>
                        {recents.map((loc) => (
                          <TouchableOpacity
                            key={loc.address}
                            style={styles.locItem}
                            onPress={() => handleSelectDestination(
                              loc.address,
                              loc.latitude != null && loc.longitude != null
                                ? { latitude: loc.latitude, longitude: loc.longitude }
                                : undefined,
                            )}
                            activeOpacity={0.8}
                          >
                            <View style={styles.locIcon}><Search size={16} color={c.inkSoft} /></View>
                            <Text style={styles.locText}>{loc.address}</Text>
                            {isRTL ? <ChevronLeft size={14} color={c.silver} /> : <ChevronRight size={14} color={c.silver} />}
                          </TouchableOpacity>
                        ))}
                      </>
                    ) : (
                      <View style={styles.emptyTip}>
                        <Search size={28} color={c.silver} />
                        <Text style={styles.emptyTipText}>{t('search_dest')}</Text>
                      </View>
                    )
                  )}
                </ScrollView>
              </View>
            </View>
          )}
        </Animated.View>
      )}

      {/* Realtime connection indicator — live phases only */}
      {phase === 'in_ride' && (
        <ConnectionBanner style={{ position: 'absolute', top: insets.top + 60, alignSelf: 'center', zIndex: 50 }} />
      )}

      {/* Phase 3: the status-polling fallback (useRide's `pollingStale`) already
          tracked whether it's failing to reach the server, but nothing showed
          it. Only surfaced when the socket itself is connected — otherwise
          ConnectionBanner above already covers it — so this never stacks. */}
      {phase === 'in_ride' && pollingStale && socketConnectionState === 'connected' && (
        <View
          style={{
            position: 'absolute', top: insets.top + 60, alignSelf: 'center', zIndex: 50,
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: '#d97706', paddingVertical: 6, paddingHorizontal: Spacing.md,
            borderRadius: 99,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: Typography.weight.bold }}>{t('reconnecting')}</Text>
        </View>
      )}


      {/* Ride options */}
      <RideOptionsSheet
        visible={phase === 'ride_options'}
        destination={destination}
        selected={selectedRide}
        onSelect={setSelectedRide}
        onConfirm={handleConfirmRide}
        onDismiss={handleReset}
        estimate={estimate}
        singleEstimate={singleEstimate}
        estimateLoading={estimateLoading}
        confirming={requesting}
        serviceType={serviceType}
        recipientName={recipientName}
        recipientPhone={recipientPhone}
        onRecipientNameChange={setRecipientName}
        onRecipientPhoneChange={setRecipientPhone}
        paymentMethod={paymentMethod}
        onPaymentMethodChange={setPaymentMethod}
        walletAvailable={walletAvailable}
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
        onSOS={() => setSafetyOpen(true)}
      />

      <SafetySheet
        visible={safetyOpen}
        onClose={() => setSafetyOpen(false)}
        rideId={rideState.rideId}
        driverName={rideState.driver?.name}
        vehicle={rideState.driver?.vehicle}
        plate={rideState.driver?.plateNumber}
        fallbackCoords={userCoordsRef.current}
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
              onPress={handleFinishRide}
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
            <Text style={[styles.cardTitle, { color: c.ink, marginTop: Spacing.sm }]}>{cancelTitle}</Text>
            {cancelSubtitle ? (
              <Text style={[styles.cardSub, { color: c.inkSoft }]}>{cancelSubtitle}</Text>
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
});
