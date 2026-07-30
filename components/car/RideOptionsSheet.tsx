import { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  ActivityIndicator, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppLoader } from '@/components/ui/AppLoader';
import { GlassView } from '@/components/ui/GlassView';
import {
  MapPin, ChevronDown, Clock, Users, ArrowRight,
  Car, Sparkles, Bike as ScooterIcon, Package,
  Banknote, Wallet,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTabBar } from '@/context/TabBarContext';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { Animation } from '@/constants/animations';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

interface RideCategoryOption {
  slug:  string;
  name:  string;
  price: number;
}

interface RideEstimate {
  categories: RideCategoryOption[];
  eta: number;
}

interface SingleEstimate { price: number; eta: number }

// Tier accents pull from the shared VeeGo palette (mint accent / ink primary),
// cycled by position so any number of car categories gets a consistent look —
// previously this was a fixed economy/premium pair, which silently dropped
// any category configured in between (e.g. "Economy Plus").
function getTierStyles(c: ThemeColors) {
  return [
    {
      accent: c.accent,
      accentBg: c.isDark ? 'rgba(85,196,154,0.14)' : 'rgba(85,196,154,0.10)',
      accentBorder: c.isDark ? 'rgba(85,196,154,0.4)' : 'rgba(85,196,154,0.35)',
    },
    {
      accent: c.primary,
      accentBg: c.isDark ? 'rgba(232,232,242,0.10)' : 'rgba(30,30,40,0.06)',
      accentBorder: c.isDark ? 'rgba(232,232,242,0.35)' : 'rgba(30,30,40,0.28)',
    },
  ];
}

function getSingleMeta(c: ThemeColors): Record<'scooter' | 'delivery', {
  icon: typeof Car; accent: string; accentBg: string; accentBorder: string;
}> {
  return {
    scooter:  { icon: ScooterIcon, accent: c.accent, accentBg: c.isDark ? 'rgba(85,196,154,0.14)' : 'rgba(85,196,154,0.10)', accentBorder: c.isDark ? 'rgba(85,196,154,0.4)' : 'rgba(85,196,154,0.35)' },
    delivery: { icon: Package,     accent: c.accent, accentBg: c.isDark ? 'rgba(85,196,154,0.14)' : 'rgba(85,196,154,0.10)', accentBorder: c.isDark ? 'rgba(85,196,154,0.4)' : 'rgba(85,196,154,0.35)' },
  };
}

// A car category slug (dynamic, from the backend) or 'standard' for scooter/delivery.
type RideOptionId = string;

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
  serviceType?: 'car' | 'scooter' | 'delivery';
  singleEstimate?: SingleEstimate | null;
  recipientName?: string;
  recipientPhone?: string;
  onRecipientNameChange?: (value: string) => void;
  onRecipientPhoneChange?: (value: string) => void;
  paymentMethod?: 'cash' | 'wallet';
  onPaymentMethodChange?: (method: 'cash' | 'wallet') => void;
  walletAvailable?: boolean;
}

export function RideOptionsSheet({
  visible, destination, selected, onSelect, onConfirm, onDismiss,
  estimate, estimateLoading, confirming,
  serviceType = 'car', singleEstimate,
  recipientName, recipientPhone, onRecipientNameChange, onRecipientPhoneChange,
  paymentMethod, onPaymentMethodChange, walletAvailable,
}: RideOptionsSheetProps) {
  const { colors: c, t, isRTL } = useTheme();
  const { tabBarHeight } = useTabBar();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const paymentAnim = useRef(new Animated.Value(paymentMethod === 'wallet' ? 1 : 0)).current;
  const TIER_STYLES = getTierStyles(c);
  const SINGLE_META = getSingleMeta(c);
  const carCategories = estimate?.categories ?? [];

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

  useEffect(() => {
    Animated.spring(paymentAnim, {
      toValue: paymentMethod === 'wallet' ? 1 : 0,
      useNativeDriver: false,
      damping: 20,
      stiffness: 220,
    }).start();
  }, [paymentMethod]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [540, 0] });
  const isDark = c.isDark;

  // Resolve selected price for the confirm button label
  const selectedCategory = selected ? carCategories.find((cat) => cat.slug === selected) : undefined;
  const selectedPrice = (() => {
    if (!selected) return null;
    if (selected === 'standard') return singleEstimate?.price;
    return selectedCategory?.price ?? null;
  })();

  const selectedLabel = (() => {
    if (!selected) return t('confirm');
    if (selected === 'standard') return serviceType === 'scooter' ? t('scooter') : t('delivery');
    return selectedCategory?.name ?? t('confirm');
  })();

  // CTA always uses the shared VeeGo ink gradient — same treatment as the
  // Driver app's accept/next-phase buttons — instead of a tier-dependent hue.
  const confirmGradient: readonly [string, string] = canConfirm && !confirming
    ? c.gradientPrimary
    : [isDark ? '#2a2a40' : '#d1d1db', isDark ? '#1e1e32' : '#c4c4cf'];

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          opacity: slideAnim,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <GlassView strong borderRadius={28} style={[styles.sheetGlass, { paddingBottom: tabBarHeight + 20 }]}>
      {/* Drag handle */}
      <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]} />

      {/* Header row */}
      <View style={styles.headerRow}>
        {/* Trip route summary */}
        <View style={styles.tripRoute}>
          <View style={[styles.routeOriginDot, { backgroundColor: c.primary }]} />
          <View style={[styles.routeDashedLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]} />
          <View style={[styles.routeDestPin, { backgroundColor: c.accent }]}>
            <MapPin size={8} color="#fff" />
          </View>
        </View>

        <View style={styles.tripInfo}>
          <Text style={[styles.tripLabel, { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }]}>
            {t('select_ride_type')}
          </Text>
          {destination && (
            <Text style={[styles.tripDest, { color: isDark ? '#e8e8f2' : '#1e1e28' }]} numberOfLines={1}>
              {destination}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={onDismiss}
          style={[styles.dismissBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
          activeOpacity={0.75}
        >
          <ChevronDown size={18} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
        </TouchableOpacity>
      </View>

      {/* ── Option cards ── */}
      <View style={styles.optionsWrap}>
        {serviceType === 'car' ? (
          carCategories.map((cat, index) => {
            const style = TIER_STYLES[index % TIER_STYLES.length];
            const isPricierTier = index === carCategories.length - 1 && carCategories.length > 1;
            const price = cat.price;
            const eta   = estimate?.eta;
            const isSelected = selected === cat.slug;

            return (
              <TouchableOpacity
                key={cat.slug}
                onPress={() => { Haptics.selectionAsync(); onSelect(cat.slug); }}
                activeOpacity={0.82}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: isSelected
                      ? style.accentBg
                      : (isDark ? 'rgba(255,255,255,0.04)' : '#ffffff'),
                    borderColor: isSelected ? style.accent : (isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)'),
                    borderWidth: isSelected ? 1.5 : 1,
                    shadowOffset: { width: 0, height: isSelected ? 6 : 2 },
                    shadowOpacity: isDark ? 0 : (isSelected ? 0.14 : 0.05),
                    shadowRadius: isSelected ? 12 : 4,
                    elevation: isSelected ? 4 : 1,
                  },
                ]}
              >
                {/* Icon zone */}
                <View style={[styles.optionIconZone, { backgroundColor: isSelected ? style.accentBg : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') }]}>
                  <Car size={26} color={isSelected ? style.accent : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)')} />
                  {isPricierTier && (
                    <View style={[styles.sparkBadge, { backgroundColor: isSelected ? style.accent : (isDark ? '#3a3a58' : '#e0e0ea') }]}>
                      <Sparkles size={9} color={isSelected ? '#fff' : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)')} fill={isSelected ? '#fff' : 'transparent'} />
                    </View>
                  )}
                </View>

                {/* Meta */}
                <View style={styles.optionMeta}>
                  <View style={styles.optionNameRow}>
                    <Text style={[styles.optionName, { color: isSelected ? style.accent : (isDark ? '#e8e8f2' : '#1e1e28') }]}>
                      {cat.name}
                    </Text>
                  </View>
                  <View style={styles.optionChips}>
                    <View style={[styles.chip, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
                      <Clock size={10} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
                      <Text style={[styles.chipText, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]}>
                        {estimateLoading ? '–' : eta != null ? `${eta} ${t('min')}` : `– ${t('min')}`}
                      </Text>
                    </View>
                    <View style={[styles.chip, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
                      <Users size={10} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
                      <Text style={[styles.chipText, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]}>1–4</Text>
                    </View>
                  </View>
                </View>

                {/* Price block */}
                <View style={styles.priceZone}>
                  {estimateLoading ? (
                    <ActivityIndicator size="small" color={style.accent} />
                  ) : (
                    <>
                      <Text style={[styles.priceCurrency, { color: isSelected ? style.accent : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)') }]}>
                        {t('egp')}
                      </Text>
                      <Text style={[styles.priceValue, { color: isSelected ? style.accent : (isDark ? '#e8e8f2' : '#1e1e28') }]}>
                        {price != null ? price.toFixed(0) : '—'}
                      </Text>
                    </>
                  )}
                </View>

                {/* Selected indicator */}
                {isSelected && (
                  <View style={[styles.selectedDot, { backgroundColor: style.accent }]} />
                )}
              </TouchableOpacity>
            );
          })
        ) : (
          (() => {
            const meta = SINGLE_META[serviceType as 'scooter' | 'delivery'];
            const isSelected = selected === 'standard';
            const price = singleEstimate?.price;
            const eta   = singleEstimate?.eta;
            const IconComp = meta.icon;

            return (
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); onSelect('standard'); }}
                activeOpacity={0.82}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: isSelected
                      ? meta.accentBg
                      : (isDark ? 'rgba(255,255,255,0.04)' : '#ffffff'),
                    borderColor: isSelected ? meta.accent : (isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)'),
                    borderWidth: isSelected ? 1.5 : 1,
                    shadowOffset: { width: 0, height: isSelected ? 6 : 2 },
                    shadowOpacity: isDark ? 0 : (isSelected ? 0.14 : 0.05),
                    shadowRadius: isSelected ? 12 : 4,
                    elevation: isSelected ? 4 : 1,
                  },
                ]}
              >
                <View style={[styles.optionIconZone, { backgroundColor: isSelected ? meta.accentBg : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') }]}>
                  <IconComp size={26} color={isSelected ? meta.accent : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)')} />
                </View>
                <View style={styles.optionMeta}>
                  <Text style={[styles.optionName, { color: isSelected ? meta.accent : (isDark ? '#e8e8f2' : '#1e1e28') }]}>
                    {serviceType === 'scooter' ? t('scooter') : t('delivery')}
                  </Text>
                  <View style={styles.optionChips}>
                    <View style={[styles.chip, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
                      <Clock size={10} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
                      <Text style={[styles.chipText, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]}>
                        {estimateLoading ? '–' : eta != null ? `${eta} ${t('min')}` : `– ${t('min')}`}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.priceZone}>
                  {estimateLoading ? (
                    <ActivityIndicator size="small" color={meta.accent} />
                  ) : (
                    <>
                      <Text style={[styles.priceCurrency, { color: isSelected ? meta.accent : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)') }]}>
                        {t('egp')}
                      </Text>
                      <Text style={[styles.priceValue, { color: isSelected ? meta.accent : (isDark ? '#e8e8f2' : '#1e1e28') }]}>
                        {price != null ? price.toFixed(0) : '—'}
                      </Text>
                    </>
                  )}
                </View>
                {isSelected && (
                  <View style={[styles.selectedDot, { backgroundColor: meta.accent }]} />
                )}
              </TouchableOpacity>
            );
          })()
        )}

        {/* Delivery recipient fields */}
        {isDelivery && (
          <View style={styles.recipientBlock}>
            <TextInput
              style={[styles.recipientInput, {
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
                color: isDark ? '#e8e8f2' : '#1e1e28',
              }]}
              value={recipientName}
              onChangeText={onRecipientNameChange}
              placeholder={t('recipient_name')}
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)'}
            />
            <TextInput
              style={[styles.recipientInput, {
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
                color: isDark ? '#e8e8f2' : '#1e1e28',
              }]}
              value={recipientPhone}
              onChangeText={onRecipientPhoneChange}
              placeholder={t('recipient_phone')}
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)'}
              keyboardType="phone-pad"
            />
          </View>
        )}
      </View>

      {/* ── Payment method ── */}
      {onPaymentMethodChange && (
        <View style={styles.paymentSection}>
          <Text style={[styles.paymentHeading, { color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)' }]}>
            {t('payment_method_label')}
          </Text>

          {walletAvailable ? (
            // Segmented control — a single sliding ink-gradient highlight signals
            // "one of two states", not two separate pressable buttons.
            <View style={[styles.segmentTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.045)' }]}>
              <Animated.View
                style={[
                  styles.segmentHighlight,
                  {
                    left: paymentAnim.interpolate({ inputRange: [0, 1], outputRange: ['3%', '50%'] }),
                    shadowColor: '#000',
                  },
                ]}
              >
                <LinearGradient colors={c.gradientPrimary} style={StyleSheet.absoluteFill} />
              </Animated.View>

              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); onPaymentMethodChange('cash'); }}
                activeOpacity={0.82}
                style={styles.segmentBtn}
              >
                <Banknote size={15} color={paymentMethod !== 'wallet' ? '#ffffff' : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)')} />
                <Text style={[styles.paymentPillText, {
                  color: paymentMethod !== 'wallet' ? '#ffffff' : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'),
                }]}>
                  {t('payment_methods_cash')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); onPaymentMethodChange('wallet'); }}
                activeOpacity={0.82}
                style={styles.segmentBtn}
              >
                <Wallet size={15} color={paymentMethod === 'wallet' ? '#ffffff' : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)')} />
                <Text style={[styles.paymentPillText, {
                  color: paymentMethod === 'wallet' ? '#ffffff' : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'),
                }]}>
                  {t('payment_methods_wallet')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.paymentPill, styles.paymentPillSolo, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
              <Banknote size={15} color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)'} />
              <Text style={[styles.paymentPillText, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)' }]}>
                {t('payment_methods_cash')}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Confirm button ── */}
      <TouchableOpacity
        style={[styles.confirmWrap, { opacity: canConfirm && !confirming ? 1 : 0.5 }]}
        disabled={!canConfirm || !!confirming}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onConfirm();
        }}
        activeOpacity={0.88}
      >
        <LinearGradient
          colors={confirmGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.confirmGradient}
        >
          {confirming ? (
            <AppLoader size={24} />
          ) : (
            <View style={styles.confirmInner}>
              <Text style={styles.confirmLabel}>
                {selectedPrice != null
                  ? isRTL
                    ? `${selectedLabel} · ${selectedPrice.toFixed(0)} ${t('egp')}`
                    : `${selectedLabel} · ${t('egp')} ${selectedPrice.toFixed(0)}`
                  : t('confirm')}
              </Text>
              <View style={styles.confirmArrow}>
                <ArrowRight size={16} color="#fff" />
              </View>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
      </GlassView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: -16 },
    shadowOpacity: 0.35, shadowRadius: 32, elevation: 28,
    zIndex: 999,
  },
  sheetGlass: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0,
    paddingTop: 8,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: Spacing.lg,
  },

  // Header
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: Spacing.lg, gap: 12,
  },
  tripRoute: { alignItems: 'center', gap: 0, width: 16 },
  routeOriginDot: { width: 10, height: 10, borderRadius: 5 },
  routeDashedLine: { width: 2, height: 18, marginVertical: 3, borderRadius: 1 },
  routeDestPin: {
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  tripInfo: { flex: 1 },
  tripLabel: { fontSize: 10.5, fontWeight: '600' as any, letterSpacing: 0.8, textTransform: 'uppercase' },
  tripDest: { fontSize: 14, fontWeight: '600' as any, marginTop: 2 },
  dismissBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },

  // Options
  optionsWrap: { paddingHorizontal: 16, gap: 10, marginBottom: Spacing.lg },
  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 18, padding: 14,
    position: 'relative',
    shadowColor: '#000',
  },
  optionIconZone: {
    width: 54, height: 54, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative', flexShrink: 0,
  },
  sparkBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  optionMeta: { flex: 1, gap: 4 },
  optionNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionName: { fontSize: 16, fontWeight: '700' as any, letterSpacing: -0.3 },
  tagPill: {
    borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1,
  },
  tagText: { fontSize: 10, fontWeight: '600' as any },
  optionDesc: { fontSize: 12, lineHeight: 16 },
  optionChips: { flexDirection: 'row', gap: 6, marginTop: 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3,
  },
  chipText: { fontSize: 11, fontWeight: '500' as any },
  priceZone: { alignItems: 'flex-end', gap: 1, paddingRight: 4 },
  priceCurrency: { fontSize: 11, fontWeight: '600' as any },
  priceValue: { fontSize: 24, fontWeight: '800' as any, letterSpacing: -1 },
  selectedDot: {
    position: 'absolute', top: 10, right: 10,
    width: 8, height: 8, borderRadius: 4,
  },

  // Recipient
  recipientBlock: { gap: Spacing.sm, marginTop: 4 },
  recipientInput: {
    height: 48, borderRadius: Radius.lg, borderWidth: 1,
    paddingHorizontal: Spacing.md, fontSize: 14,
  },

  // Payment
  paymentSection: { paddingHorizontal: 16, marginBottom: Spacing.lg, gap: Spacing.sm },
  paymentHeading: { fontSize: 10.5, fontWeight: '600' as any, letterSpacing: 0.8, textTransform: 'uppercase' },
  segmentTrack: {
    flexDirection: 'row', height: 50, borderRadius: 16, padding: 3,
  },
  segmentHighlight: {
    position: 'absolute', top: 3, bottom: 3, width: '47%', borderRadius: 13,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 8, elevation: 5,
  },
  segmentBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  paymentPill: {
    height: 46, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
  },
  paymentPillSolo: { width: '100%' },
  paymentPillText: { fontSize: 13.5, fontWeight: '600' as any },

  // Confirm
  confirmWrap: { marginHorizontal: 16 },
  confirmGradient: {
    height: 58, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  confirmInner: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 12,
  },
  confirmLabel: {
    fontSize: 15.5, fontWeight: '700' as any,
    color: '#ffffff', letterSpacing: -0.2,
  },
  confirmArrow: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
});
