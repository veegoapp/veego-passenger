import { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Platform, PanResponder,
} from 'react-native';
import { Car, ChevronDown, Clock, Users, ArrowRightCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';

const RIDE_OPTIONS = [
  {
    id: 'economy' as const,
    labelKey: 'economy' as const,
    descKey: 'economy_desc' as const,
    icon: Car,
    price: 25,
    eta: 4,
    color: '#55c49a',
    bgColor: 'rgba(85,196,154,0.14)',
    borderSelected: '#55c49a',
  },
  {
    id: 'premium' as const,
    labelKey: 'premium' as const,
    descKey: 'premium_desc' as const,
    icon: Car,
    price: 45,
    eta: 6,
    color: '#8B6FD4',
    bgColor: 'rgba(139,111,212,0.14)',
    borderSelected: '#8B6FD4',
  },
];

const DISMISS_THRESHOLD = 80;

interface RideOptionsSheetProps {
  visible: boolean;
  destination: string | null;
  selected: 'economy' | 'premium' | null;
  onSelect: (id: 'economy' | 'premium') => void;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function RideOptionsSheet({
  visible, destination, selected, onSelect, onConfirm, onDismiss,
}: RideOptionsSheetProps) {
  const { colors: c, t } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) panY.setValue(0);
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 200,
      mass: 0.8,
    }).start();
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 8 && gs.dy > 0,
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) panY.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > DISMISS_THRESHOLD || gs.vy > 0.8) {
          if (Platform.OS !== 'web') Haptics.selectionAsync();
          onDismiss();
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 250 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(panY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 250 }).start();
      },
    })
  ).current;

  const baseTranslateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] });
  const translateY = Animated.add(baseTranslateY, panY);

  const sheetBg = c.isDark ? '#12122a' : '#ffffff';
  const selectedOption = RIDE_OPTIONS.find(o => o.id === selected);

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          backgroundColor: sheetBg,
          paddingBottom: Platform.OS === 'web' ? 24 : insets.bottom + 32,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View {...panResponder.panHandlers} style={styles.dragArea}>
        <View style={styles.handle} />
      </View>

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.ink }]}>{t('select_ride_type')}</Text>
          {destination && (
            <View style={styles.destRow}>
              <View style={styles.destDot} />
              <Text style={[styles.destText, { color: c.inkSoft }]} numberOfLines={1}>{destination}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={onDismiss} activeOpacity={0.8} style={[styles.closeBtn, { backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.mist }]}>
          <ChevronDown size={18} color={c.inkSoft} />
        </TouchableOpacity>
      </View>

      <View style={styles.options}>
        {RIDE_OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.option,
                {
                  backgroundColor: isSelected ? option.bgColor : c.isDark ? 'rgba(255,255,255,0.04)' : c.mist,
                  borderColor: isSelected ? option.borderSelected : 'transparent',
                  borderWidth: 2,
                },
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync();
                onSelect(option.id);
              }}
              activeOpacity={0.85}
            >
              <View style={[styles.optionIcon, { backgroundColor: isSelected ? option.bgColor : c.isDark ? 'rgba(255,255,255,0.06)' : c.border }]}>
                <option.icon size={26} color={isSelected ? option.color : c.inkSoft} />
              </View>
              <View style={styles.optionMeta}>
                <Text style={[styles.optionName, { color: c.ink }]}>{t(option.labelKey)}</Text>
                <Text style={[styles.optionDesc, { color: c.inkSoft }]}>{t(option.descKey)}</Text>
                <View style={styles.optionStats}>
                  <Clock size={11} color={c.inkSoft} />
                  <Text style={[styles.optionEta, { color: c.inkSoft }]}>{option.eta} {t('min')}</Text>
                  <View style={[styles.statDot, { backgroundColor: c.silver }]} />
                  <Users size={11} color={c.inkSoft} />
                  <Text style={[styles.optionEta, { color: c.inkSoft }]}>1–4</Text>
                </View>
              </View>
              <View style={styles.priceBlock}>
                <Text style={[styles.priceLabel, { color: c.inkSoft }]}>{t('egp')}</Text>
                <Text style={[styles.price, { color: isSelected ? option.color : c.ink }]}>{option.price}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[
          styles.confirmBtn,
          {
            backgroundColor: selected ? (selectedOption?.color ?? '#55c49a') : c.isDark ? 'rgba(255,255,255,0.06)' : c.mist,
            opacity: selected ? 1 : 0.55,
          },
        ]}
        disabled={!selected}
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onConfirm();
        }}
        activeOpacity={0.9}
      >
        <ArrowRightCircle size={20} color={selected ? '#ffffff' : c.inkSoft} />
        <Text style={[styles.confirmText, { color: selected ? '#ffffff' : c.inkSoft }]}>{t('confirm_ride')}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -16 },
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 28,
    paddingTop: 6,
    zIndex: 999,
  },
  dragArea: { alignItems: 'center', paddingBottom: 10, paddingTop: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(150,150,180,0.35)' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  destRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  destDot: { width: 7, height: 7, borderRadius: 2, backgroundColor: '#e07055' },
  destText: { fontSize: 12.5, flex: 1 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  options: { paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  option: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 14, gap: 12 },
  optionIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  optionMeta: { flex: 1, gap: 2 },
  optionName: { fontSize: 15.5, fontWeight: '700', letterSpacing: -0.2 },
  optionDesc: { fontSize: 11.5 },
  optionStats: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  optionEta: { fontSize: 11 },
  statDot: { width: 3, height: 3, borderRadius: 2 },
  priceBlock: { alignItems: 'flex-end' },
  priceLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  price: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  confirmBtn: {
    marginHorizontal: 16,
    height: 56,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#55c49a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  confirmText: { fontSize: 16, fontWeight: '700' },
});
