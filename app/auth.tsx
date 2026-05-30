import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Navigation, User, Lock, Eye, EyeOff, ArrowRight, Phone, Mail, Shield, Check } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { C, S } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';
import api, { tokenStore } from '@/src/api/client';

const SESSION_KEY = '@veego_session_v1';

async function saveSession(identifier: string, name?: string) {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ identifier, name: name || '', loggedInAt: Date.now() }));
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
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setTab(newTab);
  };

  const switchLang = (lang: 'en' | 'ar') => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
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
  const { t } = useTheme();
  const [credential, setCredential] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSignIn = async () => {
    if (!credential.trim() || !password.trim()) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { credential: credential.trim(), password });
      await persistTokens(data);
      await saveSession(credential.trim(), data.user?.name ?? data.name);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.error ?? e?.response?.data?.message ?? 'Sign in failed. Please try again.';
      if (status === 403) {
        Alert.alert(t('error'), 'Your account has been blocked. Please contact support.');
      } else {
        Alert.alert(t('error'), msg);
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
          value={credential}
          onChangeText={setCredential}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
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
        />
        <TouchableOpacity onPress={() => setShowPass(!showPass)} activeOpacity={0.7}>
          {showPass ? <EyeOff size={16} color={C.inkSoft} /> : <Eye size={16} color={C.inkSoft} />}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, (!credential.trim() || !password.trim() || loading) && { opacity: 0.6 }]}
        activeOpacity={0.9}
        onPress={handleSignIn}
        disabled={!credential.trim() || !password.trim() || loading}
      >
        {loading ? (
          <ActivityIndicator color={C.white} size="small" />
        ) : (
          <>
            <Text style={styles.primaryBtnText}>{t('sign_in')}</Text>
            <ArrowRight size={16} color={C.white} />
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTheme();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSignUp = async () => {
    if (!name.trim() || !phone.trim() || !email.trim() || !password.trim()) return;
    if (password.length < 8) {
      Alert.alert(t('error'), 'Password must be at least 8 characters.');
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password,
      });
      await persistTokens(data);
      await saveSession(email.trim(), name.trim());
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.response?.data?.message ?? 'Registration failed. Please try again.';
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
        />
        <TouchableOpacity onPress={() => setShowPass(!showPass)} activeOpacity={0.7}>
          {showPass ? <EyeOff size={16} color={C.inkSoft} /> : <Eye size={16} color={C.inkSoft} />}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, (!name.trim() || !phone.trim() || !email.trim() || !password.trim() || loading) && { opacity: 0.6 }]}
        activeOpacity={0.9}
        onPress={handleSignUp}
        disabled={!name.trim() || !phone.trim() || !email.trim() || !password.trim() || loading}
      >
        {loading ? (
          <ActivityIndicator color={C.white} size="small" />
        ) : (
          <>
            <Text style={styles.primaryBtnText}>{t('sign_up')}</Text>
            <ArrowRight size={16} color={C.white} />
          </>
        )}
      </TouchableOpacity>

      <View style={styles.termsRow}>
        <Shield size={13} color={C.inkSoft} />
        <Text style={styles.termsText}>
          {t('terms_agree')}{' '}
          <Text style={styles.termsLink}>{t('terms_link')}</Text>
        </Text>
      </View>
    </View>
  );
}

function ForgotForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTheme();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!phone.trim()) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { phone: phone.trim() });
    } catch {
      // Always show success to prevent enumeration
    } finally {
      setLoading(false);
    }
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSent(true);
  };

  if (sent) {
    return (
      <View style={[styles.form, { alignItems: 'center', gap: 16 }]}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', ...S.float }}>
          <Check size={28} color={C.white} />
        </View>
        <Text style={[styles.formTitle, { textAlign: 'center' }]}>{t('otp_title')}</Text>
        <Text style={[styles.formSubtitle, { textAlign: 'center' }]}>{t('otp_subtitle')} {phone}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={onSuccess} activeOpacity={0.9}>
          <Text style={styles.primaryBtnText}>{t('back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        />
      </View>

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
            <ArrowRight size={16} color={C.white} />
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
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  termsText: { fontSize: 11, color: C.inkSoft, flex: 1 },
  termsLink: { color: C.ink, fontWeight: '600' },
});
