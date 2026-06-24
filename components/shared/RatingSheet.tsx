import { useRef, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Animated, Platform, Keyboard,
} from 'react-native';
import { Check, Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';

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

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 200,
      mass: 0.85,
    }).start();
    if (!visible) {
      setStars(0);
      setComment('');
      setSubmitted(false);
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

  const handleSubmit = () => {
    if (stars === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Keyboard.dismiss();
    setSubmitted(true);
    Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 180 }).start();
    setTimeout(() => onSubmit(stars, comment), 1400);
  };

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });
  const sheetBg = c.isDark ? 'rgba(14,14,28,0.99)' : 'rgba(250,250,252,0.99)';
  const borderCol = c.isDark ? 'rgba(90,95,160,0.25)' : 'rgba(0,0,0,0.06)';

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          backgroundColor: sheetBg,
          borderTopColor: borderCol,
          paddingBottom: insets.bottom + 32,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View style={styles.handle} />

      {submitted ? (
        <View style={styles.successWrap}>
          <Animated.View style={[styles.successCircle, { transform: [{ scale: checkScale }] }]}>
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
                    color={n <= stars ? '#FFB000' : c.silver}
                    fill={n <= stars ? '#FFB000' : 'none'}
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
              style={[styles.submitBtn, { backgroundColor: stars > 0 ? '#55c49a' : c.mist, opacity: stars > 0 ? 1 : 0.5 }]}
              onPress={handleSubmit}
              activeOpacity={0.85}
            >
              <Text style={[styles.submitText, { color: stars > 0 ? '#ffffff' : c.inkSoft }]}>{t('submit_rating')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn} onPress={onSkip} activeOpacity={0.7}>
              <Text style={[styles.skipText, { color: c.inkSoft }]}>{t('skip')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -16 },
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 28,
    paddingTop: 6,
    zIndex: 1000,
  },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(150,150,180,0.4)', alignSelf: 'center', marginBottom: 16 },
  inner: { paddingHorizontal: 24, alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginTop: 2 },
  sub: { fontSize: 13.5, marginTop: -8 },
  starsRow: { flexDirection: 'row', gap: 10, marginVertical: 4 },
  commentBox: { width: '100%', borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, minHeight: 72 },
  commentInput: { fontSize: 13.5, lineHeight: 20 },
  btnRow: { width: '100%', gap: 10, marginTop: 4 },
  submitBtn: { height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontSize: 15, fontWeight: '700' },
  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipText: { fontSize: 13.5 },
  successWrap: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, alignItems: 'center', gap: 14 },
  successCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#55c49a', alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  successSub: { fontSize: 13.5, marginTop: -8 },
});
