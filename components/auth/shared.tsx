import { StyleSheet } from 'react-native';
import type { ThemeColors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { useSplitColors, type SplitColors } from '@/constants/splitTheme';

// Session/token persistence now lives in src/api/session.ts (single shared
// module — was previously duplicated here, in app/index.tsx, and in
// app/verify-phone.tsx). Re-exported so existing imports of
// `saveSession`/`persistTokens` from './shared' keep working unchanged.
export { saveSession, persistTokens } from '@/src/api/session';

// ── C · Split Panel — fixed palette, independent of the app's light/dark theme.
const C_RED = '#D92D20';

export function makeStyles(_c: ThemeColors, S: SplitColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: S.bg },
    langBar: {
      position: 'absolute', top: 56, right: 20, zIndex: 20,
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: S.card,
      borderRadius: 99, paddingHorizontal: 6, paddingVertical: Spacing.xs, gap: 2,
      borderWidth: 1, borderColor: S.hair,
    },
    langChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: 99 },
    langChipActive: { backgroundColor: S.panel },
    langChipText: { fontSize: 12, fontWeight: '700', color: S.inkSoft },
    langChipTextActive: { color: '#fff' },
    langSep: { width: 1, height: 14, backgroundColor: S.hair },
    scroll: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40, justifyContent: 'center', gap: 28 },
    logoBlock: { alignItems: 'center', gap: Spacing.sm, paddingTop: 60 },
    logoIcon: { width: 56, height: 56, borderRadius: 20, backgroundColor: S.panel, alignItems: 'center', justifyContent: 'center' },
    wordmark: { fontSize: 26, fontWeight: '800', color: S.ink, letterSpacing: -1.1 },
    card: { backgroundColor: S.card, borderRadius: 28, borderWidth: 1, borderColor: S.hair, overflow: 'hidden' },
    tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: S.hair },
    tabBtn: { flex: 1, paddingVertical: Spacing.lg, alignItems: 'center' },
    tabBtnActive: { borderBottomWidth: 2, borderBottomColor: S.panel, marginBottom: -1 },
    tabText: { fontSize: 12.5, fontWeight: '600', color: S.inkSoft },
    tabTextActive: { color: S.ink, fontWeight: '700' },
    form: { padding: Spacing.xl, gap: Spacing.md },
    formHeader: { gap: Spacing.xs, marginBottom: Spacing.xs },
    formTitle: { fontSize: 20, fontWeight: '700', color: S.ink, letterSpacing: -0.4 },
    formSubtitle: { fontSize: 13, color: S.inkSoft },
    inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: S.surfaceMuted, borderRadius: 18, height: 52, paddingHorizontal: Spacing.lg, gap: 10 },
    inputIcon: { width: 28, alignItems: 'center' },
    inputField: { flex: 1, fontSize: 14, color: S.ink },
    primaryBtn: { height: 56, borderRadius: 20, backgroundColor: S.panel, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
    primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    termsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Spacing.xs },
    termsText: { fontSize: 11, color: S.inkSoft, flex: 1 },
    termsLink: { color: S.ink, fontWeight: '700', textDecorationLine: 'underline' },
    termsCheckRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingTop: Spacing.xs, paddingBottom: 2 },
    checkbox: {
      width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: S.hair,
      backgroundColor: S.surfaceMuted, alignItems: 'center', justifyContent: 'center',
      marginTop: 1, flexShrink: 0,
    },
    checkboxChecked: { backgroundColor: S.panel, borderColor: S.panel },
    termsCheckText: { fontSize: 12, color: S.inkSoft, flex: 1, lineHeight: 18 },

    fieldError: {
      fontSize: 12.5,
      color: C_RED,
      marginTop: -4,
      paddingHorizontal: Spacing.xs,
    },
    channelRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: -Spacing.xs },
    channelChip: {
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
      borderRadius: 14, borderWidth: 1.5, borderColor: S.hair,
      backgroundColor: S.card,
    },
    channelChipActive: { borderColor: S.panel, backgroundColor: S.panel },
    channelChipText: { fontSize: 13, fontWeight: '600', color: S.inkSoft },
    channelChipTextActive: { color: '#fff', fontWeight: '700' },
    successText: {
      fontSize: 12.5,
      color: S.teal,
      fontWeight: '700',
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
      borderColor: S.hair,
      backgroundColor: S.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    otpBoxActive: {
      borderColor: S.panel,
      backgroundColor: S.card,
    },
    otpBoxFilled: {
      borderColor: S.teal,
      backgroundColor: 'rgba(14,159,142,0.06)',
    },
    otpBoxError: { borderColor: C_RED },
    otpDigit: {
      fontSize: 20,
      fontWeight: '800',
      color: S.ink,
      letterSpacing: -0.5,
    },

    resendBtn: {
      alignSelf: 'center',
      paddingVertical: 10,
      paddingHorizontal: Spacing.lg,
      marginTop: Spacing.xs,
    },
    resendBtnEmphasized: {
      backgroundColor: 'rgba(14,159,142,0.1)',
      borderRadius: 14,
    },
    resendBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: S.inkSoft,
    },
    resendTextEmphasized: { color: S.teal, fontWeight: '800' },
  });
}
