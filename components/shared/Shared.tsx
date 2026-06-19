import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight, ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';

export function SectionHeader({ title, onMore }: { title: string; onMore?: () => void }) {
  const { colors: c, t, isRTL } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: c.ink }]}>{title}</Text>
      {onMore && (
        <TouchableOpacity style={styles.seeAllBtn} onPress={onMore} activeOpacity={0.7}>
          <Text style={[styles.seeAllText, { color: c.inkSoft }]}>{t('see_all')}</Text>
          {isRTL ? <ChevronLeft size={12} color={c.inkSoft} /> : <ChevronRight size={12} color={c.inkSoft} />}
        </TouchableOpacity>
      )}
    </View>
  );
}

export function SectionLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  const { colors: c } = useTheme();
  return (
    <View style={styles.sectionLabel}>
      {icon}
      <Text style={[styles.sectionLabelText, { color: c.inkSoft }]}>{children}</Text>
    </View>
  );
}

export { RealMap as MapMockView } from './RealMap';

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28 },
  sectionTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.3 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 12, fontWeight: '500' },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabelText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.2 },
});
