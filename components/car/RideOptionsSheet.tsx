import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator, TextInput } from 'react-native';
import { AppLoader } from '@/components/ui/AppLoader';
import { MapPin, ChevronDown, Clock, Users, CheckCircle2, Car, Sparkles, Bike as ScooterIcon, Package } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { Animation } from '@/constants/animations';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

interface RideEstimate {
  economy: { price: number; eta: number };
  premium: { price: number; eta: number };
}

interface SingleEstimate { price: number; eta: number }

const RIDE_DEFAULTS = {
  economy: { id: 'economy' as const, labelKey: 'economy' as const, descKey: 'economy_desc' as const, icon: Car, color: '#55c49a', bgColor: 'rgba(85,196,154,0.12)' },
  premium: { id: 'premium' as const, labelKey: 'premium' as const, descKey: 'premium_desc' as const, icon: Car, color: '#8B6FD4', bgColor: 'rgba(139,111,212,0.12)' },
};

// Single-tier option shown for services with no economy/premium split
// (scooter and delivery pricing is single-rate on the backend).
const SINGLE_OPTION_META: Record<'scooter' | 'delivery', { icon: typeof Car; color: string; bgColor: string }> = {
  scooter:  { icon: ScooterIcon, color: '#55c49a', bgColor: 'rgba(85,196,154,0.12)' },
  delivery: { icon: Package,     color: '#8B6FD4', bgColor: 'rgba(139,111,212,0.12)' },
};

type RideOptionId = 'economy' | 'premium' | 'standard';

interface RideOptionsSheetProps {
  visible: boolean;
  destination: string | null;
  selected: RideOptionId | null;
  onSelect: (id: RideOptionId) => void;
  onConfirm: () => void;
  onDismiss: () => void;
  estimate?: RideEstimate | null;
  estimateLoading?: boolean;
  confirming?: boolean;
  /** Defaults to 'car' — preserves the existing economy/premium UI unchanged. */
  serviceType?: 'car' | 'scooter' | 'delivery';
  /** Single-rate estimate used when serviceType !== 'car'. */
  singleEstimate?: SingleEstimate | null;
  recipientName?: string;
  recipientPhone?: string;
  onRecipientNameChange?: (value: string) => void;
  onRecipientPhoneChange?: (value: string) => void;
  /** Omit to hide the payment-method selector entirely (preserves prior cash-only UI). */
  paymentMethod?: 'cash' | 'wallet';
  onPaymentMethodChange?: (method: 'cash' | 'wallet') => void;
  /** Only offer the wallet chip when the wallet feature is actually live. */
  walletAvailable?: boolean;
}

export function RideOptionsSheet({
  visible, destination, selected, onSelect, onConfirm, onDismiss,
  estimate, estimateLoading, confirming,
  serviceType = 'car', singleEstimate,
  recipientName, recipientPhone, onRecipientNameChange, onRecipientPhoneChange,
  paymentMethod, onPaymentMethodChange, walletAvailable,
}: RideOptionsSheetProps) {
  const { colors: c, t } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isDelivery = serviceType === 'delivery';
  const recipientReady = !isDelivery || (!!recipientName?.trim() && !!recipientPhone?.trim());
  const canConfirm = !!selected && recipientReady;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      ...Animation.spring.sheet,
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
          paddingBottom: insets.bottom + 35,
          opacity: slideAnim,
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
              <MapPin size={13} color={c.badge} />
              <Text style={[styles.destText, { color: c.inkSoft }]} numberOfLines={1}>{destination}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={onDismiss} activeOpacity={0.8} style={[styles.closeBtn, { backgroundColor: c.mist }]}>
          <ChevronDown size={18} color={c.inkSoft} />
        </TouchableOpacity>
      </View>

      {serviceType === 'car' ? (
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
                  Haptics.selectionAsync();
                  onSelect(id);
                }}
                activeOpacity={0.85}
              >
                <View style={[styles.optionIcon, { backgroundColor: opt.bgColor }]}>
                  <opt.icon size={24} color={opt.color} />
                  {id === 'premium' && (
                    <View style={[styles.premiumBadge, { borderColor: opt.color }]}>
                      <Sparkles size={10} color={opt.color} fill={opt.color} />
                    </View>
                  )}
                </View>
                <View style={styles.optionMeta}>
                  <Text style={[styles.optionName, { color: c.ink }]}>{t(opt.labelKey)}</Text>
                  <Text style={[styles.optionDesc, { color: c.inkSoft }]}>{t(opt.descKey)}</Text>
                  <View style={styles.optionStats}>
                    <Clock size={11} color={c.inkSoft} />
                    <Text style={[styles.optionEta, { color: c.inkSoft }]}>
                      {estimateLoading ? '...' : eta != null ? `${eta} ${t('min')}` : `— ${t('min')}`}
                    </Text>
                    <View style={[styles.statDot, { backgroundColor: c.silver }]} />
                    <Users size={11} color={c.inkSoft} />
                    <Text style={[styles.optionEta, { color: c.inkSoft }]}>1-4</Text>
                  </View>
                </View>
                <View style={styles.priceBlock}>
                  <Text style={[styles.priceLabel, { color: c.inkSoft }]}>{t('egp')}</Text>
                  {estimateLoading ? (
                    <ActivityIndicator size="small" color={opt.color} style={{ marginTop: Spacing.xs }} />
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
      ) : (
        <View style={styles.options}>
          {(() => {
            const meta = SINGLE_OPTION_META[serviceType];
            const isSelected = selected === 'standard';
            const price = singleEstimate?.price;
            const eta   = singleEstimate?.eta;
            return (
              <TouchableOpacity
                style={[
                  styles.option,
                  {
                    backgroundColor: isSelected ? meta.bgColor : c.isDark ? 'rgba(255,255,255,0.04)' : c.white,
                    borderColor: isSelected ? meta.color : c.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  onSelect('standard');
                }}
                activeOpacity={0.85}
              >
                <View style={[styles.optionIcon, { backgroundColor: meta.bgColor }]}>
                  <meta.icon size={24} color={meta.color} />
                </View>
                <View style={styles.optionMeta}>
                  <Text style={[styles.optionName, { color: c.ink }]}>{t(serviceType)}</Text>
                  <View style={styles.optionStats}>
                    <Clock size={11} color={c.inkSoft} />
                    <Text style={[styles.optionEta, { color: c.inkSoft }]}>
                      {estimateLoading ? '...' : eta != null ? `${eta} ${t('min')}` : `— ${t('min')}`}
                    </Text>
                  </View>
                </View>
                <View style={styles.priceBlock}>
                  <Text style={[styles.priceLabel, { color: c.inkSoft }]}>{t('egp')}</Text>
                  {estimateLoading ? (
                    <ActivityIndicator size="small" color={meta.color} style={{ marginTop: Spacing.xs }} />
                  ) : (
                    <Text style={[styles.price, { color: isSelected ? meta.color : c.ink }]}>
                      {price != null ? price.toFixed(0) : '—'}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })()}

          {isDelivery && (
            <View style={styles.recipientBlock}>
              <TextInput
                style={[styles.recipientInput, { borderColor: c.border, backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.white, color: c.ink }]}
                value={recipientName}
                onChangeText={onRecipientNameChange}
                placeholder={t('recipient_name')}
                placeholderTextColor={c.inkSoft}
              />
              <TextInput
                style={[styles.recipientInput, { borderColor: c.border, backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : c.white, color: c.ink }]}
                value={recipientPhone}
                onChangeText={onRecipientPhoneChange}
                placeholder={t('recipient_phone')}
                placeholderTextColor={c.inkSoft}
                keyboardType="phone-pad"
              />
            </View>
          )}
        </View>
      )}

      {onPaymentMethodChange && (
        <View style={styles.paymentRow}>
          <Text style={[styles.paymentLabel, { color: c.inkSoft }]}>{t('payment_method_label')}</Text>
          <View style={styles.paymentChips}>
            <TouchableOpacity
              style={[
                styles.paymentChip,
                {
                  borderColor: paymentMethod !== 'wallet' ? c.ink : c.border,
                  backgroundColor: paymentMethod !== 'wallet' ? c.ink : 'transparent',
                },
              ]}
              onPress={() => { Haptics.selectionAsync(); onPaymentMethodChange('cash'); }}
              activeOpacity={0.85}
            >
              <Text style={[styles.paymentChipText, { color: paymentMethod !== 'wallet' ? (c.isDark ? c.background : c.white) : c.ink }]}>
                {t('payment_methods_cash')}
              </Text>
            </TouchableOpacity>
            {walletAvailable && (
              <TouchableOpacity
                style={[
                  styles.paymentChip,
                  {
                    borderColor: paymentMethod === 'wallet' ? c.ink : c.border,
                    backgroundColor: paymentMethod === 'wallet' ? c.ink : 'transparent',
                  },
                ]}
                onPress={() => { Haptics.selectionAsync(); onPaymentMethodChange('wallet'); }}
                activeOpacity={0.85}
              >
                <Text style={[styles.paymentChipText, { color: paymentMethod === 'wallet' ? (c.isDark ? c.background : c.white) : c.ink }]}>
                  {t('payment_methods_wallet')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.confirmBtn,
          { backgroundColor: canConfirm && !confirming ? c.ink : c.silver, opacity: canConfirm && !confirming ? 1 : 0.5 },
        ]}
        disabled={!canConfirm || !!confirming}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onConfirm();
        }}
        activeOpacity={0.9}
      >
        {confirming ? (
          <AppLoader size={24} />
        ) : (
          <>
            <CheckCircle2 size={18} color={c.isDark ? c.background : c.white} />
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
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(150,150,180,0.4)', alignSelf: 'center', marginBottom: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: Spacing.lg },
  title: { fontSize: 19, fontWeight: Typography.weight.bold, letterSpacing: -0.4, fontFamily: 'Inter_700Bold' },
  destRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  destText: { fontSize: 12.5, flex: 1 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  options: { paddingHorizontal: 20, gap: 10, marginBottom: Spacing.lg },
  option: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, padding: 14, gap: Spacing.md },
  optionIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  premiumBadge: {
    position: 'absolute', top: -3, right: -3,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#ffffff', borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  optionMeta: { flex: 1, gap: 2 },
  optionName: { fontSize: 15, fontWeight: Typography.weight.semibold, letterSpacing: -0.2 },
  optionDesc: { fontSize: 11.5 },
  optionStats: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  optionEta: { fontSize: 11 },
  statDot: { width: 3, height: 3, borderRadius: 2 },
  recipientBlock: { gap: Spacing.sm, marginTop: Spacing.xs },
  recipientInput: { height: 46, borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: Spacing.md, fontSize: 13.5 },
  paymentRow: { paddingHorizontal: 20, marginBottom: Spacing.lg, gap: Spacing.sm },
  paymentLabel: { fontSize: 11, fontWeight: Typography.weight.semibold, textTransform: 'uppercase', letterSpacing: 1 },
  paymentChips: { flexDirection: 'row', gap: Spacing.sm },
  paymentChip: { flex: 1, height: 44, borderRadius: Radius.lg, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  paymentChipText: { fontSize: 13.5, fontWeight: Typography.weight.semibold },
  priceBlock: { alignItems: 'flex-end', minWidth: 44 },
  priceLabel: { fontSize: 10, fontWeight: Typography.weight.medium },
  price: { fontSize: 20, fontWeight: Typography.weight.bold, letterSpacing: -0.5 },
  confirmBtn: {
    marginHorizontal: 20, height: 56, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    shadowColor: '#1e1e28', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 6,
  },
  confirmText: { fontSize: 15, fontWeight: Typography.weight.semibold },
});
