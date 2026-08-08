import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { MapPin, X, Navigation } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from '@/constants/mapStyles';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

interface Coords { latitude: number; longitude: number }

interface PickupMapPickerProps {
  visible: boolean;
  /** Where to center the map when it opens — the current pickup or device GPS. */
  initialCoords: Coords | null;
  onCancel: () => void;
  /** Fires with the map-center coords and a best-effort reverse-geocoded label. */
  onConfirm: (coords: Coords, address: string) => void;
}

const DEFAULT_DELTA = { latitudeDelta: 0.004, longitudeDelta: 0.004 };

/**
 * Full-screen "drag the map under a fixed pin" pickup picker — the Uber/Careem
 * pattern. The pin is a static screen-center overlay (NOT a map marker), so it
 * stays put while the map pans beneath it; whatever sits under the pin when the
 * user stops panning is the chosen pickup. The center is captured on every
 * region-change-complete and reverse-geocoded for the address label.
 */
export function PickupMapPicker({ visible, initialCoords, onCancel, onConfirm }: PickupMapPickerProps) {
  const { darkMode, t, isRTL, colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c, isRTL), [c, isRTL]);

  const mapRef = useRef<MapView | null>(null);
  // The live map center — seeded once a real position (prop or fresh GPS
  // fix) is known. No hardcoded city fallback: until this is set, the map
  // itself isn't rendered (see the locating/error states below).
  const centerRef = useRef<Coords | null>(initialCoords);
  const [seedCoords, setSeedCoords] = useState<Coords | null>(initialCoords);
  const [address, setAddress] = useState<string>('');
  const [resolving, setResolving] = useState(false);
  const [locateError, setLocateError] = useState(false);
  const geocodeSeqRef = useRef(0);

  const initialRegion: Region | null = useMemo(() => (
    seedCoords ? { ...seedCoords, ...DEFAULT_DELTA } : null
  ), [seedCoords]);

  // Reverse-geocode the current center into a human label. Best-effort and
  // sequence-guarded so a slow lookup never overwrites a newer one.
  const resolveAddress = useCallback(async (coords: Coords) => {
    const seq = ++geocodeSeqRef.current;
    setResolving(true);
    try {
      const results = await Location.reverseGeocodeAsync(coords);
      if (seq !== geocodeSeqRef.current) return;
      const r = results[0];
      const label = r ? [r.name, r.street, r.city].filter(Boolean).join(', ') : '';
      setAddress(label);
    } catch {
      if (seq === geocodeSeqRef.current) setAddress('');
    } finally {
      if (seq === geocodeSeqRef.current) setResolving(false);
    }
  }, []);

  // Shared GPS-fix helper: permission check + a fresh high-accuracy fix.
  // Returns null on denial/failure — callers decide how to surface that.
  const getFreshGpsFix = useCallback(async (): Promise<Coords | null> => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        if (req.status !== 'granted') return null;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    } catch {
      return null;
    }
  }, []);

  // Seed the picker whenever it (re)opens. If a known location was passed in
  // (current pickup or an already-resolved device fix), use it immediately —
  // same fast path as before. Otherwise actively wait for a real GPS fix
  // instead of guessing a city; on failure, show a retryable error state.
  useEffect(() => {
    if (!visible) return;
    if (initialCoords) {
      centerRef.current = initialCoords;
      setSeedCoords(initialCoords);
      setLocateError(false);
      resolveAddress(initialCoords);
      return;
    }

    let cancelled = false;
    setLocateError(false);
    getFreshGpsFix().then((coords) => {
      if (cancelled) return;
      if (!coords) { setLocateError(true); return; }
      centerRef.current = coords;
      setSeedCoords(coords);
      resolveAddress(coords);
    });
    return () => { cancelled = true; };
  }, [visible, initialCoords, resolveAddress, getFreshGpsFix]);

  const onRegionChangeComplete = useCallback((region: Region) => {
    const coords = { latitude: region.latitude, longitude: region.longitude };
    centerRef.current = coords;
    resolveAddress(coords);
  }, [resolveAddress]);

  // Re-center the already-visible map on the device's live GPS position.
  const recenterOnGps = useCallback(async () => {
    const coords = await getFreshGpsFix();
    if (!coords) return; // ignore — user can still pan manually
    Haptics.selectionAsync();
    mapRef.current?.animateToRegion({ ...coords, ...DEFAULT_DELTA }, 500);
    // onRegionChangeComplete will fire from the animation and refresh label/center.
  }, [getFreshGpsFix]);

  // Retry the initial GPS fix from the error state (no known location at all).
  const retryInitialLocate = useCallback(async () => {
    setLocateError(false);
    const coords = await getFreshGpsFix();
    if (!coords) { setLocateError(true); return; }
    centerRef.current = coords;
    setSeedCoords(coords);
    resolveAddress(coords);
  }, [getFreshGpsFix, resolveAddress]);

  const handleConfirm = useCallback(() => {
    const coords = centerRef.current;
    if (!coords) return; // no valid pin location yet — button is disabled in this state
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const label = address || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
    onConfirm(coords, label);
  }, [address, onConfirm]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} presentationStyle="fullScreen">
      <View style={styles.root}>
        {/* Close button — always available, including while locating/failed */}
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + Spacing.sm }]}
          onPress={onCancel}
          activeOpacity={0.85}
        >
          <X size={22} color={c.ink} />
        </TouchableOpacity>

        {!seedCoords || !initialRegion ? (
          // No known location yet — wait for a real GPS fix rather than
          // guessing a city. Locating spinner, or a retryable error state.
          <View style={styles.centerState}>
            {locateError ? (
              <>
                <Text style={styles.centerStateTitle}>{t('location_error')}</Text>
                <Text style={styles.centerStateSub}>{t('location_error_msg')}</Text>
                <TouchableOpacity style={styles.confirmBtn} onPress={retryInitialLocate} activeOpacity={0.9}>
                  <Text style={styles.confirmText}>{t('retry')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color={c.primary} />
                <Text style={styles.centerStateSub}>{t('locating')}</Text>
              </>
            )}
          </View>
        ) : (
          <>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              provider={PROVIDER_GOOGLE}
              initialRegion={initialRegion}
              customMapStyle={darkMode ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
              onRegionChangeComplete={onRegionChangeComplete}
              showsUserLocation
              showsMyLocationButton={false}
              toolbarEnabled={false}
            />

            {/* Fixed center pin — sits above the map, never moves. The tip points at
                the exact map center; the pin body is offset up by half its height so
                the tip (not the middle) marks the spot. */}
            <View pointerEvents="none" style={styles.pinWrap}>
              <View style={styles.pinShift}>
                <MapPin size={40} color={c.primary} fill={c.primary} strokeWidth={1.5} />
              </View>
              <View style={styles.pinShadow} />
            </View>

            {/* Recenter-on-GPS button */}
            <TouchableOpacity
              style={[styles.gpsBtn, { bottom: insets.bottom + 170 }]}
              onPress={recenterOnGps}
              activeOpacity={0.85}
            >
              <Navigation size={20} color={c.primary} />
            </TouchableOpacity>

            {/* Bottom sheet: address preview + confirm */}
            <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.md }]}>
              <Text style={styles.hint}>{t('move_map_to_set_pickup')}</Text>
              <View style={styles.addressRow}>
                <MapPin size={18} color={c.primary} />
                {resolving && !address ? (
                  <View style={styles.addressLoading}>
                    <ActivityIndicator size="small" color={c.primary} />
                    <Text style={styles.addressText}>{t('locating')}</Text>
                  </View>
                ) : (
                  <Text style={styles.addressText} numberOfLines={2}>
                    {address || t('current_location')}
                  </Text>
                )}
              </View>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.9}>
                <Text style={styles.confirmText}>{t('confirm_pickup')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

function makeStyles(c: ThemeColors, isRTL: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    centerState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
      gap: Spacing.md,
    },
    centerStateTitle: {
      fontSize: Typography.size.md,
      fontWeight: Typography.weight.bold,
      color: c.ink,
      textAlign: 'center',
    },
    centerStateSub: {
      fontSize: Typography.size.sm,
      color: c.inkSoft,
      textAlign: 'center',
    },
    pinWrap: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Lift the pin up by half its height so its tip marks the exact center.
    pinShift: { transform: [{ translateY: -20 }] },
    pinShadow: {
      width: 8,
      height: 4,
      borderRadius: 4,
      backgroundColor: 'rgba(0,0,0,0.25)',
      // Sits at the true center, just below the pin tip.
      marginTop: -2,
    },
    closeBtn: {
      position: 'absolute',
      [isRTL ? 'right' : 'left']: Spacing.md,
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    gpsBtn: {
      position: 'absolute',
      [isRTL ? 'left' : 'right']: Spacing.md,
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.surface,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      gap: Spacing.md,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: -3 },
      elevation: 12,
    },
    hint: {
      color: c.inkSoft,
      fontSize: Typography.size.sm,
      fontWeight: Typography.weight.medium,
      textAlign: isRTL ? 'right' : 'left',
    },
    addressRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    addressLoading: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      flex: 1,
    },
    addressText: {
      flex: 1,
      color: c.ink,
      fontSize: Typography.size.md,
      fontWeight: Typography.weight.semibold,
      textAlign: isRTL ? 'right' : 'left',
    },
    confirmBtn: {
      backgroundColor: c.primary,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmText: {
      color: '#fff',
      fontSize: Typography.size.md,
      fontWeight: Typography.weight.bold,
    },
  });
}
