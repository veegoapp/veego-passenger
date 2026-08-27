import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Star } from 'lucide-react-native';
import { useRef, useEffect, useState, useCallback } from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppLoader } from '@/components/ui/AppLoader';
import { useTheme } from '@/context/ThemeContext';
import { getPassengerRating } from '@/src/api/userService';
import { Animation } from '@/constants/animations';
import { Spacing } from '@/constants/spacing';

type RatingEntry = {
  id: number;
  raterId: number;
  rideId?: number | null;
  tripId?: number | null;
  context: 'ride' | 'shuttle';
  score: number;
  comment?: string | null;
  createdAt: string;
};

type RatingsResponse = {
  averageRating: number | null;
  totalRatings: number;
  tripCount: number;
  ratings: RatingEntry[];
};

type BreakdownItem = { stars: number; count: number; pct: number };

// ── C · Split Panel — fixed palette, independent of the app's light/dark theme.
const C_BG = '#EEF0F2';
const C_PANEL = '#14151A';
const C_INK = '#14151A';
const C_INK_SOFT = '#6B7178';
const C_CAP = '#9AA0A6';
const C_HAIR = '#EEF0F1';
const C_TEAL = '#0E9F8E';
const C_STAR = '#F5A623';

function buildBreakdown(ratings: RatingEntry[]): BreakdownItem[] {
  const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of ratings) {
    const s = Math.round(r.score);
    if (s >= 1 && s <= 5) counts[s]++;
  }
  const total = ratings.length || 1;
  return [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: counts[stars],
    pct: Math.round((counts[stars] / total) * 100),
  }));
}

/**
 * Structural/visual port of the Driver app's own ratings screen
 * (VeeGo-Driver/app/ratings.tsx) — same hero average-rating card, animated
 * star-breakdown bars, and "Recent reviews" list — showing how drivers have
 * rated this passenger instead of how riders have rated a driver.
 */
export default function RatingsScreen() {
  const { t, isRTL } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = insets.top;
  const TA = isRTL ? ('right' as const) : ('left' as const);

  const [data, setData] = useState<RatingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const raw = await getPassengerRating();
      setData({
        averageRating: typeof raw?.averageRating === 'number' ? raw.averageRating : null,
        totalRatings: raw?.totalRatings ?? 0,
        tripCount: raw?.tripCount ?? 0,
        ratings: Array.isArray(raw?.ratings) ? raw.ratings : [],
      });
      setIsError(false);
    } catch {
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const ratings = data?.ratings ?? [];
  const breakdown = buildBreakdown(ratings);
  const barAnims = useRef(Array.from({ length: 5 }, () => new Animated.Value(0))).current;

  useEffect(() => {
    if (!breakdown.length) return;
    Animated.stagger(80, breakdown.map((r, i) =>
      Animated.timing(barAnims[i], { toValue: r.pct / 100, duration: Animation.duration.slower, useNativeDriver: false })
    )).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratings.length]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: C_BG, alignItems: 'center', justifyContent: 'center' }]}>
        <AppLoader />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, { backgroundColor: C_BG, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: C_INK_SOFT, fontSize: 13.5 }}>{t('ratings_load_error')}</Text>
      </View>
    );
  }

  const avgRating = data?.averageRating ?? 0;
  const ratingsCount = data?.totalRatings ?? 0;
  const tripCount = data?.tripCount ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: C_BG }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: 40, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          {isRTL ? <ArrowRight size={20} color={C_INK} strokeWidth={2} /> : <ArrowLeft size={20} color={C_INK} strokeWidth={2} />}
        </Pressable>

        {/* Average rating hero — dark panel */}
        <View style={styles.heroCard}>
          <Text style={styles.bigRating}>{avgRating ? avgRating.toFixed(2) : '—'}</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} size={20}
                color={C_STAR}
                fill={n <= Math.round(avgRating) ? C_STAR : 'transparent'}
                strokeWidth={2}
              />
            ))}
          </View>
          <Text style={styles.tripCount}>
            {t('ratings_trips_summary').replace('{ratings}', String(ratingsCount)).replace('{trips}', String(tripCount))}
          </Text>
        </View>

        {/* Breakdown bars */}
        <View style={styles.breakdownCard}>
          {breakdown.map((r, i) => (
            <View key={r.stars} style={styles.breakdownRow}>
              <Text style={styles.starNum}>{r.stars}</Text>
              <Star size={12} color={C_STAR} fill={C_STAR} strokeWidth={2} />
              <View style={styles.barTrack}>
                <Animated.View style={[styles.barFill, {
                  backgroundColor: C_TEAL,
                  width: barAnims[i].interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }]} />
              </View>
              <Text style={styles.countText}>{r.count}</Text>
            </View>
          ))}
        </View>

        {/* Reviews list */}
        {ratings.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('recent_reviews')}</Text>
            <View style={{ gap: Spacing.sm }}>
              {ratings.slice(0, 20).map((r) => (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewStars}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={12}
                          color={i < r.score ? C_STAR : '#D3D6DA'}
                          fill={i < r.score ? C_STAR : 'transparent'}
                          strokeWidth={2}
                        />
                      ))}
                    </View>
                    <Text style={[styles.reviewContext, { textAlign: TA }]}>
                      {r.context === 'ride' ? t('car') : t('shuttle')}
                    </Text>
                  </View>
                  {r.comment ? (
                    <Text style={[styles.reviewText, { textAlign: TA }]}>
                      "{r.comment}"
                    </Text>
                  ) : null}
                  <Text style={[styles.reviewDate, { textAlign: TA }]}>
                    {new Date(r.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {ratings.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ color: C_INK_SOFT, fontSize: 13.5 }}>{t('no_ratings_yet')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: C_HAIR,
  },
  heroCard: {
    alignItems: 'center', marginTop: Spacing.xl,
    backgroundColor: C_PANEL, borderRadius: 24, paddingVertical: 28, paddingHorizontal: 20,
  },
  bigRating: { fontSize: 56, lineHeight: 60, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  starsRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm },
  tripCount: { fontSize: 12.5, marginTop: Spacing.sm, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
  breakdownCard: { padding: Spacing.lg, marginTop: Spacing.lg, gap: 10, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: C_HAIR },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  starNum: { width: 12, fontSize: 12.5, fontWeight: '800', color: C_INK },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#F0F2F3', flex: 1 },
  barFill: { height: '100%', borderRadius: 4 },
  countText: { width: 48, textAlign: 'right', fontSize: 12.5, color: C_INK_SOFT, fontWeight: '600' },
  sectionTitle: { fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: Spacing.xxl, marginBottom: Spacing.md, color: C_CAP, fontWeight: '700' },
  reviewCard: { padding: Spacing.lg, gap: 6, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: C_HAIR },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewContext: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: C_INK_SOFT, fontWeight: '600' },
  reviewText: { fontSize: 13.5, lineHeight: 20, color: C_INK_SOFT },
  reviewDate: { fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: C_CAP, fontWeight: '700' },
});
