/**
 * TripSupportSheet — trip-linked "Need Help" bottom sheet.
 *
 * Sends a support ticket with the booking/ride id and serviceType attached so
 * ops can look up the trip directly. Auth token is injected automatically by
 * the Axios interceptor; no extra setup needed here.
 *
 * Pattern mirrors SafetySheet (transparent modal, bottom-sheet layout).
 */

import { useState, useCallback, useMemo} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, ScrollView, Platform, KeyboardAvoidingView, I18nManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppLoader } from '@/components/ui/AppLoader';
import * as Haptics from 'expo-haptics';
import { HelpCircle, X, Check } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { createTripSupportTicket } from '@/src/api/userService';
import { Spacing } from '@/constants/spacing';
import { useSplitColors, type SplitColors } from '@/constants/splitTheme';

// ── C · Split Panel — fixed palette, independent of the app's light/dark theme.
const C_RED = '#D92D20';

const ISSUE_TYPES = [
  'issue_booking',
  'issue_payment',
  'issue_driver',
  'issue_app',
  'issue_other',
] as const;

export interface TripSupportSheetProps {
  visible: boolean;
  onClose: () => void;
  /** 'shuttle' booking — send bookingId */
  serviceType: 'shuttle' | 'car' | 'scooter' | 'delivery';
  /** Shuttle: the booking's own id */
  bookingId?: string | number | null;
  /** Ride: the ride id */
  rideId?: string | number | null;
}

export function TripSupportSheet({
  visible,
  onClose,
  serviceType,
  bookingId,
  rideId,
}: TripSupportSheetProps) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const isRTL = I18nManager.isRTL;
  const S = useSplitColors();
  const styles = makeStyles(isRTL, S);

  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setSelectedIssue(null);
    setMessage('');
    setSending(false);
    setSent(false);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSend = useCallback(async () => {
    if (!selectedIssue || !message.trim()) {
      setError(t('support_missing_fields'));
      return;
    }
    setError(null);
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await createTripSupportTicket({
        issueType: selectedIssue,
        message: message.trim(),
        serviceType,
        bookingId: bookingId ?? null,
        rideId: rideId ?? null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch (e: any) {
      const msg: string =
        e?.response?.data?.message ?? e?.message ?? t('send_failed');
      setError(msg);
    } finally {
      setSending(false);
    }
  }, [selectedIssue, message, serviceType, bookingId, rideId, t]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <HelpCircle size={19} color="#fff" />
            </View>
            <Text style={styles.title}>{t('need_help')}</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          {sent ? (
            /* ── Success state ── */
            <View style={styles.successWrap}>
              <View style={styles.successCircle}>
                <Check size={30} color={S.teal} strokeWidth={2.5} />
              </View>
              <Text style={styles.successTitle}>{t('message_sent_title')}</Text>
              <Text style={styles.successSub}>{t('message_sent_body')}</Text>
              <TouchableOpacity style={styles.doneBtn} onPress={handleClose} activeOpacity={0.9}>
                <Text style={styles.doneBtnText}>{t('done')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ── Form ── */
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.formScroll}
            >
              {/* Issue type chips */}
              <Text style={styles.label}>{t('issue_type')}</Text>
              <View style={styles.chipRow}>
                {ISSUE_TYPES.map((key) => {
                  const active = selectedIssue === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedIssue(key);
                        setError(null);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, { color: active ? '#fff' : S.inkSoft }]}>
                        {t(key)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Message input */}
              <Text style={[styles.label, { marginTop: Spacing.lg }]}>{t('describe_issue')}</Text>
              <TextInput
                style={styles.textArea}
                value={message}
                onChangeText={(v) => { setMessage(v); setError(null); }}
                placeholder={t('issue_placeholder')}
                placeholderTextColor={S.cap}
                multiline
                editable={!sending}
              />

              {/* Inline error */}
              {!!error && (
                <Text style={styles.errorText}>{error}</Text>
              )}

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitBtn, sending && { opacity: 0.6 }]}
                onPress={handleSend}
                activeOpacity={0.9}
                disabled={sending}
              >
                {sending
                  ? <AppLoader size={22} />
                  : <Text style={styles.submitBtnText}>{t('send_message')}</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(isRTL: boolean, S: SplitColors) {
  return StyleSheet.create({
    keyboardWrap: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: S.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      overflow: 'hidden',
      maxHeight: '90%',
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
      backgroundColor: S.panel,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 16,
      marginBottom: 20,
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(255,255,255,0.12)',
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

    /* Form */
    formScroll: {
      paddingHorizontal: 20,
      paddingBottom: Spacing.lg,
    },
    label: {
      fontSize: 10.5,
      fontWeight: '700',
      color: S.cap,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: Spacing.sm,
      textAlign: isRTL ? 'right' : 'left',
    },
    chipRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 99,
      borderWidth: 1.5,
    },
    chipActive: {
      backgroundColor: S.panel,
      borderColor: S.panel,
    },
    chipInactive: {
      backgroundColor: S.card,
      borderColor: S.hair,
    },
    chipText: {
      fontSize: 12.5,
      fontWeight: '700',
    },
    textArea: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: S.hair,
      backgroundColor: '#F7F8F8',
      paddingHorizontal: Spacing.lg,
      paddingVertical: 12,
      fontSize: 14,
      color: S.ink,
      minHeight: 100,
      textAlignVertical: 'top',
      textAlign: isRTL ? 'right' : 'left',
    },
    errorText: {
      fontSize: 12,
      color: C_RED,
      marginTop: Spacing.sm,
      textAlign: isRTL ? 'right' : 'left',
    },
    submitBtn: {
      marginTop: Spacing.lg,
      height: 52,
      borderRadius: 16,
      backgroundColor: S.panel,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#ffffff',
    },

    /* Success */
    successWrap: {
      alignItems: 'center',
      paddingVertical: Spacing.xxl,
      paddingHorizontal: 20,
      gap: Spacing.md,
    },
    successCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: 'rgba(14,159,142,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    successTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: S.ink,
      textAlign: 'center',
    },
    successSub: {
      fontSize: 13,
      color: S.inkSoft,
      textAlign: 'center',
      lineHeight: 19,
      paddingHorizontal: Spacing.lg,
    },
    doneBtn: {
      marginTop: Spacing.sm,
      height: 48,
      paddingHorizontal: 36,
      borderRadius: 16,
      backgroundColor: S.panel,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#ffffff',
    },
  });
}
