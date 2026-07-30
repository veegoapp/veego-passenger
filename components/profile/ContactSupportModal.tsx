import { useMemo, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Platform,
  Modal, TextInput, KeyboardAvoidingView, SafeAreaView,
} from 'react-native';
import { AppLoader } from '@/components/ui/AppLoader';
import { Check, ImagePlus, X, CircleAlert } from 'lucide-react-native';
import { showAppAlert } from '@/components/shared/AppAlertHost';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/context/ThemeContext';
import { createSupportTicket, uploadSupportAttachment } from '@/src/api/userService';
import { compressImageForUpload } from '@/src/utils/imageCompression';
import { Spacing } from '@/constants/spacing';
import { makeStyles, ModalHeader } from './shared';

const ISSUE_TYPES = ['issue_booking', 'issue_payment', 'issue_driver', 'issue_app', 'issue_other'] as const;
const MAX_ATTACHMENTS = 5;

type AttachmentStatus = 'pending' | 'uploading' | 'done' | 'error';
interface SupportAttachment {
  id: string;
  uri: string;
  status: AttachmentStatus;
}

export function ContactSupportModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors: c, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [sent, setSent] = useState(false);
  const [hadAttachmentError, setHadAttachmentError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePickAttachments = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAppAlert(t('photo_permission_title'), t('photo_permission_msg'));
      return;
    }
    const remaining = MAX_ATTACHMENTS - attachments.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    Haptics.selectionAsync();
    setAttachments((prev) => [
      ...prev,
      ...result.assets.slice(0, remaining).map((a, i) => ({
        id: `${Date.now()}_${i}`,
        uri: a.uri,
        status: 'pending' as AttachmentStatus,
      })),
    ]);
  };

  const handleRemoveAttachment = (id: string) => {
    Haptics.selectionAsync();
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Compresses + uploads each attachment to the ticket one at a time, tracking per-image status
  const uploadAttachments = async (ticketId: string | number) => {
    let anyFailed = false;
    for (const att of attachments) {
      setAttachments((prev) => prev.map((a) => (a.id === att.id ? { ...a, status: 'uploading' } : a)));
      try {
        const compressed = await compressImageForUpload(att.uri);
        const form = new FormData();
        form.append('file', { uri: compressed.uri, name: compressed.name, type: compressed.type } as any);
        await uploadSupportAttachment(ticketId, form);
        setAttachments((prev) => prev.map((a) => (a.id === att.id ? { ...a, status: 'done' } : a)));
      } catch {
        anyFailed = true;
        setAttachments((prev) => prev.map((a) => (a.id === att.id ? { ...a, status: 'error' } : a)));
      }
    }
    return anyFailed;
  };

  const handleSend = async () => {
    if (!selectedIssue || !message.trim()) {
      showAppAlert(t('error'), t('support_missing_fields'));
      return;
    }
    setLoading(true);
    try {
      const ticket = await createSupportTicket(selectedIssue, message.trim());
      const ticketId = ticket?.id;
      const anyFailed = ticketId && attachments.length > 0 ? await uploadAttachments(ticketId) : false;
      setHadAttachmentError(anyFailed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch {
      showAppAlert(t('error'), 'Failed to send your message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSent(false);
    setMessage('');
    setSelectedIssue(null);
    setAttachments([]);
    setHadAttachmentError(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.modal}>
        <ModalHeader title={t('contact_title')} onClose={handleClose} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {sent ? (
              <View style={styles.successBox}>
                <View style={styles.successIcon}>
                  <Check size={36} color="#ffffff" />
                </View>
                <Text style={styles.successTitle}>{t('message_sent_title')}</Text>
                <Text style={styles.successSub}>
                  {hadAttachmentError ? t('message_sent_body_attachment_error') : t('message_sent_body')}
                </Text>
                <TouchableOpacity style={[styles.primaryBtn, { paddingHorizontal: 40 }]} onPress={handleClose} activeOpacity={0.9}>
                  <Text style={styles.primaryBtnText}>{t('done')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={{ gap: Spacing.sm }}>
                  <Text style={styles.inputLabel}>{t('issue_type')}</Text>
                  <View style={styles.issueRow}>
                    {ISSUE_TYPES.map((key) => {
                      const active = selectedIssue === key;
                      return (
                        <TouchableOpacity
                          key={key}
                          style={[styles.issueChip, active ? styles.issueChipActive : styles.issueChipInactive]}
                          onPress={() => { Haptics.selectionAsync(); setSelectedIssue(key); }}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.issueChipText, { color: active ? (c.isDark ? c.background : c.white) : c.inkSoft }]}>
                            {t(key)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                <View style={{ gap: Spacing.sm }}>
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
                <View style={{ gap: Spacing.sm }}>
                  <Text style={styles.inputLabel}>{t('attach_photos')}</Text>
                  <View style={styles.attachmentRow}>
                    {attachments.map((att) => (
                      <View key={att.id} style={styles.attachmentThumb}>
                        <Image source={{ uri: att.uri }} style={styles.attachmentImage} />
                        {att.status === 'uploading' && (
                          <View style={styles.attachmentOverlay}>
                            <ActivityIndicator size="small" color="#ffffff" />
                          </View>
                        )}
                        {att.status === 'done' && (
                          <View style={[styles.attachmentBadge, { backgroundColor: '#22c55e' }]}>
                            <Check size={11} color="#ffffff" strokeWidth={3} />
                          </View>
                        )}
                        {att.status === 'error' && (
                          <View style={[styles.attachmentBadge, { backgroundColor: c.badge }]}>
                            <CircleAlert size={12} color="#ffffff" strokeWidth={2.5} />
                          </View>
                        )}
                        {att.status === 'pending' && !loading && (
                          <TouchableOpacity
                            style={styles.attachmentRemoveBtn}
                            onPress={() => handleRemoveAttachment(att.id)}
                            activeOpacity={0.8}
                          >
                            <X size={11} color="#ffffff" strokeWidth={3} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                    {attachments.length < MAX_ATTACHMENTS && (
                      <TouchableOpacity
                        style={styles.attachmentAddBtn}
                        onPress={handlePickAttachments}
                        activeOpacity={0.8}
                        disabled={loading}
                      >
                        <ImagePlus size={20} color={c.inkSoft} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <TouchableOpacity style={[styles.primaryBtn, loading && { opacity: 0.6 }]} onPress={handleSend} activeOpacity={0.9} disabled={loading}>
                  {loading
                    ? <AppLoader size={24} />
                    : <Text style={styles.primaryBtnText}>{t('send_message')}</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
