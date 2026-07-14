import { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { AppLoader } from '@/components/ui/AppLoader';
import { router } from 'expo-router';
import { User, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, Shield } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '@/context/ThemeContext';
import api, { tokenStore } from '@/src/api/client';
import { emitAuthEvent } from '@/src/api/authEvents';
import { makeStyles, saveSession, persistTokens } from './shared';

export function SignInForm({ onSuccess, initialCredential }: { onSuccess: () => void; initialCredential?: string }) {
  const { t, isRTL, colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [email, setEmail] = useState(initialCredential ?? '');
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
    }).catch((err) => {
      // Availability check failing just means biometric sign-in stays hidden
      // (safe default) — log in dev so a recurring failure isn't invisible.
      if (__DEV__) console.warn('[Auth] biometric availability check failed:', err);
    });
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
      const { data } = await api.post('/auth/login', { credential: email.trim(), password });
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
          <User size={16} color={c.inkSoft} />
        </View>
        <TextInput
          style={styles.inputField}
          placeholder={t('email_or_phone')}
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

      <TouchableOpacity
        style={[styles.primaryBtn, (!email.trim() || !password.trim() || loading) && { opacity: 0.6 }]}
        activeOpacity={0.9}
        onPress={handleSignIn}
        disabled={!email.trim() || !password.trim() || loading}
      >
        {loading ? (
          <AppLoader size={24} />
        ) : (
          <>
            <Text style={styles.primaryBtnText}>{t('sign_in')}</Text>
            {isRTL ? <ArrowLeft size={16} color={c.white} /> : <ArrowRight size={16} color={c.white} />}
          </>
        )}
      </TouchableOpacity>

      {biometricAvailable && (
        <TouchableOpacity
          style={styles.biometricBtn}
          activeOpacity={0.9}
          onPress={handleBiometric}
        >
          <Shield size={18} color={c.ink} />
          <Text style={styles.biometricBtnText}>Sign in with Biometrics</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
