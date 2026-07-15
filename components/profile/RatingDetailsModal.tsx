import { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Star } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { getPassengerRating } from '@/src/api/userService';
import { S } from '@/constants/colors';
import { Radius } from '@/constants/radius';
import { makeStyles, ModalHeader } from './shared';

export function RatingDetailsModal({ visible, onClose, onOpenHistory }: { visible: boolean; onClose: () => void; onOpenHistory: () => void }) {
  const { colors: c, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [ratingData, setRatingData] = useState<{
    averageRating: number | null;
    totalRatings: number;
  } | null>(null);

  useEffect(() => {
    if (!visible) return;
    getPassengerRating().then((data) => {
      setRatingData({
        averageRating: typeof data.averageRating === 'number' ? data.averageRating : null,
        totalRatings: data.totalRatings ?? 0,
      });
    }).catch(() => {
      setRatingData({ averageRating: null, totalRatings: 0 });
    });
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <ModalHeader title={t('rating_details')} onClose={onClose} />
        <ScrollView contentContainerStyle={[styles.modalScroll, { paddingBottom: 40 }]}>

          {/* Hero score card */}
          <LinearGradient
            colors={[c.ink, c.isDark ? '#2a2a4a' : '#1e2040']}
            style={{ borderRadius: Radius.xl, overflow: 'hidden' }}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <View style={styles.ratingHero}>
              <Text style={styles.ratingScore}>
                {ratingData?.averageRating !== null && ratingData?.averageRating !== undefined
                  ? ratingData.averageRating.toFixed(1) : '—'}
              </Text>
              <View style={styles.ratingStars}>
                {[1, 2, 3, 4, 5].map((s) => {
                  const score = ratingData?.averageRating ?? null;
                  return (
                    <Star
                      key={s}
                      size={18}
                      color="#f59e0b"
                      fill={score !== null && s <= Math.round(score) ? '#f59e0b' : 'transparent'}
                      strokeWidth={1.5}
                    />
                  );
                })}
              </View>
              <Text style={styles.ratingSubtitle}>
                {ratingData?.averageRating !== null && ratingData?.averageRating !== undefined
                  ? t('based_on_ratings').replace('{count}', String(ratingData.totalRatings)).replace('{plural}', ratingData.totalRatings !== 1 ? 's' : '')
                  : t('no_ratings_yet')}
              </Text>
            </View>
          </LinearGradient>

          <View style={[styles.groupCard, S.float]}>
            <TouchableOpacity style={styles.settingItem} activeOpacity={0.75} onPress={onOpenHistory}>
              <View style={styles.settingIcon}><Star size={16} color={c.ink} /></View>
              <Text style={styles.settingLabel}>{t('my_ratings')}</Text>
              <ChevronRight size={14} color={c.silver} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
