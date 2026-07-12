import { StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

export type VeeGoBadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface VeeGoBadgeProps {
  text: string;
  variant?: VeeGoBadgeVariant;
  /** Extra style merged onto the badge text (added after the variant text color). */
  textStyle?: StyleProp<TextStyle>;
  /** Overrides the variant's background color. */
  backgroundColor?: string;
  /** Adds a 1px border in this color. No border is drawn unless this is set. */
  borderColor?: string;
  /** Overrides the variant's text color. */
  textColor?: string;
}

function getVariantColors(variant: VeeGoBadgeVariant, c: ThemeColors) {
  switch (variant) {
    case 'success':
      return { background: `${c.success}1A`, foreground: c.success };
    case 'warning':
      return { background: `${c.warning}1A`, foreground: c.warning };
    case 'error':
      return { background: `${c.error}1A`, foreground: c.error };
    case 'info':
      return { background: `${c.info}1A`, foreground: c.info };
    case 'neutral':
    default:
      return { background: c.mist, foreground: c.mutedText };
  }
}

export function VeeGoBadge({ text, variant = 'neutral', textStyle, backgroundColor, borderColor, textColor }: VeeGoBadgeProps) {
  const { colors: c } = useTheme();
  const { background, foreground } = getVariantColors(variant, c);

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: backgroundColor ?? background },
        borderColor ? { borderWidth: 1, borderColor } : null,
      ]}
    >
      <Text
        style={[styles.text, { color: textColor ?? foreground, fontWeight: Typography.weight.semibold }, textStyle]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs / 2,
    borderRadius: Radius.full,
  },
  text: {
    fontSize: Typography.size.xs,
  },
});
