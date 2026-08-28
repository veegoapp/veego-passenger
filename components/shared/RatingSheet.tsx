import { useRef, useEffect, useState, useCallback, useMemo} from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Animated, Keyboard,
} from 'react-native';
import { Check, Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { Animation } from '@/constants/animations';
import { useSplitColors, type SplitColors } from '@/constants/splitTheme';

interface RatingSheetProps {
  visible: boolean;
  driverName: string;
  driverInitials: string;
  driverColor: string;
  onSubmit: (stars: number, comment: string) => void;
  onSkip: () => void;
}

// ── C · Split Panel — fixed palette, independent of the app's light/dark theme
// (matches TripCompletedSheet's rating step, which this mirrors).
const C_STAR = '#F5A623';

export function RatingSheet({ visible, driverName, driverInitials, driverColor, onSubmit, onSkip }: RatingSheetProps) {
  const { t } = useTheme();
  const S = useSplitColors();
  const styles = useMemo(() => makeStyles(S), [S]);
  const insets = useSafeAreaInsets();
  const slideAnim   = useRef(new Animated.Value(0)).current;
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
      style={[styles.sheet, { opacity: slideAnim, transform: [{ translateY }] }]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View style={[styles.card, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />

        {submitted ? (
          /* ── Success state ── */
          <View style={styles.successWrap}>
            <Animated.View style={[styles.successCircle, { transform: [{ scale: checkScale }] }]}>
              <Check size={34} color={S.teal} strokeWidth={2.5} />
            </Animated.View>
            <Text style={styles.successTitle}>{t('thanks_rating')}</Text>
            <Text style={styles.successSub}>{t('ride_confirmed')}</Text>
          </View>
        ) : (
          <>
            {/* dark header row */}
            <View style={styles.header}>
              <View style={[styles.avatar, { backgroundColor: driverColor }]}>
                <Text style={styles.avatarText}>{driverInitials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerCap}>{t('trip_complete') ?? 'Trip completed'}</Text>
                <Text style={styles.headerTitle}>{t('rate_your_ride')}</Text>
                <Text style={styles.headerSub} numberOfLines={1}>{driverName}</Text>
              </View>
            </View>

            {/* white body */}
            <View style={styles.body}>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity key={n} onPress={() => setStars(n)} hitSlop={6} activeOpacity={0.75}>
                    <Star size={38} color={n <= stars ? C_STAR : '#D3D6DA'} fill={n <= stars ? C_STAR : 'transparent'} strokeWidth={n <= stars ? 0 : 1.4} />
                  </TouchableOpacity>
                ))}
              </View>

              {stars > 0 ? (
                <TextInput
                  style={styles.commentInput}
                  placeholder={t('leave_comment')}
                  placeholderTextColor={S.cap}
                  multiline
                  maxLength={200}
                  value={comment}
                  onChangeText={setComment}
                  numberOfLines={2}
                />
              ) : (
                <Text style={styles.commentPlaceholder}>{t('leave_comment')}</Text>
              )}

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={stars === 0}
                activeOpacity={0.88}
                style={[styles.submitBtn, { opacity: stars > 0 ? 1 : 0.5 }]}
              >
                <Text style={styles.submitBtnText}>{t('submit_rating')}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.skipBtn}>
                <Text style={styles.skipText}>{t('skip')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Animated.View>
  );
}

function makeStyles(S: SplitColors) {
  return StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 28,
    zIndex: 1000,
  },
  card: {
    backgroundColor: S.card,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  handle: {
    width: 40, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.14)',
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },

  /* ── Header (dark) ── */
  header: {
    backgroundColor: S.panel, flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 22, paddingVertical: 20,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  headerCap: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: S.capOnDark },
  headerTitle: { fontSize: 19, fontWeight: '800', color: '#ffffff', marginTop: 3 },
  headerSub: { fontSize: 12.5, fontWeight: '600', color: '#B7BBC2', marginTop: 2 },

  /* ── Body (white) ── */
  body: { padding: 22 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  commentPlaceholder: {
    marginTop: 20, backgroundColor: '#F6F7F8', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, fontWeight: '500', color: S.cap,
  },
  commentInput: {
    width: '100%', borderWidth: 1, borderColor: S.hair, borderRadius: 14, backgroundColor: '#F6F7F8',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, lineHeight: 20, marginTop: 20,
    minHeight: 60, textAlignVertical: 'top', color: S.ink,
  },
  submitBtn: {
    height: 54, borderRadius: 15, backgroundColor: S.panel,
    alignItems: 'center', justifyContent: 'center', marginTop: 20,
  },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#ffffff', letterSpacing: 0.2 },
  skipBtn: { alignSelf: 'center', paddingVertical: 12 },
  skipText: { fontSize: 13, fontWeight: '700', color: S.cap },

  /* ── Success ── */
  successWrap: { paddingHorizontal: 24, paddingTop: 6, paddingBottom: 30, alignItems: 'center', gap: 12 },
  successCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(14,159,142,0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  successTitle: { fontSize: 19, fontWeight: '800', color: S.ink, letterSpacing: -0.3 },
  successSub: { fontSize: 13, fontWeight: '600', color: S.cap, marginTop: -6 },
  });
}
