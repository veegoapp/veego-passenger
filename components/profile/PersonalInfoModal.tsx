import { useMemo, useState, useEffect } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Alert,
  Modal, TextInput, KeyboardAvoidingView, SafeAreaView,
} from 'react-native';
import { AppLoader } from '@/components/ui/AppLoader';
import { Camera, Eye, EyeOff, KeyRound, ChevronUp, ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import api from '@/src/api/client';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { makeStyles, ModalHeader, useProfileInfo } from './shared';

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
  const { colors: c, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { name: savedName, email: savedEmail, dob: savedDob, phone: savedPhone, saveProfile } = useProfileInfo();
  const [email, setEmail] = useState(savedEmail);
  const [dob, setDob] = useState(savedDob);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (visible) {
      setEmail(savedEmail);
      setDob(savedDob);
      setSaved(false);
      setSaving(false);
      setPwOpen(false);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    }
  }, [visible, savedEmail, savedDob]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await saveProfile(savedName, email, dob);
      onSaved?.(savedName);
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 900);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      Alert.alert(t('error'), t('password_fill_all'));
      return;
    }
    if (newPw !== confirmPw) {
      Alert.alert(t('error'), t('passwords_no_match'));
      return;
    }
    try {
      await api.patch('/users/me/password', { currentPassword: currentPw, newPassword: newPw });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t('saved'), t('password_updated'));
      setPwOpen(false);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (e: any) {
      Alert.alert(t('error'), e?.response?.data?.message ?? t('password_change_failed'));
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
                  <Text style={styles.readOnlyBadgeText}>LOCKED</Text>
                </View>
              </View>
            </View>

            {/* Phone — read-only */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('phone')}</Text>
              <View style={{ position: 'relative' }}>
                <Text style={styles.readOnlyInput}>{savedPhone || '—'}</Text>
                <View style={styles.readOnlyBadge}>
                  <Text style={styles.readOnlyBadgeText}>LOCKED</Text>
                </View>
              </View>
            </View>

            {/* Email — editable */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('email_address')}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={c.silver}
              />
            </View>

            {/* Date of birth — editable */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('date_of_birth')}</Text>
              <TextInput
                style={styles.input}
                value={dob}
                onChangeText={setDob}
                placeholder={t('dob_placeholder')}
                placeholderTextColor={c.silver}
              />
            </View>

            {/* ── Change Password section ── */}
            <View style={styles.pwSection}>
              <TouchableOpacity
                style={styles.pwSectionHeader}
                onPress={() => { Haptics.selectionAsync(); setPwOpen((v) => !v); }}
                activeOpacity={0.8}
              >
                <View style={[styles.toggleIcon, { backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f5' }]}>
                  <KeyRound size={18} color={c.ink} />
                </View>
                <Text style={styles.pwSectionTitle}>{t('change_password')}</Text>
                {pwOpen ? <ChevronUp size={16} color={c.silver} /> : <ChevronDown size={16} color={c.silver} />}
              </TouchableOpacity>
              {pwOpen && (
                <View style={styles.pwSectionBody}>
                  {/* Current password */}
                  <View style={{ position: 'relative' }}>
                    <TextInput
                      style={[styles.input, { paddingRight: 48 }]}
                      placeholder={t('current_password')}
                      placeholderTextColor={c.silver}
                      value={currentPw}
                      onChangeText={setCurrentPw}
                      secureTextEntry={!showCurrent}
                    />
                    <TouchableOpacity
                      style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}
                      onPress={() => setShowCurrent((v) => !v)}
                    >
                      {showCurrent ? <EyeOff size={16} color={c.silver} /> : <Eye size={16} color={c.silver} />}
                    </TouchableOpacity>
                  </View>
                  {/* New password */}
                  <View style={{ position: 'relative' }}>
                    <TextInput
                      style={[styles.input, { paddingRight: 48 }]}
                      placeholder={t('new_password')}
                      placeholderTextColor={c.silver}
                      value={newPw}
                      onChangeText={setNewPw}
                      secureTextEntry={!showNew}
                    />
                    <TouchableOpacity
                      style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}
                      onPress={() => setShowNew((v) => !v)}
                    >
                      {showNew ? <EyeOff size={16} color={c.silver} /> : <Eye size={16} color={c.silver} />}
                    </TouchableOpacity>
                  </View>
                  {/* Confirm password */}
                  <TextInput
                    style={styles.input}
                    placeholder={t('confirm_new_password')}
                    placeholderTextColor={c.silver}
                    value={confirmPw}
                    onChangeText={setConfirmPw}
                    secureTextEntry
                  />
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleChangePassword} activeOpacity={0.9}>
                    <Text style={styles.primaryBtnText}>{t('update_password')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

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
    </Modal>
  );
}
