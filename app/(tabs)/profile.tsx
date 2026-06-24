import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, Alert,
  Switch, Modal, TextInput, KeyboardAvoidingView, SafeAreaView, Animated,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ArrowRight, Camera, Check, CreditCard, Lock, ChevronRight, ChevronLeft, MapPin, BarChart2, Megaphone, Bus, Tag, Lightbulb, User, Shield, ShieldCheck, HelpCircle, MessageCircle, FileText, Info, Star, LogOut, Bell, Moon, Languages, ChevronUp, ChevronDown, Trash2, Eye, EyeOff, KeyRound, Banknote, Wallet } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/context/ThemeContext';
import { useProfile } from '@/src/hooks/shared/useProfile';
import { useTrips } from '@/src/hooks/shared/useTrips';
import { useWallet } from '@/src/hooks/shared/useWallet';
import { usePaymentConfig } from '@/context/PaymentConfigContext';
import api, { tokenStore } from '@/src/api/client';
import { emitAuthEvent } from '@/src/api/authEvents';
import { ThemeColors, S } from '@/constants/colors';
import TermsModal from '@/components/shared/TermsModal';

type ProfileScreen =
  | 'personal_info'
  | 'payment_methods'
  | 'privacy'
  | 'notifications'
  | 'help_faq'
  | 'contact_support'
  | 'rating_details'
  | 'terms'
  | null;

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: 12 },
    headerTitle: { fontSize: 26, fontWeight: '700', color: c.ink, letterSpacing: -0.8, fontFamily: 'Inter_700Bold' },
    scrollContent: { paddingHorizontal: 20, paddingTop: 4, gap: 0 },
    heroCard: { borderRadius: 28, overflow: 'hidden', marginBottom: 20, ...S.float },
    heroGrad: { padding: 20, borderRadius: 28, overflow: 'hidden' },
    heroGlow: { position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.06)' },
    heroContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
    avatarLg: { width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    avatarLgText: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
    heroText: { flex: 1, gap: 2 },
    heroName: { fontSize: 18, fontWeight: '700', color: '#ffffff', fontFamily: 'Inter_700Bold' },
    heroEmail: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },
    heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 0 },
    heroStat: { alignItems: 'center', flex: 1 },
    heroStatNum: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
    heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 1 },
    heroStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)' },
    section: { marginBottom: 16, gap: 8 },
    sectionLabel: { fontSize: 11, fontWeight: '600', color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 1.2, paddingStart: 4 },
    groupCard: { borderRadius: 24, overflow: 'hidden', backgroundColor: c.white },
    settingItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
    itemDivider: { height: 1, backgroundColor: c.border, opacity: 0.6, marginStart: 64 },
    settingIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' },
    settingLabel: { flex: 1, fontSize: 13.5, fontWeight: '500', color: c.ink },
    settingRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    settingValue: { fontSize: 12, color: c.inkSoft },
    langRow: { flexDirection: 'row', gap: 6 },
    langBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, borderWidth: 1 },
    langBtnActive: { backgroundColor: c.ink, borderColor: c.ink },
    langBtnInactive: { backgroundColor: c.white, borderColor: c.border },
    langBtnText: { fontSize: 12, fontWeight: '600' },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 20, borderWidth: 1, borderColor: `${c.badge}40`, backgroundColor: `${c.badge}10` },
    logoutText: { fontSize: 14, fontWeight: '500', color: c.badge },

    modal: { flex: 1, backgroundColor: c.isDark ? c.background : c.snow },
    modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border, gap: 12, backgroundColor: c.white },
    modalBackBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' },
    modalTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: c.ink, fontFamily: 'Inter_700Bold' },
    modalHeaderAction: { fontSize: 14, fontWeight: '600', color: c.ink },
    modalBody: { flex: 1 },
    modalScroll: { padding: 20, gap: 20 },

    inputGroup: { gap: 6 },
    inputLabel: { fontSize: 12, fontWeight: '600', color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 0.8 },
    input: { backgroundColor: c.white, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: c.ink, borderWidth: 1, borderColor: c.border },
    primaryBtn: { height: 52, borderRadius: 18, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center', marginTop: 8, ...S.float },
    primaryBtnText: { color: c.isDark ? c.background : c.white, fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
    dangerBtn: { height: 52, borderRadius: 18, borderWidth: 1, borderColor: `${c.badge}50`, backgroundColor: `${c.badge}10`, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
    dangerBtnText: { color: c.badge, fontSize: 14, fontWeight: '600' },

    cardRow: { backgroundColor: c.white, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, ...S.float },
    cardIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' },
    cardLabel: { flex: 1, gap: 2 },
    cardName: { fontSize: 14, fontWeight: '600', color: c.ink },
    cardSub: { fontSize: 12, color: c.inkSoft },
    defaultBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: `${c.accentMint}20` },
    defaultBadgeText: { fontSize: 11, fontWeight: '600', color: c.accentMint },

    toggleRow: { backgroundColor: c.white, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, ...S.float },
    toggleIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' },
    toggleMeta: { flex: 1 },
    toggleLabel: { fontSize: 14, fontWeight: '600', color: c.ink },
    toggleSub: { fontSize: 12, color: c.inkSoft, marginTop: 2 },

    faqItem: { backgroundColor: c.white, borderRadius: 20, overflow: 'hidden', ...S.float },
    faqQ: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
    faqQText: { flex: 1, fontSize: 14, fontWeight: '600', color: c.ink },
    faqA: { paddingHorizontal: 16, paddingBottom: 16, fontSize: 13.5, color: c.inkSoft, lineHeight: 20 },

    issueRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    issueChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1 },
    issueChipActive: { backgroundColor: c.ink, borderColor: c.ink },
    issueChipInactive: { backgroundColor: c.white, borderColor: c.border },
    issueChipText: { fontSize: 12, fontWeight: '500' },
    textArea: { backgroundColor: c.white, borderRadius: 16, padding: 16, fontSize: 14, color: c.ink, borderWidth: 1, borderColor: c.border, height: 120, textAlignVertical: 'top' },

    successBox: { alignItems: 'center', gap: 14, paddingTop: 60 },
    successIcon: { width: 80, height: 80, borderRadius: 28, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center', ...S.float },
    successTitle: { fontSize: 22, fontWeight: '700', color: c.ink, fontFamily: 'Inter_700Bold' },
    successSub: { fontSize: 14, color: c.inkSoft, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },

    readOnlyInput: {
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f8',
      borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 15, color: c.inkSoft, borderWidth: 1,
      borderColor: c.isDark ? 'rgba(255,255,255,0.06)' : '#ececf0',
    },
    readOnlyBadge: {
      position: 'absolute', right: 14, top: '50%',
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : '#ececf0',
    },
    readOnlyBadgeText: { fontSize: 10, fontWeight: '600', color: c.silver, letterSpacing: 0.4 },

    avatarPickerWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
    avatarPickerCircle: {
      width: 88, height: 88, borderRadius: 44, overflow: 'hidden',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f5',
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: c.isDark ? 'rgba(255,255,255,0.15)' : '#e0e0ea',
    },
    avatarPickerInitials: { fontSize: 28, fontWeight: '700', color: c.ink },
    avatarCameraBadge: {
      position: 'absolute', bottom: 0, right: 0,
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: c.white,
    },

    pwSection: {
      borderRadius: 18, overflow: 'hidden',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : '#f5f5fa',
      borderWidth: 1, borderColor: c.isDark ? 'rgba(255,255,255,0.07)' : '#e8e8f2',
    },
    pwSectionHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 16,
    },
    pwSectionTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: c.ink },
    pwSectionBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },

    ratingHero: { alignItems: 'center', paddingVertical: 28, gap: 6 },
    ratingScore: { fontSize: 56, fontWeight: '800', color: '#ffffff', letterSpacing: -2 },
    ratingStars: { flexDirection: 'row', gap: 4 },
    ratingSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 },
    ratingBarRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 6,
    },
    ratingBarLabel: { fontSize: 13, fontWeight: '600', color: c.ink, width: 14, textAlign: 'center' },
    ratingBarTrack: {
      flex: 1, height: 8, borderRadius: 4,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : '#ececf5',
      overflow: 'hidden',
    },
    ratingBarFill: { height: 8, borderRadius: 4, backgroundColor: '#f59e0b' },
    ratingBarPct: { fontSize: 12, color: c.inkSoft, width: 34, textAlign: 'right' },
  });
}

function ModalHeader({ title, onClose, actionLabel, onAction }: { title: string; onClose: () => void; actionLabel?: string; onAction?: () => void }) {
  const { colors: c, isRTL } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.modalHeader}>
      <TouchableOpacity style={styles.modalBackBtn} onPress={onClose} activeOpacity={0.8}>
        {isRTL ? <ArrowRight size={18} color={c.ink} /> : <ArrowLeft size={18} color={c.ink} />}
      </TouchableOpacity>
      <Text style={styles.modalTitle}>{title}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.8}>
          <Text style={styles.modalHeaderAction}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ✅ useProfileInfo delegates to useProfile which fetches from GET /users/me
export function useProfileInfo() {
  const { profile, loading, saveProfile: apiSave } = useProfile();

  const saveProfile = useCallback(async (n: string, em: string, d: string) => {
    await apiSave({ name: n, email: em, dob: d });
  }, [apiSave]);

  return {
    name: profile.name || 'User',
    email: profile.email || '',
    dob: profile.dob || '',
    phone: profile.phone || '',
    loaded: !loading,
    saveProfile,
  };
}

function PersonalInfoModal({
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
      setPwOpen(false);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    }
  }, [visible, savedEmail, savedDob]);

  const handleSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await saveProfile(savedName, email, dob);
    onSaved?.(savedName);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 900);
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modal}>
        <ModalHeader
          title={t('personal_info_title')}
          onClose={onClose}
          actionLabel={saved ? t('saved') : t('save_changes')}
          onAction={handleSave}
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
              <Text style={{ fontSize: 12, color: c.inkSoft, marginTop: 8 }}>{t('tap_change_photo')}</Text>
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

            <TouchableOpacity style={styles.primaryBtn} onPress={handleSave} activeOpacity={0.9}>
              <Text style={styles.primaryBtnText}>{saved ? t('saved') : t('save_changes')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function PaymentMethodIcon({ iconKey, color }: { iconKey?: string | null; color: string }) {
  const size = 20;
  switch (iconKey) {
    case 'banknote': return <Banknote size={size} color={color} />;
    case 'wallet':   return <Wallet size={size} color={color} />;
    default:         return <CreditCard size={size} color={color} />;
  }
}

function PaymentMethodsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors: c, t, language } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { paymentMethods } = usePaymentConfig();
  const isAr = language === 'ar';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modal}>
        <ModalHeader title={t('payment_title')} onClose={onClose} />
        <ScrollView contentContainerStyle={styles.modalScroll}>
          {paymentMethods.map((method) => (
            <View key={method.key} style={styles.cardRow}>
              <View style={styles.cardIconBox}>
                <PaymentMethodIcon iconKey={method.icon} color={c.ink} />
              </View>
              <View style={styles.cardLabel}>
                <Text style={styles.cardName}>{isAr ? method.nameAr : method.name}</Text>
                {(isAr ? method.descriptionAr : method.description) ? (
                  <Text style={styles.cardSub}>{isAr ? method.descriptionAr : method.description}</Text>
                ) : null}
              </View>
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>{t('active')}</Text>
              </View>
            </View>
          ))}
          {paymentMethods.length === 0 && (
            <Text style={[styles.cardSub, { textAlign: 'center', marginTop: 24 }]}>
              {t('no_payment_methods')}
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// SecurityModal removed per Phase 7 — security settings consolidated into PersonalInfoModal (Change Password)

function PrivacyModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors: c, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [locationHistory, setLocationHistory] = useState(true);
  const [analytics, setAnalytics] = useState(true);
  const [ads, setAds] = useState(false);

  useEffect(() => {
    if (!visible) return;
    api.get('/users/me/privacy').then(({ data }) => {
      if (typeof data.privacyLocationHistory === 'boolean') setLocationHistory(data.privacyLocationHistory);
      if (typeof data.privacyAnalytics === 'boolean') setAnalytics(data.privacyAnalytics);
      if (typeof data.privacyPersonalizedAds === 'boolean') setAds(data.privacyPersonalizedAds);
    }).catch(() => {});
  }, [visible]);

  const syncPrivacy = (field: string, value: boolean) => {
    api.patch('/users/me/privacy', { [field]: value }).catch(() => {});
  };

  const TOGGLES = [
    { icon: MapPin, label: t('location_history'), sub: t('location_history_sub'), value: locationHistory, set: (v: boolean) => { setLocationHistory(v); syncPrivacy('privacyLocationHistory', v); } },
    { icon: BarChart2, label: t('share_analytics'), sub: t('share_analytics_sub'), value: analytics, set: (v: boolean) => { setAnalytics(v); syncPrivacy('privacyAnalytics', v); } },
    { icon: Megaphone, label: t('personalized_ads'), sub: t('personalized_ads_sub'), value: ads, set: (v: boolean) => { setAds(v); syncPrivacy('privacyPersonalizedAds', v); } },
  ];

  const handleDelete = () => {
    Alert.alert(t('delete_account'), t('delete_account_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete_account'), style: 'destructive', onPress: async () => {
          try {
            await api.delete('/users/me');
            try { await AsyncStorage.removeItem('@veego_session_v1'); } catch {}
            try { await tokenStore.removeToken(tokenStore.TOKEN_KEY); } catch {}
            try { await tokenStore.removeToken(tokenStore.REFRESH_KEY); } catch {}
            emitAuthEvent('auth:logout');
            router.replace('/auth');
          } catch {
            Alert.alert(t('error'), t('delete_account_error'));
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modal}>
        <ModalHeader title={t('privacy_title')} onClose={onClose} />
        <ScrollView contentContainerStyle={styles.modalScroll}>
          {TOGGLES.map((item, i) => (
            <View key={i} style={styles.toggleRow}>
              <View style={styles.toggleIcon}>
                <item.icon size={20} color={c.ink} />
              </View>
              <View style={styles.toggleMeta}>
                <Text style={styles.toggleLabel}>{item.label}</Text>
                <Text style={styles.toggleSub}>{item.sub}</Text>
              </View>
              <Switch value={item.value} onValueChange={(v) => { Haptics.selectionAsync(); item.set(v); }} trackColor={{ false: c.silver, true: c.ink }} thumbColor={c.isDark ? c.background : c.white} />
            </View>
          ))}
          <TouchableOpacity style={styles.dangerBtn} onPress={handleDelete} activeOpacity={0.8}>
            <Trash2 size={16} color={c.badge} />
            <Text style={styles.dangerBtnText}>{t('delete_account')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const NOTIF_KEY = '@veego_notif_v1';

function NotificationsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors: c, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [trips, setTrips] = useState(true);
  const [promos, setPromos] = useState(false);
  const [system, setSystem] = useState(true);
  const [driver, setDriver] = useState(true);

  useEffect(() => {
    if (!visible) return;
    api.get('/users/me/notifications').then(({ data }) => {
      if (typeof data.notifTrips === 'boolean') setTrips(data.notifTrips);
      if (typeof data.notifPromos === 'boolean') setPromos(data.notifPromos);
      if (typeof data.notifSystem === 'boolean') setSystem(data.notifSystem);
      if (typeof data.notifDriverUpdates === 'boolean') setDriver(data.notifDriverUpdates);
    }).catch(() => {
      AsyncStorage.getItem(NOTIF_KEY).then((raw) => {
        if (!raw) return;
        try {
          const d = JSON.parse(raw);
          if (typeof d.trips === 'boolean') setTrips(d.trips);
          if (typeof d.promos === 'boolean') setPromos(d.promos);
          if (typeof d.system === 'boolean') setSystem(d.system);
          if (typeof d.driver === 'boolean') setDriver(d.driver);
        } catch {}
      });
    });
  }, [visible]);

  const syncNotif = (apiField: string, localKey: string, value: boolean) => {
    api.patch('/users/me/notifications', { [apiField]: value }).catch(() => {});
    AsyncStorage.getItem(NOTIF_KEY).then((raw) => {
      const current = raw ? JSON.parse(raw) : {};
      AsyncStorage.setItem(NOTIF_KEY, JSON.stringify({ ...current, [localKey]: value }));
    });
  };

  const ITEMS = [
    { icon: Bus, label: t('notif_trips_label'), sub: t('notif_trips_sub'), value: trips, set: (v: boolean) => { setTrips(v); syncNotif('notifTrips', 'trips', v); } },
    { icon: Tag, label: t('notif_promos_label'), sub: t('notif_promos_sub'), value: promos, set: (v: boolean) => { setPromos(v); syncNotif('notifPromos', 'promos', v); } },
    { icon: Megaphone, label: t('notif_system_label'), sub: t('notif_system_sub'), value: system, set: (v: boolean) => { setSystem(v); syncNotif('notifSystem', 'system', v); } },
    { icon: Lightbulb, label: t('notif_driver_label'), sub: t('notif_driver_sub'), value: driver, set: (v: boolean) => { setDriver(v); syncNotif('notifDriverUpdates', 'driver', v); } },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modal}>
        <ModalHeader title={t('notif_settings_title')} onClose={onClose} />
        <ScrollView contentContainerStyle={styles.modalScroll}>
          {ITEMS.map((item, i) => (
            <View key={i} style={styles.toggleRow}>
              <View style={styles.toggleIcon}>
                <item.icon size={20} color={c.ink} />
              </View>
              <View style={styles.toggleMeta}>
                <Text style={styles.toggleLabel}>{item.label}</Text>
                <Text style={styles.toggleSub}>{item.sub}</Text>
              </View>
              <Switch value={item.value} onValueChange={(v) => { Haptics.selectionAsync(); item.set(v); }} trackColor={{ false: c.silver, true: c.ink }} thumbColor={c.isDark ? c.background : c.white} />
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const FAQ_ITEMS = ['faq_q1', 'faq_q2', 'faq_q3', 'faq_q4', 'faq_q5'] as const;
const FAQ_ANSWERS = ['faq_a1', 'faq_a2', 'faq_a3', 'faq_a4', 'faq_a5'] as const;

function HelpFaqModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors: c, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modal}>
        <ModalHeader title={t('help_title')} onClose={onClose} />
        <ScrollView contentContainerStyle={styles.modalScroll}>
          {FAQ_ITEMS.map((qKey, i) => (
            <TouchableOpacity
              key={i}
              style={styles.faqItem}
              activeOpacity={0.8}
              onPress={() => { Haptics.selectionAsync(); setOpenIndex(openIndex === i ? null : i); }}
            >
              <View style={styles.faqQ}>
                <View style={[styles.toggleIcon, { backgroundColor: c.mist }]}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: c.ink }}>{i + 1}</Text>
                </View>
                <Text style={styles.faqQText}>{t(qKey)}</Text>
                {openIndex === i ? <ChevronUp size={16} color={c.silver} /> : <ChevronDown size={16} color={c.silver} />}
              </View>
              {openIndex === i && (
                <Text style={styles.faqA}>{t(FAQ_ANSWERS[i])}</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const ISSUE_TYPES = ['issue_booking', 'issue_payment', 'issue_driver', 'issue_app', 'issue_other'] as const;

function ContactSupportModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors: c, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!selectedIssue || !message.trim()) {
      Alert.alert(t('error'), t('support_missing_fields'));
      return;
    }
    setLoading(true);
    try {
      await api.post('/support/tickets', {
        issueType: selectedIssue,
        message: message.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
    } catch {
      Alert.alert(t('error'), 'Failed to send your message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSent(false);
    setMessage('');
    setSelectedIssue(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modal}>
        <ModalHeader title={t('contact_title')} onClose={handleClose} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {sent ? (
              <View style={styles.successBox}>
                <View style={styles.successIcon}>
                  <Check size={36} color="#ffffff" />
                </View>
                <Text style={styles.successTitle}>{t('message_sent_title')}</Text>
                <Text style={styles.successSub}>{t('message_sent_body')}</Text>
                <TouchableOpacity style={[styles.primaryBtn, { paddingHorizontal: 40 }]} onPress={handleClose} activeOpacity={0.9}>
                  <Text style={styles.primaryBtnText}>{t('done')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={{ gap: 8 }}>
                  <Text style={styles.inputLabel}>{t('issue_type')}</Text>
                  <View style={styles.issueRow}>
                    {ISSUE_TYPES.map((key) => {
                      const active = selectedIssue === key;
                      return (
                        <TouchableOpacity
                          key={key}
                          style={[styles.issueChip, active ? styles.issueChipActive : styles.issueChipInactive]}
                          onPress={() => { Haptics.selectionAsync(); setSelectedIssue(key); }}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.issueChipText, { color: active ? (c.isDark ? c.background : c.white) : c.inkSoft }]}>
                            {t(key)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                <View style={{ gap: 8 }}>
                  <Text style={styles.inputLabel}>{t('describe_issue')}</Text>
                  <TextInput
                    style={styles.textArea}
                    value={message}
                    onChangeText={setMessage}
                    placeholder={t('issue_placeholder')}
                    placeholderTextColor={c.silver}
                    multiline
                  />
                </View>
                <TouchableOpacity style={[styles.primaryBtn, loading && { opacity: 0.6 }]} onPress={handleSend} activeOpacity={0.9} disabled={loading}>
                  {loading
                    ? <ActivityIndicator color={c.isDark ? c.background : c.white} size="small" />
                    : <Text style={styles.primaryBtnText}>{t('send_message')}</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Rating Details Modal ─────────────────────────────────────────────────────

function RatingDetailsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors: c, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const barAnims = useRef([1, 2, 3, 4, 5].map(() => new Animated.Value(0))).current;
  const [ratingData, setRatingData] = useState<{
    overallScore: number | null;
    totalRatings: number;
    distribution: Record<number, number>;
  } | null>(null);

  useEffect(() => {
    if (!visible) return;
    api.get('/users/me/rating').then(({ data }) => {
      setRatingData({
        overallScore: data.overallScore ?? null,
        totalRatings: data.totalRatings ?? 0,
        distribution: data.distribution ?? { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      });
    }).catch(() => {
      setRatingData({ overallScore: null, totalRatings: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });
    });
  }, [visible]);

  useEffect(() => {
    if (!visible || !ratingData || ratingData.overallScore === null) return;
    barAnims.forEach((anim) => anim.setValue(0));
    const animations = [5, 4, 3, 2, 1].map((star, i) =>
      Animated.timing(barAnims[i], {
        toValue: (ratingData.distribution[star] ?? 0) / 100,
        duration: 600 + i * 80,
        useNativeDriver: false,
      }),
    );
    Animated.stagger(60, animations).start();
  }, [visible, ratingData]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modal}>
        <ModalHeader title={t('rating_details')} onClose={onClose} />
        <ScrollView contentContainerStyle={[styles.modalScroll, { paddingBottom: 40 }]}>

          {/* Hero score card */}
          <LinearGradient
            colors={[c.ink, c.isDark ? '#2a2a4a' : '#1e2040']}
            style={{ borderRadius: 24, overflow: 'hidden' }}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <View style={styles.ratingHero}>
              <Text style={styles.ratingScore}>
                {ratingData?.overallScore !== null && ratingData?.overallScore !== undefined
                  ? ratingData.overallScore.toFixed(1) : '—'}
              </Text>
              <View style={styles.ratingStars}>
                {[1, 2, 3, 4, 5].map((s) => {
                  const score = ratingData?.overallScore ?? null;
                  return (
                    <Star
                      key={s}
                      size={18}
                      color="#f59e0b"
                      fill={score !== null && s <= Math.round(score) ? '#f59e0b' : 'transparent'}
                      strokeWidth={1.5}
                    />
                  );
                })}
              </View>
              <Text style={styles.ratingSubtitle}>
                {ratingData?.overallScore !== null && ratingData?.overallScore !== undefined
                  ? t('based_on_ratings').replace('{count}', String(ratingData.totalRatings)).replace('{plural}', ratingData.totalRatings !== 1 ? 's' : '')
                  : t('no_ratings_yet')}
              </Text>
            </View>
          </LinearGradient>

          {/* Rating breakdown */}
          <View style={{ backgroundColor: c.white, borderRadius: 22, padding: 18, gap: 4, ...S.float }}>
            <Text style={[styles.inputLabel, { marginBottom: 10 }]}>{t('rating_breakdown')}</Text>
            {!ratingData || ratingData.overallScore === null ? (
              <Text style={{ fontSize: 13, color: c.inkSoft, textAlign: 'center', paddingVertical: 12 }}>
                {t('no_ratings_received')}
              </Text>
            ) : (
              [5, 4, 3, 2, 1].map((star, i) => {
                const pct = ratingData.distribution[star] ?? 0;
                return (
                  <View key={star} style={styles.ratingBarRow}>
                    <Star size={12} color="#f59e0b" fill="#f59e0b" />
                    <Text style={styles.ratingBarLabel}>{star}</Text>
                    <View style={styles.ratingBarTrack}>
                      <Animated.View
                        style={[
                          styles.ratingBarFill,
                          {
                            width: barAnims[i].interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0%', `${pct}%`],
                            }),
                            backgroundColor: star >= 4 ? '#22c55e' : star === 3 ? '#f59e0b' : '#ef4444',
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.ratingBarPct}>{pct}%</Text>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const { colors: c, glassStyle: gs, darkMode, setDarkMode, language, setLanguage, t, isRTL } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [activeModal, setActiveModal] = useState<ProfileScreen>(null);
  const { openTerms } = useLocalSearchParams<{ openTerms?: string }>();

  useEffect(() => {
    if (openTerms === '1') {
      setActiveModal('terms');
    }
  }, [openTerms]);
  const { name: profileName, email: profileEmail } = useProfileInfo();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Live stats — bound to real API data
  const { upcomingTrips, pastTrips } = useTrips();
  const totalTrips = upcomingTrips.length + pastTrips.length;
  const [savedAmount, setSavedAmount] = useState<number | null>(null);
  const [overallRating, setOverallRating] = useState<number | null>(null);

  useEffect(() => {
    api.get('/users/me/stats').then(({ data }) => {
      if (typeof data.savedAmount === 'number') setSavedAmount(data.savedAmount);
    }).catch(() => {});
    api.get('/users/me/rating').then(({ data }) => {
      if (typeof data.overallScore === 'number') setOverallRating(data.overallScore);
    }).catch(() => {});
  }, []);

  const handlePickAvatar = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('photo_permission_title'), t('photo_permission_msg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const prevUri = avatarUri;
    setAvatarUri(asset.uri);
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append('avatar', { uri: asset.uri, name: 'avatar.jpg', type: 'image/jpeg' } as any);
      const { data: uploadData } = await api.post('/users/me/avatar', form);
      if (uploadData?.avatarUrl) setAvatarUri(uploadData.avatarUrl);
    } catch {
      setAvatarUri(prevUri);
      Alert.alert(t('upload_failed'), t('upload_failed_msg'));
    } finally {
      setAvatarUploading(false);
    }
  }, [avatarUri]);

  const heroName = displayName ?? profileName;
  const heroInitials = heroName
    .split(' ')
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'VG';

  const open = (screen: ProfileScreen) => {
    Haptics.selectionAsync();
    setActiveModal(screen);
  };
  const close = () => setActiveModal(null);

  return (
    <LinearGradient colors={c.luxeGrad} style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <Text style={styles.headerTitle}>{t('profile_title')}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[gs, styles.heroCard]}>
          <LinearGradient colors={[c.ink, c.isDark ? '#2a2a4a' : '#2a2a3a']} style={styles.heroGrad}>
            <View style={styles.heroGlow} />
            <View style={styles.heroContent}>
              <TouchableOpacity style={[styles.avatarLg, { overflow: 'hidden' }]} onPress={handlePickAvatar} activeOpacity={0.85}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                ) : avatarUploading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.avatarLgText}>{heroInitials}</Text>
                )}
              </TouchableOpacity>
              <View style={styles.heroText}>
                <Text style={styles.heroName}>{heroName}</Text>
                <Text style={styles.heroEmail}>{profileEmail || ''}</Text>
                <View style={styles.heroStats}>
                  {/* Trips — bound to useTrips */}
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatNum}>{totalTrips}</Text>
                    <Text style={styles.heroStatLabel}>{t('trips_stat')}</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  {/* Rating — tappable → RatingDetailsModal */}
                  <TouchableOpacity style={styles.heroStat} activeOpacity={0.75} onPress={() => open('rating_details')}>
                    <Text style={styles.heroStatNum}>{overallRating !== null ? overallRating.toFixed(1) : '—'}</Text>
                    <Text style={styles.heroStatLabel}>{t('rating_stat')} ›</Text>
                  </TouchableOpacity>
                  <View style={styles.heroStatDivider} />
                  {/* Saved — GET /users/me/stats */}
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatNum}>{savedAmount !== null ? savedAmount.toFixed(0) : '—'}</Text>
                    <Text style={styles.heroStatLabel}>{t('saved_stat')}</Text>
                  </View>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('account')}</Text>
          <View style={[gs, styles.groupCard]}>
            {[
              { icon: User, label: t('personal_info'), value: heroName, screen: 'personal_info' as ProfileScreen },
              { icon: CreditCard, label: t('payment_methods'), value: t('payment_methods_cash'), screen: 'payment_methods' as ProfileScreen },
              { icon: Shield, label: t('privacy'), value: undefined, screen: 'privacy' as ProfileScreen },
            ].map((item, i) => (
              <View key={item.label}>
                {i > 0 && <View style={styles.itemDivider} />}
                <TouchableOpacity style={styles.settingItem} activeOpacity={0.75} onPress={() => open(item.screen)}>
                  <View style={styles.settingIcon}><item.icon size={16} color={c.ink} /></View>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  <View style={styles.settingRight}>
                    {item.value && <Text style={styles.settingValue}>{item.value}</Text>}
                    {isRTL ? <ChevronLeft size={14} color={c.silver} /> : <ChevronRight size={14} color={c.silver} />}
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('preferences')}</Text>
          <View style={[gs, styles.groupCard]}>
            <TouchableOpacity style={styles.settingItem} activeOpacity={0.75} onPress={() => open('notifications')}>
              <View style={styles.settingIcon}><Bell size={16} color={c.ink} /></View>
              <Text style={styles.settingLabel}>{t('push_notifs')}</Text>
              <View style={styles.settingRight}>
                <Text style={styles.settingValue}>{t('notif_on')}</Text>
                {isRTL ? <ChevronLeft size={14} color={c.silver} /> : <ChevronRight size={14} color={c.silver} />}
              </View>
            </TouchableOpacity>

            <View style={styles.itemDivider} />

            <TouchableOpacity style={styles.settingItem} activeOpacity={1}>
              <View style={styles.settingIcon}><Moon size={16} color={c.ink} /></View>
              <Text style={styles.settingLabel}>{t('dark_mode')}</Text>
              <Switch
                value={darkMode}
                onValueChange={(v) => { Haptics.selectionAsync(); setDarkMode(v); }}
                trackColor={{ false: c.silver, true: c.ink }}
                thumbColor={c.isDark ? c.background : c.white}
              />
            </TouchableOpacity>

            <View style={styles.itemDivider} />

            <View style={styles.settingItem}>
              <View style={styles.settingIcon}><Languages size={16} color={c.ink} /></View>
              <Text style={styles.settingLabel}>{t('language')}</Text>
              <View style={styles.langRow}>
                <TouchableOpacity
                  style={[styles.langBtn, language === 'en' ? styles.langBtnActive : styles.langBtnInactive]}
                  onPress={() => { Haptics.selectionAsync(); setLanguage('en'); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.langBtnText, { color: language === 'en' ? (c.isDark ? c.background : c.white) : c.inkSoft }]}>EN</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.langBtn, language === 'ar' ? styles.langBtnActive : styles.langBtnInactive]}
                  onPress={() => { Haptics.selectionAsync(); setLanguage('ar'); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.langBtnText, { color: language === 'ar' ? (c.isDark ? c.background : c.white) : c.inkSoft }]}>AR</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('support')}</Text>
          <View style={[gs, styles.groupCard]}>
            {[
              { icon: HelpCircle, label: t('help_faq'), screen: 'help_faq' as ProfileScreen },
              { icon: MessageCircle, label: t('contact_support'), screen: 'contact_support' as ProfileScreen },
            ].map((item, i) => (
              <View key={item.label}>
                {i > 0 && <View style={styles.itemDivider} />}
                <TouchableOpacity style={styles.settingItem} activeOpacity={0.75} onPress={() => open(item.screen)}>
                  <View style={styles.settingIcon}><item.icon size={16} color={c.ink} /></View>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  {isRTL ? <ChevronLeft size={14} color={c.silver} /> : <ChevronRight size={14} color={c.silver} />}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('app_version_label')}</Text>
          <View style={[gs, styles.groupCard]}>
            {[
              { icon: FileText, label: t('terms_of_service'), onPress: () => open('terms') },
              { icon: ShieldCheck, label: t('privacy_policy'), onPress: () => Alert.alert(t('privacy_policy'), t('privacy_browser_msg')) },
              { icon: Info, label: t('about_veego'), value: 'v1.0.0', onPress: () => {} },
              { icon: Star, label: t('rate_app'), onPress: () => Alert.alert(t('rate_app'), t('rate_app_msg')) },
            ].map((item, i) => (
              <View key={item.label}>
                {i > 0 && <View style={styles.itemDivider} />}
                <TouchableOpacity style={styles.settingItem} activeOpacity={0.75} onPress={item.onPress}>
                  <View style={styles.settingIcon}><item.icon size={16} color={c.ink} /></View>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  <View style={styles.settingRight}>
                    {(item as any).value && <Text style={styles.settingValue}>{(item as any).value}</Text>}
                    {isRTL ? <ChevronLeft size={14} color={c.silver} /> : <ChevronRight size={14} color={c.silver} />}
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          activeOpacity={0.8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Alert.alert(t('sign_out'), t('sign_out_q'), [
              { text: t('cancel'), style: 'cancel' },
              { text: t('sign_out'), style: 'destructive', onPress: async () => { try { await AsyncStorage.removeItem('@veego_session_v1'); } catch {} emitAuthEvent('auth:logout'); try { await tokenStore.removeToken(tokenStore.TOKEN_KEY); await tokenStore.removeToken(tokenStore.REFRESH_KEY); } catch {} router.replace('/auth'); } },
            ]);
          }}
        >
          <LogOut size={16} color={c.badge} />
          <Text style={styles.logoutText}>{t('sign_out')}</Text>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>

      <PersonalInfoModal
        visible={activeModal === 'personal_info'}
        onClose={close}
        onSaved={(n) => setDisplayName(n)}
        avatarUri={avatarUri}
        onPickAvatar={handlePickAvatar}
        avatarUploading={avatarUploading}
        heroInitials={heroInitials}
      />
      <PaymentMethodsModal visible={activeModal === 'payment_methods'} onClose={close} />
      <PrivacyModal visible={activeModal === 'privacy'} onClose={close} />
      <NotificationsModal visible={activeModal === 'notifications'} onClose={close} />
      <HelpFaqModal visible={activeModal === 'help_faq'} onClose={close} />
      <ContactSupportModal visible={activeModal === 'contact_support'} onClose={close} />
      <RatingDetailsModal visible={activeModal === 'rating_details'} onClose={close} />
      <TermsModal
        visible={activeModal === 'terms'}
        onClose={close}
        checkForUpdates
      />
    </LinearGradient>
  );
}
