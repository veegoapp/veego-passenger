import { ReactNode } from 'react';
import { GestureResponderEvent, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
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
  /** Extra style applied to an inner wrapper around children, separate from the outer container `style`. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Renders the card as a Pressable when true. Defaults to a plain View. */
  pressable?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
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

export function VeeGoCard({
  children,
  style,
  variant = 'elevated',
  contentStyle,
  pressable = false,
  onPress,
}: VeeGoCardProps) {
  const { colors: c } = useTheme();
  const variantStyle = getVariantStyle(variant, c);
  const containerStyle = [styles.base, variantStyle, style];
  const content = contentStyle ? <View style={contentStyle}>{children}</View> : children;

  if (pressable) {
    return (
      <Pressable onPress={onPress} style={containerStyle}>
        {content}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
});
