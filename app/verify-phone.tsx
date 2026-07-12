import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, ArrowRight, ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { S } from '@/constants/colors';
import type { ThemeColors } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';
import api, { tokenStore } from '@/src/api/client';
import { emitAuthEvent } from '@/src/api/authEvents';
import { acceptTerms } from '@/components/shared/TermsModal';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

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
  const { colors: c, t, isRTL } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const inputRef = useRef<any>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  useEffect(() => {
    if (lockCountdown <= 0) {
      if (locked) setLocked(false);
      return;
    }
    const id = setTimeout(() => setLockCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [lockCountdown, locked]);

  const doResend = async (silent = false) => {
    if (!phone || (countdown > 0 && !silent)) return;
    if (!silent) setResending(true);
    setError('');
    setSuccessMsg('');
    try {
      await api.post('/auth/send-otp', { phone });
      setLocked(false);
      setLockCountdown(0);
      setAttemptsRemaining(null);
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
    if (otp.length < OTP_LENGTH || !phone || locked) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const { data } = await api.post('/auth/verify-otp', { phone, otp });
      await persistTokens(data);
      if (data.user) {
        await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (e: any) {
      const status = e?.response?.status;
      const body = e?.response?.data ?? {};
      const msg: string = body.error ?? body.message ?? '';
      setOtp('');
      if (status === 429) {
        const retryAfter: number = body.retryAfter ?? 900;
        setAttemptsRemaining(null);
        setLocked(true);
        setLockCountdown(retryAfter);
        setError(msg || t('otp_locked_out'));
      } else if (msg.toLowerCase().includes('expired')) {
        setAttemptsRemaining(null);
        setError(t('otp_expired'));
        doResend(true);
      } else if (typeof body.attemptsRemaining === 'number') {
        setAttemptsRemaining(body.attemptsRemaining);
        setError(msg || t('invalid_otp'));
      } else {
        setAttemptsRemaining(null);
        setError(msg || t('invalid_otp'));
      }
    } finally {
      setLoading(false);
    }
  };

  const digits = otp.split('');
  while (digits.length < OTP_LENGTH) digits.push('');
  const displayPhone = maskedPhone || phone || '';

  return (
    <LinearGradient colors={c.luxeGrad} style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={styles.iconWrap}>
            <Shield size={32} color={c.white} />
          </View>

          <Text style={styles.title}>{t('otp_title')}</Text>
          <Text style={styles.subtitle}>{t('otp_subtitle')}</Text>
          <Text style={styles.phone}>{displayPhone}</Text>

          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={otp}
            editable={!locked}
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
                disabled={locked}
                onPress={() => inputRef.current?.focus()}
              >
                <Text style={styles.otpDigit}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {!!error && (
            <Text style={styles.errorText}>
              {error}
              {locked && lockCountdown > 0 ? ` (${t('resend_in').replace('{s}', String(lockCountdown))})` : ''}
              {!locked && attemptsRemaining !== null ? ` — ${t('otp_attempts_remaining').replace('{n}', String(attemptsRemaining))}` : ''}
            </Text>
          )}
          {!!successMsg && !error && <Text style={styles.successText}>{successMsg}</Text>}

          <TouchableOpacity
            style={[styles.primaryBtn, (otp.length < OTP_LENGTH || loading || locked) && { opacity: 0.5 }]}
            activeOpacity={0.9}
            onPress={handleVerify}
            disabled={otp.length < OTP_LENGTH || loading || locked}
          >
            {loading ? (
              <ActivityIndicator color={c.white} size="small" />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>{t('verify')}</Text>
                {isRTL ? <ArrowLeft size={16} color={c.white} /> : <ArrowRight size={16} color={c.white} />}
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.resendBtn,
              locked && styles.resendBtnEmphasized,
              (countdown > 0 || resending) && { opacity: 0.4 },
            ]}
            onPress={() => doResend()}
            disabled={countdown > 0 || resending}
            activeOpacity={0.7}
          >
            {resending ? (
              <ActivityIndicator color={c.inkSoft} size="small" />
            ) : (
              <Text style={[styles.resendText, locked && styles.resendTextEmphasized]}>
                {countdown > 0 ? t('resend_in').replace('{s}', String(countdown)) : t('resend')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1 },
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xxl,
      gap: Spacing.md,
    },
    iconWrap: {
      width: 72, height: 72, borderRadius: Radius.xl,
      backgroundColor: c.ink,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: Spacing.xs,
      ...(S.luxe as any),
    },
    title: {
      fontSize: 26, fontWeight: Typography.weight.bold, color: c.ink,
      letterSpacing: -0.8, textAlign: 'center',
    },
    subtitle: {
      fontSize: Typography.size.sm, color: c.inkSoft, textAlign: 'center',
    },
    phone: {
      fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: c.ink,
      letterSpacing: 1.5, textAlign: 'center',
      marginBottom: Spacing.xs,
    },
    hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
    otpRow: { flexDirection: 'row', gap: 10, marginVertical: Spacing.sm },
    otpBox: {
      width: 48, height: 56, borderRadius: Radius.lg,
      borderWidth: 1.5, borderColor: c.border,
      backgroundColor: 'rgba(255,255,255,0.75)',
      alignItems: 'center', justifyContent: 'center',
    },
    otpBoxActive: {
      borderColor: c.ink,
      backgroundColor: 'rgba(255,255,255,0.95)',
    },
    otpBoxFilled: {
      borderColor: c.accentMint,
      backgroundColor: 'rgba(85,196,154,0.1)',
    },
    otpBoxError: { borderColor: c.error },
    otpDigit: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, color: c.ink },
    errorText: {
      fontSize: 13, color: c.error, textAlign: 'center', marginTop: -4,
    },
    successText: {
      fontSize: 13, color: c.accentMint, fontWeight: Typography.weight.semibold,
      textAlign: 'center', marginTop: -4,
    },
    primaryBtn: {
      width: '100%', height: 56, borderRadius: 20,
      backgroundColor: c.ink,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: Spacing.sm, marginTop: Spacing.sm,
      ...(S.luxe as any),
    },
    primaryBtnText: { color: c.white, fontSize: 15, fontWeight: Typography.weight.semibold },
    resendBtn: { paddingVertical: Spacing.md, paddingHorizontal: 20 },
    resendBtnEmphasized: {
      backgroundColor: 'rgba(85,196,154,0.12)',
      borderRadius: 14,
    },
    resendText: { fontSize: 13, fontWeight: Typography.weight.medium, color: c.inkSoft, textAlign: 'center' },
    resendTextEmphasized: { color: c.accentMint, fontWeight: Typography.weight.bold },
  });
}
