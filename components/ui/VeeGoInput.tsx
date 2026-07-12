import { ReactNode, useState } from 'react';
import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

export interface VeeGoInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  disabled?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  /** Extra style merged onto the TextInput itself. */
  inputStyle?: StyleProp<TextStyle>;
  /** Extra style merged onto the label text. */
  labelStyle?: StyleProp<TextStyle>;
  /** Extra style merged onto the error text. */
  errorStyle?: StyleProp<TextStyle>;
  /** Extra style merged onto the icon+input row container (distinct from the outer `style`). */
  containerStyle?: StyleProp<ViewStyle>;
}

export function VeeGoInput({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
  secureTextEntry,
  keyboardType,
  inputStyle,
  labelStyle,
  errorStyle,
  containerStyle,
}: VeeGoInputProps) {
  const { colors: c, isRTL } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? c.error : focused ? c.primary : c.border;

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <Text
          style={[
            styles.label,
            { color: c.mutedText, textAlign: isRTL ? 'right' : 'left', fontWeight: Typography.weight.medium },
            labelStyle,
          ]}
        >
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputRow,
          {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            backgroundColor: c.mist,
            borderColor,
            opacity: disabled ? 0.5 : 1,
          },
          containerStyle,
        ]}
      >
        {leftIcon ? <View style={styles.iconSlot}>{leftIcon}</View> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.inkSoft}
          editable={!disabled}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          textAlign={isRTL ? 'right' : 'left'}
          style={[styles.input, { color: c.text, fontSize: Typography.size.sm }, inputStyle]}
        />
        {rightIcon ? <View style={styles.iconSlot}>{rightIcon}</View> : null}
      </View>

      {error ? (
        <Text style={[styles.error, { color: c.error, textAlign: isRTL ? 'right' : 'left' }, errorStyle]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: Typography.size.xs,
  },
  inputRow: {
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    height: 52,
    gap: Spacing.sm,
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
  },
  error: {
    fontSize: Typography.size.xs,
  },
});
