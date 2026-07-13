import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppLoader } from '@/components/ui/AppLoader';
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

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.4);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 180 }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  const c = darkMode ? DARK : LIGHT;

  return (
    <Animated.View style={[overlayStyles.root, { opacity: fadeAnim }]} pointerEvents={visible ? 'auto' : 'none'}>
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.72)']}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[overlayStyles.card, { backgroundColor: c.isDark ? 'rgba(30,32,54,0.98)' : 'rgba(255,255,255,0.98)', transform: [{ scale: scaleAnim }] }]}>
        <AppLoader size={80} />
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
    width: 136,
    height: 136,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 20,
  },
});

// ─────────────────────────────────────────────────────────────────────────────

// ── Automatic app restart (RTL reload) ────────────────────────────────────────
// I18nManager.forceRTL only takes effect for already-mounted native views after
// a full reload. expo-updates is the primary mechanism (works in Expo Go +
// standalone); if it throws or is unavailable, fall back to RN's
// DevSettings.reload() so a language switch never silently leaves layout
// mirroring unapplied.
function triggerAppRestart(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { default: Updates } = require('expo-updates');
    (Updates.reloadAsync as () => Promise<void>)().catch(() => {
      devSettingsReload();
    });
  } catch {
    devSettingsReload();
  }
}

function devSettingsReload(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NativeModules } = require('react-native');
    NativeModules.DevSettings?.reload?.();
  } catch {
    // No restart path available — user must restart manually.
  }
}

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
            const shouldBeRTL = prefs.language === 'ar';
            if (I18nManager.isRTL !== shouldBeRTL) {
              I18nManager.forceRTL(shouldBeRTL);
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
    const shouldBeRTL = l === 'ar';
    const rtlChanged = I18nManager.isRTL !== shouldBeRTL;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const existing = raw ? JSON.parse(raw) : {};
        return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, language: l }));
      })
      .then(() => {
        if (rtlChanged) {
          I18nManager.forceRTL(shouldBeRTL);
          triggerAppRestart();
        }
      })
      .catch(() => {});
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
