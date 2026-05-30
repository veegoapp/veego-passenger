import { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, Alert, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Check, MessageCircle, Phone } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { ThemeColors } from '@/constants/colors';
import api from '@/src/api/client';

const ISSUE_TYPES = ['issue_booking', 'issue_payment', 'issue_driver', 'issue_app', 'issue_other'] as const;

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
    backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    headerText: { flex: 1 },
    headerTitle: {
      fontSize: 20, fontWeight: '700', color: c.ink, letterSpacing: -0.5, fontFamily: 'Inter_700Bold',
    },
    headerSub: { fontSize: 12.5, color: c.inkSoft, marginTop: 1 },

    scroll: { paddingHorizontal: 20, gap: 20 },
    inputLabel: { fontSize: 11.5, fontWeight: '700', color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },

    issueRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    issueChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 99, borderWidth: 1 },
    issueChipActive: { backgroundColor: c.ink, borderColor: c.ink },
    issueChipInactive: { backgroundColor: c.white, borderColor: c.border },
    issueChipText: { fontSize: 12.5, fontWeight: '600' },

    textArea: {
      borderRadius: 18, borderWidth: 1, borderColor: c.border,
      backgroundColor: c.white, paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 14, color: c.ink, minHeight: 120, textAlignVertical: 'top',
    },
    primaryBtn: {
      height: 56, borderRadius: 20, backgroundColor: c.ink,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: c.ink, shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25, shadowRadius: 14, elevation: 6,
    },
    primaryBtnText: { color: c.isDark ? c.background : c.white, fontSize: 15, fontWeight: '700' },

    successWrap: {
      flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16,
    },
    successCircle: {
      width: 90, height: 90, borderRadius: 45,
      backgroundColor: '#55c49a', alignItems: 'center', justifyContent: 'center',
    },
    successTitle: { fontSize: 22, fontWeight: '700', color: c.ink, letterSpacing: -0.4, textAlign: 'center' },
    successSub: { fontSize: 14, color: c.inkSoft, textAlign: 'center', lineHeight: 21 },
    successBtn: {
      marginTop: 8, height: 52, paddingHorizontal: 40, borderRadius: 18,
      backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center',
    },
    successBtnText: { fontSize: 15, fontWeight: '700', color: c.isDark ? c.background : c.white },

    contactRow: { flexDirection: 'row', gap: 10 },
    contactCard: {
      flex: 1, borderRadius: 20, padding: 16, alignItems: 'center', gap: 8,
    },
    contactIcon: {
      width: 48, height: 48, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center',
    },
    contactLabel: { fontSize: 12, fontWeight: '600', color: c.ink },
    contactSub: { fontSize: 11, color: c.inkSoft, textAlign: 'center' },
  });
}

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? 60 : insets.top;
  const { colors: c, glassStyle: gs, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!selectedIssue || !message.trim()) {
      Alert.alert(t('error'), 'Please select an issue type and describe your problem.');
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSending(true);
    try {
      await api.post('/support/tickets', {
        issueType: selectedIssue,
        message: message.trim(),
      });
    } catch (e: any) {
      const status = e?.response?.status;
      if (status && status !== 404 && status !== 501 && status >= 400 && status < 500) {
        const msg = e?.response?.data?.message ?? 'Failed to send message. Please try again.';
        Alert.alert('Error', msg);
        setSending(false);
        return;
      }
    } finally {
      setSending(false);
    }
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSent(true);
  };

  return (
    <LinearGradient colors={c.luxeGrad} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <TouchableOpacity style={[gs, styles.backBtn]} onPress={() => router.back()} activeOpacity={0.8}>
          <ArrowLeft size={18} color={c.ink} />
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
                { icon: MessageCircle, label: 'Live Chat', sub: 'Avg. 2 min wait', color: '#55c49a', bg: 'rgba(85,196,154,0.1)' },
                { icon: Phone, label: 'Phone', sub: '+20 100 000 0000', color: '#4d9ef6', bg: 'rgba(77,158,246,0.1)' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={[gs, styles.contactCard]}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                    Alert.alert(item.label, item.sub);
                  }}
                >
                  <View style={[styles.contactIcon, { backgroundColor: item.bg }]}>
                    <item.icon size={22} color={item.color} />
                  </View>
                  <Text style={styles.contactLabel}>{item.label}</Text>
                  <Text style={styles.contactSub}>{item.sub}</Text>
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
                        if (Platform.OS !== 'web') Haptics.selectionAsync();
                        setSelectedIssue(key);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.issueChipText,
                        { color: active ? (c.isDark ? c.background : c.white) : c.inkSoft },
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
                placeholderTextColor={c.silver}
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
                ? <ActivityIndicator color={c.isDark ? c.background : c.white} />
                : <Text style={styles.primaryBtnText}>{t('send_message')}</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </LinearGradient>
  );
}
