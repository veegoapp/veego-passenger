/**
 * TripSupportSheet — trip-linked "Need Help" bottom sheet.
 *
 * Sends a support ticket with the booking/ride id and serviceType attached so
 * ops can look up the trip directly. Auth token is injected automatically by
 * the Axios interceptor; no extra setup needed here.
 *
 * Pattern mirrors SafetySheet (transparent modal, bottom-sheet layout).
 */

import { useState, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, ScrollView, Platform, KeyboardAvoidingView, I18nManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppLoader } from '@/components/ui/AppLoader';
import * as Haptics from 'expo-haptics';
import { HelpCircle, X, Check } from 'lucide-react-native';
import { ThemeColors } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';
import { createTripSupportTicket } from '@/src/api/userService';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

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
  const { colors: c, t } = useTheme();
  const insets = useSafeAreaInsets();
  const isRTL = I18nManager.isRTL;
  const styles = useMemo(() => makeStyles(c, isRTL), [c, isRTL]);

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
          <View style={[styles.header, isRTL && styles.rowRTL]}>
            <View style={styles.iconWrap}>
              <HelpCircle size={20} color="#4d9ef6" />
            </View>
            <Text style={styles.title}>Need Help?</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color={c.inkSoft} />
            </TouchableOpacity>
          </View>

          {sent ? (
            /* ── Success state ── */
            <View style={styles.successWrap}>
              <View style={styles.successCircle}>
                <Check size={32} color="#ffffff" />
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
                      <Text
                        style={[
                          styles.chipText,
                          { color: active ? (c.isDark ? c.background : '#ffffff') : c.inkSoft },
                        ]}
                      >
                        {t(key)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Message input */}
              <Text style={[styles.label, { marginTop: Spacing.lg }]}>{t('describe_issue')}</Text>
              <TextInput
                style={[styles.textArea, { textAlign: isRTL ? 'right' : 'left' }]}
                value={message}
                onChangeText={(v) => { setMessage(v); setError(null); }}
                placeholder={t('issue_placeholder')}
                placeholderTextColor={c.silver}
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

function makeStyles(c: ThemeColors, isRTL: boolean) {
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
      backgroundColor: c.white,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: Spacing.md,
      maxHeight: '90%',
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
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(77,158,246,0.12)',
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

    /* Form */
    formScroll: {
      paddingBottom: Spacing.md,
    },
    label: {
      fontSize: 11,
      fontWeight: Typography.weight.semibold,
      color: c.inkSoft,
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
      borderWidth: 1,
    },
    chipActive: {
      backgroundColor: c.ink,
      borderColor: c.ink,
    },
    chipInactive: {
      backgroundColor: c.white,
      borderColor: c.border,
    },
    chipText: {
      fontSize: 12.5,
      fontWeight: Typography.weight.semibold,
    },
    textArea: {
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.isDark ? c.mist : c.white,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 12,
      fontSize: Typography.size.sm,
      color: c.ink,
      minHeight: 100,
      textAlignVertical: 'top',
    },
    errorText: {
      fontSize: Typography.size.xs,
      color: '#dc2626',
      marginTop: Spacing.sm,
      textAlign: isRTL ? 'right' : 'left',
    },
    submitBtn: {
      marginTop: Spacing.lg,
      height: 52,
      borderRadius: Radius.lg,
      backgroundColor: c.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtnText: {
      fontSize: 15,
      fontWeight: Typography.weight.bold,
      color: c.isDark ? c.background : '#ffffff',
    },

    /* Success */
    successWrap: {
      alignItems: 'center',
      paddingVertical: Spacing.xxl,
      gap: Spacing.md,
    },
    successCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: '#55c49a',
      alignItems: 'center',
      justifyContent: 'center',
    },
    successTitle: {
      fontSize: Typography.size.lg,
      fontWeight: Typography.weight.bold,
      color: c.ink,
      textAlign: 'center',
    },
    successSub: {
      fontSize: Typography.size.sm,
      color: c.inkSoft,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: Spacing.lg,
    },
    doneBtn: {
      marginTop: Spacing.sm,
      height: 48,
      paddingHorizontal: 36,
      borderRadius: Radius.lg,
      backgroundColor: c.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneBtnText: {
      fontSize: Typography.size.sm,
      fontWeight: Typography.weight.bold,
      color: c.isDark ? c.background : '#ffffff',
    },
  });
}
