import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Alert,
  Switch, Modal, TextInput, KeyboardAvoidingView, SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Check, CreditCard, Smartphone, Lock, ChevronRight, Fingerprint, ShieldCheck, MapPin, BarChart2, Megaphone, Bus, Tag, Lightbulb, User, Shield, HelpCircle, MessageCircle, FileText, Info, Star, LogOut, Bell, Moon, Languages, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { useProfile } from '@/src/hooks/useProfile';
import { tokenStore } from '@/src/api/client';
import { emitAuthEvent } from '@/src/api/authEvents';
import { ThemeColors, S } from '@/constants/colors';

type ProfileScreen =
  | 'personal_info'
  | 'payment_methods'
  | 'security'
  | 'privacy'
  | 'notifications'
  | 'help_faq'
  | 'contact_support'
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
  });
}

function ModalHeader({ title, onClose, actionLabel, onAction }: { title: string; onClose: () => void; actionLabel?: string; onAction?: () => void }) {
  const { colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.modalHeader}>
      <TouchableOpacity style={styles.modalBackBtn} onPress={onClose} activeOpacity={0.8}>
        <ArrowLeft size={18} color={c.ink} />
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
    loaded: !loading,
    saveProfile,
  };
}

function PersonalInfoModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved?: (name: string) => void }) {
  const { colors: c, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { name: savedName, email: savedEmail, dob: savedDob, saveProfile } = useProfileInfo();
  const [name, setName] = useState(savedName);
  const [email, setEmail] = useState(savedEmail);
  const [dob, setDob] = useState(savedDob);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(savedName);
      setEmail(savedEmail);
      setDob(savedDob);
      setSaved(false);
    }
  }, [visible, savedName, savedEmail, savedDob]);

  const handleSave = async () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await saveProfile(name, email, dob);
    onSaved?.(name);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 900);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modal}>
        <ModalHeader title={t('personal_info_title')} onClose={onClose} actionLabel={saved ? t('saved') : t('save_changes')} onAction={handleSave} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('full_name')}</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={c.silver} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('phone')}</Text>
              <TextInput style={[styles.input, { color: c.inkSoft }]} value="+20 100 000 0000" editable={false} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('email_address')}</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={c.silver} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('date_of_birth')}</Text>
              <TextInput style={styles.input} value={dob} onChangeText={setDob} placeholder="DD/MM/YYYY" placeholderTextColor={c.silver} />
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

function PaymentMethodsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors: c, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modal}>
        <ModalHeader title={t('payment_title')} onClose={onClose} />
        <ScrollView contentContainerStyle={styles.modalScroll}>
          <View style={styles.cardRow}>
            <View style={styles.cardIconBox}>
              <CreditCard size={20} color={c.ink} />
            </View>
            <View style={styles.cardLabel}>
              <Text style={styles.cardName}>{t('payment_methods_cash')}</Text>
              <Text style={styles.cardSub}>{t('payment_cards_soon')}</Text>
            </View>
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>{t('active')}</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function SecurityModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors: c, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { profile, saveProfile } = useProfile();
  const [biometric, setBiometric] = useState(false);
  const [twoFa, setTwoFa] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const load = async () => {
      const bioApi = profile.biometricEnabled;
      const twoApi = profile.twoFactorEnabled;
      const [bioStored, twoStored] = await Promise.all([
        AsyncStorage.getItem('veego_biometric'),
        AsyncStorage.getItem('veego_2fa'),
      ]);
      setBiometric(bioApi || bioStored === 'true');
      setTwoFa(twoApi || twoStored === 'true');
    };
    load().catch(() => {});
  }, [visible, profile.biometricEnabled, profile.twoFactorEnabled]);

  const persistToggle = async (newBio: boolean, newTwoFa: boolean) => {
    setSaving(true);
    try {
      await Promise.all([
        AsyncStorage.setItem('veego_biometric', String(newBio)),
        AsyncStorage.setItem('veego_2fa', String(newTwoFa)),
      ]);
      const result = await saveProfile({ biometricEnabled: newBio, twoFactorEnabled: newTwoFa });
      if (!result.success) {
        setBiometric(!newBio === biometric ? biometric : !newBio);
        setTwoFa(!newTwoFa === twoFa ? twoFa : !newTwoFa);
        Alert.alert(t('error'), t('toggle_save_failed'));
      }
    } catch {
      Alert.alert(t('error'), t('toggle_save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleBiometricToggle = async (v: boolean) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    if (v && Platform.OS !== 'web') {
      try {
        const LocalAuth = await import('expo-local-authentication');
        const hasHardware = await LocalAuth.hasHardwareAsync();
        const isEnrolled = await LocalAuth.isEnrolledAsync();
        if (!hasHardware || !isEnrolled) {
          Alert.alert(t('biometric'), t('biometric_not_available'));
          return;
        }
        const result = await LocalAuth.authenticateAsync({ promptMessage: t('biometric_verify_prompt') });
        if (!result.success) return;
      } catch {}
    }
    setBiometric(v);
    await persistToggle(v, twoFa);
  };

  const handleTwoFaToggle = async (v: boolean) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setTwoFa(v);
    await persistToggle(biometric, v);
  };

  const ACTIONS = [
    { icon: Smartphone, label: t('change_phone'), sub: t('change_phone_sub'), onPress: () => Alert.alert(t('change_phone'), 'Phone change flow would open here.') },
    { icon: Lock, label: t('change_pin'), sub: t('change_pin_sub'), onPress: () => Alert.alert(t('change_pin'), 'PIN change flow would open here.') },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modal}>
        <ModalHeader title={t('security_title')} onClose={onClose} />
        <ScrollView contentContainerStyle={styles.modalScroll}>
          {ACTIONS.map((item, i) => (
            <TouchableOpacity key={i} style={styles.toggleRow} onPress={item.onPress} activeOpacity={0.8}>
              <View style={styles.toggleIcon}>
                <item.icon size={20} color={c.ink} />
              </View>
              <View style={styles.toggleMeta}>
                <Text style={styles.toggleLabel}>{item.label}</Text>
                <Text style={styles.toggleSub}>{item.sub}</Text>
              </View>
              <ChevronRight size={16} color={c.silver} />
            </TouchableOpacity>
          ))}
          <View style={styles.toggleRow}>
            <View style={styles.toggleIcon}>
              <Fingerprint size={20} color={c.ink} />
            </View>
            <View style={styles.toggleMeta}>
              <Text style={styles.toggleLabel}>{t('biometric')}</Text>
              <Text style={styles.toggleSub}>{t('biometric_sub')}</Text>
            </View>
            <Switch value={biometric} onValueChange={handleBiometricToggle} disabled={saving} trackColor={{ false: c.silver, true: c.ink }} thumbColor={c.isDark ? c.background : c.white} />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.toggleIcon}>
              <ShieldCheck size={20} color={c.ink} />
            </View>
            <View style={styles.toggleMeta}>
              <Text style={styles.toggleLabel}>{t('two_fa')}</Text>
              <Text style={styles.toggleSub}>{t('two_fa_sub')}</Text>
            </View>
            <Switch value={twoFa} onValueChange={handleTwoFaToggle} disabled={saving} trackColor={{ false: c.silver, true: c.ink }} thumbColor={c.isDark ? c.background : c.white} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function PrivacyModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors: c, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [locationHistory, setLocationHistory] = useState(true);
  const [analytics, setAnalytics] = useState(true);
  const [ads, setAds] = useState(false);

  const TOGGLES = [
    { icon: MapPin, label: t('location_history'), sub: t('location_history_sub'), value: locationHistory, set: setLocationHistory },
    { icon: BarChart2, label: t('share_analytics'), sub: t('share_analytics_sub'), value: analytics, set: setAnalytics },
    { icon: Megaphone, label: t('personalized_ads'), sub: t('personalized_ads_sub'), value: ads, set: setAds },
  ];

  const handleDelete = () => {
    Alert.alert(t('delete_account'), t('delete_account_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete_account'), style: 'destructive', onPress: () => Alert.alert('Deleted', 'Account deletion would happen here.') },
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
              <Switch value={item.value} onValueChange={(v) => { if (Platform.OS !== 'web') Haptics.selectionAsync(); item.set(v); }} trackColor={{ false: c.silver, true: c.ink }} thumbColor={c.isDark ? c.background : c.white} />
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
    AsyncStorage.getItem(NOTIF_KEY).then((raw) => {
      if (raw) {
        try {
          const d = JSON.parse(raw);
          if (typeof d.trips === 'boolean') setTrips(d.trips);
          if (typeof d.promos === 'boolean') setPromos(d.promos);
          if (typeof d.system === 'boolean') setSystem(d.system);
          if (typeof d.driver === 'boolean') setDriver(d.driver);
        } catch {}
      }
    });
  }, []);

  const persist = (key: string, value: boolean) => {
    AsyncStorage.getItem(NOTIF_KEY).then((raw) => {
      const current = raw ? JSON.parse(raw) : {};
      AsyncStorage.setItem(NOTIF_KEY, JSON.stringify({ ...current, [key]: value }));
    });
  };

  const ITEMS = [
    { icon: Bus, label: t('notif_trips_label'), sub: t('notif_trips_sub'), value: trips, set: (v: boolean) => { setTrips(v); persist('trips', v); } },
    { icon: Tag, label: t('notif_promos_label'), sub: t('notif_promos_sub'), value: promos, set: (v: boolean) => { setPromos(v); persist('promos', v); } },
    { icon: Megaphone, label: t('notif_system_label'), sub: t('notif_system_sub'), value: system, set: (v: boolean) => { setSystem(v); persist('system', v); } },
    { icon: Lightbulb, label: t('notif_driver_label'), sub: t('notif_driver_sub'), value: driver, set: (v: boolean) => { setDriver(v); persist('driver', v); } },
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
              <Switch value={item.value} onValueChange={(v) => { if (Platform.OS !== 'web') Haptics.selectionAsync(); item.set(v); }} trackColor={{ false: c.silver, true: c.ink }} thumbColor={c.isDark ? c.background : c.white} />
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
              onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync(); setOpenIndex(openIndex === i ? null : i); }}
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

  const handleSend = () => {
    if (!selectedIssue || !message.trim()) {
      Alert.alert(t('error'), 'Please select an issue type and describe your problem.');
      return;
    }
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSent(true);
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
                          onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync(); setSelectedIssue(key); }}
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
                <TouchableOpacity style={styles.primaryBtn} onPress={handleSend} activeOpacity={0.9}>
                  <Text style={styles.primaryBtnText}>{t('send_message')}</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? 60 : insets.top;
  const { colors: c, glassStyle: gs, darkMode, setDarkMode, language, setLanguage, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [activeModal, setActiveModal] = useState<ProfileScreen>(null);
  const { name: profileName, email: profileEmail } = useProfileInfo();
  const [displayName, setDisplayName] = useState<string | null>(null);

  const heroName = displayName ?? profileName;
  const heroInitials = heroName
    .split(' ')
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'VG';

  const open = (screen: ProfileScreen) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
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
              <TouchableOpacity style={styles.avatarLg} onPress={() => open('personal_info')} activeOpacity={0.85}>
                <Text style={styles.avatarLgText}>{heroInitials}</Text>
              </TouchableOpacity>
              <View style={styles.heroText}>
                <Text style={styles.heroName}>{heroName}</Text>
                <Text style={styles.heroEmail}>{profileEmail || '+20 100 000 0000'}</Text>
                <View style={styles.heroStats}>
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatNum}>24</Text>
                    <Text style={styles.heroStatLabel}>{t('trips_stat')}</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatNum}>4.9</Text>
                    <Text style={styles.heroStatLabel}>{t('rating_stat')}</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatNum}>48 {t('egp')}</Text>
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
              { icon: Lock, label: t('security_title'), value: undefined, screen: 'security' as ProfileScreen },
              { icon: Shield, label: t('privacy'), value: undefined, screen: 'privacy' as ProfileScreen },
            ].map((item, i) => (
              <View key={item.label}>
                {i > 0 && <View style={styles.itemDivider} />}
                <TouchableOpacity style={styles.settingItem} activeOpacity={0.75} onPress={() => open(item.screen)}>
                  <View style={styles.settingIcon}><item.icon size={16} color={c.ink} /></View>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  <View style={styles.settingRight}>
                    {item.value && <Text style={styles.settingValue}>{item.value}</Text>}
                    <ChevronRight size={14} color={c.silver} />
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
                <Text style={styles.settingValue}>On</Text>
                <ChevronRight size={14} color={c.silver} />
              </View>
            </TouchableOpacity>

            <View style={styles.itemDivider} />

            <TouchableOpacity style={styles.settingItem} activeOpacity={1}>
              <View style={styles.settingIcon}><Moon size={16} color={c.ink} /></View>
              <Text style={styles.settingLabel}>{t('dark_mode')}</Text>
              <Switch
                value={darkMode}
                onValueChange={(v) => { if (Platform.OS !== 'web') Haptics.selectionAsync(); setDarkMode(v); }}
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
                  onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync(); setLanguage('en'); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.langBtnText, { color: language === 'en' ? (c.isDark ? c.background : c.white) : c.inkSoft }]}>EN</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.langBtn, language === 'ar' ? styles.langBtnActive : styles.langBtnInactive]}
                  onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync(); setLanguage('ar'); }}
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
                  <ChevronRight size={14} color={c.silver} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('app_version_label')}</Text>
          <View style={[gs, styles.groupCard]}>
            {[
              { icon: FileText, label: t('terms_of_service'), onPress: () => Alert.alert(t('terms_of_service'), 'Terms would open in a browser.') },
              { icon: ShieldCheck, label: t('privacy_policy'), onPress: () => Alert.alert(t('privacy_policy'), 'Privacy policy would open in a browser.') },
              { icon: Info, label: t('about_veego'), value: 'v1.0.0', onPress: () => {} },
              { icon: Star, label: t('rate_app'), onPress: () => Alert.alert(t('rate_app'), 'App store rating would open here.') },
            ].map((item, i) => (
              <View key={item.label}>
                {i > 0 && <View style={styles.itemDivider} />}
                <TouchableOpacity style={styles.settingItem} activeOpacity={0.75} onPress={item.onPress}>
                  <View style={styles.settingIcon}><item.icon size={16} color={c.ink} /></View>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  <View style={styles.settingRight}>
                    {(item as any).value && <Text style={styles.settingValue}>{(item as any).value}</Text>}
                    <ChevronRight size={14} color={c.silver} />
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
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

      <PersonalInfoModal visible={activeModal === 'personal_info'} onClose={close} onSaved={(n) => setDisplayName(n)} />
      <PaymentMethodsModal visible={activeModal === 'payment_methods'} onClose={close} />
      <SecurityModal visible={activeModal === 'security'} onClose={close} />
      <PrivacyModal visible={activeModal === 'privacy'} onClose={close} />
      <NotificationsModal visible={activeModal === 'notifications'} onClose={close} />
      <HelpFaqModal visible={activeModal === 'help_faq'} onClose={close} />
      <ContactSupportModal visible={activeModal === 'contact_support'} onClose={close} />
    </LinearGradient>
  );
}
