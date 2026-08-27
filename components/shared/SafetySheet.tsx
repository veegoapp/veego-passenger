import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Linking, I18nManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppLoader } from '@/components/ui/AppLoader';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { ShieldAlert, Phone, Cross, MessageCircle, X, CheckCircle } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { sendRideSos } from '@/src/api/rideService';
import { sendTripSos } from '@/src/api/shuttleService';
import { getEmergencyContact } from '@/src/api/userService';
import { Spacing } from '@/constants/spacing';

// ── C · Split Panel — fixed palette, independent of the app's light/dark theme.
const C_PANEL = '#14151A';
const C_INK_SOFT = '#6B7178';
const C_CAP = '#9AA0A6';
const C_HAIR = '#EEF0F1';
const C_RED = '#D92D20';
const C_ORANGE = '#EA580C';
const C_WHATSAPP = '#25D366';

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
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const isRTL = I18nManager.isRTL;

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
      let status = (await Location.getForegroundPermissionsAsync()).status;
      if (status !== 'granted') {
        status = (await Location.requestForegroundPermissionsAsync()).status;
      }
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
              <ShieldAlert size={20} color="#fff" />
            </View>
            <Text style={styles.title}>{t('safety_title')}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.options}>
            <TouchableOpacity style={styles.optionBtn} onPress={handleCallPolice} activeOpacity={0.85}>
              <View style={[styles.optionIcon, { backgroundColor: 'rgba(217,45,32,0.1)' }]}>
                <Phone size={19} color={C_RED} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, { color: C_RED }]}>{t('call_122')}</Text>
                <Text style={styles.optionSub}>{t('call_122_sub')}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionBtn} onPress={handleCallAmbulance} activeOpacity={0.85}>
              <View style={[styles.optionIcon, { backgroundColor: 'rgba(234,88,12,0.1)' }]}>
                <Cross size={19} color={C_ORANGE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, { color: C_ORANGE }]}>{t('call_123')}</Text>
                <Text style={styles.optionSub}>{t('call_123_sub')}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionBtn} onPress={handleShareTrip} activeOpacity={0.85}>
              <View style={[styles.optionIcon, { backgroundColor: 'rgba(37,211,102,0.12)' }]}>
                <MessageCircle size={19} color={C_WHATSAPP} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, { color: '#1CA855' }]}>{t('share_trip')}</Text>
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
                <CheckCircle size={18} color="#0E9F8E" />
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    paddingBottom: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(0,0,0,0.14)',
    marginTop: 10,
    marginBottom: 16,
  },
  header: {
    backgroundColor: C_PANEL,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 18,
  },
  rowRTL: { flexDirection: 'row-reverse' },
  shieldIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(217,45,32,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  options: { paddingHorizontal: 20, gap: 10 },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C_HAIR,
    backgroundColor: '#fff',
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  optionSub: {
    fontSize: 11.5,
    color: C_CAP,
    marginTop: 2,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  statusSending: {
    fontSize: 13,
    color: C_INK_SOFT,
    fontWeight: '700',
  },
  statusSent: {
    fontSize: 13,
    color: '#0E9F8E',
    fontWeight: '800',
  },
  errorText: {
    textAlign: 'center',
    fontSize: 13,
    color: C_RED,
    fontWeight: '700',
    paddingTop: Spacing.sm,
  },
});
