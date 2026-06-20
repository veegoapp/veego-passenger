import { useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Platform, SafeAreaView,
} from 'react-native';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/context/ThemeContext';
import api from '@/src/api/client';

export const TERMS_VERSION_KEY = 'passenger_terms_accepted_version';

export interface TermsData {
  id: number;
  version: number;
  contentAr: string;
  contentEn: string;
}

export async function fetchPassengerTerms(): Promise<TermsData> {
  const { data } = await api.get('/api/terms/passenger');
  return data as TermsData;
}

export async function acceptTerms(version: number): Promise<void> {
  await api.post('/api/terms/accept', { app: 'passenger', version });
  await storeAcceptedVersion(version);
}

export async function storeAcceptedVersion(version: number): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(TERMS_VERSION_KEY, String(version));
    } else {
      await AsyncStorage.setItem(TERMS_VERSION_KEY, String(version));
    }
  } catch {}
}

export async function getAcceptedVersion(): Promise<number | null> {
  try {
    const raw = Platform.OS === 'web'
      ? localStorage.getItem(TERMS_VERSION_KEY)
      : await AsyncStorage.getItem(TERMS_VERSION_KEY);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

interface TermsModalProps {
  visible: boolean;
  onClose: () => void;
  /** Pre-fetched terms (signup flow). If omitted, modal fetches on open. */
  termsData?: TermsData | null;
  /** Called when "I Accept" is tapped (signup flow — just closes & checks box). */
  onAccept?: () => void;
  /** Whether to check locally stored version and show an update banner. */
  checkForUpdates?: boolean;
}

export default function TermsModal({
  visible,
  onClose,
  termsData: externalData,
  onAccept,
  checkForUpdates = false,
}: TermsModalProps) {
  const { t, language, isRTL, colors: c } = useTheme();
  const [terms, setTerms] = useState<TermsData | null>(externalData ?? null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [acceptedVersion, setAcceptedVersion] = useState<number | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setAccepted(false);

    if (externalData) {
      setTerms(externalData);
      return;
    }

    setLoading(true);
    setFetchError(false);
    fetchPassengerTerms()
      .then((data) => { setTerms(data); })
      .catch(() => { setFetchError(true); })
      .finally(() => { setLoading(false); });
  }, [visible, externalData]);

  useEffect(() => {
    if (!visible || !checkForUpdates) return;
    getAcceptedVersion().then(setAcceptedVersion);
  }, [visible, checkForUpdates]);

  const content = language === 'ar' ? terms?.contentAr : terms?.contentEn;
  const needsUpdate = checkForUpdates && terms !== null && acceptedVersion !== null && terms.version > acceptedVersion;
  const needsFirstAccept = checkForUpdates && terms !== null && acceptedVersion === null;
  const showBanner = (needsUpdate || needsFirstAccept) && !accepted;

  const handleProfileAccept = async () => {
    if (!terms) return;
    setAccepting(true);
    try {
      await acceptTerms(terms.version);
      setAcceptedVersion(terms.version);
      setAccepted(true);
    } catch {
      // silent
    } finally {
      setAccepting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.root, { backgroundColor: c.isDark ? c.background : c.snow }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.white }]}>
          <TouchableOpacity style={[styles.backBtn, { backgroundColor: c.mist }]} onPress={onClose} activeOpacity={0.8}>
            {isRTL ? <ArrowRight size={18} color={c.ink} /> : <ArrowLeft size={18} color={c.ink} />}
          </TouchableOpacity>
          <Text style={[styles.title, { color: c.ink }]}>{t('terms_and_conditions')}</Text>
        </View>

        {/* Update banner */}
        {showBanner && (
          <View style={[styles.banner, { backgroundColor: `${c.accentMint}18`, borderColor: `${c.accentMint}50` }]}>
            <Text style={[styles.bannerText, { color: c.ink }]}>{t('terms_updated_banner')}</Text>
            <TouchableOpacity
              style={[styles.bannerBtn, { backgroundColor: c.ink }]}
              onPress={handleProfileAccept}
              activeOpacity={0.85}
              disabled={accepting}
            >
              {accepting
                ? <ActivityIndicator size="small" color={c.white} />
                : <Text style={[styles.bannerBtnText, { color: c.isDark ? c.background : c.white }]}>{t('accept')}</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Body */}
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={c.ink} />
            <Text style={[styles.loadingText, { color: c.inkSoft }]}>{t('terms_loading')}</Text>
          </View>
        ) : fetchError ? (
          <View style={styles.loader}>
            <Text style={[styles.loadingText, { color: c.inkSoft }]}>{t('error')}</Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.body, { direction: isRTL ? 'rtl' : 'ltr' }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.contentText, { color: c.ink, textAlign: isRTL ? 'right' : 'left' }]}>
              {content ?? ''}
            </Text>
          </ScrollView>
        )}

        {/* Accept button — shown in signup flow (onAccept prop provided) */}
        {onAccept && !loading && !fetchError && (
          <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.white }]}>
            <TouchableOpacity
              style={[styles.acceptBtn, { backgroundColor: c.ink }]}
              onPress={() => { onAccept(); onClose(); }}
              activeOpacity={0.9}
            >
              <Text style={[styles.acceptBtnText, { color: c.isDark ? c.background : c.white }]}>
                {t('i_accept')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, gap: 12,
  },
  backBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  banner: {
    margin: 16, marginBottom: 0,
    borderRadius: 16, borderWidth: 1,
    padding: 14, gap: 10,
    flexDirection: 'row', alignItems: 'center',
  },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  bannerBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  bannerBtnText: { fontSize: 13, fontWeight: '600' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13 },
  body: { padding: 20, paddingBottom: 40 },
  contentText: { fontSize: 14, lineHeight: 22 },
  footer: { padding: 16, paddingBottom: Platform.OS === 'ios' ? 8 : 16, borderTopWidth: 1 },
  acceptBtn: { height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  acceptBtnText: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
});
