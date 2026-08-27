import { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useProfile } from '@/src/hooks/shared/useProfile';
import { ThemeColors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';

// ── C · Split Panel — fixed palette, independent of the app's light/dark theme.
const C_BG = '#EEF0F2';
const C_PANEL = '#14151A';
const C_INK = '#14151A';
const C_INK_SOFT = '#6B7178';
const C_CAP = '#9AA0A6';
const C_HAIR = '#EEF0F1';
const C_MIST = '#F0F2F3';
const C_TEAL = '#0E9F8E';
const C_RED = '#D92D20';

export function makeStyles(_c: ThemeColors) {
  return StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: Spacing.md },
    headerTitle: { fontSize: 24, fontWeight: '800', color: C_INK, letterSpacing: -0.7 },
    scrollContent: { paddingHorizontal: 20, paddingTop: Spacing.xs, gap: 0 },
    heroCard: { borderRadius: 28, marginBottom: 20, backgroundColor: C_PANEL, overflow: 'hidden' },
    heroGrad: { padding: 20, borderRadius: 28 },
    heroGlow: { position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.05)' },
    heroContent: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.lg },
    avatarLg: { width: 72, height: 72, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
    avatarLgText: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
    heroText: { flex: 1, gap: 2 },
    heroName: { fontSize: 17, fontWeight: '800', color: '#ffffff' },
    heroEmail: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
    heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, gap: 0 },
    heroStat: { alignItems: 'center', flex: 1 },
    heroStatNum: { fontSize: 15, fontWeight: '800', color: '#ffffff' },
    heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
    heroStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.14)' },
    section: { marginBottom: Spacing.lg, gap: Spacing.sm },
    sectionLabel: { fontSize: 11, fontWeight: '700', color: C_CAP, textTransform: 'uppercase', letterSpacing: 1.2, paddingStart: 4 },
    groupCard: { overflow: 'hidden', backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: C_HAIR },
    settingItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
    itemDivider: { height: 1, backgroundColor: C_HAIR, marginStart: 64 },
    settingIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: C_MIST, alignItems: 'center', justifyContent: 'center' },
    settingLabel: { flex: 1, fontSize: 13.5, fontWeight: '700', color: C_INK },
    settingRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    settingValue: { fontSize: 12, color: C_INK_SOFT },
    langRow: { flexDirection: 'row', gap: 6 },
    langBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, borderWidth: 1.5 },
    langBtnActive: { backgroundColor: C_PANEL, borderColor: C_PANEL },
    langBtnInactive: { backgroundColor: '#fff', borderColor: C_HAIR },
    langBtnText: { fontSize: 12, fontWeight: '700' },
    logoutBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, height: 52,
      backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: C_HAIR,
    },
    logoutText: { fontSize: 13.5, fontWeight: '700', color: C_RED },

    modal: { flex: 1, backgroundColor: C_BG },
    modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C_HAIR, gap: Spacing.md, backgroundColor: '#fff' },
    modalBackBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: C_MIST, alignItems: 'center', justifyContent: 'center' },
    modalTitle: { flex: 1, fontSize: 15.5, fontWeight: '800', color: C_INK },
    modalHeaderAction: { fontSize: 13.5, fontWeight: '700', color: C_INK },
    modalBody: { flex: 1 },
    modalScroll: { padding: 20, gap: 20 },

    inputGroup: { gap: 6 },
    inputLabel: { fontSize: 11, fontWeight: '700', color: C_CAP, textTransform: 'uppercase', letterSpacing: 0.8 },
    input: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: Spacing.lg, paddingVertical: 14, fontSize: 15, color: C_INK, borderWidth: 1, borderColor: C_HAIR },
    primaryBtn: { height: 52, borderRadius: 16, backgroundColor: C_PANEL, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
    primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    dangerBtn: { height: 52, borderRadius: 16, borderWidth: 1, borderColor: '#F3C6C2', backgroundColor: '#FEF2F1', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.sm },
    dangerBtnText: { color: C_RED, fontSize: 13.5, fontWeight: '700' },

    cardRow: { backgroundColor: '#fff', borderRadius: 20, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: C_HAIR },
    cardIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: C_MIST, alignItems: 'center', justifyContent: 'center' },
    cardLabel: { flex: 1, gap: 2 },
    cardName: { fontSize: 13.5, fontWeight: '700', color: C_INK },
    cardSub: { fontSize: 12, color: C_INK_SOFT },
    defaultBadge: { paddingHorizontal: 10, paddingVertical: Spacing.xs, borderRadius: 99, backgroundColor: 'rgba(14,159,142,0.12)' },
    defaultBadgeText: { fontSize: 11, fontWeight: '700', color: C_TEAL },

    toggleRow: { backgroundColor: '#fff', borderRadius: 20, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: C_HAIR },
    toggleIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: C_MIST, alignItems: 'center', justifyContent: 'center' },
    toggleMeta: { flex: 1 },
    toggleLabel: { fontSize: 13.5, fontWeight: '700', color: C_INK },
    toggleSub: { fontSize: 12, color: C_INK_SOFT, marginTop: 2 },

    faqItem: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C_HAIR },
    faqQ: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
    faqQText: { flex: 1, fontSize: 13.5, fontWeight: '700', color: C_INK },
    faqA: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, fontSize: 13.5, color: C_INK_SOFT, lineHeight: 20 },

    issueRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    issueChip: { paddingHorizontal: 14, paddingVertical: Spacing.sm, borderRadius: 99, borderWidth: 1.5 },
    issueChipActive: { backgroundColor: C_PANEL, borderColor: C_PANEL },
    issueChipInactive: { backgroundColor: '#fff', borderColor: C_HAIR },
    issueChipText: { fontSize: 12, fontWeight: '600' },
    textArea: { backgroundColor: '#fff', borderRadius: 16, padding: Spacing.lg, fontSize: 14, color: C_INK, borderWidth: 1, borderColor: C_HAIR, height: 120, textAlignVertical: 'top' },

    attachmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    attachmentThumb: { width: 64, height: 64, borderRadius: 14, overflow: 'hidden', backgroundColor: C_MIST },
    attachmentImage: { width: '100%', height: '100%' },
    attachmentOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
    attachmentBadge: { position: 'absolute', bottom: 3, right: 3, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    attachmentRemoveBtn: { position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
    attachmentAddBtn: { width: 64, height: 64, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C_HAIR, backgroundColor: '#F7F8F8', alignItems: 'center', justifyContent: 'center' },

    successBox: { alignItems: 'center', gap: 14, paddingTop: 60 },
    successIcon: { width: 80, height: 80, borderRadius: 28, backgroundColor: C_PANEL, alignItems: 'center', justifyContent: 'center' },
    successTitle: { fontSize: 19, fontWeight: '800', color: C_INK },
    successSub: { fontSize: 13.5, color: C_INK_SOFT, textAlign: 'center', paddingHorizontal: Spacing.xxl, lineHeight: 20 },

    readOnlyInput: {
      backgroundColor: '#F5F5F8',
      borderRadius: 16, paddingHorizontal: Spacing.lg, paddingVertical: 14,
      fontSize: 15, color: C_INK_SOFT, borderWidth: 1,
      borderColor: '#ECECF0',
    },
    readOnlyBadge: {
      position: 'absolute', right: 14, top: '50%',
      paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: 8,
      backgroundColor: '#ECECF0',
    },
    readOnlyBadgeText: { fontSize: 10, fontWeight: '700', color: C_CAP, letterSpacing: 0.4 },

    avatarPickerWrap: { alignItems: 'center', paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
    avatarPickerCircle: {
      width: 88, height: 88, borderRadius: 44, overflow: 'hidden',
      backgroundColor: '#F0F0F5',
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: '#E0E0EA',
    },
    avatarPickerInitials: { fontSize: 24, fontWeight: '800', color: C_INK },
    avatarCameraBadge: {
      position: 'absolute', bottom: 0, right: 0,
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: C_PANEL, alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: '#fff',
    },

    pwSection: {
      borderRadius: 18, overflow: 'hidden',
      backgroundColor: '#F7F8FA',
      borderWidth: 1, borderColor: '#E8E8F2',
    },
    pwSectionHeader: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      padding: Spacing.lg,
    },
    pwSectionTitle: { flex: 1, fontSize: 13.5, fontWeight: '700', color: C_INK },
    pwSectionBody: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.md },

    ratingHero: { alignItems: 'center', paddingVertical: 28, gap: 6 },
    ratingScore: { fontSize: 56, fontWeight: '800', color: '#ffffff', letterSpacing: -2 },
    ratingStars: { flexDirection: 'row', gap: Spacing.xs },
    ratingSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: Spacing.xs },
  });
}

export function ModalHeader({ title, onClose, actionLabel, onAction, actionDisabled }: { title: string; onClose: () => void; actionLabel?: string; onAction?: () => void; actionDisabled?: boolean }) {
  const { colors: c, isRTL } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.modalHeader}>
      <TouchableOpacity style={styles.modalBackBtn} onPress={onClose} activeOpacity={0.8}>
        {isRTL ? <ArrowRight size={18} color={C_INK} /> : <ArrowLeft size={18} color={C_INK} />}
      </TouchableOpacity>
      <Text style={styles.modalTitle}>{title}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.8} disabled={actionDisabled}>
          <Text style={[styles.modalHeaderAction, actionDisabled && { opacity: 0.5 }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ✅ useProfileInfo delegates to useProfile which fetches from GET /users/me
export function useProfileInfo() {
  const { profile, loading, saveProfile: apiSave, refresh } = useProfile();

  const saveProfile = useCallback(async (n: string, em: string) => {
    await apiSave({ name: n, email: em });
  }, [apiSave]);

  return {
    name: profile.name || 'User',
    email: profile.email || '',
    phone: profile.phone || '',
    gender: profile.gender,
    loaded: !loading,
    saveProfile,
    refresh,
  };
}
