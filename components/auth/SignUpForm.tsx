import { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { AppLoader } from '@/components/ui/AppLoader';
import { User, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, Phone, Mail, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import api from '@/src/api/client';
import { emitAuthEvent } from '@/src/api/authEvents';
import TermsModal, { fetchPassengerTerms, acceptTerms, type TermsData } from '@/components/shared/TermsModal';
import { makeStyles, saveSession, persistTokens } from './shared';

export function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const { t, isRTL, colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsData, setTermsData] = useState<TermsData | null>(null);
  const [termsFetching, setTermsFetching] = useState(true);

  useEffect(() => {
    setTermsFetching(true);
    fetchPassengerTerms()
      .then(setTermsData)
      .catch((err) => {
        // Terms modal gating (`termsFetching`) already keeps sign-up blocked
        // until this settles; just log so a recurring failure is visible in dev.
        if (__DEV__) console.warn('[Auth] failed to fetch passenger terms:', err);
      })
      .finally(() => setTermsFetching(false));
  }, []);

  const canSubmit = !!(name.trim() && phone.trim() && email.trim() && password.trim() && gender && termsChecked && !loading);

  const handleSignUp = async () => {
    if (!canSubmit) return;
    if (password.length < 8) {
      Alert.alert(t('error'), t('password_min'));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password,
        gender,
      });
      if (data.requiresOtp) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.push({ pathname: '/verify-phone', params: { phone: data.phone ?? phone.trim(), maskedPhone: data.maskedPhone ?? data.phone ?? phone.trim(), termsVersion: String(termsData?.version ?? '') } } as any);
        return;
      }
      // Fallback: backend returned tokens directly (forward compatibility)
      const { accessToken } = await persistTokens(data);
      await saveSession(email.trim(), name.trim());
      if (accessToken && termsData) {
        acceptTerms(termsData.version).catch((err) => {
          if (__DEV__) console.warn('[Auth] failed to record terms acceptance:', err);
        });
      }
      emitAuthEvent('auth:login');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.response?.data?.message ?? t('register_failed');
      Alert.alert(t('error'), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.form}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>{t('sign_up_title')}</Text>
        <Text style={styles.formSubtitle}>{t('sign_up_subtitle')}</Text>
      </View>

      <View style={styles.inputWrap}>
        <View style={styles.inputIcon}>
          <User size={16} color={c.inkSoft} />
        </View>
        <TextInput
          style={styles.inputField}
          placeholder={t('full_name')}
          placeholderTextColor={c.silver}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoCorrect={false}
          textAlign={isRTL ? 'right' : 'left'}
        />
      </View>

      <View style={styles.inputWrap}>
        <View style={styles.inputIcon}>
          <Phone size={16} color={c.inkSoft} />
        </View>
        <TextInput
          style={styles.inputField}
          placeholder={t('phone_placeholder')}
          placeholderTextColor={c.silver}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoCapitalize="none"
          textAlign={isRTL ? 'right' : 'left'}
        />
      </View>

      <View style={styles.inputWrap}>
        <View style={styles.inputIcon}>
          <Mail size={16} color={c.inkSoft} />
        </View>
        <TextInput
          style={styles.inputField}
          placeholder={t('email_address')}
          placeholderTextColor={c.silver}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textAlign={isRTL ? 'right' : 'left'}
        />
      </View>

      <View style={styles.inputWrap}>
        <View style={styles.inputIcon}>
          <Lock size={16} color={c.inkSoft} />
        </View>
        <TextInput
          style={[styles.inputField, { flex: 1 }]}
          placeholder={t('password')}
          placeholderTextColor={c.silver}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPass}
          autoCapitalize="none"
          autoCorrect={false}
          textAlign={isRTL ? 'right' : 'left'}
        />
        <TouchableOpacity onPress={() => setShowPass(!showPass)} activeOpacity={0.7}>
          {showPass ? <EyeOff size={16} color={c.inkSoft} /> : <Eye size={16} color={c.inkSoft} />}
        </TouchableOpacity>
      </View>

      {/* Gender — required */}
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}>
        {(['male', 'female'] as const).map((g) => (
          <TouchableOpacity
            key={g}
            onPress={() => { Haptics.selectionAsync(); setGender(g); }}
            activeOpacity={0.8}
            style={{
              flex: 1,
              height: 52,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: gender === g ? c.ink : c.border,
              backgroundColor: gender === g ? c.ink : c.mist,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: gender === g ? c.white : c.ink }}>
              {g === 'male' ? t('gender_male') : t('gender_female')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Terms checkbox */}
      <TouchableOpacity
        style={[styles.termsCheckRow, isRTL && { flexDirection: 'row-reverse' }]}
        activeOpacity={0.8}
        onPress={() => { Haptics.selectionAsync(); setTermsChecked((v) => !v); }}
      >
        <View style={[styles.checkbox, termsChecked && styles.checkboxChecked]}>
          {termsChecked && <Check size={12} color={c.white} strokeWidth={3} />}
        </View>
        <Text style={[styles.termsCheckText, isRTL && { textAlign: 'right' }]}>
          {t('terms_agree_checkbox')}{' '}
          {termsFetching ? (
            <Text style={styles.termsLink}>{t('terms_link_label')}</Text>
          ) : (
            <Text
              style={styles.termsLink}
              onPress={(e) => { e.stopPropagation(); setShowTermsModal(true); }}
            >
              {t('terms_link_label')}
            </Text>
          )}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.primaryBtn, !canSubmit && { opacity: 0.4 }]}
        activeOpacity={0.9}
        onPress={handleSignUp}
        disabled={!canSubmit}
      >
        {loading ? (
          <AppLoader size={24} />
        ) : (
          <>
            <Text style={styles.primaryBtnText}>{t('sign_up')}</Text>
            {isRTL ? <ArrowLeft size={16} color={c.white} /> : <ArrowRight size={16} color={c.white} />}
          </>
        )}
      </TouchableOpacity>

      <TermsModal
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        termsData={termsData}
        onAccept={() => setTermsChecked(true)}
      />
    </View>
  );
}
