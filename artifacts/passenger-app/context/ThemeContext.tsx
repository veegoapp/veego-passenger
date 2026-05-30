import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkModeState] = useState(false);
  const [language, setLanguageState] = useState<Lang>('en');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const prefs = JSON.parse(raw);
          if (typeof prefs.darkMode === 'boolean') setDarkModeState(prefs.darkMode);
          if (prefs.language === 'en' || prefs.language === 'ar') {
            setLanguageState(prefs.language);
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
    setLanguageState(l);
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const existing = raw ? JSON.parse(raw) : {};
        return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, language: l }));
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
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
