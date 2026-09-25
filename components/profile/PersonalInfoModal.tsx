import { useMemo, useState, useEffect } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Platform,
  Modal, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLoader } from '@/components/ui/AppLoader';
import { Camera, KeyRound, ChevronRight, ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { makeStyles, ModalHeader, useProfileInfo } from './shared';
import { useSplitColors } from '@/constants/splitTheme';
import { ChangePasswordModal } from './ChangePasswordModal';

export function PersonalInfoModal({
  visible, onClose, onSaved,
  avatarUri, onPickAvatar, avatarUploading, heroInitials,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved?: (name: string) => void;
  avatarUri: string | null;
  onPickAvatar: () => void;
  avatarUploading: boolean;
  heroInitials: string;
}) {
  const { colors: c, t, isRTL } = useTheme();
  const S = useSplitColors();
  const styles = useMemo(() => makeStyles(c, S), [c, S]);
  const { name: savedName, email: savedEmail, phone: savedPhone, gender: savedGender, saveProfile } = useProfileInfo();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setSaved(false);
      setSaving(false);
      setChangePasswordVisible(false);
    }
  }, [visible]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await saveProfile(savedName, savedEmail);
      onSaved?.(savedName);
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 900);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <ModalHeader
          title={t('personal_info_title')}
          onClose={onClose}
          actionLabel={saved ? t('saved') : t('save_changes')}
          onAction={handleSave}
          actionDisabled={saving}
        />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.modalScroll}>

            {/* ── Avatar picker ── */}
            <View style={styles.avatarPickerWrap}>
              <TouchableOpacity onPress={onPickAvatar} activeOpacity={0.85} style={{ position: 'relative' }}>
                <View style={styles.avatarPickerCircle}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                  ) : avatarUploading ? (
                    <ActivityIndicator size="small" color={c.ink} />
                  ) : (
                    <Text style={styles.avatarPickerInitials}>{heroInitials}</Text>
                  )}
                </View>
                <View style={styles.avatarCameraBadge}>
                  <Camera size={13} color={c.isDark ? c.background : '#ffffff'} />
                </View>
              </TouchableOpacity>
              <Text style={{ fontSize: Typography.size.xs, color: c.inkSoft, marginTop: Spacing.sm }}>{t('tap_change_photo')}</Text>
            </View>

            {/* Full Name — read-only */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('full_name')}</Text>
              <View style={{ position: 'relative' }}>
                <Text style={styles.readOnlyInput}>{savedName || '—'}</Text>
                <View style={styles.readOnlyBadge}>
                  <Text style={styles.readOnlyBadgeText}>{t('locked')}</Text>
                </View>
              </View>
            </View>

            {/* Phone — read-only */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('phone')}</Text>
              <View style={{ position: 'relative' }}>
                <Text style={styles.readOnlyInput}>{savedPhone || '—'}</Text>
                <View style={styles.readOnlyBadge}>
                  <Text style={styles.readOnlyBadgeText}>{t('locked')}</Text>
                </View>
              </View>
            </View>

            {/* Email — read-only */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('email_address')}</Text>
              <View style={{ position: 'relative' }}>
                <Text style={styles.readOnlyInput}>{savedEmail || '—'}</Text>
                <View style={styles.readOnlyBadge}>
                  <Text style={styles.readOnlyBadgeText}>{t('locked')}</Text>
                </View>
              </View>
            </View>

            {/* Gender — read-only */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('gender')}</Text>
              <View style={{ position: 'relative' }}>
                <Text style={styles.readOnlyInput}>
                  {savedGender === 'male' ? t('gender_male') : savedGender === 'female' ? t('gender_female') : '—'}
                </Text>
                <View style={styles.readOnlyBadge}>
                  <Text style={styles.readOnlyBadgeText}>{t('locked')}</Text>
                </View>
              </View>
            </View>

            {/* ── Change Password — opens as its own card on top of this page ── */}
            <TouchableOpacity
              style={styles.cardRow}
              onPress={() => { Haptics.selectionAsync(); setChangePasswordVisible(true); }}
              activeOpacity={0.8}
            >
              <View style={styles.cardIconBox}>
                <KeyRound size={18} color={c.ink} />
              </View>
              <Text style={[styles.cardName, { flex: 1 }]}>{t('change_password')}</Text>
              {isRTL ? <ChevronLeft size={16} color={c.silver} /> : <ChevronRight size={16} color={c.silver} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              activeOpacity={0.9}
              disabled={saving}
            >
              {saving ? (
                <AppLoader size={24} />
              ) : (
                <Text style={styles.primaryBtnText}>{saved ? t('saved') : t('save_changes')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <ChangePasswordModal
        visible={changePasswordVisible}
        onClose={() => setChangePasswordVisible(false)}
      />
    </Modal>
  );
}
