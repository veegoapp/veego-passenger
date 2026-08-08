import React from 'react';
import { Platform, StyleSheet, View, ViewStyle, LayoutChangeEvent } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/context/ThemeContext';

interface GlassViewProps {
  style?: ViewStyle | ViewStyle[];
  strong?: boolean;
  children?: React.ReactNode;
  borderRadius?: number;
  onLayout?: (e: LayoutChangeEvent) => void;
}

/**
 * Passenger-side port of the Driver app's GlassView. Now matches it exactly:
 * real native frosted blur on iOS light mode (the Driver app's signature
 * depth cue), flat translucent panel everywhere else.
 */
export function GlassView({ style, strong = false, children, borderRadius = 16, onLayout }: GlassViewProps) {
  const { colors: c } = useTheme();
  const bg = c.isDark
    ? (strong ? 'rgba(22,22,26,0.98)' : 'rgba(22,22,26,0.94)')
    : (strong ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.85)');

  if (Platform.OS === 'ios' && !c.isDark) {
    return (
      <View onLayout={onLayout} style={[{ borderRadius, overflow: 'hidden', borderWidth: 1, borderColor: c.border }, style]}>
        <BlurView intensity={strong ? 80 : 60} tint="light" style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  }

  return (
    <View onLayout={onLayout} style={[{ backgroundColor: bg, borderRadius, borderWidth: 1, borderColor: c.border }, style]}>
      {children}
    </View>
  );
}
