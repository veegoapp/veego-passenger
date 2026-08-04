import { memo, useRef } from 'react';
import { View, TouchableOpacity, Animated } from 'react-native';
import { Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';

interface StarsProps {
  /** Current rating, 0–5. Fractional values round to the nearest star for display. */
  value: number;
  size?: number;
  gap?: number;
  /** Presence enables interactive (tap-to-rate) mode with a per-star press animation. */
  onRate?: (n: number) => void;
}

function StarsBase({ value, size = 14, gap = 2, onRate }: StarsProps) {
  const { colors: c } = useTheme();
  const scales = useRef([1, 2, 3, 4, 5].map(() => new Animated.Value(1))).current;

  const handlePress = (n: number) => {
    Haptics.selectionAsync();
    Animated.sequence([
      Animated.timing(scales[n - 1], { toValue: 1.5, duration: 120, useNativeDriver: true }),
      Animated.spring(scales[n - 1], { toValue: 1, useNativeDriver: true, damping: 10 }),
    ]).start();
    onRate!(n);
  };

  return (
    <View style={{ flexDirection: 'row', gap }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= Math.round(value);
        const star = (
          <Star
            size={size}
            color={filled ? c.gold : c.border}
            fill={filled ? c.gold : 'transparent'}
            strokeWidth={0}
          />
        );

        if (!onRate) return <View key={i}>{star}</View>;

        return (
          <TouchableOpacity key={i} onPress={() => handlePress(i)} activeOpacity={0.7}>
            <Animated.View style={{ transform: [{ scale: scales[i - 1] }] }}>{star}</Animated.View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export const Stars = memo(StarsBase);
