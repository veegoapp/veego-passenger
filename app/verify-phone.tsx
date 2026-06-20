import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, ArrowRight, ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C, S } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';
import api, { tokenStore } from '@/src/api/client';
import { emitAuthEvent } from '@/src/api/authEvents';
import { acceptTerms } from '@/components/shared/TermsModal';

const SESSION_KEY = '@veego_session_v1';
const OTP_LENGTH = 6;

async function persistTokens(data: any) {
  const accessToken = data.accessToken ?? data.access_token ?? data.token;
  const refreshToken = data.refreshToken ?? data.refresh_token;
  if (accessToken) await tokenStore.setToken(tokenStore.TOKEN_KEY, accessToken);
  if (refreshToken) await tokenStore.setToken(tokenStore.REFRESH_KEY, refreshToken);
}

export default function VerifyPhoneScreen() {
  const { phone, maskedPhone, termsVersion } = useLocalSearchParams<{ phone: string; maskedPhone?: string; termsVersion?: string }>();
  const { t, isRTL } = useTheme();

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [countdown, setCountdown] = useState(0);
  const inputRef = useRef<any>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const doResend = async (silent = false) => {
    if (!phone || (countdown > 0 && !silent)) return;
    if (!silent) setResending(true);
    setError('');
    setSuccessMsg('');
    try {
      await api.post('/auth/send-otp', { phone });
      if (!silent) {
        setSuccessMsg(t('otp_code_sent'));
        setCountdown(60);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const retryAfter: number = e?.response?.data?.retryAfter ?? 60;
      if (status === 429) {
        setCountdown(retryAfter);
        if (!silent) setError(t('resend_in').replace('{s}', String(retryAfter)));
      }
    } finally {
      if (!silent) setResending(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length < OTP_LENGTH || !phone) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const { data } = await api.post('/auth/verify-otp', { phone, otp });
      await persistTokens(data);
      if (data.user) {
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({
          identifier: data.user.email ?? data.user.phone ?? phone,
          name: data.user.name ?? '',
          loggedInAt: Date.now(),
        }));
      }
      emitAuthEvent('auth:login');
      if (termsVersion) {
        const v = parseInt(termsVersion, 10);
        if (!isNaN(v)) acceptTerms(v).catch(() => {});
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (e: any) {
      const msg: string = e?.response?.data?.error ?? e?.response?.data?.message ?? '';
      if (msg.toLowerCase().includes('expired')) {
        setOtp('');
        setError(t('otp_expired'));
        doResend(true);
      } else {
        setError(msg || t('invalid_otp'));
        setOtp('');
      }
    } finally {
      setLoading(false);
    }
  };

  const digits = otp.split('');
  while (digits.length < OTP_LENGTH) digits.push('');
  const displayPhone = maskedPhone || phone || '';

  return (
    <LinearGradient colors={C.luxeGrad} style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={styles.iconWrap}>
            <Shield size={32} color={C.white} />
          </View>

          <Text style={styles.title}>{t('otp_title')}</Text>
          <Text style={styles.subtitle}>{t('otp_subtitle')}</Text>
          <Text style={styles.phone}>{displayPhone}</Text>

          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={otp}
            onChangeText={(v) => {
              const cleaned = v.replace(/\D/g, '').slice(0, OTP_LENGTH);
              setOtp(cleaned);
              setError('');
              setSuccessMsg('');
            }}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            autoFocus
            caretHidden
          />

          <View style={styles.otpRow}>
            {digits.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.otpBox,
                  otp.length === i && styles.otpBoxActive,
                  !!d && styles.otpBoxFilled,
                  !!error && styles.otpBoxError,
                ]}
                activeOpacity={0.85}
                onPress={() => inputRef.current?.focus()}
              >
                <Text style={styles.otpDigit}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}
          {!!successMsg && !error && <Text style={styles.successText}>{successMsg}</Text>}

          <TouchableOpacity
            style={[styles.primaryBtn, (otp.length < OTP_LENGTH || loading) && { opacity: 0.5 }]}
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
            style={[styles.resendBtn, (countdown > 0 || resending) && { opacity: 0.4 }]}
            onPress={() => doResend()}
            disabled={countdown > 0 || resending}
            activeOpacity={0.7}
          >
            {resending ? (
              <ActivityIndicator color={C.inkSoft} size="small" />
            ) : (
              <Text style={styles.resendText}>
                {countdown > 0 ? t('resend_in').replace('{s}', String(countdown)) : t('resend')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: C.ink,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
    ...(S.luxe as any),
  },
  title: {
    fontSize: 26, fontWeight: '700', color: C.ink,
    letterSpacing: -0.8, textAlign: 'center',
  },
  subtitle: {
    fontSize: 14, color: C.inkSoft, textAlign: 'center',
  },
  phone: {
    fontSize: 18, fontWeight: '700', color: C.ink,
    letterSpacing: 1.5, textAlign: 'center',
    marginBottom: 4,
  },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  otpRow: { flexDirection: 'row', gap: 10, marginVertical: 8 },
  otpBox: {
    width: 48, height: 56, borderRadius: 16,
    borderWidth: 1.5, borderColor: C.border,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center', justifyContent: 'center',
  },
  otpBoxActive: {
    borderColor: C.ink,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  otpBoxFilled: {
    borderColor: C.accentMint,
    backgroundColor: 'rgba(85,196,154,0.1)',
  },
  otpBoxError: { borderColor: '#dc2626' },
  otpDigit: { fontSize: 22, fontWeight: '700', color: C.ink },
  errorText: {
    fontSize: 13, color: '#dc2626', textAlign: 'center', marginTop: -4,
  },
  successText: {
    fontSize: 13, color: C.accentMint, fontWeight: '600',
    textAlign: 'center', marginTop: -4,
  },
  primaryBtn: {
    width: '100%', height: 56, borderRadius: 20,
    backgroundColor: C.ink,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 8,
    ...(S.luxe as any),
  },
  primaryBtnText: { color: C.white, fontSize: 15, fontWeight: '600' },
  resendBtn: { paddingVertical: 12, paddingHorizontal: 20 },
  resendText: { fontSize: 13, fontWeight: '500', color: C.inkSoft, textAlign: 'center' },
});
