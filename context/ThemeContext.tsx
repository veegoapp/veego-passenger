import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager, Platform, View, Text, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LIGHT, DARK, makeGlassStyle, ThemeColors } from '@/constants/colors';
import { translations, LangKey, Lang } from '@/constants/i18n';

type ThemeContextType = {
  colors: ThemeColors;
  glassStyle: ReturnType<typeof makeGlassStyle>;
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
  language: Lang;
  setLanguage: (l: Lang) => void;
  t: (key: LangKey) => string;
  isRTL: boolean;
};

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

const STORAGE_KEY = '@veego_prefs_v1';

// ── Language-switch overlay ───────────────────────────────────────────────────

const SWITCH_DURATION = 750; // ms the overlay stays visible

function LangSwitchOverlay({ visible, darkMode }: { visible: boolean; darkMode: boolean }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.4)).current;
  const checkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset then animate in
      scaleAnim.setValue(0.4);
      checkAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 180 }),
      ]).start(() => {
        Animated.timing(checkAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      });
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  const c = darkMode ? DARK : LIGHT;

  return (
    <Animated.View style={[overlayStyles.root, { opacity: fadeAnim }]} pointerEvents={visible ? 'auto' : 'none'}>
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.6)']}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[overlayStyles.card, { backgroundColor: c.white, transform: [{ scale: scaleAnim }] }]}>
        {/* Animated ring */}
        <View style={[overlayStyles.ring, { borderColor: `${c.accentMint}30`, backgroundColor: `${c.accentMint}12` }]}>
          <View style={[overlayStyles.innerCircle, { backgroundColor: c.ink }]}>
            <Animated.Text style={[overlayStyles.checkIcon, { opacity: checkAnim, transform: [{ scale: checkAnim }] }]}>
              ✓
            </Animated.Text>
          </View>
        </View>
        <Text style={[overlayStyles.label, { color: c.inkSoft }]}>
          {'‎'}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const overlayStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 120,
    height: 120,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  ring: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    fontSize: 26,
    color: '#ffffff',
    fontWeight: '700',
    lineHeight: 30,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
});

// ─────────────────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkModeState] = useState(false);
  const [language, setLanguageState] = useState<Lang>('en');
  const [langSwitching, setLangSwitching] = useState(false);
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const prefs = JSON.parse(raw);
          if (typeof prefs.darkMode === 'boolean') setDarkModeState(prefs.darkMode);
          if (prefs.language === 'en' || prefs.language === 'ar') {
            setLanguageState(prefs.language);
            if (Platform.OS !== 'web') {
              const shouldBeRTL = prefs.language === 'ar';
              if (I18nManager.isRTL !== shouldBeRTL) {
                I18nManager.forceRTL(shouldBeRTL);
              }
            }
          }
        } catch {}
      })
      .catch(() => {});
  }, []);

  const setDarkMode = useCallback((v: boolean) => {
    setDarkModeState(v);
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const existing = raw ? JSON.parse(raw) : {};
        return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, darkMode: v }));
      })
      .catch(() => {});
  }, []);

  const setLanguage = useCallback((l: Lang) => {
    // Show the luxe loading overlay while screens re-fetch translated data
    if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    setLangSwitching(true);
    switchTimerRef.current = setTimeout(() => setLangSwitching(false), SWITCH_DURATION);

    setLanguageState(l);
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const existing = raw ? JSON.parse(raw) : {};
        return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, language: l }));
      })
      .catch(() => {});
    if (Platform.OS !== 'web') {
      const shouldBeRTL = l === 'ar';
      if (I18nManager.isRTL !== shouldBeRTL) {
        I18nManager.forceRTL(shouldBeRTL);
        try {
          const { default: Updates } = require('expo-updates');
          if (typeof Updates?.reloadAsync === 'function') {
            Updates.reloadAsync().catch(() => {});
          }
        } catch {}
      }
    }
  }, []);

  const t = useCallback(
    (key: LangKey) => (translations[language][key] ?? translations['en'][key] ?? key) as string,
    [language]
  );

  const colors = useMemo(() => (darkMode ? DARK : LIGHT), [darkMode]);
  const gs = useMemo(() => makeGlassStyle(colors), [colors]);
  const isRTL = language === 'ar';

  const value = useMemo(
    () => ({ colors, glassStyle: gs, darkMode, setDarkMode, language, setLanguage, t, isRTL }),
    [colors, gs, darkMode, setDarkMode, language, setLanguage, t, isRTL]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
      <LangSwitchOverlay visible={langSwitching} darkMode={darkMode} />
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
