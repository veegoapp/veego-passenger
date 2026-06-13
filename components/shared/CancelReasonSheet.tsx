import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Platform, ActivityIndicator, I18nManager,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { X, CircleDot, Circle } from 'lucide-react-native';
import { C } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';

interface CancelReasonSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  mode?: 'shuttle' | 'ride';
}

export function CancelReasonSheet({ visible, onClose, onConfirm, mode = 'ride' }: CancelReasonSheetProps) {
  const { t } = useTheme();
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

  const handleClose = useCallback(() => {
    setSelected(null);
    setError('');
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={[styles.header, isRTL && styles.rowRTL]}>
            <Text style={styles.title}>{t('cancel_trip')}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={C.inkSoft} />
            </TouchableOpacity>
          </View>

          <Text style={styles.prompt}>
            {mode === 'shuttle' ? t('cancel_trip_q') : t('select_reason')}
          </Text>

          <View style={styles.reasons}>
            {reasons.map((reason) => {
              const active = selected === reason;
              return (
                <TouchableOpacity
                  key={reason}
                  style={[styles.reasonRow, active && styles.reasonRowActive, isRTL && styles.rowRTL]}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                    setSelected(active ? null : reason);
                    setError('');
                  }}
                  activeOpacity={0.75}
                >
                  {active
                    ? <CircleDot size={18} color={C.accentMint} />
                    : <Circle size={18} color={C.border} />
                  }
                  <Text style={[styles.reasonText, active && styles.reasonTextActive]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {mode === 'shuttle' && (
            <Text style={styles.optionalHint}>{isRTL ? 'الاختيار اختياري' : 'Selection is optional'}</Text>
          )}

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.confirmBtn, (!canConfirm || loading) && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!canConfirm || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.confirmBtnText}>{t('confirm_cancel')}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.backBtn} onPress={handleClose} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>{t('no_back')}</Text>
          </TouchableOpacity>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
  title: {
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
  prompt: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  reasons: {
    gap: 8,
    marginBottom: 12,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#f8f8fa',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  reasonRowActive: {
    borderColor: C.accentMint,
    backgroundColor: 'rgba(85,196,154,0.07)',
  },
  reasonText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  reasonTextActive: {
    color: '#1a1a2e',
    fontWeight: '600',
  },
  optionalHint: {
    fontSize: 11.5,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 14,
  },
  errorText: {
    fontSize: 12.5,
    color: '#dc2626',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmBtn: {
    height: 52,
    borderRadius: 18,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  backBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
});
