import { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useProfile } from '@/src/hooks/shared/useProfile';
import { ThemeColors, S } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

export function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: Spacing.md },
    headerTitle: { fontSize: 26, fontWeight: Typography.weight.bold, color: c.ink, letterSpacing: -0.8, fontFamily: 'Inter_700Bold' },
    scrollContent: { paddingHorizontal: 20, paddingTop: Spacing.xs, gap: 0 },
    heroCard: { borderRadius: 28, overflow: 'hidden', marginBottom: 20, ...S.float },
    heroGrad: { padding: 20, borderRadius: 28, overflow: 'hidden' },
    heroGlow: { position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.06)' },
    heroContent: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.lg },
    avatarLg: { width: 72, height: 72, borderRadius: Radius.xl, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    avatarLgText: { color: '#ffffff', fontSize: Typography.size.xl, fontWeight: Typography.weight.bold },
    heroText: { flex: 1, gap: 2 },
    heroName: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: '#ffffff', fontFamily: 'Inter_700Bold' },
    heroEmail: { fontSize: Typography.size.xs, color: 'rgba(255,255,255,0.65)' },
    heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, gap: 0 },
    heroStat: { alignItems: 'center', flex: 1 },
    heroStatNum: { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: '#ffffff' },
    heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 1 },
    heroStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)' },
    section: { marginBottom: Spacing.lg, gap: Spacing.sm },
    sectionLabel: { fontSize: 11, fontWeight: Typography.weight.semibold, color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 1.2, paddingStart: 4 },
    groupCard: { borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: c.white },
    settingItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
    itemDivider: { height: 1, backgroundColor: c.border, opacity: 0.6, marginStart: 64 },
    settingIcon: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' },
    settingLabel: { flex: 1, fontSize: 13.5, fontWeight: Typography.weight.medium, color: c.ink },
    settingRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    settingValue: { fontSize: Typography.size.xs, color: c.inkSoft },
    langRow: { flexDirection: 'row', gap: 6 },
    langBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, borderWidth: 1 },
    langBtnActive: { backgroundColor: c.ink, borderColor: c.ink },
    langBtnInactive: { backgroundColor: c.white, borderColor: c.border },
    langBtnText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, height: 52, borderRadius: 20, borderWidth: 1, borderColor: `${c.badge}40`, backgroundColor: `${c.badge}10` },
    logoutText: { fontSize: Typography.size.sm, fontWeight: Typography.weight.medium, color: c.badge },

    modal: { flex: 1, backgroundColor: c.isDark ? c.background : c.snow },
    modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border, gap: Spacing.md, backgroundColor: c.white },
    modalBackBtn: { width: 36, height: 36, borderRadius: Radius.md, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' },
    modalTitle: { flex: 1, fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: c.ink, fontFamily: 'Inter_700Bold' },
    modalHeaderAction: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: c.ink },
    modalBody: { flex: 1 },
    modalScroll: { padding: 20, gap: 20 },

    inputGroup: { gap: 6 },
    inputLabel: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold, color: c.inkSoft, textTransform: 'uppercase', letterSpacing: 0.8 },
    input: { backgroundColor: c.white, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg, paddingVertical: 14, fontSize: 15, color: c.ink, borderWidth: 1, borderColor: c.border },
    primaryBtn: { height: 52, borderRadius: 18, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm, ...S.float },
    primaryBtnText: { color: c.isDark ? c.background : c.white, fontSize: 15, fontWeight: Typography.weight.semibold, fontFamily: 'Inter_600SemiBold' },
    dangerBtn: { height: 52, borderRadius: 18, borderWidth: 1, borderColor: `${c.badge}50`, backgroundColor: `${c.badge}10`, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.sm },
    dangerBtnText: { color: c.badge, fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold },

    cardRow: { backgroundColor: c.white, borderRadius: 20, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 14, ...S.float },
    cardIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' },
    cardLabel: { flex: 1, gap: 2 },
    cardName: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: c.ink },
    cardSub: { fontSize: Typography.size.xs, color: c.inkSoft },
    defaultBadge: { paddingHorizontal: 10, paddingVertical: Spacing.xs, borderRadius: 99, backgroundColor: `${c.accentMint}20` },
    defaultBadgeText: { fontSize: 11, fontWeight: Typography.weight.semibold, color: c.accentMint },

    toggleRow: { backgroundColor: c.white, borderRadius: 20, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 14, ...S.float },
    toggleIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center' },
    toggleMeta: { flex: 1 },
    toggleLabel: { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: c.ink },
    toggleSub: { fontSize: Typography.size.xs, color: c.inkSoft, marginTop: 2 },

    faqItem: { backgroundColor: c.white, borderRadius: 20, overflow: 'hidden', ...S.float },
    faqQ: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
    faqQText: { flex: 1, fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: c.ink },
    faqA: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, fontSize: 13.5, color: c.inkSoft, lineHeight: 20 },

    issueRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    issueChip: { paddingHorizontal: 14, paddingVertical: Spacing.sm, borderRadius: 99, borderWidth: 1 },
    issueChipActive: { backgroundColor: c.ink, borderColor: c.ink },
    issueChipInactive: { backgroundColor: c.white, borderColor: c.border },
    issueChipText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.medium },
    textArea: { backgroundColor: c.white, borderRadius: Radius.lg, padding: Spacing.lg, fontSize: Typography.size.sm, color: c.ink, borderWidth: 1, borderColor: c.border, height: 120, textAlignVertical: 'top' },

    attachmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    attachmentThumb: { width: 64, height: 64, borderRadius: 14, overflow: 'hidden', backgroundColor: c.mist },
    attachmentImage: { width: '100%', height: '100%' },
    attachmentOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
    attachmentBadge: { position: 'absolute', bottom: 3, right: 3, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    attachmentRemoveBtn: { position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
    attachmentAddBtn: { width: 64, height: 64, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border, backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f8', alignItems: 'center', justifyContent: 'center' },

    successBox: { alignItems: 'center', gap: 14, paddingTop: 60 },
    successIcon: { width: 80, height: 80, borderRadius: 28, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center', ...S.float },
    successTitle: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, color: c.ink, fontFamily: 'Inter_700Bold' },
    successSub: { fontSize: Typography.size.sm, color: c.inkSoft, textAlign: 'center', paddingHorizontal: Spacing.xxl, lineHeight: 20 },

    readOnlyInput: {
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f8',
      borderRadius: Radius.lg, paddingHorizontal: Spacing.lg, paddingVertical: 14,
      fontSize: 15, color: c.inkSoft, borderWidth: 1,
      borderColor: c.isDark ? 'rgba(255,255,255,0.06)' : '#ececf0',
    },
    readOnlyBadge: {
      position: 'absolute', right: 14, top: '50%',
      paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : '#ececf0',
    },
    readOnlyBadgeText: { fontSize: 10, fontWeight: Typography.weight.semibold, color: c.silver, letterSpacing: 0.4 },

    avatarPickerWrap: { alignItems: 'center', paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
    avatarPickerCircle: {
      width: 88, height: 88, borderRadius: 44, overflow: 'hidden',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f5',
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: c.isDark ? 'rgba(255,255,255,0.15)' : '#e0e0ea',
    },
    avatarPickerInitials: { fontSize: Typography.size.xxl, fontWeight: Typography.weight.bold, color: c.ink },
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
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      padding: Spacing.lg,
    },
    pwSectionTitle: { flex: 1, fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: c.ink },
    pwSectionBody: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.md },

    ratingHero: { alignItems: 'center', paddingVertical: 28, gap: 6 },
    ratingScore: { fontSize: 56, fontWeight: '800', color: '#ffffff', letterSpacing: -2 },
    ratingStars: { flexDirection: 'row', gap: Spacing.xs },
    ratingSubtitle: { fontSize: Typography.size.xs, color: 'rgba(255,255,255,0.55)', marginTop: Spacing.xs },
  });
}

export function ModalHeader({ title, onClose, actionLabel, onAction, actionDisabled }: { title: string; onClose: () => void; actionLabel?: string; onAction?: () => void; actionDisabled?: boolean }) {
  const { colors: c, isRTL } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.modalHeader}>
      <TouchableOpacity style={styles.modalBackBtn} onPress={onClose} activeOpacity={0.8}>
        {isRTL ? <ArrowRight size={18} color={c.ink} /> : <ArrowLeft size={18} color={c.ink} />}
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
    refresh,
  };
}
