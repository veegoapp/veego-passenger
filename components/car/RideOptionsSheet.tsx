import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';

interface RideEstimate {
  economy: { price: number; eta: number };
  premium: { price: number; eta: number };
}

const RIDE_DEFAULTS = {
  economy: { id: 'economy' as const, labelKey: 'economy' as const, descKey: 'economy_desc' as const, icon: 'car-outline' as const, color: '#55c49a', bgColor: 'rgba(85,196,154,0.12)' },
  premium: { id: 'premium' as const, labelKey: 'premium' as const, descKey: 'premium_desc' as const, icon: 'car-sport-outline' as const, color: '#8B6FD4', bgColor: 'rgba(139,111,212,0.12)' },
};

interface RideOptionsSheetProps {
  visible: boolean;
  destination: string | null;
  selected: 'economy' | 'premium' | null;
  onSelect: (id: 'economy' | 'premium') => void;
  onConfirm: () => void;
  onDismiss: () => void;
  estimate?: RideEstimate | null;
  estimateLoading?: boolean;
  confirming?: boolean;
}

export function RideOptionsSheet({
  visible, destination, selected, onSelect, onConfirm, onDismiss,
  estimate, estimateLoading, confirming,
}: RideOptionsSheetProps) {
  const { colors: c, t } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 200,
      mass: 0.8,
    }).start();
  }, [visible]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] });
  const sheetBg = c.isDark ? 'rgba(16,16,32,0.98)' : 'rgba(250,250,252,0.98)';
  const borderCol = c.isDark ? 'rgba(90,95,160,0.25)' : 'rgba(255,255,255,0.8)';

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          backgroundColor: sheetBg,
          borderTopColor: borderCol,
          paddingBottom: Platform.OS === 'web' ? 24 : insets.bottom + 35,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View style={styles.handle} />

      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: c.ink }]}>{t('select_ride_type')}</Text>
          {destination && (
            <View style={styles.destRow}>
              <Ionicons name="location" size={13} color={c.badge} />
              <Text style={[styles.destText, { color: c.inkSoft }]} numberOfLines={1}>{destination}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={onDismiss} activeOpacity={0.8} style={[styles.closeBtn, { backgroundColor: c.mist }]}>
          <Ionicons name="chevron-down" size={18} color={c.inkSoft} />
        </TouchableOpacity>
      </View>

      <View style={styles.options}>
        {(['economy', 'premium'] as const).map((id) => {
          const opt = RIDE_DEFAULTS[id];
          const price = estimate?.[id]?.price;
          const eta   = estimate?.[id]?.eta;
          const isSelected = selected === id;
          return (
            <TouchableOpacity
              key={id}
              style={[
                styles.option,
                {
                  backgroundColor: isSelected ? opt.bgColor : c.isDark ? 'rgba(255,255,255,0.04)' : c.white,
                  borderColor: isSelected ? opt.color : c.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync();
                onSelect(id);
              }}
              activeOpacity={0.85}
            >
              <View style={[styles.optionIcon, { backgroundColor: opt.bgColor }]}>
                <Ionicons name={opt.icon} size={24} color={opt.color} />
              </View>
              <View style={styles.optionMeta}>
                <Text style={[styles.optionName, { color: c.ink }]}>{t(opt.labelKey)}</Text>
                <Text style={[styles.optionDesc, { color: c.inkSoft }]}>{t(opt.descKey)}</Text>
                <View style={styles.optionStats}>
                  <Ionicons name="time-outline" size={11} color={c.inkSoft} />
                  <Text style={[styles.optionEta, { color: c.inkSoft }]}>
                    {estimateLoading ? '...' : eta != null ? `${eta} ${t('min')}` : `— ${t('min')}`}
                  </Text>
                  <View style={[styles.statDot, { backgroundColor: c.silver }]} />
                  <Ionicons name="people-outline" size={11} color={c.inkSoft} />
                  <Text style={[styles.optionEta, { color: c.inkSoft }]}>1-4</Text>
                </View>
              </View>
              <View style={styles.priceBlock}>
                <Text style={[styles.priceLabel, { color: c.inkSoft }]}>{t('egp')}</Text>
                {estimateLoading ? (
                  <ActivityIndicator size="small" color={opt.color} style={{ marginTop: 4 }} />
                ) : (
                  <Text style={[styles.price, { color: isSelected ? opt.color : c.ink }]}>
                    {price != null ? price.toFixed(0) : '—'}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[
          styles.confirmBtn,
          { backgroundColor: selected && !confirming ? c.ink : c.silver, opacity: selected && !confirming ? 1 : 0.5 },
        ]}
        disabled={!selected || !!confirming}
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onConfirm();
        }}
        activeOpacity={0.9}
      >
        {confirming ? (
          <ActivityIndicator size="small" color={c.isDark ? c.background : c.white} />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={18} color={c.isDark ? c.background : c.white} />
            <Text style={[styles.confirmText, { color: c.isDark ? c.background : c.white }]}>{t('confirm')}</Text>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.3, shadowRadius: 28, elevation: 24, paddingTop: 6, zIndex: 999,
  },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(150,150,180,0.4)', alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
  title: { fontSize: 19, fontWeight: '700', letterSpacing: -0.4, fontFamily: 'Inter_700Bold' },
  destRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  destText: { fontSize: 12.5, flex: 1 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  options: { paddingHorizontal: 20, gap: 10, marginBottom: 16 },
  option: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 14, gap: 12 },
  optionIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  optionMeta: { flex: 1, gap: 2 },
  optionName: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  optionDesc: { fontSize: 11.5 },
  optionStats: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  optionEta: { fontSize: 11 },
  statDot: { width: 3, height: 3, borderRadius: 2 },
  priceBlock: { alignItems: 'flex-end', minWidth: 44 },
  priceLabel: { fontSize: 10, fontWeight: '500' },
  price: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  confirmBtn: {
    marginHorizontal: 20, height: 56, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#1e1e28', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 6,
  },
  confirmText: { fontSize: 15, fontWeight: '600' },
});
