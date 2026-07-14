import { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Navigation } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { SignInForm } from '@/components/auth/SignInForm';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { ForgotForm } from '@/components/auth/ForgotForm';
import { makeStyles } from '@/components/auth/shared';

type AuthTab = 'signin' | 'signup' | 'forgot';

export default function AuthPage() {
  const [tab, setTab] = useState<AuthTab>('signin');
  const [prefillCredential, setPrefillCredential] = useState('');
  const { language, setLanguage, t, colors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);

  const switchTab = (newTab: AuthTab) => {
    Haptics.selectionAsync();
    setTab(newTab);
  };

  const switchLang = (lang: 'en' | 'ar') => {
    Haptics.selectionAsync();
    setLanguage(lang);
  };

  return (
    <LinearGradient colors={c.luxeGrad} style={styles.root}>
      <View style={styles.langBar}>
        <TouchableOpacity
          style={[styles.langChip, language === 'ar' && styles.langChipActive]}
          onPress={() => switchLang('ar')}
          activeOpacity={0.8}
        >
          <Text style={[styles.langChipText, language === 'ar' && styles.langChipTextActive]}>AR</Text>
        </TouchableOpacity>
        <View style={styles.langSep} />
        <TouchableOpacity
          style={[styles.langChip, language === 'en' && styles.langChipActive]}
          onPress={() => switchLang('en')}
          activeOpacity={0.8}
        >
          <Text style={[styles.langChipText, language === 'en' && styles.langChipTextActive]}>EN</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoBlock}>
            <View style={styles.logoIcon}>
              <Navigation size={24} color={c.white} />
            </View>
            <Text style={styles.wordmark}>VeeGo</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.tabs}>
              {(['signin', 'signup', 'forgot'] as AuthTab[]).map((tabId) => (
                <TouchableOpacity
                  key={tabId}
                  onPress={() => switchTab(tabId)}
                  style={[styles.tabBtn, tab === tabId && styles.tabBtnActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, tab === tabId && styles.tabTextActive]}>
                    {t(tabId === 'signin' ? 'sign_in' : tabId === 'signup' ? 'sign_up' : 'forgot')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {tab === 'signin' && <SignInForm onSuccess={() => router.replace('/(tabs)')} initialCredential={prefillCredential} />}
            {tab === 'signup' && <SignUpForm onSuccess={() => router.replace('/(tabs)')} />}
            {tab === 'forgot' && (
              <ForgotForm
                onSuccess={(phone) => {
                  setPrefillCredential(phone);
                  switchTab('signin');
                }}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
