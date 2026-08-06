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
// Cairo fallback only used if we open with no known location at all.
const FALLBACK: Coords = { latitude: 30.0444, longitude: 31.2357 };

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
  // The live map center — seeded from initialCoords, updated as the user pans.
  const centerRef = useRef<Coords>(initialCoords ?? FALLBACK);
  const [address, setAddress] = useState<string>('');
  const [resolving, setResolving] = useState(false);
  const geocodeSeqRef = useRef(0);

  const initialRegion: Region = useMemo(() => ({
    ...(initialCoords ?? FALLBACK),
    ...DEFAULT_DELTA,
  }), [initialCoords]);

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

  // Seed the label whenever the picker (re)opens.
  useEffect(() => {
    if (!visible) return;
    const seed = initialCoords ?? FALLBACK;
    centerRef.current = seed;
    resolveAddress(seed);
  }, [visible, initialCoords, resolveAddress]);

  const onRegionChangeComplete = useCallback((region: Region) => {
    const coords = { latitude: region.latitude, longitude: region.longitude };
    centerRef.current = coords;
    resolveAddress(coords);
  }, [resolveAddress]);

  // Re-center the map on the device's live GPS position.
  const recenterOnGps = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        if (req.status !== 'granted') return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      Haptics.selectionAsync();
      mapRef.current?.animateToRegion({ ...coords, ...DEFAULT_DELTA }, 500);
      // onRegionChangeComplete will fire from the animation and refresh label/center.
    } catch {
      /* ignore — user can still pan manually */
    }
  }, []);

  const handleConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const coords = centerRef.current;
    const label = address || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
    onConfirm(coords, label);
  }, [address, onConfirm]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} presentationStyle="fullScreen">
      <View style={styles.root}>
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

        {/* Close button */}
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + Spacing.sm }]}
          onPress={onCancel}
          activeOpacity={0.85}
        >
          <X size={22} color={c.ink} />
        </TouchableOpacity>

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
      </View>
    </Modal>
  );
}

function makeStyles(c: ThemeColors, isRTL: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
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
