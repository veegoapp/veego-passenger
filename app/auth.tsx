import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Navigation, User, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, Phone, Mail, Shield, Check } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { C, S } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';
import api, { tokenStore } from '@/src/api/client';
import { emitAuthEvent } from '@/src/api/authEvents';
import TermsModal, { fetchPassengerTerms, acceptTerms, type TermsData } from '@/components/shared/TermsModal';

const SESSION_KEY = '@veego_session_v1';

async function saveSession(identifier: string, name?: string) {
  try {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ identifier, name: name || '', loggedInAt: Date.now() }));
  } catch {}
}

async function persistTokens(data: any) {
  const accessToken = data.accessToken ?? data.access_token ?? data.token;
  const refreshToken = data.refreshToken ?? data.refresh_token;
  if (accessToken) await tokenStore.setToken(tokenStore.TOKEN_KEY, accessToken);
  if (refreshToken) await tokenStore.setToken(tokenStore.REFRESH_KEY, refreshToken);
  return { accessToken, refreshToken };
}

type AuthTab = 'signin' | 'signup' | 'forgot';

export default function AuthPage() {
  const [tab, setTab] = useState<AuthTab>('signin');
  const { language, setLanguage, t, colors: c } = useTheme();

  const switchTab = (newTab: AuthTab) => {
    Haptics.selectionAsync();
    setTab(newTab);
  };

  const switchLang = (lang: 'en' | 'ar') => {
    Haptics.selectionAsync();
    setLanguage(lang);
  };

  return (
    <LinearGradient colors={C.luxeGrad} style={styles.root}>
      <View style={styles.langBar}>
        <TouchableOpacity
          style={[styles.langChip, language === 'ar' && styles.langChipActive]}
          onPress={() => switchLang('ar')}
          activeOpacity={0.8}
        >
          <Text style={[styles.langChipText, language === 'ar' && styles.langChipTextActive]}>AR</Text>
        </TouchableOpacity>
        <View style={styles.langSep} />
        <TouchableOpacity
          style={[styles.langChip, language === 'en' && styles.langChipActive]}
          onPress={() => switchLang('en')}
          activeOpacity={0.8}
        >
          <Text style={[styles.langChipText, language === 'en' && styles.langChipTextActive]}>EN</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoBlock}>
            <View style={styles.logoIcon}>
              <Navigation size={24} color={C.white} />
            </View>
            <Text style={styles.wordmark}>VeeGo</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.tabs}>
              {(['signin', 'signup', 'forgot'] as AuthTab[]).map((tabId) => (
                <TouchableOpacity
                  key={tabId}
                  onPress={() => switchTab(tabId)}
                  style={[styles.tabBtn, tab === tabId && styles.tabBtnActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, tab === tabId && styles.tabTextActive]}>
                    {t(tabId === 'signin' ? 'sign_in' : tabId === 'signup' ? 'sign_up' : 'forgot')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {tab === 'signin' && <SignInForm onSuccess={() => router.replace('/(tabs)')} />}
            {tab === 'signup' && <SignUpForm onSuccess={() => router.replace('/(tabs)')} />}
            {tab === 'forgot' && <ForgotForm onSuccess={() => switchTab('signin')} />}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const { t, isRTL } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      SecureStore.getItemAsync(tokenStore.REFRESH_KEY),
    ]).then(([hasHardware, isEnrolled, refreshToken]) => {
      setBiometricAvailable(hasHardware && isEnrolled && !!refreshToken);
    }).catch(() => {});
  }, []);

  const handleBiometric = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to VeeGo',
        fallbackLabel: 'Use Password',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (result.success) {
        emitAuthEvent('auth:login');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onSuccess();
      }
    } catch {
      // biometric unavailable — user falls back to manual entry
    }
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email: email.trim(), password });
      await persistTokens(data);
      await saveSession(email.trim(), data.user?.name ?? data.name);
      emitAuthEvent('auth:login');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
    } catch (e: any) {
      const status = e?.response?.status;
      const body = e?.response?.data ?? {};
      if (status === 403 && body.requiresOtp) {
        router.push({ pathname: '/verify-phone', params: { phone: body.phone, maskedPhone: body.maskedPhone ?? body.phone } } as any);
        return;
      }
      if (status === 403) {
        Alert.alert(t('error'), t('account_blocked'));
      } else {
        Alert.alert(t('error'), body.error ?? body.message ?? t('sign_in_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.form}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>{t('sign_in_title')}</Text>
        <Text style={styles.formSubtitle}>{t('sign_in_subtitle')}</Text>
      </View>

      <View style={styles.inputWrap}>
        <View style={styles.inputIcon}>
          <User size={16} color={C.inkSoft} />
        </View>
        <TextInput
          style={styles.inputField}
          placeholder={t('email_or_phone')}
          placeholderTextColor={C.silver}
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
          <Lock size={16} color={C.inkSoft} />
        </View>
        <TextInput
          style={[styles.inputField, { flex: 1 }]}
          placeholder={t('password')}
          placeholderTextColor={C.silver}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPass}
          autoCapitalize="none"
          autoCorrect={false}
          textAlign={isRTL ? 'right' : 'left'}
        />
        <TouchableOpacity onPress={() => setShowPass(!showPass)} activeOpacity={0.7}>
          {showPass ? <EyeOff size={16} color={C.inkSoft} /> : <Eye size={16} color={C.inkSoft} />}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, (!email.trim() || !password.trim() || loading) && { opacity: 0.6 }]}
        activeOpacity={0.9}
        onPress={handleSignIn}
        disabled={!email.trim() || !password.trim() || loading}
      >
        {loading ? (
          <ActivityIndicator color={C.white} size="small" />
        ) : (
          <>
            <Text style={styles.primaryBtnText}>{t('sign_in')}</Text>
            {isRTL ? <ArrowLeft size={16} color={C.white} /> : <ArrowRight size={16} color={C.white} />}
          </>
        )}
      </TouchableOpacity>

      {biometricAvailable && (
        <TouchableOpacity
          style={styles.biometricBtn}
          activeOpacity={0.9}
          onPress={handleBiometric}
        >
          <Shield size={18} color={C.ink} />
          <Text style={styles.biometricBtnText}>Sign in with Biometrics</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const { t, isRTL } = useTheme();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      .catch(() => {})
      .finally(() => setTermsFetching(false));
  }, []);

  const canSubmit = !!(name.trim() && phone.trim() && email.trim() && password.trim() && termsChecked && !loading);

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
        acceptTerms(termsData.version).catch(() => {});
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
          <User size={16} color={C.inkSoft} />
        </View>
        <TextInput
          style={styles.inputField}
          placeholder={t('full_name')}
          placeholderTextColor={C.silver}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoCorrect={false}
          textAlign={isRTL ? 'right' : 'left'}
        />
      </View>

      <View style={styles.inputWrap}>
        <View style={styles.inputIcon}>
          <Phone size={16} color={C.inkSoft} />
        </View>
        <TextInput
          style={styles.inputField}
          placeholder={t('phone_placeholder')}
          placeholderTextColor={C.silver}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoCapitalize="none"
          textAlign={isRTL ? 'right' : 'left'}
        />
      </View>

      <View style={styles.inputWrap}>
        <View style={styles.inputIcon}>
          <Mail size={16} color={C.inkSoft} />
        </View>
        <TextInput
          style={styles.inputField}
          placeholder={t('email_address')}
          placeholderTextColor={C.silver}
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
          <Lock size={16} color={C.inkSoft} />
        </View>
        <TextInput
          style={[styles.inputField, { flex: 1 }]}
          placeholder={t('password')}
          placeholderTextColor={C.silver}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPass}
          autoCapitalize="none"
          autoCorrect={false}
          textAlign={isRTL ? 'right' : 'left'}
        />
        <TouchableOpacity onPress={() => setShowPass(!showPass)} activeOpacity={0.7}>
          {showPass ? <EyeOff size={16} color={C.inkSoft} /> : <Eye size={16} color={C.inkSoft} />}
        </TouchableOpacity>
      </View>

      {/* Terms checkbox */}
      <TouchableOpacity
        style={[styles.termsCheckRow, isRTL && { flexDirection: 'row-reverse' }]}
        activeOpacity={0.8}
        onPress={() => { Haptics.selectionAsync(); setTermsChecked((v) => !v); }}
      >
        <View style={[styles.checkbox, termsChecked && styles.checkboxChecked]}>
          {termsChecked && <Check size={12} color={C.white} strokeWidth={3} />}
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
          <ActivityIndicator color={C.white} size="small" />
        ) : (
          <>
            <Text style={styles.primaryBtnText}>{t('sign_up')}</Text>
            {isRTL ? <ArrowLeft size={16} color={C.white} /> : <ArrowRight size={16} color={C.white} />}
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

function ForgotForm({ onSuccess }: { onSuccess: () => void }) {
  const { t, isRTL } = useTheme();
  type ForgotStep = 'phone' | 'otp' | 'reset';
  const [step, setStep] = useState<ForgotStep>('phone');
  const [phone, setPhone] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Step A: Phone submission ──────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!phone.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { phone: phone.trim() });
    } catch {
      // Always advance to OTP step to prevent phone enumeration
    } finally {
      setLoading(false);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep('otp');
  };

  if (step === 'phone') {
    return (
      <View style={styles.form}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>{t('forgot_title')}</Text>
          <Text style={styles.formSubtitle}>{t('forgot_subtitle')}</Text>
        </View>

        <View style={styles.inputWrap}>
          <View style={styles.inputIcon}>
            <Phone size={16} color={C.inkSoft} />
          </View>
          <TextInput
            style={styles.inputField}
            placeholder={t('phone_placeholder')}
            placeholderTextColor={C.silver}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
            textAlign={isRTL ? 'right' : 'left'}
          />
        </View>

        {!!error && <Text style={styles.fieldError}>{error}</Text>}

        <TouchableOpacity
          style={[styles.primaryBtn, (!phone.trim() || loading) && { opacity: 0.6 }]}
          activeOpacity={0.9}
          onPress={handleSend}
          disabled={!phone.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color={C.white} size="small" />
          ) : (
            <>
              <Text style={styles.primaryBtnText}>{t('send_code')}</Text>
              {isRTL ? <ArrowLeft size={16} color={C.white} /> : <ArrowRight size={16} color={C.white} />}
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'otp') {
    return (
      <OtpStep
        phone={phone}
        onVerified={(token) => { setOtpToken(token); setStep('reset'); }}
        onResend={handleSend}
        t={t}
      />
    );
  }

  return (
    <ResetStep
      token={otpToken}
      onSuccess={() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSuccess();
      }}
      t={t}
    />
  );
}

function OtpStep({
  phone, onVerified, onResend, t,
}: {
  phone: string;
  onVerified: (token: string) => void;
  onResend: () => void;
  t: (k: any) => string;
}) {
  const { isRTL } = useTheme();
  const OTP_LENGTH = 6;
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const otpDeadlineRef = useRef(Date.now() + 60_000);
  const [countdown, setCountdown] = useState(() =>
    Math.max(0, Math.ceil((otpDeadlineRef.current - Date.now()) / 1000))
  );
  const inputRef = useRef<any>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const handleVerify = async () => {
    if (otp.length < OTP_LENGTH) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/verify-otp', { phone, otp });
      const token = data?.token ?? data?.resetToken ?? data?.data?.token ?? '';
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onVerified(token);
    } catch {
      setError(t('invalid_otp'));
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    if (countdown > 0) return;
    otpDeadlineRef.current = Date.now() + 60_000;
    setCountdown(60);
    setError('');
    onResend();
  };

  // Render digit boxes backed by a hidden TextInput
  const digits = otp.split('');
  while (digits.length < OTP_LENGTH) digits.push('');

  return (
    <View style={styles.form}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>{t('otp_title')}</Text>
        <Text style={styles.formSubtitle}>{t('otp_subtitle')} {phone}</Text>
      </View>

      {/* Hidden real input */}
      <TextInput
        ref={inputRef}
        style={styles.otpHiddenInput}
        value={otp}
        onChangeText={(v) => {
          const cleaned = v.replace(/\D/g, '').slice(0, OTP_LENGTH);
          setOtp(cleaned);
          setError('');
        }}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        autoFocus
        caretHidden
      />

      {/* Visual digit boxes */}
      <View style={styles.otpRow}>
        {digits.map((d, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.otpBox, otp.length === i && styles.otpBoxActive, !!d && styles.otpBoxFilled]}
            activeOpacity={0.85}
            onPress={() => inputRef.current?.focus()}
          >
            <Text style={styles.otpDigit}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!!error && <Text style={styles.fieldError}>{error}</Text>}

      <TouchableOpacity
        style={[styles.primaryBtn, (otp.length < OTP_LENGTH || loading) && { opacity: 0.6 }]}
        activeOpacity={0.9}
        onPress={handleVerify}
        disabled={otp.length < OTP_LENGTH || loading}
      >
        {loading ? (
          <ActivityIndicator color={C.white} size="small" />
        ) : (
          <>
            <Text style={styles.primaryBtnText}>{t('verify')}</Text>
            {isRTL ? <ArrowLeft size={16} color={C.white} /> : <ArrowRight size={16} color={C.white} />}
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.resendBtn, countdown > 0 && { opacity: 0.4 }]}
        onPress={handleResend}
        disabled={countdown > 0}
        activeOpacity={0.7}
      >
        <Text style={styles.resendBtnText}>
          {countdown > 0
            ? t('resend_in').replace('{s}', String(countdown))
            : t('resend_otp')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function ResetStep({
  token, onSuccess, t,
}: {
  token: string;
  onSuccess: () => void;
  t: (k: any) => string;
}) {
  const { isRTL } = useTheme();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async () => {
    if (!password.trim() || !confirm.trim()) return;
    if (password !== confirm) {
      setError(t('passwords_no_match'));
      return;
    }
    if (password.length < 8) {
      setError(t('password_min'));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      Alert.alert(t('verify'), t('password_reset_success'));
      onSuccess();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.response?.data?.error ?? t('reset_failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.form}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>{t('reset_password')}</Text>
        <Text style={styles.formSubtitle}>{t('forgot_subtitle')}</Text>
      </View>

      <View style={styles.inputWrap}>
        <View style={styles.inputIcon}>
          <Lock size={16} color={C.inkSoft} />
        </View>
        <TextInput
          style={[styles.inputField, { flex: 1 }]}
          placeholder={t('new_password')}
          placeholderTextColor={C.silver}
          value={password}
          onChangeText={(v) => { setPassword(v); setError(''); }}
          secureTextEntry={!showPass}
          autoCapitalize="none"
          autoCorrect={false}
          textAlign={isRTL ? 'right' : 'left'}
        />
        <TouchableOpacity onPress={() => setShowPass(!showPass)} activeOpacity={0.7}>
          {showPass ? <EyeOff size={16} color={C.inkSoft} /> : <Eye size={16} color={C.inkSoft} />}
        </TouchableOpacity>
      </View>

      <View style={styles.inputWrap}>
        <View style={styles.inputIcon}>
          <Lock size={16} color={C.inkSoft} />
        </View>
        <TextInput
          style={[styles.inputField, { flex: 1 }]}
          placeholder={t('confirm_password')}
          placeholderTextColor={C.silver}
          value={confirm}
          onChangeText={(v) => { setConfirm(v); setError(''); }}
          secureTextEntry={!showPass}
          autoCapitalize="none"
          autoCorrect={false}
          textAlign={isRTL ? 'right' : 'left'}
        />
      </View>

      {!!error && <Text style={styles.fieldError}>{error}</Text>}

      <TouchableOpacity
        style={[styles.primaryBtn, (!password.trim() || !confirm.trim() || loading) && { opacity: 0.6 }]}
        activeOpacity={0.9}
        onPress={handleReset}
        disabled={!password.trim() || !confirm.trim() || loading}
      >
        {loading ? (
          <ActivityIndicator color={C.white} size="small" />
        ) : (
          <>
            <Text style={styles.primaryBtnText}>{t('reset_password')}</Text>
            {isRTL ? <ArrowLeft size={16} color={C.white} /> : <ArrowRight size={16} color={C.white} />}
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  langBar: {
    position: 'absolute', top: 56, right: 20, zIndex: 20,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 99, paddingHorizontal: 6, paddingVertical: 4, gap: 2,
    shadowColor: '#1e1e28', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  langChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  langChipActive: { backgroundColor: C.ink },
  langChipText: { fontSize: 12, fontWeight: '600', color: C.inkSoft },
  langChipTextActive: { color: C.white },
  langSep: { width: 1, height: 14, backgroundColor: C.border },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40, justifyContent: 'center', gap: 28 },
  logoBlock: { alignItems: 'center', gap: 8, paddingTop: 60 },
  logoIcon: { width: 56, height: 56, borderRadius: 20, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', ...S.float },
  wordmark: { fontSize: 28, fontWeight: '700', color: C.ink, letterSpacing: -1.2, fontFamily: 'Inter_700Bold' },
  card: { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', overflow: 'hidden', ...S.luxe },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border },
  tabBtn: { flex: 1, paddingVertical: 16, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: C.ink, marginBottom: -1 },
  tabText: { fontSize: 12.5, fontWeight: '500', color: C.inkSoft },
  tabTextActive: { color: C.ink, fontWeight: '600' },
  form: { padding: 24, gap: 12 },
  formHeader: { gap: 4, marginBottom: 4 },
  formTitle: { fontSize: 22, fontWeight: '600', color: C.ink, letterSpacing: -0.5, fontFamily: 'Inter_600SemiBold' },
  formSubtitle: { fontSize: 13, color: C.inkSoft, fontFamily: 'Inter_400Regular' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.mist, borderRadius: 18, height: 52, paddingHorizontal: 16, gap: 10 },
  inputIcon: { width: 28, alignItems: 'center' },
  inputField: { flex: 1, fontSize: 14, color: C.ink },
  primaryBtn: { height: 56, borderRadius: 20, backgroundColor: C.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, ...S.luxe },
  primaryBtnText: { color: C.white, fontSize: 15, fontWeight: '600' },
  biometricBtn: { height: 52, borderRadius: 20, backgroundColor: C.mist, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: C.border },
  biometricBtnText: { color: C.ink, fontSize: 15, fontWeight: '600' },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  termsText: { fontSize: 11, color: C.inkSoft, flex: 1 },
  termsLink: { color: C.ink, fontWeight: '600', textDecorationLine: 'underline' },
  termsCheckRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: 4, paddingBottom: 2 },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.mist, alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: C.ink, borderColor: C.ink },
  termsCheckText: { fontSize: 12, color: C.inkSoft, flex: 1, lineHeight: 18 },

  fieldError: {
    fontSize: 12.5,
    color: '#dc2626',
    marginTop: -4,
    paddingHorizontal: 4,
  },

  otpHiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 8,
  },
  otpBox: {
    width: 44,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: {
    borderColor: C.ink,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  otpBoxFilled: {
    borderColor: C.accentMint,
    backgroundColor: 'rgba(85,196,154,0.06)',
  },
  otpDigit: {
    fontSize: 20,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: -0.5,
  },

  resendBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  resendBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: C.inkSoft,
  },
});
