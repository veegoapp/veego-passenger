import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
  Switch,
} from 'react-native';
import { showAppAlert } from '@/components/shared/AppAlertHost';
import { useLocalSearchParams } from 'expo-router';
import { CreditCard, ChevronRight, ChevronLeft, User, Shield, HelpCircle, MessageCircle, FileText, Info, Star, LogOut, Bell, Moon, Languages } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/context/ThemeContext';
import { useWallet } from '@/src/hooks/shared/useWallet';
import api, { tokenStore } from '@/src/api/client';
import { emitAuthEvent } from '@/src/api/authEvents';
import { clearSession } from '@/src/api/session';
import { compressImageForUpload } from '@/src/utils/imageCompression';
import TermsModal from '@/components/shared/TermsModal';
import EmergencyContactModal from '@/components/shared/EmergencyContactModal';
import { PersonalInfoModal } from '@/components/profile/PersonalInfoModal';
import { PaymentMethodsModal } from '@/components/profile/PaymentMethodsModal';
import { NotificationsModal } from '@/components/profile/NotificationsModal';
import { HelpFaqModal } from '@/components/profile/HelpFaqModal';
import { ContactSupportModal } from '@/components/profile/ContactSupportModal';
import { makeStyles, useProfileInfo } from '@/components/profile/shared';

const C_INK = '#14151A';
const C_INK_SOFT = '#6B7178';
const C_HAIR = '#EEF0F1';
const C_PANEL = '#14151A';

type ProfileScreen =
  | 'personal_info'
  | 'payment_methods'
  | 'notifications'
  | 'help_faq'
  | 'contact_support'
  | 'ratings_history'
  | 'terms'
  | 'emergency_contact'
  | null;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const { colors: c, darkMode, setDarkMode, language, setLanguage, t, isRTL } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [activeModal, setActiveModal] = useState<ProfileScreen>(null);
  const { openTerms } = useLocalSearchParams<{ openTerms?: string }>();

  useEffect(() => {
    if (openTerms === '1') {
      setActiveModal('terms');
    }
  }, [openTerms]);
  const { name: profileName, email: profileEmail, avatar: profileAvatar, refresh: refreshProfile } = useProfileInfo();
  const [displayName, setDisplayName] = useState<string | null>(null);
  // Starts null (no session upload yet) and falls back to the fetched
  // profile's avatar — same pattern as heroName/displayName below. Without
  // the fallback this always showed the initials placeholder on a fresh
  // screen load, even for a user with an avatar already saved.
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const heroAvatarUri = avatarUri ?? profileAvatar;
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.selectionAsync();
    await refreshProfile();
    setRefreshing(false);
  }, [refreshProfile]);

  const handlePickAvatar = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAppAlert(t('photo_permission_title'), t('photo_permission_msg'));
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
      const compressed = await compressImageForUpload(asset.uri);
      const form = new FormData();
      form.append('avatar', { uri: compressed.uri, name: compressed.name, type: compressed.type } as any);
      // Root cause of the recurring "Network Error" on this upload: the
      // shared `api` instance (src/api/client.ts) sets a default
      // Content-Type of 'application/json' on every request. Bypassing
      // transformRequest (below) stops axios from mangling the FormData
      // body, but on its own it does nothing about that header — the
      // request still went out as `Content-Type: application/json` with a
      // multipart body, which React Native's native networking layer
      // refuses to send (it only walks/serializes a FormData body into a
      // real multipart request when it sees a 'multipart/form-data'
      // Content-Type; anything else and the request never leaves the
      // device, surfacing as axios's generic "Network Error"). Both parts
      // are required together: transformRequest so axios doesn't touch the
      // body, and this header so RN's bridge recognizes it as multipart and
      // appends its own boundary param.
      const { data: uploadData } = await api.post('/users/me/avatar', form, {
        transformRequest: (data) => data,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (uploadData?.avatarUrl) setAvatarUri(uploadData.avatarUrl);
    } catch (err: any) {
      setAvatarUri(prevUri);
      // Surface the server's actual reason (e.g. "Storage upload failed.",
      // a file-type rejection) instead of a generic message, so a failure
      // can be diagnosed from what the user sees instead of needing
      // server log access every time.
      const serverMessage = err?.response?.data?.message ?? err?.response?.data?.detail;
      console.error('[avatar upload] failed', {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
      showAppAlert(t('upload_failed'), serverMessage ?? err?.message ?? t('upload_failed_msg'));
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
    // "My Ratings" is a full screen (exact port of the Driver app's ratings
    // screen), not a modal — navigate instead of toggling activeModal.
    if (screen === 'ratings_history') {
      router.push('/ratings');
      return;
    }
    setActiveModal(screen);
  };
  const close = () => setActiveModal(null);

  return (
    <View style={{ flex: 1, backgroundColor: '#EEF0F2' }}>
      <View style={[styles.header, { paddingTop: top + 12 }]}>
        <Text style={styles.headerTitle}>{t('profile_title')}</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C_INK_SOFT}
            colors={[C_PANEL]}
          />
        }
      >
        <View style={styles.heroCard}>
          <View style={styles.heroGrad}>
            <View style={styles.heroGlow} />
            <View style={styles.heroContent}>
              <TouchableOpacity style={[styles.avatarLg, { overflow: 'hidden' }]} onPress={handlePickAvatar} activeOpacity={0.85}>
                {heroAvatarUri ? (
                  <Image source={{ uri: heroAvatarUri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                ) : avatarUploading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.avatarLgText}>{heroInitials}</Text>
                )}
              </TouchableOpacity>
              <View style={styles.heroText}>
                <Text style={styles.heroName}>{heroName}</Text>
                <Text style={styles.heroEmail}>{profileEmail || ''}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('account')}</Text>
          <View style={styles.groupCard}>
            {[
              { icon: User, label: t('personal_info'), value: heroName as string | undefined, screen: 'personal_info' as ProfileScreen },
              { icon: CreditCard, label: t('payment_methods'), value: t('payment_methods_cash') as string | undefined, screen: 'payment_methods' as ProfileScreen },
              { icon: Star, label: t('my_ratings'), value: undefined as string | undefined, screen: 'ratings_history' as ProfileScreen },
              { icon: Shield, label: t('emergency_contact_section'), value: undefined as string | undefined, screen: 'emergency_contact' as ProfileScreen },
            ].map((item, i) => (
              <View key={item.label}>
                {i > 0 && <View style={styles.itemDivider} />}
                <TouchableOpacity style={styles.settingItem} activeOpacity={0.75} onPress={() => open(item.screen)}>
                  <View style={styles.settingIcon}><item.icon size={16} color={C_INK} /></View>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  <View style={styles.settingRight}>
                    {item.value && <Text style={styles.settingValue}>{item.value}</Text>}
                    {isRTL ? <ChevronLeft size={14} color={C_INK_SOFT} /> : <ChevronRight size={14} color={C_INK_SOFT} />}
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('preferences')}</Text>
          <View style={styles.groupCard}>
            <TouchableOpacity style={styles.settingItem} activeOpacity={0.75} onPress={() => open('notifications')}>
              <View style={styles.settingIcon}><Bell size={16} color={C_INK} /></View>
              <Text style={styles.settingLabel}>{t('push_notifs')}</Text>
              <View style={styles.settingRight}>
                <Text style={styles.settingValue}>{t('notif_on')}</Text>
                {isRTL ? <ChevronLeft size={14} color={C_INK_SOFT} /> : <ChevronRight size={14} color={C_INK_SOFT} />}
              </View>
            </TouchableOpacity>

            <View style={styles.itemDivider} />

            <TouchableOpacity style={styles.settingItem} activeOpacity={1}>
              <View style={styles.settingIcon}><Moon size={16} color={C_INK} /></View>
              <Text style={styles.settingLabel}>{t('dark_mode')}</Text>
              <Switch
                value={darkMode}
                onValueChange={(v) => { Haptics.selectionAsync(); setDarkMode(v); }}
                trackColor={{ false: '#C7CBCF', true: C_PANEL }}
                thumbColor="#ffffff"
              />
            </TouchableOpacity>

            <View style={styles.itemDivider} />

            <View style={styles.settingItem}>
              <View style={styles.settingIcon}><Languages size={16} color={C_INK} /></View>
              <Text style={styles.settingLabel}>{t('language')}</Text>
              <View style={styles.langRow}>
                <TouchableOpacity
                  style={[styles.langBtn, language === 'en' ? styles.langBtnActive : styles.langBtnInactive]}
                  onPress={() => { Haptics.selectionAsync(); setLanguage('en'); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.langBtnText, { color: language === 'en' ? '#ffffff' : C_INK_SOFT }]}>EN</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.langBtn, language === 'ar' ? styles.langBtnActive : styles.langBtnInactive]}
                  onPress={() => { Haptics.selectionAsync(); setLanguage('ar'); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.langBtnText, { color: language === 'ar' ? '#ffffff' : C_INK_SOFT }]}>AR</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('support')}</Text>
          <View style={styles.groupCard}>
            {[
              { icon: HelpCircle, label: t('help_faq'), screen: 'help_faq' as ProfileScreen },
              { icon: MessageCircle, label: t('contact_support'), screen: 'contact_support' as ProfileScreen },
            ].map((item, i) => (
              <View key={item.label}>
                {i > 0 && <View style={styles.itemDivider} />}
                <TouchableOpacity style={styles.settingItem} activeOpacity={0.75} onPress={() => open(item.screen)}>
                  <View style={styles.settingIcon}><item.icon size={16} color={C_INK} /></View>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  {isRTL ? <ChevronLeft size={14} color={C_INK_SOFT} /> : <ChevronRight size={14} color={C_INK_SOFT} />}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('app_version_label')}</Text>
          <View style={styles.groupCard}>
            {[
              { icon: FileText, label: t('terms_of_service'), onPress: () => open('terms') },
              { icon: Info, label: t('about_veego'), value: 'v1.0.0', onPress: () => {} },
            ].map((item, i) => (
              <View key={item.label}>
                {i > 0 && <View style={styles.itemDivider} />}
                <TouchableOpacity style={styles.settingItem} activeOpacity={0.75} onPress={item.onPress}>
                  <View style={styles.settingIcon}><item.icon size={16} color={C_INK} /></View>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  <View style={styles.settingRight}>
                    {(item as any).value && <Text style={styles.settingValue}>{(item as any).value}</Text>}
                    {isRTL ? <ChevronLeft size={14} color={C_INK_SOFT} /> : <ChevronRight size={14} color={C_INK_SOFT} />}
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            showAppAlert(t('sign_out'), t('sign_out_q'), [
              { text: t('cancel'), style: 'cancel' },
              { text: t('sign_out'), style: 'destructive', onPress: async () => { try { await api.post('/auth/logout'); } catch {} try { await clearSession(); } catch {} emitAuthEvent('auth:logout'); try { await tokenStore.removeToken(tokenStore.TOKEN_KEY); await tokenStore.removeToken(tokenStore.REFRESH_KEY); } catch {} router.replace('/auth'); } },
            ]);
          }}
        >
          <View style={styles.logoutBtn}>
            <LogOut size={16} color="#D92D20" />
            <Text style={styles.logoutText}>{t('sign_out')}</Text>
          </View>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>

      <PersonalInfoModal
        visible={activeModal === 'personal_info'}
        onClose={close}
        onSaved={(n) => setDisplayName(n)}
        avatarUri={heroAvatarUri}
        onPickAvatar={handlePickAvatar}
        avatarUploading={avatarUploading}
        heroInitials={heroInitials}
      />
      <PaymentMethodsModal visible={activeModal === 'payment_methods'} onClose={close} />
      <NotificationsModal visible={activeModal === 'notifications'} onClose={close} />
      <HelpFaqModal visible={activeModal === 'help_faq'} onClose={close} />
      <ContactSupportModal visible={activeModal === 'contact_support'} onClose={close} />
      <TermsModal
        visible={activeModal === 'terms'}
        onClose={close}
        checkForUpdates
      />
      <EmergencyContactModal visible={activeModal === 'emergency_contact'} onClose={close} />
    </View>
  );
}
