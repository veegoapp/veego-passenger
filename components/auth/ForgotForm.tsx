import { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { AppLoader } from '@/components/ui/AppLoader';
import { Lock, Eye, EyeOff, ArrowRight, ArrowLeft, Phone } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import api from '@/src/api/client';
import { makeStyles } from './shared';

export function ForgotForm({ onSuccess }: { onSuccess: (phone: string) => void }) {
  const { t, isRTL, colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const OTP_LENGTH = 6;
  type ForgotStep = 'phone' | 'code';
  const [step, setStep] = useState<ForgotStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [availableChannels, setAvailableChannels] = useState<Array<'whatsapp' | 'sms'>>(['whatsapp']);
  const [channel, setChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const inputRef = useRef<any>(null);

  useEffect(() => {
    api.get('/auth/otp-channels')
      .then(({ data }: { data: { whatsappEnabled: boolean; smsEnabled: boolean; defaultChannel: 'whatsapp' | 'sms' } }) => {
        const channels: Array<'whatsapp' | 'sms'> = [];
        if (data.whatsappEnabled) channels.push('whatsapp');
        if (data.smsEnabled) channels.push('sms');
        if (channels.length > 0) setAvailableChannels(channels);
        setChannel(data.defaultChannel);
      })
      .catch(() => {});
  }, []);

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

  // ── Step A: request a reset code ────────────────────────────────────────
  const requestCode = async (silent = false) => {
    if (!phone.trim() || (countdown > 0 && !silent)) return;
    if (step === 'phone') setLoading(true);
    if (step === 'code' && !silent) setResending(true);
    setError('');
    setSuccessMsg('');
    try {
      await api.post('/auth/forgot-password', { phone: phone.trim(), channel });
      setLocked(false);
      setLockCountdown(0);
      setAttemptsRemaining(null);
      setCountdown(60);
      if (step === 'phone') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep('code');
      } else {
        setSuccessMsg(t('otp_code_sent'));
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const body = e?.response?.data ?? {};
      if (status === 429) {
        const retryAfter: number = body.retryAfter ?? 60;
        setCountdown(retryAfter);
        setError(body.error || t('resend_in').replace('{s}', String(retryAfter)));
      } else {
        setError(body.error ?? body.message ?? t('reset_failed'));
      }
    } finally {
      setLoading(false);
      setResending(false);
    }
  };

  // ── Step B: submit code + new password together ────────────────────────
  const handleReset = async () => {
    if (otp.length < OTP_LENGTH || !password.trim() || !confirm.trim() || locked) return;
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
    setSuccessMsg('');
    try {
      await api.post('/auth/reset-password', { phone: phone.trim(), token: otp, newPassword: password });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t('verify'), t('password_reset_success'));
      onSuccess(phone.trim());
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
      } else if (typeof body.attemptsRemaining === 'number') {
        setAttemptsRemaining(body.attemptsRemaining);
        setError(msg || t('invalid_otp'));
      } else {
        setAttemptsRemaining(null);
        setError(msg || t('reset_failed'));
      }
    } finally {
      setLoading(false);
    }
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

        {availableChannels.length > 1 && (
          <View style={styles.channelRow}>
            {availableChannels.map((ch) => (
              <TouchableOpacity
                key={ch}
                style={[styles.channelChip, channel === ch && styles.channelChipActive]}
                onPress={() => setChannel(ch)}
                activeOpacity={0.8}
              >
                <Text style={[styles.channelChipText, channel === ch && styles.channelChipTextActive]}>
                  {ch === 'whatsapp' ? t('otp_channel_whatsapp') : t('otp_channel_sms')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!!error && <Text style={styles.fieldError}>{error}</Text>}

        <TouchableOpacity
          style={[styles.primaryBtn, (!phone.trim() || loading) && { opacity: 0.6 }]}
          activeOpacity={0.9}
          onPress={() => requestCode()}
          disabled={!phone.trim() || loading}
        >
          {loading ? (
            <AppLoader size={24} />
          ) : (
            <>
              <Text style={styles.primaryBtnText}>{t('send_code')}</Text>
              {isRTL ? <ArrowLeft size={16} color={c.white} /> : <ArrowRight size={16} color={c.white} />}
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // step === 'code' — code entry and new password, submitted together
  const digits = otp.split('');
  while (digits.length < OTP_LENGTH) digits.push('');

  return (
    <View style={styles.form}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>{t('reset_password')}</Text>
        <Text style={styles.formSubtitle}>{t('otp_subtitle')} {phone}</Text>
      </View>

      {/* Hidden real input */}
      <TextInput
        ref={inputRef}
        style={styles.otpHiddenInput}
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

      {/* Visual digit boxes */}
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

      <View style={styles.inputWrap}>
        <View style={styles.inputIcon}>
          <Lock size={16} color={c.inkSoft} />
        </View>
        <TextInput
          style={[styles.inputField, { flex: 1 }]}
          placeholder={t('new_password')}
          placeholderTextColor={c.silver}
          value={password}
          onChangeText={(v) => { setPassword(v); setError(''); }}
          secureTextEntry={!showPass}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!locked}
          textAlign={isRTL ? 'right' : 'left'}
        />
        <TouchableOpacity onPress={() => setShowPass(!showPass)} activeOpacity={0.7}>
          {showPass ? <EyeOff size={16} color={c.inkSoft} /> : <Eye size={16} color={c.inkSoft} />}
        </TouchableOpacity>
      </View>

      <View style={styles.inputWrap}>
        <View style={styles.inputIcon}>
          <Lock size={16} color={c.inkSoft} />
        </View>
        <TextInput
          style={[styles.inputField, { flex: 1 }]}
          placeholder={t('confirm_password')}
          placeholderTextColor={c.silver}
          value={confirm}
          onChangeText={(v) => { setConfirm(v); setError(''); }}
          secureTextEntry={!showPass}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!locked}
          textAlign={isRTL ? 'right' : 'left'}
        />
      </View>

      {!!error && (
        <Text style={styles.fieldError}>
          {error}
          {locked && lockCountdown > 0 ? ` (${t('resend_in').replace('{s}', String(lockCountdown))})` : ''}
          {!locked && attemptsRemaining !== null ? ` — ${t('otp_attempts_remaining').replace('{n}', String(attemptsRemaining))}` : ''}
        </Text>
      )}
      {!!successMsg && !error && <Text style={styles.successText}>{successMsg}</Text>}

      <TouchableOpacity
        style={[
          styles.primaryBtn,
          (otp.length < OTP_LENGTH || !password.trim() || !confirm.trim() || loading || locked) && { opacity: 0.6 },
        ]}
        activeOpacity={0.9}
        onPress={handleReset}
        disabled={otp.length < OTP_LENGTH || !password.trim() || !confirm.trim() || loading || locked}
      >
        {loading ? (
          <AppLoader size={24} />
        ) : (
          <>
            <Text style={styles.primaryBtnText}>{t('reset_password')}</Text>
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
        onPress={() => requestCode()}
        disabled={countdown > 0 || resending}
        activeOpacity={0.7}
      >
        {resending ? (
          <AppLoader size={24} />
        ) : (
          <Text style={[styles.resendBtnText, locked && styles.resendTextEmphasized]}>
            {countdown > 0 ? t('resend_in').replace('{s}', String(countdown)) : t('resend_otp')}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
