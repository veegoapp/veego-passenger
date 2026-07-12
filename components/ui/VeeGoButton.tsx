import { cloneElement, isValidElement, ReactElement, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
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
  /** Extra style merged onto the title text (added after the default/variant text style). */
  textStyle?: StyleProp<TextStyle>;
  /** Which side of the title the icon renders on. Defaults to 'left' (existing behavior). */
  iconPosition?: 'left' | 'right';
  /** Clones the passed icon element with this `size` prop, if provided. */
  iconSize?: number;
  /** Clones the passed icon element with this `color` prop, if provided. */
  iconColor?: string;
  /** Overrides the title's font family. Unset by default (existing behavior). */
  fontFamily?: string;
  /** Opt-in press feedback (a discrete scale-down while pressed, no animation library). Off by default. */
  pressedScale?: boolean;
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

function renderIcon(icon: ReactNode, iconSize?: number, iconColor?: string) {
  if (!icon) return null;
  if ((iconSize !== undefined || iconColor !== undefined) && isValidElement(icon)) {
    const extraProps: Record<string, unknown> = {};
    if (iconSize !== undefined) extraProps.size = iconSize;
    if (iconColor !== undefined) extraProps.color = iconColor;
    return <View style={styles.icon}>{cloneElement(icon as ReactElement<any>, extraProps)}</View>;
  }
  return <View style={styles.icon}>{icon}</View>;
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
  textStyle,
  iconPosition = 'left',
  iconSize,
  iconColor,
  fontFamily,
  pressedScale = false,
}: VeeGoButtonProps) {
  const { colors: c, isRTL } = useTheme();
  const isDisabled = disabled || loading;
  const sizeConfig = SIZE_CONFIG[size];
  const variantStyle = getVariantStyle(variant, c);

  const containerStyle: StyleProp<ViewStyle>[] = [
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
  ];

  const iconElement = renderIcon(icon, iconSize, iconColor);
  const titleElement = (
    <Text
      style={[
        styles.text,
        { fontSize: sizeConfig.fontSize, fontWeight: Typography.weight.semibold },
        variantStyle.text,
        fontFamily ? { fontFamily } : null,
        textStyle,
      ]}
    >
      {title}
    </Text>
  );

  const content = loading ? (
    <ActivityIndicator size="small" color={variantStyle.text.color as string} />
  ) : iconPosition === 'right' ? (
    <>
      {titleElement}
      {iconElement}
    </>
  ) : (
    <>
      {iconElement}
      {titleElement}
    </>
  );

  if (pressedScale) {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [...containerStyle, pressed ? styles.pressedScale : null]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} disabled={isDisabled} activeOpacity={0.8} style={containerStyle}>
      {content}
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
  pressedScale: {
    transform: [{ scale: 0.96 }],
  },
});
