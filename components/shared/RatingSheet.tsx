import { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Animated, Platform, Keyboard,
} from 'react-native';
import { Check, Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { GlassView } from '@/components/ui/GlassView';
import { Animation } from '@/constants/animations';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

interface RatingSheetProps {
  visible: boolean;
  driverName: string;
  driverInitials: string;
  driverColor: string;
  onSubmit: (stars: number, comment: string) => void;
  onSkip: () => void;
}

export function RatingSheet({ visible, driverName, driverInitials, driverColor, onSubmit, onSkip }: RatingSheetProps) {
  const { colors: c, t } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const starScale = useRef([...Array(5)].map(() => new Animated.Value(1))).current;
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const checkScale = useRef(new Animated.Value(0)).current;
  // Guards against a rapid double-tap firing handleSubmit twice before the
  // `submitted` state re-render hides the submit button.
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
      setSubmitted(false);
      submittingRef.current = false;
      checkScale.setValue(0);
    }
  }, [visible]);

  const handleStarPress = (n: number) => {
    Haptics.selectionAsync();
    setStars(n);
    Animated.sequence([
      Animated.timing(starScale[n - 1], { toValue: 1.4, duration: 120, useNativeDriver: true }),
      Animated.spring(starScale[n - 1], { toValue: 1, useNativeDriver: true, damping: 10 }),
    ]).start();
  };

  const handleSubmit = useCallback(() => {
    if (stars === 0 || submittingRef.current) return;
    submittingRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Keyboard.dismiss();
    setSubmitted(true);
    Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 180 }).start();
    setTimeout(() => onSubmit(stars, comment), 1400);
  }, [stars, comment, onSubmit, checkScale]);

  const handleSkip = useCallback(() => {
    if (submittingRef.current) return;
    onSkip();
  }, [onSkip]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          opacity: slideAnim,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <GlassView strong borderRadius={28} style={[styles.sheetGlass, { paddingBottom: insets.bottom + 32 }]}>
      <View style={[styles.handle, { backgroundColor: c.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)' }]} />

      {submitted ? (
        <View style={styles.successWrap}>
          <Animated.View style={[styles.successCircle, { backgroundColor: c.accent, transform: [{ scale: checkScale }] }]}>
            <Check size={38} color="#ffffff" />
          </Animated.View>
          <Text style={[styles.successTitle, { color: c.ink }]}>{t('thanks_rating')}</Text>
          <Text style={[styles.successSub, { color: c.inkSoft }]}>{t('ride_confirmed')}</Text>
        </View>
      ) : (
        <View style={styles.inner}>
          <View style={[styles.avatar, { backgroundColor: driverColor }]}>
            <Text style={styles.avatarText}>{driverInitials}</Text>
          </View>
          <Text style={[styles.title, { color: c.ink }]}>{t('rate_your_ride')}</Text>
          <Text style={[styles.sub, { color: c.inkSoft }]}>{driverName}</Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity key={n} onPress={() => handleStarPress(n)} activeOpacity={0.7}>
                <Animated.View style={{ transform: [{ scale: starScale[n - 1] }] }}>
                  <Star
                    size={40}
                    color={n <= stars ? c.accent : c.silver}
                    fill={n <= stars ? c.accent : 'none'}
                  />
                </Animated.View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.commentBox, { backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.white, borderColor: c.border }]}>
            <TextInput
              style={[styles.commentInput, { color: c.ink }]}
              placeholder={t('leave_comment')}
              placeholderTextColor={c.inkSoft}
              multiline
              maxLength={200}
              value={comment}
              onChangeText={setComment}
            />
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: stars > 0 ? c.accent : c.mist, opacity: stars > 0 ? 1 : 0.5 }]}
              onPress={handleSubmit}
              activeOpacity={0.85}
            >
              <Text style={[styles.submitText, { color: stars > 0 ? '#ffffff' : c.inkSoft }]}>{t('submit_rating')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
              <Text style={[styles.skipText, { color: c.inkSoft }]}>{t('skip')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      </GlassView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -16 },
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 28,
    zIndex: 1000,
  },
  sheetGlass: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0,
    paddingTop: 6,
  },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: Spacing.lg },
  inner: { paddingHorizontal: Spacing.xl, alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontSize: Typography.size.xl, fontWeight: Typography.weight.bold },
  title: { fontSize: 20, fontWeight: Typography.weight.bold, letterSpacing: -0.4, marginTop: 2 },
  sub: { fontSize: 13.5, marginTop: -8 },
  starsRow: { flexDirection: 'row', gap: 10, marginVertical: Spacing.xs },
  commentBox: { width: '100%', borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, minHeight: 72 },
  commentInput: { fontSize: 13.5, lineHeight: 20 },
  btnRow: { width: '100%', gap: 10, marginTop: Spacing.xs },
  submitBtn: { height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontSize: 15, fontWeight: Typography.weight.bold },
  skipBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  skipText: { fontSize: 13.5 },
  successWrap: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.sm, alignItems: 'center', gap: 14 },
  successCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, letterSpacing: -0.4 },
  successSub: { fontSize: 13.5, marginTop: -8 },
});
