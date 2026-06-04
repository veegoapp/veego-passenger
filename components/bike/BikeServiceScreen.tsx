import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  TextInput, FlatList, Animated, Modal, Alert, PanResponder,
} from 'react-native';
import { ArrowLeft, ArrowRight, Bell, XCircle, Search, Clock, MapPin, ChevronLeft, ChevronRight, Bike, User, ArrowRightCircle, Star, MessageCircle, Phone, X, Tag } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { useRecentSearches } from '@/hooks/useRecentSearches';
import { RatingSheet } from '@/components/shared/RatingSheet';
import { useRide } from '@/src/hooks/useRide';
import { usePromos } from '@/src/hooks/usePromos';
import { ChatModal } from '@/components/car/ChatModal';
import { BikeMap } from '@/components/bike/BikeMap';

function fmtSecs(s: number): string {
  if (s <= 0) return '0:00';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

type BikePhase = 'idle' | 'selecting' | 'ride_options' | 'searching' | 'driver_assigned' | 'completed';

interface BikeServiceScreenProps {
  onBack: () => void;
  embedded?: boolean;
}

const WADI_LOCS_AR = [
  'الخارجة - وسط المدينة', 'الداخلة - موط', 'بلاط', 'قصر الداخلة',
  'الفرافرة', 'باريس', 'بلاط الجديدة', 'موط - الشمال',
  'سوق الخارجة', 'مستشفى الخارجة',
  'محطة الخارجة', 'مطار الخارجة', 'جامعة وادي الجديد',
];
const WADI_LOCS_EN = [
  'Al-Kharga Downtown', 'Dakhla - Mut', 'Balat', 'Qasr Dakhla',
  'Farafra', 'Baris', 'New Balat', 'Mut North',
  'Kharga Market', 'Kharga Hospital',
  'Kharga Station', 'Kharga Airport', 'Wadi El Gedid University',
];

const MOCK_RIDER = {
  name: 'محمد علي',
  nameEn: 'Mohamed Ali',
  initials: 'مع',
  initialsEn: 'MA',
  vehicle: 'Honda 150',
  plate: 'WG 5678',
  rating: 4.9,
  trips: 843,
  eta: 2,
  phone: '+201234567890',
  color: '#55c49a',
};

const DISMISS_THRESHOLD = 80;
const CURRENT_LOCATION_EN = 'Wadi El Gedid — My location';
const CURRENT_LOCATION_AR = 'وادي الجديد — موقعي الحالي';

function makeStyles(c: ThemeColors, insetTop: number) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0d0e22' },
    topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30, paddingTop: insetTop + 8 },
    topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    titleBlock: { flex: 1 },
    topTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '500' },
    topSubtitle: { color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
    notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    searchWrap: { paddingHorizontal: 16 },
    searchCard: {
      marginHorizontal: 16, borderRadius: 20, overflow: 'hidden',
      backgroundColor: 'rgba(20,22,45,0.92)', borderWidth: 1, borderColor: 'rgba(85,196,154,0.18)',
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
    },
    fromRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
    fromDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#55c49a', borderWidth: 2, borderColor: 'rgba(85,196,154,0.35)' },
    fromText: { flex: 1, fontSize: 13.5, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
    dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginLeft: 38, marginRight: 16 },
    toRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
    toDot: { width: 10, height: 10, borderRadius: 2, backgroundColor: '#e07055' },
    toText: { flex: 1, fontSize: 13.5, fontWeight: '500', color: 'rgba(255,255,255,0.4)' },
    destTagText: { fontSize: 13.5, color: '#55c49a', fontWeight: '600', flex: 1 },
    clearBtn: { padding: 4 },
    mapMock: { flex: 1, backgroundColor: '#0d0e22', alignItems: 'center', justifyContent: 'center' },
    mapGrid: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    mapDot: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#55c49a', top: '45%', left: '48%', borderWidth: 3, borderColor: '#fff', shadowColor: '#55c49a', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8, elevation: 8 },
    bikeBadge: { backgroundColor: 'rgba(85,196,154,0.15)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(85,196,154,0.3)' },
    bikeBadgeText: { color: '#55c49a', fontSize: 13, fontWeight: '600' },
    selectingModal: { flex: 1, backgroundColor: c.isDark ? '#0c0c1c' : '#f4f4f8' },
    modalTop: { backgroundColor: c.isDark ? '#131325' : '#ffffff', paddingTop: Platform.OS === 'web' ? 20 : insetTop + 8, paddingBottom: 16, paddingHorizontal: 16, gap: 14, borderBottomWidth: 1, borderBottomColor: c.isDark ? 'rgba(85,196,154,0.1)' : c.border },
    modalHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    modalBackBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.mist, alignItems: 'center', justifyContent: 'center' },
    modalTitle: { fontSize: 17, fontWeight: '700', color: c.ink, flex: 1 },
    fieldBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 14, height: 46, backgroundColor: c.isDark ? 'rgba(255,255,255,0.05)' : c.mist, borderWidth: 1, borderColor: c.isDark ? 'rgba(255,255,255,0.08)' : c.border },
    fieldBoxFocused: { borderColor: '#55c49a', backgroundColor: c.isDark ? 'rgba(85,196,154,0.07)' : 'rgba(85,196,154,0.06)' },
    fieldInput: { flex: 1, fontSize: 14, color: c.ink },
    fieldDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#55c49a' },
    fieldSquare: { width: 8, height: 8, borderRadius: 2, backgroundColor: '#e07055' },
    locItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.isDark ? 'rgba(255,255,255,0.05)' : c.border },
    locIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.mist, alignItems: 'center', justifyContent: 'center' },
    locIconRecent: { width: 36, height: 36, borderRadius: 12, backgroundColor: c.isDark ? 'rgba(85,196,154,0.1)' : 'rgba(85,196,154,0.08)', alignItems: 'center', justifyContent: 'center' },
    locText: { flex: 1, fontSize: 13.5, color: c.ink, fontWeight: '500' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
    sectionTitle: { fontSize: 11, fontWeight: '700', color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 1.1 },
    clearAllBtn: { paddingHorizontal: 4, paddingVertical: 2 },
    clearAllText: { fontSize: 12, fontWeight: '600', color: '#55c49a' },
    divider: { height: 1, backgroundColor: c.border, marginHorizontal: 20, marginTop: 4, marginBottom: 2, opacity: 0.5 },
    emptyTip: { paddingHorizontal: 20, paddingTop: 40, alignItems: 'center', gap: 10 },
    emptyTipText: { fontSize: 13.5, color: c.inkSoft, textAlign: 'center' },
    sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: -12 }, shadowOpacity: 0.3, shadowRadius: 28, elevation: 24, paddingTop: 6, zIndex: 999 },
    dragArea: { alignItems: 'center', paddingBottom: 8, paddingTop: 4 },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(150,150,180,0.35)' },
    priceHeader: { paddingHorizontal: 20, marginBottom: 14 },
    priceTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
    priceDestRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
    priceDestText: { fontSize: 12.5 },
    priceCard: { marginHorizontal: 16, borderRadius: 18, padding: 14, borderWidth: 2, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    priceIconWrap: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    priceMeta: { flex: 1, gap: 2 },
    priceCardTitle: { fontSize: 15.5, fontWeight: '700' },
    priceCardDesc: { fontSize: 11.5 },
    priceCardStats: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
    priceCardEta: { fontSize: 11 },
    priceBlock: { alignItems: 'flex-end' },
    priceLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
    priceAmount: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
    confirmBtn: { marginHorizontal: 16, height: 56, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: '#55c49a', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 8 },
    confirmText: { fontSize: 16, fontWeight: '700' },
    promoSection: {},
    promoInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    promoInput: { flex: 1, height: 38, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, fontSize: 13 },
    promoApplyBtn: { height: 38, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#55c49a', alignItems: 'center', justifyContent: 'center' },
    promoApplyText: { fontSize: 12, fontWeight: '700' },
    promoSuccess: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(34,160,107,0.12)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
    promoSuccessText: { fontSize: 12, fontWeight: '600', color: '#22a06b', flex: 1 },
    promoError: { fontSize: 11.5, color: '#e0584a' },
    container: { paddingHorizontal: 18, gap: 12 },
    etaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    pulseDot: { width: 8, height: 8, borderRadius: 4 },
    etaText: { fontSize: 13.5, fontWeight: '700' },
    etaSep: { width: 1, height: 14, marginHorizontal: 2 },
    etaDest: { fontSize: 12.5, flex: 1 },
    driverCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14, borderWidth: 1 },
    avatarWrap: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    avatarText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
    driverMeta: { flex: 1, gap: 4 },
    driverName: { fontSize: 15.5, fontWeight: '700', letterSpacing: -0.3 },
    driverStats: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    statVal: { fontSize: 12, fontWeight: '500' },
    sep: { width: 1, height: 12 },
    vehicleBlock: { alignItems: 'flex-end', gap: 5 },
    vehicleText: { fontSize: 10.5, maxWidth: 95, textAlign: 'right' },
    plateBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    plateText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
    actionRow: { flexDirection: 'row', gap: 10 },
    chatBtn: { flex: 1, height: 50, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    chatBtnText: { fontSize: 15, fontWeight: '700' },
    callBtn: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    cancelRow: { alignItems: 'center', paddingVertical: 6 },
    cancelText: { fontSize: 14, fontWeight: '600', color: '#e0584a' },
    searchingBox: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: -12 }, shadowOpacity: 0.3, shadowRadius: 28, elevation: 24, paddingTop: 6, zIndex: 999, alignItems: 'center', gap: 14 },
    searchingIconOuter: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
    searchingIconInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(85,196,154,0.18)', alignItems: 'center', justifyContent: 'center' },
  });
}

function usePanSheet(onDismiss: () => void, panY: Animated.Value) {
  return useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 8 && gs.dy > 0,
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) panY.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > DISMISS_THRESHOLD || gs.vy > 0.8) {
          if (Platform.OS !== 'web') Haptics.selectionAsync();
          onDismiss();
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 250 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(panY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 250 }).start();
      },
    })
  ).current;
}

function SearchingDots() {
  const dot0 = useRef(new Animated.Value(0.3)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    pulse(dot0, 0);
    pulse(dot1, 200);
    pulse(dot2, 400);
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[dot0, dot1, dot2].map((anim, i) => (
        <Animated.View
          key={i}
          style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#55c49a', opacity: anim }}
        />
      ))}
    </View>
  );
}

export function BikeServiceScreen({ onBack, embedded }: BikeServiceScreenProps) {
  const { colors: c, t, isRTL, language } = useTheme();
  const isAr = language === 'ar';
  const insets = useSafeAreaInsets();
  const insetTop = Platform.OS === 'web' ? 60 : insets.top;
  const styles = useMemo(() => makeStyles(c, insetTop), [c, insetTop]);

  const [phase, setPhase] = useState<BikePhase>('idle');
  const [destination, setDestination] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bikeSecsLeft, setBikeSecsLeft] = useState(MOCK_RIDER.eta * 60);
  const [showChat, setShowChat] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bikeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketResponded = useRef(false);
  const { recents, addRecent, clearRecents } = useRecentSearches('bike');
  const { requestRide, rideState } = useRide();
  const { validateCode } = usePromos();
  const [promoInput, setPromoInput] = useState<string>('');
  const [promoStatus, setPromoStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');
  const [promoDiscount, setPromoDiscount] = useState('');
  const [promoError, setPromoError] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState('');

  const handleApplyPromo = useCallback(async () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoStatus('loading');
    setPromoError('');
    const result = await validateCode(code, 15);
    if (result.valid) {
      setPromoStatus('valid');
      setPromoDiscount(result.discount ?? '');
      setAppliedPromoCode(code);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setPromoStatus('invalid');
      setPromoError(result.message ?? 'Invalid promo code');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [promoInput, validateCode]);

  const clearPromo = useCallback(() => {
    setPromoInput('');
    setPromoStatus('idle');
    setPromoDiscount('');
    setPromoError('');
    setAppliedPromoCode('');
  }, []);

  useEffect(() => {
    if (rideState.status === 'driver_assigned' && phase === 'searching') {
      socketResponded.current = true;
      if (searchTimer.current) clearTimeout(searchTimer.current);
      setPhase('driver_assigned');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [rideState.status]);

  const priceSlide = useRef(new Animated.Value(0)).current;
  const pricePanY = useRef(new Animated.Value(0)).current;
  const driverSlide = useRef(new Animated.Value(0)).current;
  const driverPanY = useRef(new Animated.Value(0)).current;
  const bikeDotPulse = useRef(new Animated.Value(1)).current;

  const WADI_LOCS = isAr ? WADI_LOCS_AR : WADI_LOCS_EN;
  const filteredLocs = searchQuery.trim()
    ? WADI_LOCS.filter(l => l.toLowerCase().includes(searchQuery.toLowerCase()))
    : WADI_LOCS;

  useEffect(() => {
    if (phase === 'ride_options') pricePanY.setValue(0);
    Animated.spring(priceSlide, {
      toValue: phase === 'ride_options' ? 1 : 0,
      useNativeDriver: true, damping: 22, stiffness: 200,
    }).start();
  }, [phase]);

  useEffect(() => {
    if (phase === 'driver_assigned') driverPanY.setValue(0);
    Animated.spring(driverSlide, {
      toValue: phase === 'driver_assigned' ? 1 : 0,
      useNativeDriver: true, damping: 22, stiffness: 200, mass: 0.85,
    }).start();
  }, [phase]);

  useEffect(() => {
    if (phase === 'driver_assigned') {
      setBikeSecsLeft(MOCK_RIDER.eta * 60);
      bikeIntervalRef.current = setInterval(() => {
        setBikeSecsLeft(prev => {
          if (prev <= 1) {
            if (bikeIntervalRef.current) clearInterval(bikeIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(bikeDotPulse, { toValue: 0.3, duration: 600, useNativeDriver: true }),
          Animated.timing(bikeDotPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => {
        pulse.stop();
        if (bikeIntervalRef.current) clearInterval(bikeIntervalRef.current);
      };
    } else {
      if (bikeIntervalRef.current) clearInterval(bikeIntervalRef.current);
      bikeDotPulse.setValue(1);
    }
  }, [phase === 'driver_assigned']);

  const dismissPriceSheet = () => {
    setPhase('idle');
    setDestination(null);
  };

  const pricePan = usePanSheet(dismissPriceSheet, pricePanY);
  const driverPan = usePanSheet(
    () => Alert.alert(
      t('cancel_trip'), t('cancel_trip_q'),
      [
        { text: t('no_back'), style: 'cancel', onPress: () => driverPanY.setValue(0) },
        { text: t('yes_cancel'), style: 'destructive', onPress: () => { if (searchTimer.current) clearTimeout(searchTimer.current); setPhase('idle'); setDestination(null); } },
      ]
    ),
    driverPanY
  );

  const handleSelectDestination = (loc: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    addRecent(loc);
    setDestination(loc);
    setPhase('ride_options');
  };

  type BikeListItem =
    | { kind: 'recent_header' }
    | { kind: 'recent'; value: string }
    | { kind: 'divider' }
    | { kind: 'all_header' }
    | { kind: 'dest'; value: string }
    | { kind: 'empty' };

  const bikeListData: BikeListItem[] = searchQuery.trim()
    ? filteredLocs.length > 0
      ? filteredLocs.map(v => ({ kind: 'dest', value: v }))
      : [{ kind: 'empty' }]
    : [
        ...(recents.length > 0 ? [{ kind: 'recent_header' } as BikeListItem] : []),
        ...recents.map(v => ({ kind: 'recent', value: v } as BikeListItem)),
        ...(recents.length > 0 ? [{ kind: 'divider' } as BikeListItem, { kind: 'all_header' } as BikeListItem] : []),
        ...WADI_LOCS.map(v => ({ kind: 'dest', value: v } as BikeListItem)),
      ];

  const handleConfirm = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('searching');
    socketResponded.current = false;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    requestRide({
      type: 'bike',
      pickup: { latitude: 25.4449, longitude: 30.5597, address: CURRENT_LOCATION_EN },
      dropoff: { latitude: 25.4449, longitude: 30.5597, address: destination ?? '' },
      ...(appliedPromoCode ? { promoCode: appliedPromoCode } : {}),
    }).then((result) => {
      if (!result.success && !socketResponded.current) {
        searchTimer.current = setTimeout(() => {
          if (!socketResponded.current) {
            setPhase('driver_assigned');
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }, 3000);
      }
    });
    searchTimer.current = setTimeout(() => {
      if (!socketResponded.current) {
        setPhase('driver_assigned');
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 3500);
  };

  const handleCancel = () => {
    Alert.alert(
      t('cancel_trip'), t('cancel_trip_q'),
      [
        { text: t('no_back'), style: 'cancel' },
        {
          text: t('yes_cancel'), style: 'destructive',
          onPress: () => {
            if (searchTimer.current) clearTimeout(searchTimer.current);
            setPhase('idle');
            setDestination(null);
          },
        },
      ]
    );
  };

  const handleRatingDone = () => {
    setPhase('idle');
    setDestination(null);
  };

  useEffect(() => {
    if (bikeSecsLeft === 0 && phase === 'driver_assigned') {
      const timer = setTimeout(() => {
        setPhase('completed');
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [bikeSecsLeft, phase]);

  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);

  const priceTranslateY = Animated.add(
    priceSlide.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }),
    pricePanY
  );
  const driverTranslateY = Animated.add(
    driverSlide.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }),
    driverPanY
  );

  const sheetBg = c.isDark ? 'rgba(16,16,32,0.98)' : 'rgba(250,250,252,0.98)';
  const borderCol = c.isDark ? 'rgba(90,95,160,0.25)' : 'rgba(255,255,255,0.8)';
  const riderName = isAr ? MOCK_RIDER.name : MOCK_RIDER.nameEn;
  const riderInitials = isAr ? MOCK_RIDER.initials : MOCK_RIDER.initialsEn;

  return (
    <View style={styles.root}>
      {/* Animated Map */}
      <View style={styles.mapMock}>
        <BikeMap phase={phase} destination={destination} />
      </View>

      {/* Top overlay */}
      <View style={[styles.topOverlay, embedded && { paddingTop: 8 }]}>
        {!embedded && (
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.85}>
              {isRTL ? <ArrowRight size={18} color="#ffffff" /> : <ArrowLeft size={18} color="#ffffff" />}
            </TouchableOpacity>
            <View style={styles.titleBlock}>
              <Text style={styles.topTitle}>VeeGo {t('bike')}</Text>
              <Text style={styles.topSubtitle}>{isAr ? 'وادي الجديد' : 'Wadi El Gedid'}</Text>
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
          onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync(); setSearchQuery(''); setPhase('selecting'); }}
        >
          <View style={styles.fromRow}>
            <View style={styles.fromDot} />
            <Text style={styles.fromText} numberOfLines={1}>{isAr ? CURRENT_LOCATION_AR : CURRENT_LOCATION_EN}</Text>
          </View>
          <View style={styles.dividerLine} />
          <View style={styles.toRow}>
            <View style={styles.toDot} />
            {destination ? (
              <>
                <Text style={styles.destTagText} numberOfLines={1}>{destination}</Text>
                <TouchableOpacity style={styles.clearBtn} onPress={() => { setDestination(null); setPhase('idle'); }}>
                  <XCircle size={18} color="rgba(255,255,255,0.35)" />
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.toText}>{t('where_going_car')}</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Destination selector — full screen */}
      <Modal visible={phase === 'selecting'} animationType="slide" onRequestClose={() => setPhase('idle')}>
        <View style={styles.selectingModal}>
          <View style={styles.modalTop}>
            <View style={styles.modalHeaderRow}>
              <TouchableOpacity style={styles.modalBackBtn} onPress={() => setPhase('idle')} activeOpacity={0.8}>
                {isRTL ? <ArrowRight size={18} color={c.ink} /> : <ArrowLeft size={18} color={c.ink} />}
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t('choose_dest')}</Text>
            </View>
            {/* From field */}
            <View style={styles.fieldBox}>
              <View style={styles.fieldDot} />
              <TextInput
                style={styles.fieldInput}
                value={isAr ? CURRENT_LOCATION_AR : CURRENT_LOCATION_EN}
                editable={false}
                placeholderTextColor={c.inkSoft}
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>
            {/* To field */}
            <View style={[styles.fieldBox, styles.fieldBoxFocused]}>
              <View style={styles.fieldSquare} />
              <TextInput
                style={styles.fieldInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t('search_dest')}
                placeholderTextColor={c.inkSoft}
                autoFocus
                textAlign={isRTL ? 'right' : 'left'}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <XCircle size={16} color={c.silver} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <FlatList
            data={bikeListData}
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
              if (item.kind === 'divider') {
                return <View style={styles.divider} />;
              }
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
                    <Search size={28} color={c.silver} />
                    <Text style={styles.emptyTipText}>{t('no_results')}</Text>
                  </View>
                );
              }
              const isRecent = item.kind === 'recent';
              return (
                <TouchableOpacity style={styles.locItem} onPress={() => handleSelectDestination(item.value)} activeOpacity={0.8}>
                  <View style={isRecent ? styles.locIconRecent : styles.locIcon}>
                    {isRecent ? <Clock size={16} color={c.ink} /> : <MapPin size={16} color={c.inkSoft} />}
                  </View>
                  <Text style={styles.locText}>{item.value}</Text>
                  {isRTL ? <ChevronLeft size={14} color={c.silver} /> : <ChevronRight size={14} color={c.silver} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>

      {/* Price Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: c.isDark ? '#0f0f22' : '#ffffff',
            borderTopColor: c.isDark ? 'rgba(85,196,154,0.15)' : 'rgba(0,0,0,0.06)',
            paddingBottom: Platform.OS === 'web' ? 24 : insets.bottom + 28,
            transform: [{ translateY: priceTranslateY }],
          },
        ]}
        pointerEvents={phase === 'ride_options' ? 'box-none' : 'none'}
      >
        <View {...pricePan.panHandlers} style={styles.dragArea}>
          <View style={styles.handle} />
        </View>
        <View style={styles.priceHeader}>
          <Text style={[styles.priceTitle, { color: c.ink }]}>{t('confirm_ride')}</Text>
          {destination && (
            <View style={styles.priceDestRow}>
              <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: '#e07055' }} />
              <Text style={[styles.priceDestText, { color: c.inkSoft }]} numberOfLines={1}>{destination}</Text>
            </View>
          )}
        </View>
        <View style={[styles.priceCard, { backgroundColor: 'rgba(85,196,154,0.1)', borderColor: '#55c49a' }]}>
          <View style={[styles.priceIconWrap, { backgroundColor: 'rgba(85,196,154,0.18)' }]}>
            <Bike size={30} color="#55c49a" />
          </View>
          <View style={styles.priceMeta}>
            <Text style={[styles.priceCardTitle, { color: c.ink }]}>{t('bike')}</Text>
            <Text style={[styles.priceCardDesc, { color: c.inkSoft }]}>
              {isAr ? 'توصيل سريع لشخص واحد' : 'Fast single-passenger ride'}
            </Text>
            <View style={styles.priceCardStats}>
              <Clock size={11} color={c.inkSoft} />
              <Text style={[styles.priceCardEta, { color: c.inkSoft }]}>2–5 {t('min')}</Text>
              <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: c.silver, marginHorizontal: 4 }} />
              <User size={11} color={c.inkSoft} />
              <Text style={[styles.priceCardEta, { color: c.inkSoft }]}>1</Text>
            </View>
          </View>
          <View style={styles.priceBlock}>
            <Text style={[styles.priceLabel, { color: c.inkSoft }]}>{t('egp')}</Text>
            {promoStatus === 'valid' ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.priceAmount, { color: c.inkSoft, textDecorationLine: 'line-through', fontSize: 16, fontWeight: '600' }]}>15</Text>
                <Text style={[styles.priceAmount, { color: '#55c49a', fontSize: 13 }]}>-{promoDiscount}</Text>
              </View>
            ) : (
              <Text style={[styles.priceAmount, { color: '#55c49a' }]}>15</Text>
            )}
          </View>
        </View>

        <View style={[styles.promoSection, { backgroundColor: c.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderRadius: 16, marginHorizontal: 16, padding: 12, marginBottom: 12, gap: 8 }]}>
          <View style={styles.promoInputRow}>
            <Tag size={14} color={c.inkSoft} />
            <TextInput
              style={[styles.promoInput, { color: c.ink, borderColor: c.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
              placeholder="Enter promo code"
              placeholderTextColor={c.inkSoft}
              value={promoInput}
              onChangeText={(v) => { setPromoInput(v); if (promoStatus === 'invalid') setPromoStatus('idle'); }}
              autoCapitalize="characters"
              editable={promoStatus !== 'valid' && promoStatus !== 'loading'}
              returnKeyType="done"
              onSubmitEditing={handleApplyPromo}
            />
            <TouchableOpacity
              style={[styles.promoApplyBtn, (promoInput.trim().length === 0 || promoStatus === 'loading' || promoStatus === 'valid') && { opacity: 0.4 }]}
              onPress={handleApplyPromo}
              disabled={promoInput.trim().length === 0 || promoStatus === 'loading' || promoStatus === 'valid'}
              activeOpacity={0.8}
            >
              <Text style={[styles.promoApplyText, { color: '#ffffff' }]}>{promoStatus === 'loading' ? '...' : 'Apply'}</Text>
            </TouchableOpacity>
          </View>
          {promoStatus === 'valid' && (
            <View style={styles.promoSuccess}>
              <Text style={styles.promoSuccessText}>Discount applied: -{promoDiscount}</Text>
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
          style={[styles.confirmBtn, { backgroundColor: '#55c49a' }]}
          onPress={handleConfirm}
          activeOpacity={0.9}
        >
          <ArrowRightCircle size={20} color="#ffffff" />
          <Text style={[styles.confirmText, { color: '#ffffff' }]}>{t('confirm_ride')}</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Searching */}
      {phase === 'searching' && (
        <View
          style={[
            styles.searchingBox,
            {
              backgroundColor: c.isDark ? '#0f0f22' : '#ffffff',
              borderTopColor: c.isDark ? 'rgba(85,196,154,0.15)' : 'rgba(0,0,0,0.06)',
              paddingBottom: Platform.OS === 'web' ? 28 : insets.bottom + 32,
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={[styles.searchingIconOuter, { backgroundColor: 'rgba(85,196,154,0.12)' }]}>
            <View style={styles.searchingIconInner}>
              <Bike size={32} color="#55c49a" />
            </View>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: c.ink }}>{t('searching_driver')}</Text>
          <Text style={{ fontSize: 13, color: c.inkSoft, textAlign: 'center', paddingHorizontal: 32 }}>{t('searching_desc')}</Text>
          <SearchingDots />
          <TouchableOpacity
            style={{ marginHorizontal: 20, width: '88%', height: 46, borderRadius: 16, borderWidth: 1, borderColor: c.isDark ? 'rgba(255,255,255,0.1)' : c.border, alignItems: 'center', justifyContent: 'center' }}
            onPress={handleCancel}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#e0584a' }}>{t('cancel_trip')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Driver Assigned */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: c.isDark ? '#0f0f22' : '#ffffff',
            borderTopColor: c.isDark ? 'rgba(85,196,154,0.15)' : 'rgba(0,0,0,0.06)',
            paddingBottom: Platform.OS === 'web' ? 20 : insets.bottom + 16,
            transform: [{ translateY: driverTranslateY }],
          },
        ]}
        pointerEvents={phase === 'driver_assigned' ? 'box-none' : 'none'}
      >
        <View {...driverPan.panHandlers} style={styles.dragArea}>
          <View style={styles.handle} />
        </View>
        <View style={styles.container}>
          <View style={styles.etaRow}>
            <Animated.View style={[styles.pulseDot, { backgroundColor: '#55c49a', opacity: bikeDotPulse }]} />
            <Text style={[styles.etaText, { color: '#55c49a' }]}>
              {bikeSecsLeft > 0 ? `${t('arrives_in')} ${fmtSecs(bikeSecsLeft)}` : t('driver_arriving')}
            </Text>
            <View style={[styles.etaSep, { backgroundColor: c.border }]} />
            <Text style={[styles.etaDest, { color: c.inkSoft }]} numberOfLines={1}>{destination || '...'}</Text>
          </View>
          <View style={[styles.driverCard, { backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : c.mist, borderColor: c.border }]}>
            <View style={[styles.avatarWrap, { backgroundColor: '#55c49a' }]}>
              <Text style={styles.avatarText}>{riderInitials}</Text>
            </View>
            <View style={styles.driverMeta}>
              <Text style={[styles.driverName, { color: c.ink }]}>{riderName}</Text>
              <View style={styles.driverStats}>
                <Star size={13} color="#FFB000" fill="#FFB000" />
                <Text style={[styles.statVal, { color: c.ink }]}>{MOCK_RIDER.rating}</Text>
                <View style={[styles.sep, { backgroundColor: c.border }]} />
                <Text style={[styles.statVal, { color: c.inkSoft }]}>{MOCK_RIDER.trips} {t('total_trips_label')}</Text>
              </View>
            </View>
            <View style={styles.vehicleBlock}>
              <Text style={[styles.vehicleText, { color: c.inkSoft }]}>{MOCK_RIDER.vehicle}</Text>
              <View style={[styles.plateBadge, { backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : c.border }]}>
                <Text style={[styles.plateText, { color: c.ink }]}>{MOCK_RIDER.plate}</Text>
              </View>
            </View>
          </View>
          {/* Chat + Call */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.chatBtn, { backgroundColor: '#55c49a' }]}
              activeOpacity={0.85}
              onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync(); setShowChat(true); }}
            >
              <MessageCircle size={18} color="#ffffff" />
              <Text style={[styles.chatBtnText, { color: '#ffffff' }]}>{t('chat')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.callBtn, { backgroundColor: c.isDark ? 'rgba(255,255,255,0.07)' : c.mist }]}
              activeOpacity={0.8}
              onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <Phone size={20} color={c.ink} />
            </TouchableOpacity>
          </View>
          {/* Cancel text button */}
          <TouchableOpacity style={styles.cancelRow} onPress={handleCancel} activeOpacity={0.7}>
            <Text style={styles.cancelText}>{t('cancel_trip')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <RatingSheet
        visible={phase === 'completed'}
        driverName={MOCK_RIDER.name}
        driverInitials={riderInitials}
        driverColor="#55c49a"
        onSubmit={handleRatingDone}
        onSkip={handleRatingDone}
      />

      <ChatModal
        visible={showChat}
        onClose={() => setShowChat(false)}
        driverName={riderName}
      />
    </View>
  );
}
