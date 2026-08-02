import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  I18nManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppLoader } from '@/components/ui/AppLoader';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';

interface CancelReasonSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  mode?: 'shuttle' | 'ride';
}

export function CancelReasonSheet({ visible, onClose, onConfirm, mode = 'ride' }: CancelReasonSheetProps) {
  const { t, colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const isRTL = I18nManager.isRTL;

  const rideReasons = [
    t('reason_driver_far'),
    t('reason_wait_long'),
    t('reason_wrong_vehicle'),
    t('reason_changed_mind'),
    t('reason_other'),
  ];
  const shuttleReasons = [
    t('reason_change_plans'),
    t('reason_time_change'),
    t('reason_booked_vehicle'),
    t('reason_other'),
  ];
  const reasons = mode === 'shuttle' ? shuttleReasons : rideReasons;
  const isReasonRequired = mode === 'ride';

  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isDark = c.isDark;
  const cardBg    = isDark ? '#1a1a2e' : '#ffffff';
  const surfaceBg = isDark ? '#16162a' : '#f7f8fc';
  const borderCol = isDark ? '#2c2c46' : '#e5e5ea';
  const primaryCol = c.primary;

  const handleClose = useCallback(() => {
    setSelected(null);
    setError('');
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError('');
    try {
      await onConfirm(selected ?? '');
      setSelected(null);
    } catch {
      setError(t('cancel_error'));
    } finally {
      setLoading(false);
    }
  }, [selected, onConfirm, t]);

  const canConfirm = isReasonRequired ? !!selected : true;

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
        <View style={[styles.sheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
          {/* Drag handle */}
          <View style={[styles.handle, { backgroundColor: borderCol }]} />

          {/* Title */}
          <View style={{ marginBottom: 4 }}>
            <Text style={[styles.title, { color: c.ink }]}>{t('cancel_trip')}</Text>
            <Text style={[styles.subtitle, { color: c.inkSoft }]}>
              {mode === 'shuttle' ? t('cancel_trip_q') : (t('select_reason') ?? 'Your feedback helps us improve the service')}
            </Text>
          </View>

          {/* Reason list */}
          <View style={{ gap: 8, marginTop: 16, marginBottom: 20 }}>
            {reasons.map((reason) => {
              const active = selected === reason;
              return (
                <TouchableOpacity
                  key={reason}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelected(active ? null : reason);
                    setError('');
                  }}
                  activeOpacity={0.78}
                  style={[
                    styles.reasonRow,
                    {
                      backgroundColor: active
                        ? (isDark ? 'rgba(30,30,40,0.18)' : 'rgba(30,30,40,0.04)')
                        : cardBg,
                      borderColor: active ? primaryCol : borderCol,
                      borderWidth: active ? 1.5 : 1,
                    },
                  ]}
                >
                  {/* Radio circle */}
                  <View style={[
                    styles.radio,
                    { borderColor: active ? primaryCol : borderCol },
                    active ? { backgroundColor: primaryCol } : {},
                  ]}>
                    {active ? <Check size={11} color="#ffffff" strokeWidth={3} /> : null}
                  </View>
                  <Text style={[styles.reasonText, { color: c.ink }]}>{reason}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {mode === 'shuttle' && (
            <Text style={[styles.optionalHint, { color: c.inkSoft }]}>{t('selection_optional')}</Text>
          )}

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          {/* Buttons */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* Back ghost button */}
            <TouchableOpacity
              onPress={handleClose}
              activeOpacity={0.78}
              style={[styles.ghostBtn, { borderColor: borderCol, backgroundColor: surfaceBg, flex: 1 }]}
            >
              <Text style={[styles.ghostBtnText, { color: c.ink }]}>{t('no_back')}</Text>
            </TouchableOpacity>

            {/* Confirm cancel (danger) */}
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={!canConfirm || loading}
              activeOpacity={0.88}
              style={[
                styles.dangerBtn,
                { flex: 1, opacity: !canConfirm || loading ? 0.35 : 1 },
              ]}
            >
              {loading
                ? <AppLoader size={22} />
                : <Text style={styles.dangerBtnText}>{t('confirm_cancel')}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    width: 40, height: 5, borderRadius: 3,
    alignSelf: 'center', marginBottom: 20,
  },

  title: {
    fontSize: 22, fontWeight: '700', letterSpacing: -0.44,
  },
  subtitle: {
    fontSize: 14, marginTop: 4, lineHeight: 20,
  },

  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14,
  },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  reasonText: {
    fontSize: 15, fontWeight: '500', flex: 1,
  },

  optionalHint: {
    fontSize: 12, textAlign: 'center', marginBottom: 14,
  },
  errorText: {
    fontSize: 13, color: '#E85454', textAlign: 'center', marginBottom: 12,
  },

  ghostBtn: {
    height: 56, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  ghostBtnText: { fontSize: 15, fontWeight: '600' },

  dangerBtn: {
    height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E85454',
    shadowColor: '#E85454',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  dangerBtnText: {
    fontSize: 15, fontWeight: '600', color: '#ffffff',
  },
});
