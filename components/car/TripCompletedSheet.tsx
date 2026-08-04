import { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { Animation } from '@/constants/animations';
import { Stars } from '@/components/ui/Stars';

interface TripCompletedSheetProps {
  visible: boolean;
  fare: number | null;
  paymentMethodLabel: string;
  driverName?: string | null;
  /** Called once, with stars === 0 if the passenger tapped Done without rating. */
  onDone: (stars: number, comment: string) => void;
}

/**
 * Lovable's `CompletedSheet` behavior: fare + payment method and the inline
 * 5-star rating live in a single sheet instead of a separate post-trip screen.
 */
export function TripCompletedSheet({ visible, fare, paymentMethodLabel, driverName, onDone }: TripCompletedSheetProps) {
  const { colors: c, t } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const submittingRef = useRef(false);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      ...Animation.spring.sheet,
      mass: 0.85,
    }).start();
    if (!visible) {
      setStars(0);
      setComment('');
      submittingRef.current = false;
    }
  }, [visible]);

  const handleDone = useCallback(() => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Keyboard.dismiss();
    onDone(stars, comment);
  }, [stars, comment, onDone]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });

  return (
    <Animated.View
      style={[styles.sheet, { opacity: slideAnim, transform: [{ translateY }] }]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View style={[styles.sheetSurface, { backgroundColor: c.white, paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.handle, { backgroundColor: c.border }]} />

        <View style={styles.inner}>
          <Text style={[styles.completedLabel, { color: c.inkSoft }]}>{t('trip_complete')}</Text>

          {fare != null && (
            <Text style={[styles.fareAmount, { color: c.ink }]}>
              {fare.toFixed(2)} <Text style={[styles.fareCurrency, { color: c.inkSoft }]}>{t('egp')}</Text>
            </Text>
          )}

          <View style={[styles.paymentChip, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}>
            <Text style={[styles.paymentChipText, { color: c.ink }]}>{paymentMethodLabel}</Text>
          </View>

          <View style={[styles.ratingSection, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}>
            <Text style={[styles.ratingPrompt, { color: c.ink }]}>
              {driverName ? `${t('rate_your_ride')} ${driverName}?` : t('rate_your_ride')}
            </Text>
            <Stars value={stars} size={32} gap={10} onRate={setStars} />
            <TextInput
              style={[styles.commentInput, { borderColor: c.border, backgroundColor: c.white, color: c.ink }]}
              placeholder={t('leave_comment')}
              placeholderTextColor={c.inkSoft}
              multiline
              maxLength={200}
              value={comment}
              onChangeText={setComment}
              numberOfLines={2}
            />
          </View>

          <TouchableOpacity
            onPress={handleDone}
            activeOpacity={0.88}
            style={[styles.primaryBtn, { backgroundColor: c.primary }]}
          >
            <Text style={styles.primaryBtnText}>{t('done')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 28,
    zIndex: 1000,
  },
  sheetSurface: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
  },
  handle: {
    width: 40, height: 5, borderRadius: 3,
    alignSelf: 'center', marginBottom: 24,
  },

  inner: {
    paddingHorizontal: 20, alignItems: 'center', gap: 14,
  },
  completedLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  fareAmount: {
    fontSize: 32, fontWeight: '800', letterSpacing: -1, marginTop: 2,
  },
  fareCurrency: { fontSize: 15, fontWeight: '600' },

  paymentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 99, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  paymentChipText: { fontSize: 13, fontWeight: '500' },

  ratingSection: {
    width: '100%', borderRadius: 16, borderWidth: 1,
    padding: 16, alignItems: 'center', gap: 12, marginTop: 4,
  },
  ratingPrompt: { fontSize: 15, fontWeight: '600' },

  commentInput: {
    width: '100%', borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, lineHeight: 20, minHeight: 68,
    textAlignVertical: 'top',
  },

  primaryBtn: {
    width: '100%', height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 6,
  },
  primaryBtnText: { fontSize: 15.5, fontWeight: '600', color: '#ffffff', letterSpacing: -0.15 },
});
