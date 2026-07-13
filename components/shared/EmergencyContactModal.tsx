import { useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, TextInput, Platform, Linking, KeyboardAvoidingView, Alert,
} from 'react-native';
import { ArrowLeft, ArrowRight, User, Phone, MessageCircle, Save } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import api from '@/src/api/client';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

interface EmergencyContact {
  name: string;
  phone: string;
}

interface EmergencyContactModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function EmergencyContactModal({ visible, onClose }: EmergencyContactModalProps) {
  const { t, isRTL, colors: c } = useTheme();

  const [savedContact, setSavedContact] = useState<EmergencyContact | null>(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSaved(false);
    setLoading(true);
    api.get('/users/me/emergency-contact')
      .then(({ data }) => {
        const contact = data as EmergencyContact | null;
        setSavedContact(contact);
        setName(contact?.name ?? '');
        setPhone(contact?.phone ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible]);

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert(t('error'), t('emergency_contact_save_err'));
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.patch('/users/me/emergency-contact', { name: name.trim(), phone: phone.trim() });
      setSavedContact(data as EmergencyContact);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      Alert.alert(t('error'), t('emergency_contact_save_err'));
    } finally {
      setSaving(false);
    }
  };

  const handleCallContact = () => {
    if (!savedContact?.phone) return;
    Linking.openURL(`tel:${savedContact.phone.replace(/\D/g, '')}`);
  };

  const handleWhatsAppContact = () => {
    if (!savedContact?.phone) return;
    const phoneClean = savedContact.phone.replace(/\D/g, '');
    Linking.openURL(`whatsapp://send?phone=${phoneClean}`).catch(() => {
      Alert.alert(t('error'), t('whatsapp_emergency_no_contact'));
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.root, { backgroundColor: c.isDark ? c.background : c.snow }]}>
        <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.white }]}>
          <TouchableOpacity style={[styles.backBtn, { backgroundColor: c.mist }]} onPress={onClose} activeOpacity={0.8}>
            {isRTL ? <ArrowRight size={18} color={c.ink} /> : <ArrowLeft size={18} color={c.ink} />}
          </TouchableOpacity>
          <Text style={[styles.title, { color: c.ink }]}>{t('emergency_contact_section')}</Text>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={[styles.subtitle, { color: c.inkSoft, textAlign: isRTL ? 'right' : 'left' }]}>
              {t('safety_contact_subtitle')}
            </Text>

            {!loading && savedContact?.phone ? (
              <View style={[styles.savedCard, { backgroundColor: c.white, borderColor: c.border }]}>
                <View style={[styles.savedHeader, isRTL && styles.rowRTL]}>
                  <View style={[styles.savedAvatar, { backgroundColor: `${c.accentMint}22` }]}>
                    <User size={20} color={c.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.savedName, { color: c.ink, textAlign: isRTL ? 'right' : 'left' }]}>{savedContact.name}</Text>
                    <Text style={[styles.savedPhone, { color: c.inkSoft, textAlign: isRTL ? 'right' : 'left' }]}>{savedContact.phone}</Text>
                  </View>
                </View>
                <View style={[styles.savedActions, isRTL && styles.rowRTL]}>
                  <TouchableOpacity style={[styles.savedActionBtn, { borderColor: c.border }]} onPress={handleCallContact} activeOpacity={0.85}>
                    <Phone size={15} color={c.ink} />
                    <Text style={[styles.savedActionText, { color: c.ink }]}>{t('call')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.savedActionBtn, { borderColor: 'rgba(37,211,102,0.4)', backgroundColor: 'rgba(37,211,102,0.08)' }]} onPress={handleWhatsAppContact} activeOpacity={0.85}>
                    <MessageCircle size={15} color="#25d366" />
                    <Text style={[styles.savedActionText, { color: '#25d366' }]}>{t('safety_open_whatsapp')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : !loading ? (
              <View style={[styles.emptyCard, { backgroundColor: c.white, borderColor: c.border }]}>
                <User size={26} color={c.inkSoft} />
                <Text style={[styles.emptyText, { color: c.inkSoft }]}>{t('safety_no_contact_yet')}</Text>
              </View>
            ) : null}

            <Text style={[styles.sectionLabel, { color: c.inkSoft, textAlign: isRTL ? 'right' : 'left' }]}>
              {t('emergency_contact_section')}
            </Text>

            <View style={[styles.formCard, { backgroundColor: c.white, borderColor: c.border }]}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('emergency_contact_name_ph')}
                placeholderTextColor={c.silver}
                textAlign={isRTL ? 'right' : 'left'}
                style={[styles.formInput, { color: c.ink, backgroundColor: c.mist, borderColor: c.border }]}
              />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder={t('emergency_contact_phone_ph')}
                placeholderTextColor={c.silver}
                keyboardType="phone-pad"
                textAlign={isRTL ? 'right' : 'left'}
                style={[styles.formInput, { color: c.ink, backgroundColor: c.mist, borderColor: c.border }]}
              />
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: saved ? '#22a06b' : c.ink, opacity: saving ? 0.7 : 1 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.9}
              >
                <Save size={16} color={c.isDark ? c.background : c.white} />
                <Text style={[styles.saveBtnText, { color: c.isDark ? c.background : c.white }]}>
                  {saved ? t('emergency_contact_saved_title') : t('emergency_contact_save')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.infoNote, { backgroundColor: `${c.accentMint}18`, borderColor: `${c.accentMint}50` }]}>
              <Text style={[styles.infoNoteText, { color: c.ink, textAlign: isRTL ? 'right' : 'left' }]}>
                {t('safety_sos_note')}
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, gap: Spacing.md,
  },
  backBtn: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: Typography.size.md, fontWeight: Typography.weight.bold, fontFamily: 'Inter_700Bold' },
  body: { padding: 20, paddingBottom: 40, gap: 16 },
  subtitle: { fontSize: 13, lineHeight: 19 },
  rowRTL: { flexDirection: 'row-reverse' },
  savedCard: { borderRadius: Radius.lg, borderWidth: 1, padding: 14, gap: 12 },
  savedHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  savedAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  savedName: { fontSize: 15, fontWeight: Typography.weight.bold },
  savedPhone: { fontSize: 13, marginTop: 2 },
  savedActions: { flexDirection: 'row', gap: 10 },
  savedActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1,
  },
  savedActionText: { fontSize: 13, fontWeight: Typography.weight.semibold },
  emptyCard: {
    alignItems: 'center', gap: 8, paddingVertical: Spacing.xl,
    borderRadius: Radius.lg, borderWidth: 1,
  },
  emptyText: { fontSize: 13 },
  sectionLabel: {
    fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase',
    fontWeight: Typography.weight.bold,
  },
  formCard: { borderRadius: Radius.lg, borderWidth: 1, padding: 14, gap: 10 },
  formInput: {
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, borderWidth: 1,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, height: 50, borderRadius: Radius.lg, marginTop: Spacing.xs,
  },
  saveBtnText: { fontSize: 15, fontWeight: Typography.weight.semibold },
  infoNote: { borderRadius: Radius.lg, borderWidth: 1, padding: 14 },
  infoNoteText: { fontSize: 12.5, lineHeight: 19 },
});
