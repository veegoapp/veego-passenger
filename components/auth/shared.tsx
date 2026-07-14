import { StyleSheet } from 'react-native';
import { S } from '@/constants/colors';
import type { ThemeColors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

// Session/token persistence now lives in src/api/session.ts (single shared
// module — was previously duplicated here, in app/index.tsx, and in
// app/verify-phone.tsx). Re-exported so existing imports of
// `saveSession`/`persistTokens` from './shared' keep working unchanged.
export { saveSession, persistTokens } from '@/src/api/session';

export function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1 },
    langBar: {
      position: 'absolute', top: 56, right: 20, zIndex: 20,
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.85)',
      borderRadius: 99, paddingHorizontal: 6, paddingVertical: Spacing.xs, gap: 2,
      shadowColor: '#1e1e28', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    },
    langChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: 99 },
    langChipActive: { backgroundColor: c.ink },
    langChipText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold, color: c.inkSoft },
    langChipTextActive: { color: c.white },
    langSep: { width: 1, height: 14, backgroundColor: c.border },
    scroll: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40, justifyContent: 'center', gap: 28 },
    logoBlock: { alignItems: 'center', gap: Spacing.sm, paddingTop: 60 },
    logoIcon: { width: 56, height: 56, borderRadius: 20, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center', ...S.float },
    wordmark: { fontSize: Typography.size.xxl, fontWeight: Typography.weight.bold, color: c.ink, letterSpacing: -1.2, fontFamily: 'Inter_700Bold' },
    card: { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', overflow: 'hidden', ...S.luxe },
    tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border },
    tabBtn: { flex: 1, paddingVertical: Spacing.lg, alignItems: 'center' },
    tabBtnActive: { borderBottomWidth: 2, borderBottomColor: c.ink, marginBottom: -1 },
    tabText: { fontSize: 12.5, fontWeight: Typography.weight.medium, color: c.inkSoft },
    tabTextActive: { color: c.ink, fontWeight: Typography.weight.semibold },
    form: { padding: Spacing.xl, gap: Spacing.md },
    formHeader: { gap: Spacing.xs, marginBottom: Spacing.xs },
    formTitle: { fontSize: Typography.size.xl, fontWeight: Typography.weight.semibold, color: c.ink, letterSpacing: -0.5, fontFamily: 'Inter_600SemiBold' },
    formSubtitle: { fontSize: 13, color: c.inkSoft, fontFamily: 'Inter_400Regular' },
    inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.mist, borderRadius: 18, height: 52, paddingHorizontal: Spacing.lg, gap: 10 },
    inputIcon: { width: 28, alignItems: 'center' },
    inputField: { flex: 1, fontSize: Typography.size.sm, color: c.ink },
    primaryBtn: { height: 56, borderRadius: 20, backgroundColor: c.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.xs, ...S.luxe },
    primaryBtnText: { color: c.white, fontSize: 15, fontWeight: Typography.weight.semibold },
    biometricBtn: { height: 52, borderRadius: 20, backgroundColor: c.mist, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: c.border },
    biometricBtnText: { color: c.ink, fontSize: 15, fontWeight: Typography.weight.semibold },
    termsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Spacing.xs },
    termsText: { fontSize: 11, color: c.inkSoft, flex: 1 },
    termsLink: { color: c.ink, fontWeight: Typography.weight.semibold, textDecorationLine: 'underline' },
    termsCheckRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: Spacing.xs, paddingBottom: 2 },
    checkbox: {
      width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: c.border,
      backgroundColor: c.mist, alignItems: 'center', justifyContent: 'center',
      marginTop: 1, flexShrink: 0,
    },
    checkboxChecked: { backgroundColor: c.ink, borderColor: c.ink },
    termsCheckText: { fontSize: Typography.size.xs, color: c.inkSoft, flex: 1, lineHeight: 18 },

    fieldError: {
      fontSize: 12.5,
      color: c.error,
      marginTop: -4,
      paddingHorizontal: Spacing.xs,
    },
    channelRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: -Spacing.xs },
    channelChip: {
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
      borderRadius: Radius.lg, borderWidth: 1.5, borderColor: c.border,
      backgroundColor: 'rgba(255,255,255,0.75)',
    },
    channelChipActive: { borderColor: c.ink, backgroundColor: c.ink },
    channelChipText: { fontSize: 13, fontWeight: Typography.weight.medium, color: c.inkSoft },
    channelChipTextActive: { color: c.white, fontWeight: Typography.weight.semibold },
    successText: {
      fontSize: 12.5,
      color: c.accentMint,
      fontWeight: Typography.weight.semibold,
      marginTop: -4,
      paddingHorizontal: Spacing.xs,
    },

    otpHiddenInput: {
      position: 'absolute',
      width: 1,
      height: 1,
      opacity: 0,
    },
    otpRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 10,
      marginVertical: Spacing.sm,
    },
    otpBox: {
      width: 44,
      height: 52,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.mist,
      alignItems: 'center',
      justifyContent: 'center',
    },
    otpBoxActive: {
      borderColor: c.ink,
      backgroundColor: 'rgba(0,0,0,0.04)',
    },
    otpBoxFilled: {
      borderColor: c.accentMint,
      backgroundColor: 'rgba(85,196,154,0.06)',
    },
    otpBoxError: { borderColor: c.error },
    otpDigit: {
      fontSize: 20,
      fontWeight: Typography.weight.bold,
      color: c.ink,
      letterSpacing: -0.5,
    },

    resendBtn: {
      alignSelf: 'center',
      paddingVertical: 10,
      paddingHorizontal: Spacing.lg,
      marginTop: Spacing.xs,
    },
    resendBtnEmphasized: {
      backgroundColor: 'rgba(85,196,154,0.12)',
      borderRadius: 14,
    },
    resendBtnText: {
      fontSize: 13,
      fontWeight: Typography.weight.medium,
      color: c.inkSoft,
    },
    resendTextEmphasized: { color: c.accentMint, fontWeight: Typography.weight.bold },
  });
}
