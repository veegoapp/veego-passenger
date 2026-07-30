import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Linking, I18nManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppLoader } from '@/components/ui/AppLoader';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { ShieldAlert, Phone, Cross, MessageCircle, X, CheckCircle } from 'lucide-react-native';
import { C, ThemeColors } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';
import { sendRideSos } from '@/src/api/rideService';
import { sendTripSos } from '@/src/api/shuttleService';
import { getEmergencyContact } from '@/src/api/userService';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

// Backend SOS action taxonomy — any of the three sheet actions raises the
// same durable admin alert (one open sos_event per ride/trip; later actions
// append to it server-side, so firing several in a row is safe).
type SosAction = 'call_police' | 'call_ambulance' | 'share_trip';

interface SafetySheetProps {
  visible: boolean;
  onClose: () => void;
  /** Car/scooter/delivery ride — alerts via POST /rides/:id/sos (coords REQUIRED by backend). */
  rideId?: string | null;
  /** Shuttle trip — alerts via POST /trips/:id/sos (coords nullable). Exactly one of rideId/tripId should be set. */
  tripId?: string | number | null;
  driverName?: string | null;
  vehicle?: string | null;
  plate?: string | null;
  routeName?: string | null;
  /**
   * Last-resort coordinates (e.g. the ride's pickup point) used when no GPS
   * fix is available — the ride SOS endpoint rejects a body without lat/lng.
   */
  fallbackCoords?: { latitude: number; longitude: number } | null;
}

type AlertState = 'idle' | 'sending' | 'sent' | 'failed';

interface EmergencyContact { name?: string | null; phone?: string | null; }

export function SafetySheet({
  visible, onClose, rideId, tripId, driverName, vehicle, plate, routeName, fallbackCoords,
}: SafetySheetProps) {
  const { t, colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const isRTL = I18nManager.isRTL;
  const styles = useMemo(() => makeSheetStyles(c), [c]);

  const [alertState, setAlertState] = useState<AlertState>('idle');
  const [contact, setContact] = useState<EmergencyContact | null>(null);

  // Prefetch the saved emergency contact so the WhatsApp share opens
  // instantly on tap. Best-effort — no contact just means a generic share.
  useEffect(() => {
    if (!visible) return;
    setAlertState('idle');
    getEmergencyContact()
      .then((data) => setContact((data ?? null) as EmergencyContact | null))
      .catch(() => setContact(null));
  }, [visible]);

  const getCoords = useCallback(async (): Promise<{ lat: number | null; lng: number | null }> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const last = await Location.getLastKnownPositionAsync();
        if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
        // High (not Balanced): this location is sent to the passenger's
        // emergency contact / support during an SOS — Balanced can resolve
        // to a coarse cell/WiFi-derived city-centre point on Android instead
        // of a real GPS fix, which is the last place accuracy should be cut.
        const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        return { lat: cur.coords.latitude, lng: cur.coords.longitude };
      }
    } catch (err: any) {
      console.error('[safety sheet] location lookup failed', err?.message);
    }
    return {
      lat: fallbackCoords?.latitude ?? null,
      lng: fallbackCoords?.longitude ?? null,
    };
  }, [fallbackCoords]);

  /**
   * Fire-and-forget durable alert to operations. Never blocks or delays the
   * local action (dialer/WhatsApp) — the passenger's own call comes first.
   */
  const sendSos = useCallback(async (action: SosAction) => {
    if (rideId == null && tripId == null) return;
    setAlertState((s) => (s === 'sent' ? 'sent' : 'sending'));
    const { lat, lng } = await getCoords();
    try {
      if (tripId != null) {
        // Shuttle: coords are nullable — a missing GPS fix must never block an SOS.
        await sendTripSos(tripId, { latitude: lat, longitude: lng, action });
      } else {
        // Ride: backend requires numeric lat/lng; omit only if truly unavailable
        // (the request will fail and the failure state tells the user to call directly).
        await sendRideSos(rideId!, {
          ...(lat != null ? { latitude: lat } : {}),
          ...(lng != null ? { longitude: lng } : {}),
          action,
        });
      }
      setAlertState('sent');
    } catch {
      setAlertState((s) => (s === 'sent' ? 'sent' : 'failed'));
    }
  }, [rideId, tripId, getCoords]);

  const handleCallPolice = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    sendSos('call_police');
    Linking.openURL('tel:122');
  }, [sendSos]);

  const handleCallAmbulance = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    sendSos('call_ambulance');
    Linking.openURL('tel:123');
  }, [sendSos]);

  const handleShareTrip = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendSos('share_trip');

    const { lat, lng } = await getCoords();
    const mapsLink = lat != null && lng != null ? `https://maps.google.com/?q=${lat},${lng}` : '';

    const lines: string[] = [t('safety_whatsapp_intro')];
    if (routeName)  lines.push(routeName);
    if (driverName) lines.push(`${t('driver_name_label')}: ${driverName}`);
    if (vehicle)    lines.push(`${t('vehicle_type')}: ${vehicle}`);
    if (plate)      lines.push(`${t('plate_number')}: ${plate}`);
    if (mapsLink)   lines.push(`${t('safety_location')}: ${mapsLink}`);
    const message = encodeURIComponent(lines.join('\n'));

    // Open the chat with the saved emergency contact when one exists, so the
    // passenger only has to press Send; otherwise fall back to a generic share.
    const phoneClean = contact?.phone ? contact.phone.replace(/\D/g, '') : '';
    if (phoneClean) {
      Linking.openURL(`whatsapp://send?phone=${phoneClean}&text=${message}`).catch(() => {
        Linking.openURL(`https://wa.me/${phoneClean}?text=${message}`);
      });
    } else {
      Linking.openURL(`whatsapp://send?text=${message}`).catch(() => {
        Linking.openURL(`https://wa.me/?text=${message}`);
      });
    }
  }, [sendSos, getCoords, contact, routeName, driverName, vehicle, plate, t]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />

          <View style={[styles.header, isRTL && styles.rowRTL]}>
            <View style={styles.shieldIcon}>
              <ShieldAlert size={22} color="#dc2626" />
            </View>
            <Text style={styles.title}>{t('safety_title')}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={C.inkSoft} />
            </TouchableOpacity>
          </View>

          <View style={styles.options}>
            <TouchableOpacity style={[styles.optionBtn, styles.optionCall]} onPress={handleCallPolice} activeOpacity={0.85}>
              <View style={[styles.optionIcon, { backgroundColor: 'rgba(220,38,38,0.12)' }]}>
                <Phone size={20} color="#dc2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, { color: '#dc2626' }]}>{t('call_122')}</Text>
                <Text style={styles.optionSub}>{t('call_122_sub')}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.optionBtn, styles.optionCall]} onPress={handleCallAmbulance} activeOpacity={0.85}>
              <View style={[styles.optionIcon, { backgroundColor: 'rgba(234,88,12,0.12)' }]}>
                <Cross size={20} color="#ea580c" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, { color: '#ea580c' }]}>{t('call_123')}</Text>
                <Text style={styles.optionSub}>{t('call_123_sub')}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.optionBtn, styles.optionWhatsApp]} onPress={handleShareTrip} activeOpacity={0.85}>
              <View style={[styles.optionIcon, { backgroundColor: 'rgba(37,211,102,0.12)' }]}>
                <MessageCircle size={20} color="#25d366" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, { color: '#25d366' }]}>{t('share_trip')}</Text>
                <Text style={styles.optionSub}>{t('share_trip_sub')}</Text>
              </View>
            </TouchableOpacity>

            {alertState === 'sending' && (
              <View style={[styles.statusRow, isRTL && styles.rowRTL]}>
                <AppLoader size={18} />
                <Text style={styles.statusSending}>{t('sos_alert_sending')}</Text>
              </View>
            )}
            {alertState === 'sent' && (
              <View style={[styles.statusRow, isRTL && styles.rowRTL]}>
                <CheckCircle size={18} color="#22a06b" />
                <Text style={styles.statusSent}>{t('emergency_notified')}</Text>
              </View>
            )}
            {alertState === 'failed' && (
              <Text style={styles.errorText}>{t('sos_error')}</Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeSheetStyles(c: ThemeColors) { return StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: c.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: Spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.18)' : '#e0e0e0',
    marginBottom: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: 18,
  },
  rowRTL: { flexDirection: 'row-reverse' },
  shieldIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(220,38,38,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color: c.ink,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  options: { gap: Spacing.md },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  optionCall: {
    backgroundColor: c.isDark ? 'rgba(220,38,38,0.08)' : 'rgba(220,38,38,0.04)',
    borderColor: 'rgba(220,38,38,0.35)',
  },
  optionWhatsApp: {
    backgroundColor: c.isDark ? 'rgba(37,211,102,0.08)' : 'rgba(37,211,102,0.05)',
    borderColor: 'rgba(37,211,102,0.4)',
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },
  optionSub: {
    fontSize: Typography.size.xs,
    color: C.inkSoft,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  statusSending: {
    fontSize: Typography.size.sm,
    color: C.inkSoft,
    fontWeight: Typography.weight.semibold,
  },
  statusSent: {
    fontSize: Typography.size.sm,
    color: '#22a06b',
    fontWeight: Typography.weight.bold,
  },
  errorText: {
    textAlign: 'center',
    fontSize: Typography.size.sm,
    color: '#dc2626',
    fontWeight: Typography.weight.semibold,
    paddingTop: Spacing.sm,
  },
}); }
