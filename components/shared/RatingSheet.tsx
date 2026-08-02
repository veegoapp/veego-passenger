import { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Animated, Keyboard,
} from 'react-native';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { Animation } from '@/constants/animations';

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const GOLD = '#C8A535';

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
  const slideAnim   = useRef(new Animated.Value(0)).current;
  const starScales  = useRef([...Array(5)].map(() => new Animated.Value(1))).current;
  const checkScale  = useRef(new Animated.Value(0)).current;
  const [stars, setStars]       = useState(0);
  const [comment, setComment]   = useState('');
  const [submitted, setSubmitted] = useState(false);
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
      Animated.timing(starScales[n - 1], { toValue: 1.5, duration: 120, useNativeDriver: true }),
      Animated.spring(starScales[n - 1], { toValue: 1, useNativeDriver: true, damping: 10 }),
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

  const isDark = c.isDark;
  const cardBg    = isDark ? '#1a1a2e' : '#ffffff';
  const surfaceBg = isDark ? '#16162a' : '#f7f8fc';
  const borderCol = isDark ? '#2c2c46' : '#e5e5ea';
  const primaryCol = c.primary;

  return (
    <Animated.View
      style={[styles.sheet, { opacity: slideAnim, transform: [{ translateY }] }]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View style={[styles.sheetSurface, { backgroundColor: cardBg, paddingBottom: insets.bottom + 32 }]}>
        <View style={[styles.handle, { backgroundColor: borderCol }]} />

        {submitted ? (
          /* ── Success state ── */
          <View style={styles.successWrap}>
            <Animated.View style={[
              styles.successCircle,
              { backgroundColor: c.success, transform: [{ scale: checkScale }] },
            ]}>
              <Check size={38} color="#ffffff" strokeWidth={2.5} />
            </Animated.View>
            <Text style={[styles.successTitle, { color: c.ink }]}>{t('thanks_rating')}</Text>
            <Text style={[styles.successSub, { color: c.inkSoft }]}>{t('ride_confirmed')}</Text>
          </View>
        ) : (
          /* ── Rating form ── */
          <View style={styles.inner}>
            {/* "Trip completed" label */}
            <Text style={[styles.completedLabel, { color: c.inkSoft }]}>
              {t('trip_complete') ?? 'Trip completed'}
            </Text>

            {/* Driver avatar */}
            <View style={[styles.avatar, { backgroundColor: driverColor }]}>
              <Text style={styles.avatarText}>{driverInitials}</Text>
            </View>

            <Text style={[styles.title, { color: c.ink }]}>{t('rate_your_ride')}</Text>
            <Text style={[styles.driverName, { color: c.inkSoft }]}>{driverName}</Text>

            {/* Star rating section */}
            <View style={[styles.ratingSection, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
              <Text style={[styles.ratingPrompt, { color: c.ink }]}>
                {`How was your ride with ${driverName}?`}
              </Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity key={n} onPress={() => handleStarPress(n)} activeOpacity={0.7}>
                    <Animated.View style={{ transform: [{ scale: starScales[n - 1] }] }}>
                      <Text style={[styles.star, { color: n <= stars ? GOLD : borderCol }]}>★</Text>
                    </Animated.View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Comment input */}
              <TextInput
                style={[
                  styles.commentInput,
                  { borderColor: borderCol, backgroundColor: cardBg, color: c.ink },
                ]}
                placeholder={t('leave_comment')}
                placeholderTextColor={c.inkSoft}
                multiline
                maxLength={200}
                value={comment}
                onChangeText={setComment}
                numberOfLines={2}
              />
            </View>

            {/* Submit button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={stars === 0}
              activeOpacity={0.88}
              style={[
                styles.submitBtn,
                { backgroundColor: stars > 0 ? primaryCol : (isDark ? '#2a2a40' : '#d1d1d8'), opacity: stars > 0 ? 1 : 0.5 },
              ]}
            >
              <Text style={styles.submitBtnText}>{t('submit_rating')}</Text>
            </TouchableOpacity>

            {/* Skip */}
            <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.skipBtn}>
              <Text style={[styles.skipText, { color: c.inkSoft }]}>{t('skip')}</Text>
            </TouchableOpacity>
          </View>
        )}
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

  /* ── Success ── */
  successWrap: {
    paddingHorizontal: 24, paddingBottom: 8,
    alignItems: 'center', gap: 14,
  },
  successCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  successTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  successSub: { fontSize: 14, marginTop: -6 },

  /* ── Rating form ── */
  inner: {
    paddingHorizontal: 20, alignItems: 'center', gap: 14,
  },
  completedLabel: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  avatar: {
    width: 64, height: 64, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginTop: 2 },
  driverName: { fontSize: 14, marginTop: -8 },

  ratingSection: {
    width: '100%', borderRadius: 16, borderWidth: 1,
    padding: 16, alignItems: 'center', gap: 12,
  },
  ratingPrompt: { fontSize: 15, fontWeight: '600' },
  starsRow: { flexDirection: 'row', gap: 10 },
  star: { fontSize: 36 },

  commentInput: {
    width: '100%', borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, lineHeight: 20, minHeight: 68,
    textAlignVertical: 'top',
  },

  submitBtn: {
    width: '100%', height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 6,
  },
  submitBtnText: { fontSize: 15.5, fontWeight: '600', color: '#ffffff', letterSpacing: -0.15 },

  skipBtn: { paddingVertical: 8, alignItems: 'center' },
  skipText: { fontSize: 14 },
});
