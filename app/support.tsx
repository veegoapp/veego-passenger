import { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, KeyboardAvoidingView,
} from 'react-native';
import { AppLoader } from '@/components/ui/AppLoader';
import { showAppAlert } from '@/components/shared/AppAlertHost';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Check, MessageCircle, Phone } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import api from '@/src/api/client';
import { getErrorMessage } from '@/src/utils/errorMessages';
import { Spacing } from '@/constants/spacing';

const ISSUE_TYPES = ['issue_booking', 'issue_payment', 'issue_driver', 'issue_app', 'issue_other'] as const;

const ISSUE_MAP: Record<string, { subject: string; category: string }> = {
  issue_booking: { subject: 'Booking problem',   category: 'other'   },
  issue_payment: { subject: 'Payment issue',     category: 'payment' },
  issue_driver:  { subject: 'Driver complaint',  category: 'quality' },
  issue_app:     { subject: 'App not working',   category: 'other'   },
  issue_other:   { subject: 'Other',             category: 'other'   },
};

// ── C · Split Panel — fixed palette, independent of the app's light/dark theme.
const C_BG = '#EEF0F2';
const C_PANEL = '#14151A';
const C_INK = '#14151A';
const C_INK_SOFT = '#6B7178';
const C_CAP = '#9AA0A6';
const C_HAIR = '#EEF0F1';
const C_TEAL = '#0E9F8E';

function makeStyles() {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: Spacing.lg, gap: Spacing.md },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: C_HAIR },
    headerText: { flex: 1 },
    headerTitle: { fontSize: 19, fontWeight: '800', color: C_INK, letterSpacing: -0.4 },
    headerSub: { fontSize: 12.5, color: C_INK_SOFT, marginTop: 1, fontWeight: '600' },

    scroll: { paddingHorizontal: 20, gap: 20 },
    inputLabel: { fontSize: 11, fontWeight: '700', color: C_CAP, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },

    issueRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    issueChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99, borderWidth: 1.5 },
    issueChipActive: { backgroundColor: C_PANEL, borderColor: C_PANEL },
    issueChipInactive: { backgroundColor: '#fff', borderColor: C_HAIR },
    issueChipText: { fontSize: 12.5, fontWeight: '700' },

    textArea: {
      borderRadius: 18, borderWidth: 1, borderColor: C_HAIR,
      backgroundColor: '#fff', paddingHorizontal: Spacing.lg, paddingVertical: 14,
      fontSize: 14, color: C_INK, minHeight: 120, textAlignVertical: 'top',
    },
    primaryBtn: {
      height: 56, borderRadius: 20, backgroundColor: C_PANEL,
      alignItems: 'center', justifyContent: 'center',
    },
    primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

    successWrap: {
      flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl, gap: Spacing.lg,
    },
    successCircle: {
      width: 90, height: 90, borderRadius: 45,
      backgroundColor: C_TEAL, alignItems: 'center', justifyContent: 'center',
    },
    successTitle: { fontSize: 20, color: C_INK, letterSpacing: -0.3, textAlign: 'center', fontWeight: '800' },
    successSub: { fontSize: 13.5, color: C_INK_SOFT, textAlign: 'center', lineHeight: 21 },
    successBtn: {
      marginTop: Spacing.sm, height: 52, paddingHorizontal: 40, borderRadius: 999,
      backgroundColor: C_PANEL, alignItems: 'center', justifyContent: 'center',
    },
    successBtnText: { fontSize: 15, color: '#fff', fontWeight: '700' },

    contactRow: { flexDirection: 'row', gap: 10 },
    contactCard: {
      flex: 1, padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm,
      backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: C_HAIR,
    },
    contactIcon: {
      width: 48, height: 48, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center',
    },
    contactLabel: { fontSize: 12.5, fontWeight: '700', color: C_INK },
    contactSub: { fontSize: 11, color: C_INK_SOFT, textAlign: 'center' },
  });
}

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const { t, isRTL } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!selectedIssue || !message.trim()) {
      showAppAlert(t('error'), t('support_missing_fields'));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSending(true);
    try {
      const mapped = ISSUE_MAP[selectedIssue] ?? ISSUE_MAP.issue_other;
      await api.post('/support/tickets', {
        subject:  mapped.subject,
        message:  message.trim(),
        category: mapped.category,
      });
    } catch (e: any) {
      const status = e?.response?.status;
      if (status && status !== 404 && status !== 501 && status >= 400 && status < 500) {
        const msg = getErrorMessage(e?.response?.data?.code, e?.response?.data?.message ?? t('send_failed'));
        showAppAlert(t('error'), msg);
        setSending(false);
        return;
      }
    } finally {
      setSending(false);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSent(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C_BG }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          {isRTL ? <ArrowRight size={18} color={C_INK} /> : <ArrowLeft size={18} color={C_INK} />}
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t('contact_title')}</Text>
          <Text style={styles.headerSub}>{t('help_faq')}</Text>
        </View>
      </View>

      {sent ? (
        <View style={styles.successWrap}>
          <View style={styles.successCircle}>
            <Check size={42} color="#ffffff" />
          </View>
          <Text style={styles.successTitle}>{t('message_sent_title')}</Text>
          <Text style={styles.successSub}>{t('message_sent_body')}</Text>
          <TouchableOpacity style={styles.successBtn} onPress={() => router.back()} activeOpacity={0.9}>
            <Text style={styles.successBtnText}>{t('done')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.scroll, { paddingBottom: 60 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.contactRow}>
              {[
                { icon: MessageCircle, label: t('live_chat'), sub: t('live_chat_wait'), color: '#55c49a', bg: 'rgba(85,196,154,0.1)' },
                { icon: Phone, label: t('phone_label'), sub: t('phone_number'), color: '#4d9ef6', bg: 'rgba(77,158,246,0.1)' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={{ flex: 1 }}
                  activeOpacity={0.85}
                  onPress={() => {
                    Haptics.selectionAsync();
                    showAppAlert(item.label, item.sub);
                  }}
                >
                  <View style={styles.contactCard}>
                    <View style={[styles.contactIcon, { backgroundColor: item.bg }]}>
                      <item.icon size={22} color={item.color} />
                    </View>
                    <Text style={styles.contactLabel}>{item.label}</Text>
                    <Text style={styles.contactSub}>{item.sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View>
              <Text style={styles.inputLabel}>{t('issue_type')}</Text>
              <View style={styles.issueRow}>
                {ISSUE_TYPES.map((key) => {
                  const active = selectedIssue === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.issueChip, active ? styles.issueChipActive : styles.issueChipInactive]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedIssue(key);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.issueChipText,
                        { color: active ? '#fff' : C_INK_SOFT },
                      ]}>
                        {t(key)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View>
              <Text style={styles.inputLabel}>{t('describe_issue')}</Text>
              <TextInput
                style={styles.textArea}
                value={message}
                onChangeText={setMessage}
                placeholder={t('issue_placeholder')}
                placeholderTextColor={C_CAP}
                textAlign={isRTL ? 'right' : 'left'}
                multiline
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, sending && { opacity: 0.7 }]}
              onPress={handleSend}
              activeOpacity={0.9}
              disabled={sending}
            >
              {sending
                ? <AppLoader size={24} />
                : <Text style={styles.primaryBtnText}>{t('send_message')}</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
