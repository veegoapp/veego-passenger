import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';
import { Shadows } from '@/constants/shadows';

export type VeeGoCardVariant = 'elevated' | 'flat' | 'outlined';

export interface VeeGoCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: VeeGoCardVariant;
}

function getVariantStyle(variant: VeeGoCardVariant, c: ThemeColors) {
  switch (variant) {
    case 'flat':
      return { backgroundColor: c.surface };
    case 'outlined':
      return { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border };
    case 'elevated':
    default:
      return { backgroundColor: c.surface, ...Shadows.medium };
  }
}

export function VeeGoCard({ children, style, variant = 'elevated' }: VeeGoCardProps) {
  const { colors: c } = useTheme();
  const variantStyle = getVariantStyle(variant, c);

  return <View style={[styles.base, variantStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
});
