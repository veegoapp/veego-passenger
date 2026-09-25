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

interface DestinationMapPickerProps {
  visible: boolean;
  /** Best-known coords for the chosen destination (geocoded address or a
   *  known-coords pick) — where the map centers when it opens. */
  initialCoords: Coords | null;
  /** The address label as typed/picked — shown while the pin's own
   *  reverse-geocode is still resolving. */
  initialAddress: string | null;
  onCancel: () => void;
  /** Fires with the map-center coords and a best-effort reverse-geocoded label. */
  onConfirm: (coords: Coords, address: string) => void;
}

// Tighter than the pickup picker's 0.004 — the destination is normally
// resolved from a geocoded address already, so this only needs to nudge a
// pin within a building/block, not re-locate across a wide area. A wide
// delta here reads as "zoomed too far out" on the exact spot passengers
// already chose.
const DEFAULT_DELTA = { latitudeDelta: 0.0015, longitudeDelta: 0.0015 };

/**
 * Shown right after the passenger picks a destination and before the ride
 * options (price/vehicle) card — same "drag the map under a fixed pin"
 * pattern as PickupMapPicker, so a rider can correct the exact drop-off spot
 * when the geocoded address lands a little off from where they actually mean.
 */
export function DestinationMapPicker({ visible, initialCoords, initialAddress, onCancel, onConfirm }: DestinationMapPickerProps) {
  const { darkMode, t, isRTL, colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c, isRTL), [c, isRTL]);

  const mapRef = useRef<MapView | null>(null);
  const centerRef = useRef<Coords | null>(initialCoords);
  const [seedCoords, setSeedCoords] = useState<Coords | null>(initialCoords);
  const [address, setAddress] = useState<string>('');
  const [resolving, setResolving] = useState(false);
  const geocodeSeqRef = useRef(0);

  const initialRegion: Region | null = useMemo(() => (
    seedCoords ? { ...seedCoords, ...DEFAULT_DELTA } : null
  ), [seedCoords]);

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

  // Re-seed every time the picker opens, anchored to whatever destination
  // coords were just resolved. Prefill the label from the typed/picked
  // address so the sheet isn't blank while the pin's own reverse-geocode runs.
  useEffect(() => {
    if (!visible || !initialCoords) return;
    centerRef.current = initialCoords;
    setSeedCoords(initialCoords);
    setAddress(initialAddress ?? '');
    resolveAddress(initialCoords);
  }, [visible, initialCoords, initialAddress, resolveAddress]);

  const onRegionChangeComplete = useCallback((region: Region) => {
    const coords = { latitude: region.latitude, longitude: region.longitude };
    centerRef.current = coords;
    resolveAddress(coords);
  }, [resolveAddress]);

  // Re-center on the originally resolved destination point.
  const recenterOnDestination = useCallback(() => {
    if (!initialCoords) return;
    Haptics.selectionAsync();
    mapRef.current?.animateToRegion({ ...initialCoords, ...DEFAULT_DELTA }, 500);
  }, [initialCoords]);

  const handleConfirm = useCallback(() => {
    const coords = centerRef.current;
    if (!coords) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const label = address || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
    onConfirm(coords, label);
  }, [address, onConfirm]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} presentationStyle="fullScreen">
      <View style={styles.root}>
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + Spacing.sm }]}
          onPress={onCancel}
          activeOpacity={0.85}
        >
          <X size={22} color={c.ink} />
        </TouchableOpacity>

        {!seedCoords || !initialRegion ? null : (
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
              pitchEnabled={false}
              showsBuildings={false}
            />

            {/* Fixed center pin — sits above the map, never moves. */}
            <View pointerEvents="none" style={styles.pinWrap}>
              <View style={styles.pinCluster}>
                <MapPin size={40} color={c.primary} fill={c.primary} strokeWidth={1.5} />
                <View style={styles.pinShadow} />
              </View>
            </View>

            {/* Recenter-on-destination button */}
            <TouchableOpacity
              style={[styles.gpsBtn, { bottom: insets.bottom + 170 }]}
              onPress={recenterOnDestination}
              activeOpacity={0.85}
            >
              <Navigation size={20} color={c.primary} />
            </TouchableOpacity>

            {/* Bottom sheet: address preview + confirm */}
            <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.md }]}>
              <Text style={styles.hint}>{t('move_map_to_set_destination')}</Text>
              <View style={styles.addressRow}>
                <MapPin size={18} color={c.primary} />
                {resolving && !address ? (
                  <View style={styles.addressLoading}>
                    <ActivityIndicator size="small" color={c.primary} />
                    <Text style={styles.addressText}>{t('locating')}</Text>
                  </View>
                ) : (
                  <Text style={styles.addressText} numberOfLines={2}>
                    {address || t('drop_off')}
                  </Text>
                )}
              </View>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.9}>
                <Text style={styles.confirmText}>{t('confirm_destination_location')}</Text>
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
    pinWrap: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pinCluster: { alignItems: 'center', transform: [{ translateY: -20 }] },
    pinShadow: {
      width: 8,
      height: 4,
      borderRadius: 4,
      backgroundColor: 'rgba(0,0,0,0.25)',
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
