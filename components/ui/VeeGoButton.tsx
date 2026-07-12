import { ReactNode } from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';
import { Shadows } from '@/constants/shadows';

export type VeeGoButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type VeeGoButtonSize = 'small' | 'medium' | 'large';

export interface VeeGoButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  variant?: VeeGoButtonVariant;
  size?: VeeGoButtonSize;
  style?: StyleProp<ViewStyle>;
}

const SIZE_CONFIG: Record<VeeGoButtonSize, { height: number; paddingHorizontal: number; fontSize: number }> = {
  small: { height: 36, paddingHorizontal: Spacing.md, fontSize: Typography.size.xs },
  medium: { height: 48, paddingHorizontal: Spacing.lg, fontSize: Typography.size.sm },
  large: { height: 56, paddingHorizontal: Spacing.xl, fontSize: Typography.size.md },
};

function getVariantStyle(variant: VeeGoButtonVariant, c: ThemeColors) {
  switch (variant) {
    case 'primary':
      return {
        container: { backgroundColor: c.primary, ...Shadows.small },
        text: { color: c.isDark ? c.background : c.white },
      };
    case 'secondary':
      return {
        container: { backgroundColor: c.mist, borderWidth: 1, borderColor: c.border },
        text: { color: c.text },
      };
    case 'danger':
      return {
        container: { backgroundColor: c.error, ...Shadows.small },
        text: { color: c.white },
      };
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent' as const },
        text: { color: c.primary },
      };
  }
}

export function VeeGoButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  icon,
  variant = 'primary',
  size = 'medium',
  style,
}: VeeGoButtonProps) {
  const { colors: c, isRTL } = useTheme();
  const isDisabled = disabled || loading;
  const sizeConfig = SIZE_CONFIG[size];
  const variantStyle = getVariantStyle(variant, c);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.base,
        {
          height: sizeConfig.height,
          paddingHorizontal: sizeConfig.paddingHorizontal,
          borderRadius: Radius.lg,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          opacity: isDisabled ? 0.5 : 1,
        },
        variantStyle.container,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyle.text.color as string} />
      ) : (
        <>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text
            style={[
              styles.text,
              { fontSize: sizeConfig.fontSize, fontWeight: Typography.weight.semibold },
              variantStyle.text,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
});
