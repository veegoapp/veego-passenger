import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Animated, Platform, ActivityIndicator, Alert, BackHandler,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  AlertCircle, Ticket, ArrowRight, ArrowLeft, AlertTriangle, Minus, Plus, X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { GlassView } from '@/components/ui/GlassView';
import { ThemeColors, S } from '@/constants/colors';
import { useBooking } from '@/context/BookingContext';
import { useServiceControl } from '@/context/ServiceControlContext';
import { Animation } from '@/constants/animations';
import { calcSegmentPrice, getDates, formatCairoTime } from '@/constants/data';
import type { ShuttleDirection } from '@/constants/data';
import { RequestTripSheet } from '@/components/shuttle/RequestTripSheet';
import { useEnabledTripRequestRoutes } from '@/src/hooks/shuttle/useEnabledTripRequestRoutes';
import { useShuttleSeatAvailability } from '@/src/hooks/shuttle/useShuttleSeatAvailability';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';
import { Shadows } from '@/constants/shadows';

import { BOOKABLE_STATUSES, formatTripDateUTC } from './tripSheetHelpers';
import {
  RouteHero, StatsRow, DateSelector, TripCard, StationPicker, PriceSummary,
} from './TripSheetSections';

// routeHero's background is c.ink — deliberately dark in light mode (so the
// hardcoded white text below reads fine there), but c.ink flips to near-white
// in dark mode, which made that same white text invisible against its own
// card. Text inside the hero card uses this instead: white on light mode's
// dark card, and the app's dark-mode background color (a fixed dark navy,
// unaffected by the card-background flip) on dark mode's light card.
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function makeStyles(c: ThemeColors, insetsBottom: number) {
  const heroInk = (alpha: number) => c.isDark ? hexToRgba(c.background, alpha) : `rgba(255,255,255,${alpha})`;
  return StyleSheet.create({
    root: { ...StyleSheet.absoluteFillObject, zIndex: 9999, pointerEvents: 'box-none' as any },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      position: 'absolute', bottom: 0, left: 0, right: 0, height: '92%',
      ...S.float,
    },
    sheetGlass: {
      flex: 1,
      borderTopLeftRadius: 36, borderTopRightRadius: 36,
      borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0,
    },
    handle: {
      width: 44, height: 5, borderRadius: 2.5,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)',
      alignSelf: 'center', marginTop: 14,
    },
    closeBtn: {
      position: 'absolute', top: 10, right: Spacing.md,
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 10,
    },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: Spacing.sm },

    /* ── Route hero ─────────────────────────────────────── */
    routeHero: {
      backgroundColor: c.ink,
      paddingHorizontal: Spacing.xl, paddingTop: 22, paddingBottom: 0,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      marginHorizontal: Spacing.md, marginTop: Spacing.lg,
      borderRadius: 28, overflow: 'hidden',
    },
    heroGlow: {
      position: 'absolute', top: -60, right: -60,
      width: 200, height: 200, borderRadius: 100,
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.lg },
    heroCodeBox: {
      width: 42, height: 42, borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    heroCodeText: { color: heroInk(1), fontSize: 11, fontWeight: Typography.weight.bold, letterSpacing: 0.5 },
    heroFavBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: 'rgba(255,255,255,0.1)',
      alignItems: 'center', justifyContent: 'center',
    },
    heroRouteName: {
      fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, color: heroInk(1),
      letterSpacing: -0.5, marginBottom: Spacing.xs,
    },
    heroRoutePath: { fontSize: 13, color: heroInk(0.6), marginBottom: 20 },

    /* Journey track — pin-marker style */
    journeyWrap: { paddingBottom: 20 },
    journeyScroll: { paddingRight: Spacing.xl },
    journeyRow: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: Spacing.sm },
    journeyStop: { alignItems: 'center', width: 70 },
    journeyPin: { height: 28, alignItems: 'center', justifyContent: 'center' },
    journeyLabel: {
      fontSize: 10, color: heroInk(0.55),
      textAlign: 'center', marginTop: 5, lineHeight: 13,
    },
    journeyLabelActive: { color: heroInk(1), fontWeight: Typography.weight.semibold },
    journeyConnector: { flex: 1, height: 2.5, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: Spacing.md },
    journeyConnectorActive: { backgroundColor: 'rgba(255,255,255,0.65)' },

    /* Stat cards row — compact horizontal.
     * Shadow lives on statCardWrap (no overflow:'hidden' — that would clip it
     * on iOS); statCard (the LinearGradient itself) clips its own corners. */
    statsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, marginTop: 10, marginBottom: Spacing.xs },
    statCardWrap: {
      flex: 1, borderRadius: 14,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: c.isDark ? 0.25 : 0.06, shadowRadius: 8, elevation: 3,
    },
    statCard: {
      borderRadius: 14, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: Spacing.sm,
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    },
    statIconBox: {
      width: 26, height: 26, borderRadius: Radius.sm,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.mist,
      alignItems: 'center', justifyContent: 'center',
    },
    statValue: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: c.ink, letterSpacing: -0.2 },
    statLabel: { fontSize: 9, color: c.inkSoft, lineHeight: 12, letterSpacing: 0.1 },

    /* Date selector strip */
    dateSelectorWrap: { paddingHorizontal: Spacing.md, marginTop: Spacing.md },
    dateItem: {
      alignItems: 'center', paddingHorizontal: 11, paddingVertical: 7,
      borderRadius: 14, marginEnd: 8, borderWidth: 1.5, minWidth: 60,
    },
    dateItemActive: { backgroundColor: c.ink, borderColor: c.ink },
    dateItemInactive: { backgroundColor: c.white, borderColor: c.border },
    dateDayLabel: { fontSize: 9, fontWeight: Typography.weight.semibold, textTransform: 'uppercase' as any, letterSpacing: 0.4, marginBottom: 1 },
    dateDayLabelActive: { color: c.isDark ? c.background : '#ffffff' },
    dateDayLabelInactive: { color: c.inkSoft },
    dateDayNum: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
    dateDayNumActive: { color: c.isDark ? c.background : '#ffffff' },
    dateDayNumInactive: { color: c.ink },

    /* Section wrapper */
    sectionWrap: { paddingHorizontal: Spacing.md, marginTop: 18 },
    sectionTitle: {
      fontSize: 11, fontWeight: Typography.weight.semibold, color: c.inkSoft,
      textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: Spacing.md,
    },

    /* Trip cards — vertical full-width.
     * Non-active card bg is always c.white (light) regardless of dark mode.
     * All non-active text colours are hard-coded dark so they are always
     * legible on that white surface. Active overrides then flip to white. */
    tripCard: {
      borderRadius: 20, borderWidth: 1.5, borderColor: c.border,
      // Intentionally a literal (not c.white, which itself darkens in dark mode) —
      // this card is always light-surfaced so the hardcoded dark text below stays legible.
      padding: Spacing.lg, backgroundColor: '#ffffff', marginBottom: 10,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: c.isDark ? 0.18 : 0.04, shadowRadius: 6, elevation: Shadows.small.elevation,
    },
    tripCardActive: {
      backgroundColor: c.ink, borderColor: c.ink,
      shadowOpacity: 0.22, shadowRadius: 14, elevation: Shadows.large.elevation,
    },
    tripCardDisabled: { opacity: 0.4 },
    tripCardTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
    tripTime: { fontSize: Typography.size.xxl, fontWeight: '800', color: '#0F172A', letterSpacing: -1 },
    tripTimeActive: { color: c.isDark ? c.background : '#ffffff' },
    tripNumberBox: {
      borderRadius: 10, paddingHorizontal: 10, paddingVertical: Spacing.xs,
      backgroundColor: 'rgba(0,0,0,0.06)',
      flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    },
    tripNumberBoxActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
    tripNumberText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold, color: '#475569' },
    tripNumberTextActive: { color: 'rgba(255,255,255,0.8)' },
    tripDateText: { fontSize: 11, color: '#475569', marginTop: 2 },
    tripDateTextActive: { color: 'rgba(255,255,255,0.55)' },
    tripStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    tripStatusDot: { width: 7, height: 7, borderRadius: 4 },
    tripStatusText: { fontSize: 11, fontWeight: Typography.weight.semibold },
    tripSeatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    tripSeatsFraction: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold, color: '#475569' },
    tripSeatsFractionActive: { color: 'rgba(255,255,255,0.65)' },
    tripSeatsLabel: { fontSize: 11, color: '#475569' },
    tripSeatsLabelActive: { color: 'rgba(255,255,255,0.5)' },
    progressBarWrap: { height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden' },
    progressBarFill: { height: '100%' as any, borderRadius: 3 },
    tripAvailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm },
    tripAvailDot: { width: 6, height: 6, borderRadius: 3 },
    tripAvailText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold },
    tripMessage: { fontSize: 11, color: '#475569', marginTop: 6, lineHeight: 15 },
    tripMessageActive: { color: 'rgba(255,255,255,0.6)' },

    /* No trips */
    noTripsWrap: { paddingVertical: 28, alignItems: 'center', gap: Spacing.sm, borderRadius: 20, backgroundColor: c.white, borderWidth: 1, borderColor: c.border },
    noTripsText: { fontSize: 13, color: c.inkSoft, textAlign: 'center', paddingHorizontal: Spacing.xl },

    /* Station picker */
    pickTabWrap: { flexDirection: 'row', padding: Spacing.xs, gap: 2, backgroundColor: c.mist },
    pickTab: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.sm },
    pickTabActive: { backgroundColor: c.ink, shadowColor: c.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: Shadows.medium.elevation },
    pickTabText: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold' },

    timeline: { marginTop: Spacing.md, backgroundColor: c.white, borderRadius: 20, padding: Spacing.lg, gap: 0, borderWidth: 1, borderColor: c.border },
    timelineRow: { flexDirection: 'row', gap: Spacing.md, paddingBottom: Spacing.md },
    timelineLeft: { alignItems: 'center', width: 16 },
    tlDot: { width: 16, height: 16, borderRadius: Radius.sm, borderWidth: 2 },
    tlDotActive: { borderColor: c.ink, backgroundColor: c.ink },
    tlDotSeg: { borderColor: c.ink, backgroundColor: c.white },
    tlDotInactive: { borderColor: c.silver, backgroundColor: c.white },
    tlLine: { width: 2, flex: 1, marginTop: 2, minHeight: 16 },
    tlLineActive: { backgroundColor: c.ink },
    tlLineInactive: { backgroundColor: 'rgba(195,195,204,0.4)' },
    timelineRight: { flex: 1, paddingBottom: Spacing.xs },
    timelineTextRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    tlName: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold' },
    tlBadge: { backgroundColor: c.ink, borderRadius: 99, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
    tlBadgeText: { fontSize: 10, fontWeight: Typography.weight.semibold, color: c.isDark ? c.background : c.white, textTransform: 'uppercase', letterSpacing: 0.8 },
    tlArea: { fontSize: 11, color: c.inkSoft, marginTop: 2 },

    /* Seat selector */
    seatRow: {
      flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: Spacing.lg, marginTop: Spacing.md,
      backgroundColor: c.white, borderWidth: 1, borderColor: c.border,
    },
    seatBtn: {
      width: 44, height: 44, borderRadius: 14, backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.mist,
      alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border,
    },
    seatBtnDisabled: { opacity: 0.3 },
    seatCountText: { fontSize: 24, fontWeight: '800', color: c.ink, minWidth: 42, textAlign: 'center' },
    seatLabelWrap: { flex: 1, paddingStart: 12 },
    seatLabel: { fontSize: 13, color: c.ink, fontWeight: Typography.weight.semibold },
    seatMax: { fontSize: 11, color: c.inkSoft, marginTop: 2 },

    /* Price card */
    priceSummary: {
      flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: Spacing.lg, marginTop: Spacing.md,
      backgroundColor: c.white, borderWidth: 1, borderColor: c.border, gap: Spacing.lg,
    },
    priceIcon: {
      width: 52, height: 52, borderRadius: Radius.lg, backgroundColor: c.ink,
      alignItems: 'center', justifyContent: 'center',
    },
    priceSegLabel: { fontSize: Typography.size.xs, color: c.inkSoft, lineHeight: 17 },
    priceTotal: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, color: c.ink, letterSpacing: -0.5, marginTop: 2 },

    /* Service banner */
    serviceBanner: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: c.isDark ? 'rgba(245,158,11,0.12)' : '#fef3c7',
      borderRadius: Radius.lg, padding: 14, marginTop: Spacing.md,
      borderWidth: 1, borderColor: c.isDark ? 'rgba(245,158,11,0.22)' : 'transparent',
    },
    serviceBannerText: { flex: 1, fontSize: 12.5, color: c.isDark ? '#fbbf24' : '#92400e', lineHeight: 18 },

    /* CTA.
     * Shadow lives on ctaBtn (no overflow:'hidden' — that would clip it on
     * iOS); ctaBtnGradient clips the gradient itself to the rounded corners. */
    cta: {
      padding: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.lg + insetsBottom,
      borderTopWidth: 1, borderTopColor: c.border,
    },
    ctaBtn: {
      height: 58, borderRadius: 22,
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
    },
    ctaBtnGradient: {
      flex: 1, borderRadius: 22, overflow: 'hidden',
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    },
    ctaBtnText: { color: '#ffffff', fontSize: 15.5, fontFamily: 'Inter_700Bold', letterSpacing: -0.2 },

    /* Request a Trip.
     * No overflow:'hidden' here — requestTripBtnInner already clips its own
     * corners (it has no decorative content that bleeds past its bounds), so
     * this only needed the flag to stop the shadow below from rendering. */
    requestTripBtn: {
      marginHorizontal: Spacing.lg, marginTop: 14, marginBottom: 2,
      borderRadius: Radius.lg,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
    },
    requestTripBtnInner: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: Spacing.sm, paddingVertical: 14, paddingHorizontal: 20, borderRadius: Radius.lg,
      backgroundColor: c.isDark ? 'rgba(85,196,154,0.16)' : 'rgba(85,196,154,0.12)',
      borderWidth: 1, borderColor: c.isDark ? 'rgba(85,196,154,0.4)' : 'rgba(85,196,154,0.32)',
    },
    requestTripBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: c.accent, letterSpacing: -0.2 },

    /* Loading / error */
    loadingWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10 },
    loadingText: { fontSize: 13, color: c.inkSoft },
    errorText: { fontSize: 13, color: c.inkSoft, textAlign: 'center' },
    retryBtn: { marginTop: Spacing.xs, paddingHorizontal: 20, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: c.border },
    retryBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.ink },
  });
}

export function TripSheet() {
  const {
    tripSheetOpen, closeTripSheet, selectedRoute, prepareBooking,
    routeLoading, tripsLoading, scheduledTrips,
    openRoute, seatCount, setSeatCount,
  } = useBooking();
  const { getService, handleServiceTap } = useServiceControl();
  const { colors: c, t, language, isRTL } = useTheme();
  const isAr = language === 'ar';
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c, insets.bottom), [c, insets.bottom]);

  const shuttleSvc = getService('shuttle');
  const shuttleServiceEnabled: boolean = !shuttleSvc || (shuttleSvc.isEnabled && shuttleSvc.displayMode === 'live');
  const shuttleDisabledMessage: string =
    shuttleSvc?.unavailableMessage ??
    (shuttleSvc?.displayMode === 'maintenance' ? 'Shuttle service is under maintenance.' :
     shuttleSvc?.displayMode === 'coming_soon' ? 'Shuttle service coming soon.' :
     'Shuttle service is currently unavailable.');

  const slideAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  // Synchronous re-entrancy guard for the Book button — `valid` alone
  // doesn't change until React re-renders, so two rapid taps in the same
  // frame both fired, stacking two review-confirm screens. Reset whenever
  // the sheet opens fresh.
  const bookSubmittedRef = useRef(false);
  useEffect(() => { if (visible) bookSubmittedRef.current = false; }, [visible]);
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);
  const [timeIdx, setTimeIdx] = useState(0);
  const [pick, setPick] = useState<'from' | 'to'>('from');
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  // Recomputed each time the sheet opens — a getDates() called once at
  // module-load could still call yesterday "Today" for a passenger who left
  // the app open (or backgrounded) across midnight.
  const DATES = useMemo(() => getDates(), [visible]);
  const [requestSheetOpen, setRequestSheetOpen] = useState(false);
  const { enabledIds: tripRequestEnabledIds } = useEnabledTripRequestRoutes();

  // Reset on every sheet open (not just when the selected route changes) —
  // reopening the same route after a previous booking/close left selectedRoute.id
  // unchanged, so a route-id-only dependency here missed that case and let seatCount
  // (and the other picks) silently carry over from the prior visit.
  useEffect(() => {
    if (tripSheetOpen && selectedRoute && selectedRoute.path.length >= 2) {
      setFromIdx(0);
      setToIdx(selectedRoute.path.length - 1);
      setTimeIdx(0);
      setSelectedDateIdx(0);
      setPick('from');
      setSeatCount(1);
    }
  }, [tripSheetOpen, selectedRoute?.id, selectedRoute?.path.length]);

  useEffect(() => {
    if (tripSheetOpen) {
      setVisible(true);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, ...Animation.spring.sheet }),
        Animated.timing(overlayAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(overlayAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start(() => setVisible(false));
    }
  }, [tripSheetOpen]);

  useEffect(() => {
    if (!tripSheetOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeTripSheet();
      return true;
    });
    return () => sub.remove();
  }, [tripSheetOpen]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [900, 0] });

  // ── Date-filtered trips ───────────────────────────────────────────────────
  // Trips are loaded from /shuttle/lines/:id (activeTrips). We filter client-side
  // by the date selected in the date strip, matching Africa/Cairo timezone display.
  const visibleTrips = useMemo(() => {
    if (scheduledTrips.length === 0) return scheduledTrips;
    const targetDate = DATES[selectedDateIdx]?.date ?? '';
    if (!targetDate) return scheduledTrips;
    const filtered = scheduledTrips.filter((trip: any) => {
      const raw = trip.departureTime ?? trip.departure_time ?? '';
      if (!raw) return false;
      const tripDateStr = formatTripDateUTC(raw); // e.g. "Jun 13"
      // DATES[i].date is "Jun 13, 2026" — check it starts with tripDate + ","
      return targetDate.startsWith(tripDateStr + ',');
    });
    return filtered;
  }, [scheduledTrips, selectedDateIdx]);

  const safeTimeIdx = Math.min(timeIdx, Math.max(0, visibleTrips.length - 1));
  const selectedTrip = visibleTrips[safeTimeIdx] ?? null;
  const selectedTripDirection = selectedTrip?.direction as ShuttleDirection | undefined;

  // ── Direction guard: if the selected departure has a known direction and the
  // currently-picked boarding/drop-off stations don't match it (e.g. the
  // passenger switched to a departure running the opposite way), snap the
  // selection back to the first/last station of that direction. Left alone
  // when direction data isn't available — never fabricated.
  useEffect(() => {
    if (!selectedRoute || selectedRoute.path.length < 2) return;
    if (!selectedTripDirection) return;
    const path = selectedRoute.path;
    const matchesDirection = (idx: number) =>
      !path[idx]?.direction || path[idx].direction === selectedTripDirection;
    if (matchesDirection(fromIdx) && matchesDirection(toIdx)) return;
    const validIdxs = path.map((_, i) => i).filter(matchesDirection);
    if (validIdxs.length >= 2) {
      setFromIdx(validIdxs[0]);
      setToIdx(validIdxs[validIdxs.length - 1]);
      setPick('from');
    }
  }, [selectedRoute, selectedTripDirection]);

  const liveAvailability = useShuttleSeatAvailability(selectedTrip?.id);

  const selectedTripSeats: number = useMemo(() => {
    if (liveAvailability) return liveAvailability.availableSeats;
    if (selectedTrip) return selectedTrip.availableSeats ?? 0;
    return selectedRoute?.seatsLeft ?? 0;
  }, [liveAvailability, selectedTrip, selectedRoute?.seatsLeft]);

  const selectedTripBookable = !selectedTrip || (
    BOOKABLE_STATUSES.includes((selectedTrip?.status ?? selectedTrip?.shuttleStatus ?? '').toLowerCase()) &&
    (liveAvailability ? liveAvailability.availableSeats : (selectedTrip?.availableSeats ?? 0)) > 0
  );

  if (!visible || !selectedRoute) return null;

  const route = selectedRoute;
  const hasPath = route.path.length >= 2;
  const safeFrom = hasPath ? fromIdx : 0;
  const safeTo = hasPath ? toIdx : 1;
  const lo = Math.min(safeFrom, safeTo);
  const hi = Math.max(safeFrom, safeTo);

  // ── Direction-filtered station indices ──────────────────────────────────
  // Indices into the ORIGINAL route.path (fromIdx/toIdx, pricing, and every
  // downstream consumer keep indexing route.path directly — only the
  // rendered list is narrowed). Falls back to every station when the
  // selected trip or a station is missing direction data — never assumes one.
  const visibleStationIndices = hasPath
    ? route.path
        .map((_, i) => i)
        .filter((i) => !selectedTripDirection || !route.path[i].direction || route.path[i].direction === selectedTripDirection)
    : [];

  const fromStationDirection = route.path[safeFrom]?.direction;
  const toStationDirection = route.path[safeTo]?.direction;
  const stationsMatchTripDirection =
    !selectedTripDirection ||
    ((!fromStationDirection || fromStationDirection === selectedTripDirection) &&
      (!toStationDirection || toStationDirection === selectedTripDirection));

  const pricePerSeat = hasPath ? calcSegmentPrice(route, safeFrom, safeTo, 1) : route.price;
  const total = pricePerSeat * seatCount;
  const seatsOk = seatCount >= 1 && seatCount <= Math.min(2, selectedTripSeats);
  const valid = hasPath && safeFrom !== safeTo && !routeLoading && visibleTrips.length > 0 && selectedTripBookable && shuttleServiceEnabled && seatsOk && stationsMatchTripDirection;

  const pickStation = (idx: number) => {
    // Defense-in-depth: the UI below only ever renders indices from
    // visibleStationIndices, but guard here too in case of stale renders.
    if (visibleStationIndices.length > 0 && !visibleStationIndices.includes(idx)) return;
    Haptics.selectionAsync();
    if (pick === 'from') {
      setFromIdx(idx);
      if (idx === toIdx) {
        const rest = visibleStationIndices.filter((i) => i !== idx);
        const nextIdx = rest.find((i) => i > idx) ?? rest[rest.length - 1] ?? Math.min(route.path.length - 1, idx + 1);
        setToIdx(nextIdx);
      }
      setPick('to');
    } else {
      if (idx === fromIdx) return;
      setToIdx(idx);
    }
  };

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closeTripSheet} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <GlassView strong borderRadius={36} style={styles.sheetGlass}>
        <View style={styles.handle} />

        {/* Close — the drag handle above is decorative (no pan gesture wired
            to it), and this sheet is a plain overlay View, not a real
            router-presented modal, so it gets neither a swipe-to-dismiss nor
            the router's own dismiss gesture. Without this, the only way to
            close it was BackHandler (Android-only) or tapping the sliver of
            dimmed backdrop not covered by the sheet (~8% of the screen,
            since the sheet is 92% tall) — effectively invisible on iOS. */}
        <TouchableOpacity
          onPress={closeTripSheet}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.closeBtn}
          accessibilityLabel={t('close')}
          accessibilityRole="button"
        >
          <X size={18} color={c.ink} strokeWidth={2.5} />
        </TouchableOpacity>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ── Route Hero ── */}
          <RouteHero
            styles={styles} route={route} isAr={isAr} lo={lo} hi={hi} pickStation={pickStation}
            visibleStationIndices={visibleStationIndices}
          />

          {/* ── Request a Trip button ── */}
          {tripRequestEnabledIds.has(Number(route.id)) && (
            <TouchableOpacity
              style={styles.requestTripBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setRequestSheetOpen(true);
              }}
              activeOpacity={0.82}
            >
              <View style={styles.requestTripBtnInner}>
                <Ticket size={16} color={c.accent} strokeWidth={2} />
                <Text style={styles.requestTripBtnText} numberOfLines={1}>{t('request_a_trip')}</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* ── Info stat cards (compact horizontal) ── */}
          <StatsRow
            styles={styles} c={c} t={t as (key: string) => string}
            route={route} visibleTripsCount={visibleTrips.length}
          />

          {/* ── Date selector strip ── */}
          <DateSelector
            styles={styles}
            dates={DATES}
            selectedDateIdx={selectedDateIdx}
            onSelectDate={(i) => {
              setSelectedDateIdx(i);
              setTimeIdx(0);
              Haptics.selectionAsync();
            }}
          />

          {/* Service disabled banner */}
          {!shuttleServiceEnabled && (
            <View style={[styles.serviceBanner, { marginHorizontal: Spacing.md }]}>
              <AlertTriangle size={15} color={c.isDark ? '#fbbf24' : '#92400e'} style={{ marginTop: 1 }} />
              <Text style={styles.serviceBannerText}>{shuttleDisabledMessage}</Text>
            </View>
          )}

          {/* ── Trips section ── */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>
              {t('departure')}
              {visibleTrips.length > 0 ? ` · ${visibleTrips.length}` : ''}
            </Text>

            {routeLoading || tripsLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={c.ink} />
                <Text style={styles.loadingText}>{t('loading_trips')}</Text>
              </View>
            ) : visibleTrips.length === 0 ? (
              <View style={styles.noTripsWrap}>
                <AlertCircle size={24} color={c.silver} />
                <Text style={styles.noTripsText}>{t('no_upcoming_trips_route')}</Text>
              </View>
            ) : (
              visibleTrips.map((trip: any, i: number) => (
                <TripCard
                  key={`${trip.id ?? i}`}
                  styles={styles} c={c} t={t as (key: string) => string} isAr={isAr}
                  trip={trip} index={i} active={i === safeTimeIdx}
                  onPress={() => { setTimeIdx(i); Haptics.selectionAsync(); }}
                />
              ))
            )}
          </View>

          {/* ── Station picker ── */}
          <StationPicker
            styles={styles} c={c} t={t as (key: string) => string} isAr={isAr}
            route={route} routeLoading={routeLoading} hasPath={hasPath}
            pick={pick} setPick={setPick} safeFrom={safeFrom} safeTo={safeTo}
            lo={lo} hi={hi} pickStation={pickStation}
            visibleStationIndices={visibleStationIndices}
            onRetry={() => openRoute(route)}
          />

          {/* ── Seat selector ── */}
          {hasPath && scheduledTrips.length > 0 && (
            <View style={[styles.seatRow, { marginHorizontal: Spacing.md }]}>
              <TouchableOpacity
                style={[styles.seatBtn, seatCount <= 1 && styles.seatBtnDisabled]}
                disabled={seatCount <= 1}
                onPress={() => { setSeatCount(Math.max(1, seatCount - 1)); Haptics.selectionAsync(); }}
                activeOpacity={0.7}
              >
                <Minus size={16} color={c.ink} />
              </TouchableOpacity>
              <Text style={styles.seatCountText}>{seatCount}</Text>
              <View style={styles.seatLabelWrap}>
                <Text style={styles.seatLabel}>{t('seat_selector_label')}</Text>
                <Text style={styles.seatMax}>{t('seats_left').replace(/\d+/, String(selectedTripSeats))}: {selectedTripSeats}</Text>
              </View>
              <TouchableOpacity
                style={[styles.seatBtn, seatCount >= Math.min(2, selectedTripSeats) && styles.seatBtnDisabled]}
                disabled={seatCount >= Math.min(2, selectedTripSeats)}
                onPress={() => { setSeatCount(Math.min(2, selectedTripSeats, seatCount + 1)); Haptics.selectionAsync(); }}
                activeOpacity={0.7}
              >
                <Plus size={16} color={c.ink} />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Price summary ── */}
          <PriceSummary
            styles={styles} c={c} t={t as (key: string) => string} isAr={isAr} isRTL={isRTL}
            route={route} safeFrom={safeFrom} safeTo={safeTo}
            seatCount={seatCount} total={total}
          />

          <View style={{ height: 120 }} />
        </ScrollView>

        <View style={styles.cta}>
          <TouchableOpacity
            style={[styles.ctaBtn, !valid && { opacity: 0.45 }]}
            disabled={!valid}
            activeOpacity={0.88}
            onPress={() => {
              if (!valid) return;
              if (bookSubmittedRef.current) return;
              // Last-line guard: don't let a stale render through to booking
              // if the boarding/drop-off stations don't match the trip's
              // direction (the picker above should already prevent this).
              if (!stationsMatchTripDirection) return;
              bookSubmittedRef.current = true;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const trip = visibleTrips[safeTimeIdx];
              const tripDate = formatTripDateUTC(trip?.departureTime ?? '');
              const tripTime = formatCairoTime(trip?.departureTime ?? '');
              const boardingStation = isAr
                ? (route.path[safeFrom]?.nameAr ?? route.path[safeFrom]?.name ?? '')
                : (route.path[safeFrom]?.name ?? '');
              const dropOffStation = isAr
                ? (route.path[safeTo]?.nameAr ?? route.path[safeTo]?.name ?? '')
                : (route.path[safeTo]?.name ?? '');
              prepareBooking({
                route,
                fromIdx: safeFrom,
                toIdx: safeTo,
                passengers: seatCount,
                date: tripDate,
                time: tripTime,
                price: total,
                tripId: trip?.id != null ? Number(trip.id) : null,
                seatCount,
                direction: selectedTripDirection,
                boardingStationId: route.path[safeFrom]?.id,
                alightingStationId: route.path[safeTo]?.id,
              });
              closeTripSheet();
              router.push({
                pathname: '/review-confirm',
                params: {
                  routeId: route.id,
                  routeName: isAr ? (route.nameAr ?? route.name) : route.name,
                  routeCode: route.code,
                  tripId: String(trip?.id ?? ''),
                  date: tripDate,
                  time: tripTime,
                  boardingStation,
                  dropOffStation,
                  boardingStationId: String(route.path[safeFrom]?.id ?? ''),
                  alightingStationId: String(route.path[safeTo]?.id ?? ''),
                  price: String(total),
                  seatCount: String(seatCount),
                },
              } as any);
            }}
          >
            <LinearGradient colors={c.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtnGradient}>
              <Text style={styles.ctaBtnText}>
                {!shuttleServiceEnabled
                  ? 'Service Unavailable'
                  : !valid
                  ? t('select_trip')
                  : t('continue_btn')}
              </Text>
              {valid && shuttleServiceEnabled && (isRTL ? <ArrowLeft size={18} color="#ffffff" /> : <ArrowRight size={18} color="#ffffff" />)}
            </LinearGradient>
          </TouchableOpacity>
        </View>
        </GlassView>
      </Animated.View>

      <RequestTripSheet
        visible={requestSheetOpen}
        route={route}
        onClose={() => setRequestSheetOpen(false)}
      />
    </View>
  );
}
