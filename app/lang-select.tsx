import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Navigation, CheckCircle } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { C } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';

export const LANG_SELECTED_KEY = '@veego_lang_selected';

export default function LangSelectScreen() {
  const { setLanguage } = useTheme();
  const [selected, setSelected] = useState<'en' | 'ar' | null>(null);

  const handleSelect = async (lang: 'en' | 'ar') => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelected(lang);
    setLanguage(lang, true);
    try {
      await AsyncStorage.setItem(LANG_SELECTED_KEY, '1');
    } catch {}
    setTimeout(() => router.replace('/onboarding'), 320);
  };

  return (
    <LinearGradient colors={C.luxeGrad} style={styles.root}>
      <View style={styles.content}>
        <View style={styles.logoBlock}>
          <View style={styles.logoIcon}>
            <Navigation size={28} color={C.white} />
          </View>
          <Text style={styles.wordmark}>VeeGo</Text>
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.titleEn}>Select Language</Text>
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
              <Text style={[styles.langName, selected === 'en' && styles.langNameSelected]}>English</Text>
              <Text style={styles.langNative}>English</Text>
            </View>
            {selected === 'en' && (
              <CheckCircle size={24} color={C.ink} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.langOption, selected === 'ar' && styles.langOptionSelected]}
            onPress={() => handleSelect('ar')}
            activeOpacity={0.85}
          >
            <Text style={styles.langFlag}>🇸🇦</Text>
            <View style={styles.langTextBlock}>
              <Text style={[styles.langName, selected === 'ar' && styles.langNameSelected]}>Arabic</Text>
              <Text style={styles.langNative}>العربية</Text>
            </View>
            {selected === 'ar' && (
              <CheckCircle size={24} color={C.ink} />
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>You can change this anytime in Settings</Text>
        <Text style={styles.hintAr}>يمكنك تغيير هذا في الإعدادات في أي وقت</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', paddingHorizontal: 28, gap: 36, alignItems: 'center' },
  logoBlock: { alignItems: 'center', gap: 10 },
  logoIcon: {
    width: 68, height: 68, borderRadius: 24, backgroundColor: C.ink,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.ink, shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22, shadowRadius: 28, elevation: 8,
  },
  wordmark: {
    fontSize: 34, fontWeight: '700', color: C.ink,
    letterSpacing: -1.5, fontFamily: 'Inter_700Bold',
  },
  textBlock: { alignItems: 'center', gap: 4 },
  titleEn: { fontSize: 22, fontWeight: '600', color: C.ink, letterSpacing: -0.4 },
  titleAr: { fontSize: 18, fontWeight: '500', color: C.inkSoft },
  optionsBlock: { width: '100%', gap: 12 },
  langOption: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 24, padding: 20,
    borderWidth: 2, borderColor: 'transparent',
    shadowColor: C.ink, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 14, elevation: 2,
  },
  langOptionSelected: {
    borderColor: C.ink,
    backgroundColor: 'rgba(255,255,255,0.98)',
    shadowOpacity: 0.14,
  },
  langFlag: { fontSize: 34 },
  langTextBlock: { flex: 1, gap: 2 },
  langName: { fontSize: 17, fontWeight: '600', color: C.inkSoft },
  langNameSelected: { color: C.ink },
  langNative: { fontSize: 13, color: C.silver },
  hint: { fontSize: 12, color: C.inkSoft, textAlign: 'center' },
  hintAr: { fontSize: 12, color: C.silver, textAlign: 'center', marginTop: -24 },
});
