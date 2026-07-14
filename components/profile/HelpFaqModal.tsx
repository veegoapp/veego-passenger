import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, Modal } from 'react-native';
import { ChevronUp, ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { Typography } from '@/constants/typography';
import { makeStyles, ModalHeader } from './shared';

const FAQ_ITEMS = ['faq_q1', 'faq_q2', 'faq_q3', 'faq_q4', 'faq_q5'] as const;
const FAQ_ANSWERS = ['faq_a1', 'faq_a2', 'faq_a3', 'faq_a4', 'faq_a5'] as const;

export function HelpFaqModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors: c, t } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <ModalHeader title={t('help_title')} onClose={onClose} />
        <ScrollView contentContainerStyle={styles.modalScroll}>
          {FAQ_ITEMS.map((qKey, i) => (
            <TouchableOpacity
              key={i}
              style={styles.faqItem}
              activeOpacity={0.8}
              onPress={() => { Haptics.selectionAsync(); setOpenIndex(openIndex === i ? null : i); }}
            >
              <View style={styles.faqQ}>
                <View style={[styles.toggleIcon, { backgroundColor: c.mist }]}>
                  <Text style={{ fontSize: Typography.size.sm, fontWeight: Typography.weight.bold, color: c.ink }}>{i + 1}</Text>
                </View>
                <Text style={styles.faqQText}>{t(qKey)}</Text>
                {openIndex === i ? <ChevronUp size={16} color={c.silver} /> : <ChevronDown size={16} color={c.silver} />}
              </View>
              {openIndex === i && (
                <Text style={styles.faqA}>{t(FAQ_ANSWERS[i])}</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
