import { useMemo, useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Platform,
  Modal, TextInput, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLoader } from '@/components/ui/AppLoader';
import { Eye, EyeOff } from 'lucide-react-native';
import { showAppAlert } from '@/components/shared/AppAlertHost';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { updatePassword } from '@/src/api/userService';
import { makeStyles, ModalHeader } from './shared';
import { useSplitColors } from '@/constants/splitTheme';

// Same change-password flow that used to live inline inside PersonalInfoModal
// (as an expand/collapse section) — moved out into its own card/modal so it
// no longer shares screen space with the read-only profile fields. The
// validation, API call, and success/error handling below are unchanged.
export function ChangePasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors: c, t } = useTheme();
  const S = useSplitColors();
  const styles = useMemo(() => makeStyles(c, S), [c, S]);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    if (visible) {
      setChangingPw(false);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setShowCurrent(false);
      setShowNew(false);
    }
  }, [visible]);

  const handleChangePassword = async () => {
    // Guards against a double-tap firing two concurrent PATCH requests.
    if (changingPw) return;
    if (!currentPw || !newPw || !confirmPw) {
      showAppAlert(t('error'), t('password_fill_all'));
      return;
    }
    if (newPw.length < 8) {
      showAppAlert(t('error'), t('password_min'));
      return;
    }
    if (newPw !== confirmPw) {
      showAppAlert(t('error'), t('passwords_no_match'));
      return;
    }
    if (newPw === currentPw) {
      showAppAlert(t('error'), t('password_same_as_current'));
      return;
    }
    setChangingPw(true);
    try {
      // Server is the source of truth: it re-verifies currentPw against the
      // stored hash before writing anything, so a wrong current password
      // never succeeds here regardless of what the client checked above.
      await updatePassword(currentPw, newPw);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAppAlert(t('saved'), t('password_updated'));
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      onClose();
    } catch (e: any) {
      showAppAlert(t('error'), e?.response?.data?.message ?? t('password_change_failed'));
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <ModalHeader title={t('change_password')} onClose={onClose} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {/* Current password */}
            <View style={{ position: 'relative' }}>
              <TextInput
                style={[styles.input, { paddingRight: 48 }]}
                placeholder={t('current_password')}
                placeholderTextColor={c.silver}
                value={currentPw}
                onChangeText={setCurrentPw}
                secureTextEntry={!showCurrent}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                textContentType="password"
                autoComplete="current-password"
                editable={!changingPw}
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
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                textContentType="newPassword"
                autoComplete="new-password"
                editable={!changingPw}
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
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              textContentType="newPassword"
              autoComplete="new-password"
              editable={!changingPw}
            />
            <TouchableOpacity
              style={[styles.primaryBtn, changingPw && { opacity: 0.6 }]}
              onPress={handleChangePassword}
              activeOpacity={0.9}
              disabled={changingPw}
            >
              {changingPw ? (
                <AppLoader size={24} />
              ) : (
                <Text style={styles.primaryBtnText}>{t('update_password')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
