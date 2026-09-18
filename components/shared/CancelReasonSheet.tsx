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
import { useSplitColors, type SplitColors } from '@/constants/splitTheme';

// Same red DriverAssignedCard uses for its own (text-only) Cancel Ride —
// kept as one shared "this is destructive" signal across the app rather
// than each screen picking its own red.
const C_RED_MUTED = '#E5484D';

interface CancelReasonSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  mode?: 'shuttle' | 'ride';
}

export function CancelReasonSheet({ visible, onClose, onConfirm, mode = 'ride' }: CancelReasonSheetProps) {
  const { t } = useTheme();
  const S = useSplitColors();
  const styles = useMemo(() => makeStyles(S), [S]);
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
        <View style={[styles.sheet, { backgroundColor: S.card, borderColor: S.hair, paddingBottom: insets.bottom + 16 }]}>
          {/* Drag handle */}
          <View style={[styles.handle, { backgroundColor: S.hair }]} />

          {/* Title */}
          <View style={{ marginBottom: 4 }}>
            <Text style={[styles.title, { color: S.ink }]}>{t('cancel_trip')}</Text>
            <Text style={[styles.subtitle, { color: S.inkSoft }]}>
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
                      backgroundColor: S.surfaceMuted,
                      borderColor: active ? S.teal : S.hair,
                      borderWidth: active ? 2 : 1,
                    },
                  ]}
                >
                  {/* Radio circle */}
                  <View style={[
                    styles.radio,
                    { borderColor: active ? S.teal : S.cap },
                    active ? { backgroundColor: S.teal } : {},
                  ]}>
                    {active ? <Check size={11} color="#ffffff" strokeWidth={3} /> : null}
                  </View>
                  <Text style={[styles.reasonText, { color: S.ink }]}>{reason}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {mode === 'shuttle' && (
            <Text style={[styles.optionalHint, { color: S.inkSoft }]}>{t('selection_optional')}</Text>
          )}

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          {/* Buttons — the safe/keep-going choice gets the strong, on-theme
              fill; the destructive one stays a quiet outline (matches how
              DriverAssignedCard's own Cancel Ride is just a small red text
              link, never a loud filled block). */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* Back — primary, on-theme */}
            <TouchableOpacity
              onPress={handleClose}
              activeOpacity={0.88}
              style={[styles.primaryBtn, { flex: 1, backgroundColor: S.panel }]}
            >
              <Text style={styles.primaryBtnText}>{t('no_back')}</Text>
            </TouchableOpacity>

            {/* Confirm cancel (destructive, de-emphasized) */}
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={!canConfirm || loading}
              activeOpacity={0.78}
              style={[
                styles.dangerGhostBtn,
                { flex: 1, opacity: !canConfirm || loading ? 0.4 : 1 },
              ]}
            >
              {loading
                ? <AppLoader size={22} />
                : <Text style={styles.dangerGhostBtnText}>{t('confirm_cancel')}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(S: SplitColors) {
  return StyleSheet.create({
  overlay: {
    flex: 1, justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  // Floats off the screen edges with rounded corners on all sides, instead
  // of a full-width, top-only-rounded sheet — matches the driver-assigned
  // card's floating treatment.
  sheet: {
    marginHorizontal: 16, marginBottom: 16,
    borderRadius: 28, borderWidth: 1,
    paddingHorizontal: 20, paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 20,
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
    fontSize: 13, textAlign: 'center', marginBottom: 12, color: C_RED_MUTED,
  },

  // On-theme primary CTA — same dark panel fill RideOptionsSheet's "Find
  // Driver" button uses, so this sheet reads as part of the same app
  // instead of a generic system alert.
  primaryBtn: {
    height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },

  // Destructive action stays a quiet outline — red as a small signifier,
  // not a loud filled block (matches DriverAssignedCard's Cancel Ride,
  // which is just red text with no background at all).
  dangerGhostBtn: {
    height: 56, borderRadius: 16, borderWidth: 1.5,
    borderColor: C_RED_MUTED,
    alignItems: 'center', justifyContent: 'center',
  },
  dangerGhostBtnText: {
    fontSize: 15, fontWeight: '700', color: C_RED_MUTED,
  },
  });
}
