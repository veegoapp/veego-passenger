import { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, SafeAreaView, Modal } from 'react-native';
import { Star } from 'lucide-react-native';
import { AppLoader } from '@/components/ui/AppLoader';
import { useTheme } from '@/context/ThemeContext';
import api from '@/src/api/client';
import { S } from '@/constants/colors';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';
import { makeStyles, ModalHeader } from './shared';

interface GivenRating {
  id: number;
  context: string;
  score: string | number;
  comment: string | null;
  driverResponse: string | null;
  createdAt: string;
  driverName: string | null;
}

export function RatingHistoryModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors: c, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [ratings, setRatings] = useState<GivenRating[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    api.get('/user/ratings/given').then(({ data }) => {
      setRatings(Array.isArray(data?.data) ? data.data : []);
    }).catch(() => {
      setRatings([]);
    }).finally(() => setLoading(false));
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <ModalHeader title={t('my_ratings')} onClose={onClose} />
        <ScrollView contentContainerStyle={[styles.modalScroll, { paddingBottom: 40, gap: Spacing.md }]}>
          {loading && !ratings ? (
            <AppLoader size={80} style={{ marginTop: 40 }} />
          ) : !ratings || ratings.length === 0 ? (
            <Text style={{ fontSize: 13, color: c.inkSoft, textAlign: 'center', paddingVertical: 40 }}>
              {t('ratings_given_empty')}
            </Text>
          ) : (
            ratings.map((r) => {
              const score = typeof r.score === 'string' ? parseFloat(r.score) : r.score;
              return (
                <View key={r.id} style={[styles.groupCard, S.float, { padding: Spacing.lg, gap: Spacing.sm }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.cardName}>{r.driverName ?? t('driver_label')}</Text>
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={13} color="#f59e0b" fill={s <= Math.round(score) ? '#f59e0b' : 'transparent'} strokeWidth={1.5} />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.cardSub}>
                    {new Date(r.createdAt).toLocaleDateString()}
                    {r.context ? ` · ${r.context === 'trip' || r.context === 'shuttle' ? t('shuttle') : t('car')}` : ''}
                  </Text>
                  {!!r.comment && <Text style={{ fontSize: 13, color: c.ink }}>{r.comment}</Text>}
                  {!!r.driverResponse && (
                    <View style={{ backgroundColor: c.mist, borderRadius: Radius.md, padding: 10, marginTop: Spacing.xs }}>
                      <Text style={{ fontSize: 11, fontWeight: Typography.weight.semibold, color: c.inkSoft, marginBottom: 2 }}>{t('driver_response_label')}</Text>
                      <Text style={{ fontSize: 12.5, color: c.ink }}>{r.driverResponse}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
