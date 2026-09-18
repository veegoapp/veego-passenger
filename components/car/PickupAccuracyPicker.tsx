import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
} from 'react-native';
import MapView, { Circle, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
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

interface PickupAccuracyPickerProps {
  visible: boolean;
  /** The GPS-determined pickup point — the fixed center of the allowed 50m zone. */
  anchorCoords: Coords | null;
  onCancel: () => void;
  /** Fires with the confirmed pin coords (always within 50m of anchorCoords)
   *  and its reverse-geocoded address — this address is what the driver sees. */
  onConfirm: (coords: Coords, address: string) => void;
}

/** Passenger-adjustable radius around the GPS fix — GPS drift is usually a
 *  few meters to a couple dozen meters, so 50m comfortably covers real
 *  inaccuracy without letting the pin wander to an unrelated location. */
const MAX_OFFSET_METERS = 50;
const EARTH_RADIUS_M = 6371000;
const MAP_DELTA = { latitudeDelta: 0.0018, longitudeDelta: 0.0018 };

/** Local equirectangular projection — accurate to well under a centimeter at
 *  this scale (tens of meters), far simpler than full great-circle math. */
function metersFromAnchor(anchor: Coords, point: Coords) {
  const latRad = (anchor.latitude * Math.PI) / 180;
  const y = ((point.latitude - anchor.latitude) * Math.PI) / 180 * EARTH_RADIUS_M;
  const x = ((point.longitude - anchor.longitude) * Math.PI) / 180 * EARTH_RADIUS_M * Math.cos(latRad);
  return { x, y };
}

function coordsFromMeters(anchor: Coords, x: number, y: number): Coords {
  const latRad = (anchor.latitude * Math.PI) / 180;
  return {
    latitude: anchor.latitude + (y / EARTH_RADIUS_M) * (180 / Math.PI),
    longitude: anchor.longitude + (x / (EARTH_RADIUS_M * Math.cos(latRad))) * (180 / Math.PI),
  };
}

/** Clamps `point` to within MAX_OFFSET_METERS of `anchor`, preserving direction. */
function clampToRadius(anchor: Coords, point: Coords): { coords: Coords; wasClamped: boolean } {
  const { x, y } = metersFromAnchor(anchor, point);
  const distance = Math.sqrt(x * x + y * y);
  if (distance <= MAX_OFFSET_METERS) return { coords: point, wasClamped: false };
  const scale = MAX_OFFSET_METERS / distance;
  return { coords: coordsFromMeters(anchor, x * scale, y * scale), wasClamped: true };
}

/**
 * Same "drag the map under a fixed pin" pattern as PickupMapPicker, but the
 * pin is boxed in to a MAX_OFFSET_METERS-radius circle around the passenger's
 * GPS fix (drawn as a Circle overlay) — this is a fine accuracy nudge for
 * when the raw GPS point lands a few meters off, not a free "pick any pickup"
 * picker. Shown between "Find Driver" and actually dispatching the request.
 */
export function PickupAccuracyPicker({ visible, anchorCoords, onCancel, onConfirm }: PickupAccuracyPickerProps) {
  const { darkMode, t, isRTL, colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c, isRTL), [c, isRTL]);

  const mapRef = useRef<MapView | null>(null);
  const anchorRef = useRef<Coords | null>(anchorCoords);
  const centerRef = useRef<Coords | null>(anchorCoords);
  const [address, setAddress] = useState('');
  const [resolving, setResolving] = useState(false);
  const geocodeSeqRef = useRef(0);
  // Guards against re-clamping the region we just animated back to.
  const clampingRef = useRef(false);

  const initialRegion: Region | null = useMemo(() => (
    anchorCoords ? { ...anchorCoords, ...MAP_DELTA } : null
  ), [anchorCoords]);

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

  // Re-seed every time the picker opens, anchored to whatever GPS pickup was
  // current at that moment.
  useEffect(() => {
    if (!visible || !anchorCoords) return;
    anchorRef.current = anchorCoords;
    centerRef.current = anchorCoords;
    setAddress('');
    resolveAddress(anchorCoords);
  }, [visible, anchorCoords, resolveAddress]);

  const onRegionChangeComplete = useCallback((region: Region) => {
    if (clampingRef.current) { clampingRef.current = false; return; }
    const anchor = anchorRef.current;
    if (!anchor) return;
    const raw = { latitude: region.latitude, longitude: region.longitude };
    const { coords, wasClamped } = clampToRadius(anchor, raw);
    centerRef.current = coords;
    if (wasClamped) {
      Haptics.selectionAsync().catch(() => {});
      clampingRef.current = true;
      mapRef.current?.animateToRegion({ ...coords, latitudeDelta: region.latitudeDelta, longitudeDelta: region.longitudeDelta }, 220);
    }
    resolveAddress(coords);
  }, [resolveAddress]);

  // Recenters on the GPS anchor (the center of the allowed circle) — not a
  // fresh GPS fix, since the anchor is what the request will be validated
  // against.
  const recenterOnAnchor = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    Haptics.selectionAsync().catch(() => {});
    mapRef.current?.animateToRegion({ ...anchor, ...MAP_DELTA }, 400);
  }, []);

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

        {!initialRegion ? null : (
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
              rotateEnabled={false}
              showsBuildings={false}
            >
              <Circle
                center={anchorCoords ?? undefined}
                radius={MAX_OFFSET_METERS}
                strokeColor={c.primary}
                strokeWidth={1.5}
                fillColor={c.isDark ? 'rgba(61,220,151,0.12)' : 'rgba(61,220,151,0.10)'}
              />
            </MapView>

            <View pointerEvents="none" style={styles.pinWrap}>
              <View style={styles.pinCluster}>
                <MapPin size={40} color={c.primary} fill={c.primary} strokeWidth={1.5} />
                <View style={styles.pinShadow} />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.gpsBtn, { bottom: insets.bottom + 170 }]}
              onPress={recenterOnAnchor}
              activeOpacity={0.85}
            >
              <Navigation size={20} color={c.primary} />
            </TouchableOpacity>

            <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.md }]}>
              <Text style={styles.title}>{t('refine_pickup_title')}</Text>
              <Text style={styles.hint}>{t('refine_pickup_hint')}</Text>
              <View style={styles.addressRow}>
                <MapPin size={18} color={c.primary} />
                <Text style={styles.addressText} numberOfLines={2}>
                  {resolving && !address ? t('locating') : (address || t('current_location'))}
                </Text>
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
      gap: Spacing.sm,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: -3 },
      elevation: 12,
    },
    title: {
      color: c.ink,
      fontSize: Typography.size.md,
      fontWeight: Typography.weight.bold,
      textAlign: isRTL ? 'right' : 'left',
    },
    hint: {
      color: c.inkSoft,
      fontSize: Typography.size.xs,
      fontWeight: Typography.weight.medium,
      textAlign: isRTL ? 'right' : 'left',
      marginBottom: Spacing.xs,
    },
    addressRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: Spacing.sm,
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
      marginTop: Spacing.xs,
    },
    confirmText: {
      color: '#fff',
      fontSize: Typography.size.md,
      fontWeight: Typography.weight.bold,
    },
  });
}
