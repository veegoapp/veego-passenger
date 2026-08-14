import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, Star } from 'lucide-react-native';
import { useRef, useEffect, useState, useCallback } from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView } from '@/components/ui/GlassView';
import { AppLoader } from '@/components/ui/AppLoader';
import { useTheme } from '@/context/ThemeContext';
import { getPassengerRating } from '@/src/api/userService';
import { Animation } from '@/constants/animations';
import { Typography } from '@/constants/typography';
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
  const { colors: c, t, isRTL } = useTheme();
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
      <View style={[styles.container, { backgroundColor: c.background, alignItems: 'center', justifyContent: 'center' }]}>
        <AppLoader />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, { backgroundColor: c.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: c.inkSoft, fontSize: Typography.size.sm, fontFamily: 'Inter_400Regular' }}>{t('ratings_load_error')}</Text>
      </View>
    );
  }

  const avgRating = data?.averageRating ?? 0;
  const ratingsCount = data?.totalRatings ?? 0;
  const tripCount = data?.tripCount ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad + 8, paddingBottom: 40, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <Pressable onPress={() => router.back()}>
          <GlassView style={styles.backBtn} borderRadius={20}>
            {isRTL ? <ArrowRight size={20} color={c.ink} strokeWidth={2} /> : <ArrowLeft size={20} color={c.ink} strokeWidth={2} />}
          </GlassView>
        </Pressable>

        {/* Average rating hero */}
        <View style={{ alignItems: 'center', marginTop: Spacing.xl }}>
          <Text style={[styles.bigRating, { color: c.ink, fontFamily: 'Inter_700Bold' }]}>
            {avgRating ? avgRating.toFixed(2) : '—'}
          </Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star key={n} size={20}
                color={c.accent}
                fill={n <= Math.round(avgRating) ? c.accent : 'transparent'}
                strokeWidth={2}
              />
            ))}
          </View>
          <Text style={[styles.tripCount, { color: c.inkSoft, fontFamily: 'Inter_600SemiBold' }]}>
            {t('ratings_trips_summary').replace('{ratings}', String(ratingsCount)).replace('{trips}', String(tripCount))}
          </Text>
        </View>

        {/* Breakdown bars */}
        <GlassView style={styles.breakdownCard} borderRadius={20}>
          {breakdown.map((r, i) => (
            <View key={r.stars} style={styles.breakdownRow}>
              <Text style={[styles.starNum, { color: c.ink, fontFamily: 'Inter_700Bold' }]}>{r.stars}</Text>
              <Star size={12} color={c.accent} fill={c.accent} strokeWidth={2} />
              <View style={[styles.barTrack, { backgroundColor: c.mist, flex: 1 }]}>
                <Animated.View style={[styles.barFill, {
                  backgroundColor: c.primary,
                  width: barAnims[i].interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }]} />
              </View>
              <Text style={[styles.countText, { color: c.inkSoft, fontFamily: 'Inter_600SemiBold' }]}>{r.count}</Text>
            </View>
          ))}
        </GlassView>

        {/* Reviews list */}
        {ratings.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: c.inkSoft, fontFamily: 'Inter_700Bold' }]}>{t('recent_reviews')}</Text>
            <View style={{ gap: Spacing.sm }}>
              {ratings.slice(0, 20).map((r) => (
                <GlassView key={r.id} style={styles.reviewCard} borderRadius={20}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewStars}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={12}
                          color={i < r.score ? c.accent : `${c.inkSoft}4D`}
                          fill={i < r.score ? c.accent : 'transparent'}
                          strokeWidth={2}
                        />
                      ))}
                    </View>
                    <Text style={[styles.reviewContext, { color: c.inkSoft, textAlign: TA, fontFamily: 'Inter_600SemiBold' }]}>
                      {r.context === 'ride' ? t('car') : t('shuttle')}
                    </Text>
                  </View>
                  {r.comment ? (
                    <Text style={[styles.reviewText, { color: c.inkSoft, textAlign: TA, fontFamily: 'Inter_400Regular' }]}>
                      "{r.comment}"
                    </Text>
                  ) : null}
                  <Text style={[styles.reviewDate, { color: `${c.inkSoft}B3`, textAlign: TA, fontFamily: 'Inter_700Bold' }]}>
                    {new Date(r.createdAt).toLocaleDateString()}
                  </Text>
                </GlassView>
              ))}
            </View>
          </>
        )}

        {ratings.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={{ color: c.inkSoft, fontSize: Typography.size.sm, fontFamily: 'Inter_400Regular' }}>{t('no_ratings_yet')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bigRating: { fontSize: 64, lineHeight: 68 },
  starsRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm },
  tripCount: { fontSize: Typography.size.xs, marginTop: Spacing.xs },
  breakdownCard: { padding: Spacing.lg, marginTop: Spacing.xxl, gap: 10 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  starNum: { width: 12, fontSize: Typography.size.xs },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  countText: { width: 48, textAlign: 'right', fontSize: Typography.size.xs },
  sectionTitle: { fontSize: Typography.size.xs, letterSpacing: 2, textTransform: 'uppercase', marginTop: Spacing.xxl, marginBottom: Spacing.md },
  reviewCard: { padding: Spacing.lg, gap: 6 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewContext: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  reviewText: { fontSize: Typography.size.sm, lineHeight: 22 },
  reviewDate: { fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
});
