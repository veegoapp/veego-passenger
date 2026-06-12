import { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Platform, ActivityIndicator, Linking, I18nManager,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { ShieldAlert, Phone, MessageCircle, AlertTriangle, X, CheckCircle } from 'lucide-react-native';
import { C } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';
import api from '@/src/api/client';

interface SafetySheetProps {
  visible: boolean;
  onClose: () => void;
  rideId: string | null;
  driverName?: string;
  vehicle?: string;
  plate?: string;
}

export function SafetySheet({ visible, onClose, rideId, driverName, vehicle, plate }: SafetySheetProps) {
  const { t } = useTheme();
  const isRTL = I18nManager.isRTL;

  const [sosLoading, setSosLoading] = useState(false);
  const [sosSuccess, setSosSuccess] = useState(false);
  const [sosError, setSosError] = useState('');

  const handleClose = useCallback(() => {
    setSosSuccess(false);
    setSosError('');
    setSosLoading(false);
    onClose();
  }, [onClose]);

  const handleCall122 = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Linking.openURL('tel:122');
  }, []);

  const handleWhatsApp = useCallback(async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let lat: number | null = null;
    let lng: number | null = null;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
    } catch {}

    const mapsLink = lat != null && lng != null
      ? `https://maps.google.com/?q=${lat},${lng}`
      : '';

    const lines: string[] = [t('safety_whatsapp_intro')];
    if (driverName) lines.push(`${t('driver_name_label')}: ${driverName}`);
    if (vehicle)    lines.push(`${t('vehicle_type')}: ${vehicle}`);
    if (plate)      lines.push(`${t('plate_number')}: ${plate}`);
    if (mapsLink)   lines.push(`${t('safety_location')}: ${mapsLink}`);

    const message = encodeURIComponent(lines.join('\n'));
    Linking.openURL(`whatsapp://send?text=${message}`).catch(() => {
      Linking.openURL(`https://wa.me/?text=${message}`);
    });
  }, [t, driverName, vehicle, plate]);

  const handleReportEmergency = useCallback(async () => {
    if (!rideId) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    setSosLoading(true);
    setSosError('');

    let lat: number | null = null;
    let lng: number | null = null;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
    } catch {}

    try {
      await api.post(`/rides/${rideId}/sos`, {
        ...(lat != null ? { latitude: lat } : {}),
        ...(lng != null ? { longitude: lng } : {}),
        notes: 'SOS triggered by passenger',
      });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSosSuccess(true);
      setTimeout(() => handleClose(), 2500);
    } catch {
      setSosError(t('sos_error'));
    } finally {
      setSosLoading(false);
    }
  }, [rideId, t, handleClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={[styles.header, isRTL && styles.rowRTL]}>
            <View style={styles.shieldIcon}>
              <ShieldAlert size={22} color="#dc2626" />
            </View>
            <Text style={styles.title}>{t('safety_title')}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={C.inkSoft} />
            </TouchableOpacity>
          </View>

          {sosSuccess ? (
            <View style={styles.successBlock}>
              <CheckCircle size={36} color="#22a06b" />
              <Text style={styles.successText}>{t('emergency_notified')}</Text>
            </View>
          ) : (
            <View style={styles.options}>
              <TouchableOpacity style={[styles.optionBtn, styles.optionCall]} onPress={handleCall122} activeOpacity={0.85}>
                <View style={[styles.optionIcon, { backgroundColor: 'rgba(220,38,38,0.12)' }]}>
                  <Phone size={20} color="#dc2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, { color: '#dc2626' }]}>{t('call_122')}</Text>
                  <Text style={styles.optionSub}>{t('call_122_sub')}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.optionBtn, styles.optionWhatsApp]} onPress={handleWhatsApp} activeOpacity={0.85}>
                <View style={[styles.optionIcon, { backgroundColor: 'rgba(37,211,102,0.12)' }]}>
                  <MessageCircle size={20} color="#25d366" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionLabel, { color: '#25d366' }]}>{t('share_trip')}</Text>
                  <Text style={styles.optionSub}>{t('share_trip_sub')}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionBtn, styles.optionSOS, sosLoading && { opacity: 0.7 }]}
                onPress={handleReportEmergency}
                disabled={sosLoading || !rideId}
                activeOpacity={0.85}
              >
                {sosLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <View style={[styles.optionIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                      <AlertTriangle size={20} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, { color: '#fff' }]}>{t('report_emergency')}</Text>
                      <Text style={[styles.optionSub, { color: 'rgba(255,255,255,0.75)' }]}>{t('report_emergency_sub')}</Text>
                    </View>
                  </>
                )}
              </TouchableOpacity>

              {!!sosError && (
                <Text style={styles.errorText}>{sosError}</Text>
              )}
            </View>
          )}
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
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e0e0e0',
    marginBottom: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
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
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    letterSpacing: -0.4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f4f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  options: {
    gap: 10,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  optionCall: {
    backgroundColor: '#fff5f5',
    borderColor: 'rgba(220,38,38,0.15)',
  },
  optionWhatsApp: {
    backgroundColor: '#f0fff4',
    borderColor: 'rgba(37,211,102,0.2)',
  },
  optionSOS: {
    backgroundColor: '#dc2626',
    borderColor: 'transparent',
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  optionSub: {
    fontSize: 11.5,
    color: '#888',
    marginTop: 2,
  },
  successBlock: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 14,
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22a06b',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12.5,
    color: '#dc2626',
    textAlign: 'center',
    marginTop: 4,
  },
});
