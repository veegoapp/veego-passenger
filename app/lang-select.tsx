import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Navigation, CheckCircle } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import type { ThemeColors } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';
import { Shadows } from '@/constants/shadows';

export const LANG_SELECTED_KEY = '@veego_lang_selected';

export default function LangSelectScreen() {
  const { colors: c, setLanguage, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [selected, setSelected] = useState<'en' | 'ar' | null>(null);

  const handleSelect = async (lang: 'en' | 'ar') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelected(lang);
    // Persist the first-launch flag BEFORE calling setLanguage. For Arabic,
    // setLanguage triggers an app restart (RTL layout change) after writing
    // to @veego_prefs_v1. If the flag is written after setLanguage, the
    // restart fires before the flag is in storage and the screen re-appears
    // on every subsequent launch.
    try {
      await AsyncStorage.setItem(LANG_SELECTED_KEY, '1');
    } catch (err) {
      if (__DEV__) console.warn('[LangSelect] failed to persist language choice:', err);
    }
    setLanguage(lang);
    setTimeout(() => router.replace('/onboarding'), 320);
  };

  return (
    <LinearGradient colors={c.luxeGrad} style={styles.root}>
      <View style={styles.content}>
        <View style={styles.logoBlock}>
          <View style={styles.logoIcon}>
            <Navigation size={28} color={c.white} />
          </View>
          <Text style={styles.wordmark}>VeeGo</Text>
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.titleEn}>{t('select_language')}</Text>
          <Text style={styles.titleAr}>اختر اللغة</Text>
        </View>

        <View style={styles.optionsBlock}>
          <TouchableOpacity
            style={[styles.langOption, selected === 'en' && styles.langOptionSelected]}
            onPress={() => handleSelect('en')}
            activeOpacity={0.85}
          >
            <Text style={styles.langFlag}>🇬🇧</Text>
            <View style={styles.langTextBlock}>
              <Text style={[styles.langName, selected === 'en' && styles.langNameSelected]}>{t('lang_english')}</Text>
              <Text style={styles.langNative}>English</Text>
            </View>
            {selected === 'en' && (
              <CheckCircle size={24} color={c.ink} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.langOption, selected === 'ar' && styles.langOptionSelected]}
            onPress={() => handleSelect('ar')}
            activeOpacity={0.85}
          >
            <Text style={styles.langFlag}>🇸🇦</Text>
            <View style={styles.langTextBlock}>
              <Text style={[styles.langName, selected === 'ar' && styles.langNameSelected]}>{t('lang_arabic')}</Text>
              <Text style={styles.langNative}>العربية</Text>
            </View>
            {selected === 'ar' && (
              <CheckCircle size={24} color={c.ink} />
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>{t('lang_change_hint')}</Text>
        <Text style={styles.hintAr}>يمكنك تغيير هذا في الإعدادات في أي وقت</Text>
      </View>
    </LinearGradient>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { width: '100%', paddingHorizontal: 28, gap: 36, alignItems: 'center' },
    logoBlock: { alignItems: 'center', gap: 10 },
    logoIcon: {
      width: 68, height: 68, borderRadius: Radius.xl, backgroundColor: c.ink,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: c.ink, shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.22, shadowRadius: 28, elevation: Shadows.large.elevation,
    },
    wordmark: {
      fontSize: 34, fontWeight: Typography.weight.bold, color: c.ink,
      letterSpacing: -1.5, fontFamily: 'Inter_700Bold',
    },
    textBlock: { alignItems: 'center', gap: Spacing.xs },
    titleEn: { fontSize: Typography.size.xl, fontWeight: Typography.weight.semibold, color: c.ink, letterSpacing: -0.4 },
    titleAr: { fontSize: Typography.size.lg, fontWeight: Typography.weight.medium, color: c.inkSoft },
    optionsBlock: { width: '100%', gap: Spacing.md },
    langOption: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
      backgroundColor: 'rgba(255,255,255,0.85)',
      borderRadius: Radius.xl, padding: 20,
      borderWidth: 2, borderColor: 'transparent',
      shadowColor: c.ink, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07, shadowRadius: 14, elevation: Shadows.small.elevation,
    },
    langOptionSelected: {
      borderColor: c.ink,
      backgroundColor: 'rgba(255,255,255,0.98)',
      shadowOpacity: 0.14,
    },
    langFlag: { fontSize: 34 },
    langTextBlock: { flex: 1, gap: 2 },
    langName: { fontSize: 17, fontWeight: Typography.weight.semibold, color: c.inkSoft },
    langNameSelected: { color: c.ink },
    langNative: { fontSize: 13, color: c.silver },
    hint: { fontSize: Typography.size.xs, color: c.inkSoft, textAlign: 'center' },
    hintAr: { fontSize: Typography.size.xs, color: c.silver, textAlign: 'center', marginTop: -24 },
  });
}
