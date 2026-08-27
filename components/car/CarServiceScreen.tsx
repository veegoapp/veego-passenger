import { useState, useRef, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  TextInput, Animated, ScrollView, Dimensions, Keyboard,
  // Modal removed — pickup/destination editing now uses the unified inline sheet.
  // KeyboardAvoidingView removed — it caused a jitter loop fighting Animated.spring.
} from 'react-native';
import { AppLoader } from '@/components/ui/AppLoader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Check, X, XCircle, ArrowLeft, ArrowRight, Search, MapPin, Map, ChevronLeft, ChevronRight, Navigation } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { usePaymentConfig } from '@/context/PaymentConfigContext';
import { useTabBar } from '@/context/TabBarContext';
import { useRide } from '@/src/hooks/car/useRide';
import { getRideEstimate } from '@/src/api/rideService';
import { getPlaceAutocomplete, getPlaceDetails, generateSessionToken, type PlaceSuggestion } from '@/src/api/placesService';
import { CancelReasonSheet } from '@/components/shared/CancelReasonSheet';
import { showAppAlert } from '@/components/shared/AppAlertHost';
import api from '@/src/api/client';
import { CarMap } from './CarMap';
import { PickupMapPicker } from './PickupMapPicker';
import { RideOptionsSheet } from './RideOptionsSheet';
import { DriverSearching } from './DriverSearching';
import { DriverAssignedCard } from './DriverAssignedCard';
import { TripCompletedSheet } from './TripCompletedSheet';
import { SafetySheet } from '@/components/shared/SafetySheet';
import { ConnectionBanner } from '@/components/shared/ConnectionBanner';
import { useRecentSearches } from '@/src/hooks/shared/useRecentSearches';
import { useWallet } from '@/src/hooks/shared/useWallet';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

interface Coords { latitude: number; longitude: number }
interface CarCategoryOption {
  slug:  string;
  name:  string;
  price: number;
}
interface RideEstimate {
  /** One entry per active car category from the backend (economy, economy_plus,
   *  comfort, ...) — was previously collapsed to just the cheapest/priciest
   *  entries, which silently dropped any category in between. */
  categories: CarCategoryOption[];
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

function makeStyles(c: ThemeColors, insetTop: number, insetBottom: number, tabBarHeight: number, sheetHeaderOffset: number) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },

    // ── Bottom idle panel (glassmorphism) ─────────────────────────────
    bottomContainer: {
      position: 'absolute', bottom: 16, left: 0, right: 0, zIndex: 30,
    },
    // Glassmorphic floating search card — same translucent-panel + hairline
    // border language as the Driver app's GlassView.
    glassCard: {
      marginHorizontal: 14,
      marginBottom: 10,
      borderRadius: 20,
      backgroundColor: c.isDark ? 'rgba(18,20,40,0.92)' : 'rgba(255,255,255,0.92)',
      borderWidth: 1,
      borderColor: c.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: c.isDark ? 0.45 : 0.14,
      shadowRadius: 22,
      // Translucent bg above: Android elevation would draw a square halo
      // around the rounded corners instead of following them.
      elevation: 0,
      overflow: 'hidden',
    },
    bottomPanel: {
      backgroundColor: c.isDark ? 'rgba(18,18,32,0.94)' : 'rgba(255,255,255,0.94)',
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      borderWidth: 1, borderColor: c.border, borderBottomWidth: 0,
      paddingBottom: tabBarHeight,
      shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12, shadowRadius: 16,
      // Translucent bg above: same square-halo issue on Android.
      elevation: 0,
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
      elevation: 10, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16,
      shadowOffset: { width: 0, height: -4 },
      zIndex: 999,
    },
    cardGlass: {
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0,
      padding: Spacing.xl,
      paddingBottom: insetBottom + Spacing.xl,
    },
    cardSurface: {
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
      borderWidth: 1, borderBottomWidth: 0,
      padding: Spacing.xl,
      paddingBottom: insetBottom + Spacing.xl,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 10,
    },
    cardInner: { alignItems: 'center', gap: 6 },
    statusBadge: {
      width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
      shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 6,
    },
    cardTitle: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, letterSpacing: -0.3, fontFamily: 'Inter_700Bold' },
    cardSub: { fontSize: 13, textAlign: 'center' },
    invoice: {
      width: '100%', borderRadius: Radius.lg, padding: Spacing.lg, alignItems: 'center', marginVertical: Spacing.md,
      borderWidth: 1, borderColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    invoiceLabel: { fontSize: Typography.size.xs, fontWeight: Typography.weight.medium },
    invoiceAmount: { fontSize: 30, fontWeight: '800', color: c.ink, marginTop: 2, letterSpacing: -0.8, fontFamily: 'Inter_700Bold' },
    actionBtn: { width: '100%', height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xs },
    actionBtnTxt: { fontSize: 15, fontWeight: Typography.weight.bold },
    resumeOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 999, backgroundColor: 'rgba(13,14,34,0.82)',
      alignItems: 'center', justifyContent: 'center', gap: 14,
    },
    resumeText: { color: 'rgba(255,255,255,0.75)', fontSize: Typography.size.sm, fontWeight: Typography.weight.medium },

    // ── Lovable CancelConfirmSheet card ──────────────────────────────────
    lvDragHandle: {
      width: 40, height: 5, borderRadius: 3,
      alignSelf: 'center', marginBottom: 20,
    },
    primaryActionBtn: {
      width: '100%' as any, height: 56, borderRadius: 16,
      alignItems: 'center' as any, justifyContent: 'center' as any,
      marginTop: 8,
      shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.18, shadowRadius: 20, elevation: 6,
    },
    primaryActionBtnText: {
      fontSize: 15.5, fontWeight: '600' as any,
      color: '#ffffff', letterSpacing: -0.15,
    },
    cancelIconCircle: {
      width: 56, height: 56, borderRadius: 28, borderWidth: 1,
      alignItems: 'center' as any, justifyContent: 'center' as any,
      marginBottom: 4,
    },
    ghostActionBtn: {
      width: '100%' as any, height: 56, borderRadius: 16, borderWidth: 1,
      alignItems: 'center' as any, justifyContent: 'center' as any,
      marginTop: 4,
    },
    ghostActionBtnText: { fontSize: 15, fontWeight: '600' as any },
  });
}

function getGreetingKey(hour: number): 'good_morning' | 'good_afternoon' | 'good_evening' {
  if (hour >= 5 && hour < 12) return 'good_morning';
  if (hour >= 12 && hour < 17) return 'good_afternoon';
  return 'good_evening';
}

export const CarServiceScreen = forwardRef<CarServiceScreenHandle, CarServiceScreenProps>(function CarServiceScreen({ onBack, serviceType = 'car', sheetHeaderOffset = 0 }, ref) {
  const { colors: c, t, isRTL, language } = useTheme();
  const insets      = useSafeAreaInsets();
  const insetTop    = insets.top;
  const { tabBarHeight } = useTabBar();
  const styles    = useMemo(() => makeStyles(c, insetTop, insets.bottom, tabBarHeight, sheetHeaderOffset), [c, insetTop, insets.bottom, tabBarHeight, sheetHeaderOffset]);

  // Phase 1: screen height used for expanded-sheet animation
  const SCREEN_H = Dimensions.get('window').height;

  const [phase, setPhase]               = useState<CarPhase>('idle');
  const [destination, setDestination]   = useState<string | null>(null);
  const [destCoords, setDestCoords]     = useState<Coords | null>(null);
  const [userCoords, setUserCoords]     = useState<Coords | null>(null);
  // Captured at ride-request time so the map can draw driverLocation → pickup
  // during the driver_assigned/arrived phase, then switch to driverLocation →
  // destCoords once the trip starts. Cleared on reset.
  const [pickupCoords, setPickupCoords] = useState<Coords | null>(null);
  // pickupQuery / destQuery / activeField replace the old single searchQuery — see expandSheet block below
  const [selectedRide, setSelectedRide] = useState<string | null>(null);
  const [safetyOpen, setSafetyOpen]     = useState(false);
  const [searchCancelSheetOpen, setSearchCancelSheetOpen] = useState(false);
  const { recents, addRecent }          = useRecentSearches(serviceType);
  const [estimate, setEstimate]         = useState<RideEstimate | null>(null);
  const [singleEstimate, setSingleEstimate] = useState<{ price: number; eta: number | null } | null>(null);
  // Live ETA (minutes) from CarMap while a driver is en route — surfaced in
  // the driver card's dark ETA panel.
  const [driverEta, setDriverEta] = useState<number | null>(null);
  const [estimateLoading, setEstLoading]= useState(false);
  const [recipientName, setRecipientName]   = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [paymentMethod, setPaymentMethod]   = useState<'cash' | 'wallet'>('cash');
  const userCoordsRef = useRef<Coords | null>(null);
  // The device's actual GPS location, kept separate from the *pickup point*.
  // `userCoords`/`userCoordsRef` hold the pickup that gets booked; this ref
  // only ever tracks the live GPS fix so "Use current location" can return to
  // it and so a late GPS fix never overwrites a manually-chosen pickup.
  const deviceLocationRef = useRef<Coords | null>(null);
  // True once the passenger has explicitly chosen a pickup different from their
  // GPS location. While true, live GPS updates must NOT overwrite the pickup.
  const pickupIsCustomRef = useRef(false);

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

  // Backend-proxied Google Places autocomplete for both the pickup and
  // destination fields (Car/Scooter/Delivery share this component). One
  // session token per opened sheet, reused across keystrokes for either field
  // and refreshed after each resolved selection to close the Google billing
  // session. `placeResults` holds the suggestions for whichever field is
  // currently active.
  const [placeSessionToken, setPlaceSessionToken] = useState<string | null>(null);
  const [placeResults, setPlaceResults]           = useState<PlaceSuggestion[]>([]);

  /** Slide the sheet up and focus the correct field after the animation
   *  completes — decouples keyboard from spring to prevent jitter. */
  const expandSheet = useCallback((field: 'pickup' | 'destination') => {
    setActiveField(field);
    setIsDestExpanded(true);
    setPlaceResults([]);
    setPlaceSessionToken(generateSessionToken());
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
      setPlaceResults([]);
      setPlaceSessionToken(null);
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
      // Mark the pickup as manually chosen so subsequent live GPS fixes don't
      // clobber it back to the device location.
      pickupIsCustomRef.current = true;
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

  // ── "Set pickup on map" (Uber/Careem-style drag-a-pin picker) ─────────────
  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  const openMapPicker = useCallback(() => {
    Keyboard.dismiss();
    setMapPickerVisible(true);
  }, []);
  const handleMapPickerConfirm = useCallback((coords: Coords, address: string) => {
    setMapPickerVisible(false);
    // Reuse the custom-pickup path: sets pickupIsCustomRef so the live GPS fix
    // won't overwrite this choice, updates the pickup coords/label, and
    // auto-advances focus to the destination field.
    handleSelectPickup(address, coords);
  }, [handleSelectPickup]);

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
  // Backend-confirmed live balance (GET /wallet) — gates the wallet toggle
  // in RideOptionsSheet independently of the feature-flag above.
  const { balance: walletBalance } = useWallet();

  // Phase 2: pass serviceType so resumeActiveRide only picks up rides that
  // belong to this tab — prevents state leakage across car/scooter/delivery.
  const { rideState, requesting, requestRide, cancelRide, resetRide, resumeActiveRide } = useRide(serviceType);
  const [resuming, setResuming] = useState(false);

  // On mount: check if there's an active ride in the backend and resume it
  useEffect(() => {
    let cancelled = false;
    setResuming(true);
    resumeActiveRide().then((resumed) => {
      if (cancelled) return;
      if (resumed?.dropoffAddress) setDestination(resumed.dropoffAddress);
      if (resumed?.dropoffLatitude != null && resumed?.dropoffLongitude != null) {
        setDestCoords({
          latitude: resumed.dropoffLatitude,
          longitude: resumed.dropoffLongitude,
        });
      }
      // Restore pickup coords from the snapshot so the map draws
      // driverLocation → pickup during driver_assigned/arrived phases,
      // even after an app restart (snapshot always carries pickup lat/lng).
      if (resumed?.pickupLatitude != null && resumed?.pickupLongitude != null) {
        setPickupCoords({
          latitude: resumed.pickupLatitude,
          longitude: resumed.pickupLongitude,
        });
      }
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
    } else if (
      (s === 'cancelled' || s === 'timeout') &&
      // The terminal Cancel Trip card is only for outcomes the passenger
      // didn't choose (driver cancel / no-show / request timeout).
      // cancelRide() stamps terminationReason: 'passenger' in the exact same
      // state write as status: 'cancelled', so this is decided by the data
      // itself, not by timing — a self-initiated cancel can never reach this
      // branch no matter how handleCancel()'s reset happens to interleave.
      rideState.terminationReason !== 'passenger'
    ) {
      setPhase('cancelled');
    }
  }, [rideState.status, rideState.rideId, rideState.terminationReason]);

  // Rapidly re-selecting a destination can fire multiple fetchEstimate calls
  // whose responses can resolve out of order — this sequence guard ensures
  // only the response for the *latest* call is ever applied.
  const estimateRequestSeqRef = useRef(0);

  const fetchEstimate = useCallback(async (pickup: Coords, dropoff: Coords) => {
    const seq = ++estimateRequestSeqRef.current;
    setEstLoading(true);
    try {
      const data = await getRideEstimate(pickup, dropoff, serviceType);
      if (seq !== estimateRequestSeqRef.current) return; // superseded — discard
      if (serviceType === 'car') {
        const categories: Array<{ slug: string; name: string; estimatedPrice: number }> = data.categories ?? [];
        setEstimate({
          categories: categories.map((cat) => ({ slug: cat.slug, name: cat.name, price: cat.estimatedPrice })),
        });
      } else {
        // Scooter/delivery pricing is single-rate on the backend — no
        // economy/premium split, just one estimatedPrice. eta stays null
        // (never a fabricated fallback) when the backend omits it — the
        // card hides the ETA row entirely rather than show a fake minute count.
        setSingleEstimate({ price: data.estimatedPrice ?? 0, eta: data.durationMinutes ?? null });
      }
    } catch {
      if (seq !== estimateRequestSeqRef.current) return; // superseded — discard
      setEstimate(null);
      setSingleEstimate(null);
    } finally {
      if (seq === estimateRequestSeqRef.current) setEstLoading(false);
    }
  }, [serviceType]);

  const handleUserLocation = useCallback((loc: Coords) => {
    // Always remember the real device position.
    deviceLocationRef.current = loc;
    // Only let the live GPS fix drive the pickup while the passenger hasn't
    // explicitly picked a different pickup point. Without this guard, a
    // late-arriving High-accuracy GPS fix (it can take several seconds) — or a
    // map remount re-fetch — overwrites a manually-chosen pickup right before
    // the ride is booked, so the trip is created from the wrong spot and the
    // driver hits "must be within 150m of pickup" at the location the
    // passenger actually chose.
    if (pickupIsCustomRef.current) return;
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

  // Debounced Places autocomplete for whichever field is active. Fires only
  // while the sheet is open and a session token exists; needs ≥2 chars (Google
  // and the backend both reject shorter input). Aborts the in-flight request
  // on each keystroke/field switch so only the latest query's results show.
  useEffect(() => {
    if (!isDestExpanded || !placeSessionToken) return;
    const query = (activeField === 'pickup' ? pickupQuery : destQuery).trim();
    if (query.length < 2) { setPlaceResults([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const bias = userCoords ? { lat: userCoords.latitude, lng: userCoords.longitude } : undefined;
        const results = await getPlaceAutocomplete(
          query,
          placeSessionToken,
          language === 'ar' ? 'ar' : 'en',
          bias,
          controller.signal,
          serviceType,
        );
        setPlaceResults(results);
      } catch { /* aborted or failed — leave prior results, field falls back to raw-text entry */ }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [isDestExpanded, placeSessionToken, activeField, pickupQuery, destQuery, language, serviceType, userCoords]);

  // Resolve a tapped suggestion to real coordinates via /places/details, then
  // hand off to the existing pickup/destination handlers (which accept known
  // coords and skip local geocoding). Refresh the session token afterwards so
  // the next search starts a fresh Google billing session.
  const handleSelectPlace = useCallback(async (item: PlaceSuggestion) => {
    const token = placeSessionToken;
    if (!token) return;
    const field = activeField;
    let details = null;
    try {
      details = await getPlaceDetails(item.placeId, token, serviceType);
    } catch { details = null; }
    setPlaceResults([]);
    setPlaceSessionToken(generateSessionToken());
    if (!details) {
      showAppAlert(t('location_error'), t('location_error_msg'));
      return;
    }
    const coords: Coords = { latitude: details.latitude, longitude: details.longitude };
    const label = details.address || details.name || item.description;
    if (field === 'pickup') {
      handleSelectPickup(label, coords);
    } else {
      handleSelectDestination(label, coords);
    }
  }, [placeSessionToken, activeField, serviceType, handleSelectPickup, handleSelectDestination, t]);

  const renderPlaceRow = useCallback((item: PlaceSuggestion) => (
    <TouchableOpacity
      key={`place-${item.placeId}`}
      style={styles.locItem}
      onPress={() => handleSelectPlace(item)}
      activeOpacity={0.8}
    >
      <View style={styles.locIcon}><MapPin size={16} color={c.inkSoft} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.locText} numberOfLines={1}>{item.mainText || item.description}</Text>
        {!!item.secondaryText && (
          <Text style={[styles.locText, { fontSize: 12, color: c.inkSoft }]} numberOfLines={1}>{item.secondaryText}</Text>
        )}
      </View>
      {isRTL ? <ChevronLeft size={14} color={c.silver} /> : <ChevronRight size={14} color={c.silver} />}
    </TouchableOpacity>
  ), [styles, c, isRTL, handleSelectPlace]);

  const handleConfirmRide = useCallback(async () => {
    if (!selectedRide) return;
    if (serviceType === 'delivery' && (!recipientName.trim() || !recipientPhone.trim())) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const pickup = userCoordsRef.current;
    const dropoff = destCoords;
    if (!pickup || !dropoff) {
      showAppAlert(t('location_error'), t('location_error_msg'));
      return;
    }

    // Store pickup coords so the map can draw driverLocation → pickup while
    // the driver is en route (driver_assigned / arrived phases).
    setPickupCoords({ latitude: pickup.latitude, longitude: pickup.longitude });

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

    // selectedRide holds the real car-category slug directly for car rides —
    // 'standard' (scooter/delivery) has no category split, so no categorySlug
    // is sent for it (unchanged dispatch behavior).
    const categorySlug = serviceType === 'car' ? (selectedRide ?? undefined) : undefined;

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
        showAppAlert(
          t('insufficient_balance_title'),
          t('insufficient_balance_msg')
            .replace('{required}', String(result.insufficientBalance.required))
            .replace('{balance}', String(result.insufficientBalance.balance)),
        );
      } else {
        showAppAlert(t('error'), result.error ?? t('request_ride_failed'));
      }
    }
  }, [selectedRide, estimate, destCoords, destination, requestRide, t, serviceType, recipientName, recipientPhone, paymentMethod]);

  const handleReset = useCallback(() => {
    resetRide();
    setPhase('idle');
    setDestination(null);
    setDestCoords(null);
    setPickupCoords(null);
    // New booking starts fresh: pickup follows GPS again until the passenger
    // explicitly picks a custom one.
    pickupIsCustomRef.current = false;
    setPickupAddress('');
    if (deviceLocationRef.current) {
      userCoordsRef.current = deviceLocationRef.current;
      setUserCoords({ ...deviceLocationRef.current });
    }
    setSelectedRide(null);
    setEstimate(null);
    setSingleEstimate(null);
    setRecipientName('');
    setRecipientPhone('');
    setPaymentMethod('cash');
    setPickupQuery('');
    setDestQuery('');
    setPlaceResults([]);
    setPlaceSessionToken(null);
    setIsDestExpanded(false);
    destSheetTop.setValue(SCREEN_H);
  }, [resetRide, destSheetTop, SCREEN_H]);

  // Combined fare + inline-rating sheet (Lovable's CompletedSheet behavior) is
  // the only post-trip UI now — there's no separate receipt screen to hand
  // off to, so "Done" just submits the rating (if any) and resets to a fresh
  // booking. A skipped rating (stars === 0) still proceeds — rating stays
  // optional, matching Lovable's unconditional "OK" button.
  const handleCompletedDone = useCallback(async (stars: number, comment: string) => {
    const finishedRideId = rideState.rideId;
    if (stars > 0 && finishedRideId) {
      try {
        await api.post(`/rides/${finishedRideId}/rate-driver`, { rating: stars, comment });
      } catch {
        // Non-fatal — rating is best-effort; nothing left downstream to retry it.
      }
    }
    handleReset();
    // Return to the Home screen instead of leaving the passenger parked on a
    // fresh booking form for this service.
    onBack();
  }, [rideState.rideId, handleReset, onBack]);

  const handleCancel = useCallback(async (reason?: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (phase === 'in_ride' && rideState.rideId) {
      const result = await cancelRide(reason || 'Cancelled by passenger');
      if (!result.success) {
        showAppAlert(t('error'), result.error ?? t('cancel_error'));
        return;
      }
      // Only show a wallet refund message when the passenger actually paid via
      // wallet or card — cash rides never receive a wallet credit even if the
      // backend returns a non-zero refundAmount.
      if (paymentMethod !== 'cash' && result.refundAmount && result.refundAmount > 0) {
        showAppAlert(t('ride_cancelled_title'), t('ride_refund_msg').replace('{amount}', String(result.refundAmount)));
      } else {
        showAppAlert(t('ride_cancelled_title'), t('ride_cancelled_msg'));
      }
    }
    handleReset();
  }, [phase, rideState.rideId, cancelRide, handleReset, t, paymentMethod]);

  // Stable identities for DriverAssignedCard's callback props — it's wrapped
  // in React.memo, and inline arrow functions here would give it a new prop
  // every render (defeating the memo) even though rideState only changes on
  // driver-location ticks that this card doesn't otherwise care about.
  const handleAssignedCancelPress = useCallback(() => {
    showAppAlert(t('cancel_trip'), t('cancel_trip_q'), [
      { text: t('no_back'), style: 'cancel' },
      { text: t('yes_cancel'), style: 'destructive', onPress: handleCancel },
    ]);
  }, [t, handleCancel]);

  const handleSOSPress = useCallback(() => setSafetyOpen(true), []);

  useImperativeHandle(ref, () => ({
    selectDestination: handleSelectDestination,
  }), [handleSelectDestination]);

  const showDriverMarker = ['driver_assigned', 'arrived', 'started'].includes(rideState.status);

  // Phase-aware map destination:
  //   driver_assigned / arrived → driverLocation → pickup point
  //   started (and all other states) → driverLocation → final dropoff
  // pickupCoords is set at ride-request time. For resumed rides it may be null
  // (snapshot doesn't carry pickup lat/lng), in which case userCoords is used
  // as the best available approximation of the pickup location.
  const mapDestCoords = ['driver_assigned', 'arrived'].includes(rideState.status)
    ? (pickupCoords ?? userCoords)
    : destCoords;

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
    rideState.terminationReason === 'no_show' && paymentMethod !== 'cash' && rideState.refundAmount && rideState.refundAmount > 0
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
        rideId={rideState.rideId}
        destCoords={mapDestCoords}
        showDriverMarker={showDriverMarker}
        onUserLocation={handleUserLocation}
        serviceType={serviceType}
        driverColorHex={rideState.driver?.vehicleColorHex}
        searching={phase === 'in_ride' && rideState.status === 'searching'}
        hideOwnLocationDot={rideState.status === 'started'}
        onEtaChange={setDriverEta}
      />

      {/* ── Close-to-Home affordance ──────────────────────────────────────
          The outer Home screen's back-arrow overlay was removed for this
          full-screen layout (matches the driver app's ride screen), which
          left iOS with no way to leave this screen — there's no hardware
          back gesture here, and the tab bar is hidden while it's open.
          A small, minimal "X" fills that gap. Scoped to idle/ride_options
          only: once a ride is actually being searched/tracked, this would
          collide with the nav card / connection banner (same top-left area)
          and duplicate the trip's own explicit Cancel flow
          (DriverAssignedCard's Cancel button) — a stray "leave" affordance
          during an active trip isn't wanted there anyway. */}
      {(phase === 'idle' || phase === 'ride_options') && (
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            position: 'absolute',
            top: insetTop + 12,
            left: 16,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(0,0,0,0.35)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 40,
          }}
          accessibilityLabel={t('close')}
          accessibilityRole="button"
        >
          <X size={18} color="#ffffff" strokeWidth={2.5} />
        </TouchableOpacity>
      )}

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
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />
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
                    <View style={[styles.routeDot, { backgroundColor: c.primary }]} />
                    <View style={styles.routeLine} />
                    <View style={[styles.routeDot, { backgroundColor: c.accent }]} />
                  </View>

                  <View style={{ flex: 1, gap: 6 }}>
                    {/* ── Pickup row ── */}
                    <TouchableOpacity
                      activeOpacity={1}
                      onPress={() => { setActiveField('pickup'); pickupInputRef.current?.focus(); }}
                      style={[
                        styles.fieldRow,
                        activeField === 'pickup' && styles.fieldRowActive,
                        { borderColor: activeField === 'pickup' ? c.primary : (c.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)') },
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
                        { borderColor: activeField === 'destination' ? c.accent : (c.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)') },
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
                            // Reset the pickup back to the REAL device GPS
                            // location (not userCoordsRef, which may now hold a
                            // custom pickup), and clear the custom flag so live
                            // GPS resumes driving the pickup.
                            const gps = deviceLocationRef.current ?? userCoordsRef.current;
                            if (gps) {
                              pickupIsCustomRef.current = false;
                              setPickupAddress('');
                              setPickupQuery('');
                              userCoordsRef.current = gps;
                              // Re-trigger reverse-geocode by nudging userCoords
                              setUserCoords({ ...gps });
                              setActiveField('destination');
                              destInputRef.current?.focus();
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.locIcon, { backgroundColor: c.primary + '1F' }]}>
                            <MapPin size={16} color={c.primary} />
                          </View>
                          <Text style={[styles.locText, { color: c.primary }]}>{t('current_location')}</Text>
                          {isRTL ? <ChevronLeft size={14} color={c.primary} /> : <ChevronRight size={14} color={c.primary} />}
                        </TouchableOpacity>
                        {/* Set pickup by dragging a pin on the map (Uber/Careem-style) */}
                        <TouchableOpacity
                          style={styles.locItem}
                          onPress={openMapPicker}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.locIcon, { backgroundColor: c.primary + '1F' }]}>
                            <Map size={16} color={c.primary} />
                          </View>
                          <Text style={[styles.locText, { color: c.primary }]}>{t('set_location_on_map')}</Text>
                          {isRTL ? <ChevronLeft size={14} color={c.primary} /> : <ChevronRight size={14} color={c.primary} />}
                        </TouchableOpacity>
                        {placeResults.length > 0 ? (
                          placeResults.map(renderPlaceRow)
                        ) : (
                          <TouchableOpacity
                            style={styles.locItem}
                            onPress={() => handleSelectPickup(pickupQuery.trim())}
                            activeOpacity={0.8}
                          >
                            <View style={styles.locIcon}><MapPin size={16} color={c.inkSoft} /></View>
                            <Text style={styles.locText}>{pickupQuery.trim()}</Text>
                            {isRTL ? <ChevronLeft size={14} color={c.silver} /> : <ChevronRight size={14} color={c.silver} />}
                          </TouchableOpacity>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Always show "Use current GPS location" at top for pickup */}
                        <TouchableOpacity
                          style={styles.locItem}
                          onPress={() => {
                            // Reset the pickup back to the REAL device GPS
                            // location and clear the custom flag.
                            const gps = deviceLocationRef.current ?? userCoordsRef.current;
                            setPickupAddress('');
                            setPickupQuery('');
                            if (gps) {
                              pickupIsCustomRef.current = false;
                              userCoordsRef.current = gps;
                              setUserCoords({ ...gps });
                            }
                            setActiveField('destination');
                            destInputRef.current?.focus();
                          }}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.locIcon, { backgroundColor: c.primary + '1F' }]}>
                            <MapPin size={16} color={c.primary} />
                          </View>
                          <Text style={[styles.locText, { color: c.primary }]}>{t('current_location')}</Text>
                          {isRTL ? <ChevronLeft size={14} color={c.primary} /> : <ChevronRight size={14} color={c.primary} />}
                        </TouchableOpacity>
                        {/* Set pickup by dragging a pin on the map (Uber/Careem-style) */}
                        <TouchableOpacity
                          style={styles.locItem}
                          onPress={openMapPicker}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.locIcon, { backgroundColor: c.primary + '1F' }]}>
                            <Map size={16} color={c.primary} />
                          </View>
                          <Text style={[styles.locText, { color: c.primary }]}>{t('set_location_on_map')}</Text>
                          {isRTL ? <ChevronLeft size={14} color={c.primary} /> : <ChevronRight size={14} color={c.primary} />}
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
                      placeResults.length > 0 ? (
                        <>{placeResults.map(renderPlaceRow)}</>
                      ) : (
                        <TouchableOpacity
                          style={styles.locItem}
                          onPress={() => handleSelectDestination(destQuery.trim())}
                          activeOpacity={0.8}
                        >
                          <View style={styles.locIcon}><MapPin size={16} color={c.inkSoft} /></View>
                          <Text style={styles.locText}>{destQuery.trim()}</Text>
                          {isRTL ? <ChevronLeft size={14} color={c.silver} /> : <ChevronRight size={14} color={c.silver} />}
                        </TouchableOpacity>
                      )
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

      {/* Realtime connection indicator — live phases only. Single source of the
          "reconnecting" strip (driven purely by the socket connection state).
          Suppressed during 'searching' because the socket is still initialising
          after ride creation; this is expected and not a real outage.
          NOTE: a second, separate reconnecting pill driven by `pollingStale`
          used to live here. It showed the SAME word while the socket was
          actually connected (REST status-poll lagging), producing a false
          "Reconnecting…" and a duplicate source. Removed so the socket banner
          below is the only thing that can surface that word. */}
      {phase === 'in_ride' && rideState.status !== 'searching' && (
        <ConnectionBanner style={{ position: 'absolute', top: insets.top + 60, alignSelf: 'center', zIndex: 50 }} />
      )}

      {/* Nav card — destination only (no live time/distance, kept off to avoid
          spending Google Directions). Target is the pickup while the driver is
          on the way, the dropoff during the trip.
          Sizing matches the driver app's destination card exactly
          (veego-driver/app/ride/[rideId].tsx: navCard/navIcon styles) —
          Spacing.lg padding, Spacing.md gap, 20 corner radius, 48x48/14-radius
          icon box. The icon box is solid #111827 (near-black) rather than the
          previous dark-blue #1e3a8a, matching the driver app's dark icon box. */}
      {phase === 'in_ride' && rideState.status !== 'searching' && (() => {
        const navTarget = rideState.status === 'started' ? destination : pickupAddress;
        if (!navTarget) return null;
        return (
          <View style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, zIndex: 55 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
              backgroundColor: c.isDark ? 'rgba(18,20,40,0.92)' : 'rgba(255,255,255,0.92)',
              borderRadius: 20, padding: Spacing.lg,
              borderWidth: 1, borderColor: c.border,
              shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
              shadowOpacity: c.isDark ? 0.45 : 0.14, shadowRadius: 22, elevation: 0,
            }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' }}>
                <Navigation size={20} color="#ffffff" strokeWidth={2} />
              </View>
              <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: '700', color: c.ink }}>
                {navTarget}
              </Text>
            </View>
          </View>
        );
      })()}


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
        walletBalance={walletBalance}
      />

      {/* Searching */}
      <DriverSearching
        visible={phase === 'in_ride' && rideState.status === 'searching'}
        onCancel={() => setSearchCancelSheetOpen(true)}
      />

      <CancelReasonSheet
        visible={searchCancelSheetOpen}
        mode="ride"
        onClose={() => setSearchCancelSheetOpen(false)}
        onConfirm={async (reason) => {
          setSearchCancelSheetOpen(false);
          await handleCancel(reason);
        }}
      />

      {/* Driver assigned / arrived / started */}
      <DriverAssignedCard
        visible={phase === 'in_ride' && ['driver_assigned', 'arrived', 'started'].includes(rideState.status)}
        carCategoryName={estimate?.categories.find((cat) => cat.slug === selectedRide)?.name}
        serviceType={serviceType}
        destination={destination}
        driver={rideState.driver}
        rideId={rideState.rideId}
        rideStatus={rideState.status}
        etaMinutes={driverEta}
        waitingCharge={rideState.waitingCharge}
        waitingChargeStatus={rideState.waitingChargeStatus}
        onCancel={handleAssignedCancelPress}
        onSOS={handleSOSPress}
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

      {/* Uber/Careem-style "drag a pin on the map" pickup picker */}
      <PickupMapPicker
        visible={mapPickerVisible}
        initialCoords={userCoords ?? deviceLocationRef.current}
        onCancel={() => setMapPickerVisible(false)}
        onConfirm={handleMapPickerConfirm}
      />

      {/* Completed — fare summary + inline rating in one sheet (Lovable CompletedSheet) */}
      <TripCompletedSheet
        visible={phase === 'completed'}
        fare={rideState.fare ?? null}
        grossFare={rideState.grossFare ?? null}
        promoDiscount={rideState.promoDiscount ?? null}
        walletDeduction={rideState.walletDeduction ?? null}
        paymentMethodLabel={paymentMethod === 'wallet' ? t('payment_methods_wallet') : t('payment_methods_cash')}
        driverName={rideState.driver?.name ?? null}
        pickup={pickupAddress || null}
        dropoff={destination}
        onDone={handleCompletedDone}
      />

      {/* Cancelled / Timeout — Lovable CancelConfirmSheet design */}
      {phase === 'cancelled' && (
        <View style={styles.card}>
          <View style={[styles.cardSurface, { backgroundColor: c.isDark ? '#1a1a2e' : '#ffffff', borderColor: c.isDark ? '#2c2c46' : '#e5e5ea' }]}>
            {/* Drag handle */}
            <View style={[styles.lvDragHandle, { backgroundColor: c.isDark ? '#2c2c46' : '#e5e5ea' }]} />

            <View style={styles.cardInner}>
              {/* X icon */}
              <View style={[styles.cancelIconCircle, { backgroundColor: `${c.error}14`, borderColor: `${c.error}25` }]}>
                <X size={28} color={c.error} strokeWidth={2.2} />
              </View>

              <Text style={[styles.cardTitle, { color: c.ink }]}>{cancelTitle}</Text>
              {cancelSubtitle ? (
                <Text style={[styles.cardSub, { color: c.inkSoft }]}>{cancelSubtitle}</Text>
              ) : null}

              <TouchableOpacity
                onPress={handleReset}
                activeOpacity={0.88}
                style={[styles.primaryActionBtn, { backgroundColor: c.primary }]}
              >
                <Text style={styles.primaryActionBtnText}>{t('try_again')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleReset}
                activeOpacity={0.75}
                style={[styles.ghostActionBtn, { borderColor: c.isDark ? '#2c2c46' : '#e5e5ea', backgroundColor: c.isDark ? '#16162a' : '#f7f8fc' }]}
              >
                <Text style={[styles.ghostActionBtnText, { color: c.ink }]}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
});
