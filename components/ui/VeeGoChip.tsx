import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

export interface VeeGoChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
  /** Overrides the background color used when selected. */
  selectedBackgroundColor?: string;
  /** Overrides the text color used when selected. */
  selectedTextColor?: string;
  /** Overrides the background color used when not selected. */
  unselectedBackgroundColor?: string;
  /** Overrides the text color used when not selected. */
  unselectedTextColor?: string;
  /** Overrides the border color for both states. */
  borderColor?: string;
  /** Extra style merged onto the chip label text. */
  textStyle?: StyleProp<TextStyle>;
}

export function VeeGoChip({
  label,
  selected = false,
  disabled = false,
  onPress,
  icon,
  selectedBackgroundColor,
  selectedTextColor,
  unselectedBackgroundColor,
  unselectedTextColor,
  borderColor,
  textStyle,
}: VeeGoChipProps) {
  const { colors: c, isRTL } = useTheme();

  const backgroundColor = selected
    ? selectedBackgroundColor ?? c.primary
    : unselectedBackgroundColor ?? c.mist;
  const textColor = selected
    ? selectedTextColor ?? (c.isDark ? c.background : c.white)
    : unselectedTextColor ?? c.text;
  const resolvedBorderColor = borderColor ?? (selected ? backgroundColor : c.border);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.8}
      style={[
        styles.base,
        {
          flexDirection: isRTL ? 'row-reverse' : 'row',
          backgroundColor,
          borderColor: resolvedBorderColor,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.text, { color: textColor, fontWeight: Typography.weight.medium }, textStyle]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: Typography.size.xs,
  },
});
