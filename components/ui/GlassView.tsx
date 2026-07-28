import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

interface GlassViewProps {
  style?: ViewStyle | ViewStyle[];
  strong?: boolean;
  children?: React.ReactNode;
  borderRadius?: number;
}

/**
 * Passenger-side port of the Driver app's GlassView — same glassmorphism
 * card language (translucent panel + hairline border) used for every sheet
 * in the ride-journey flow. No expo-blur dependency here (Driver only uses
 * native blur on iOS light mode; this flat variant matches its Android/dark
 * fallback, which is the same look already rendered there).
 */
export function GlassView({ style, strong = false, children, borderRadius = 16 }: GlassViewProps) {
  const { colors: c } = useTheme();
  const bg = c.isDark
    ? (strong ? 'rgba(22,22,26,0.98)' : 'rgba(22,22,26,0.94)')
    : (strong ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.85)');

  return (
    <View style={[{ backgroundColor: bg, borderRadius, borderWidth: 1, borderColor: c.border }, style]}>
      {children}
    </View>
  );
}
