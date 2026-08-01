import { memo, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  ActivityIndicator, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppLoader } from '@/components/ui/AppLoader';
import {
  MapPin, ChevronDown, Clock, ArrowRight,
  Car, Bike as ScooterIcon, Package,
  Banknote, Wallet,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTabBar } from '@/context/TabBarContext';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeColors } from '@/constants/colors';
import { Animation } from '@/constants/animations';
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

function RideOptionsSheetBase({
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

  const confirmGradient: readonly [string, string] = canConfirm && !confirming
    ? c.gradientPrimary
    : [isDark ? '#2a2a40' : '#d1d1db', isDark ? '#1e1e32' : '#c4c4cf'];

  const sheetBg = isDark ? '#16162a' : '#ffffff';
  const borderColor = isDark ? '#2c2c46' : '#e5e5ea';
  const mutedText = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.4)';

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
      <View style={[styles.sheetSurface, { backgroundColor: sheetBg, paddingBottom: tabBarHeight + 20 }]}>
        {/* Drag handle */}
        <View style={[styles.handle, { backgroundColor: borderColor }]} />

        {/* ── Destination header ── */}
        <View style={[styles.destRow, { borderColor, backgroundColor: isDark ? '#1e1e32' : '#f8f8fb' }]}>
          <View style={styles.routeIndicator}>
            <View style={[styles.routeDot, { backgroundColor: mutedText }]} />
            <View style={[styles.routeLine, { backgroundColor: borderColor }]} />
            <View style={[styles.routeSquare, { backgroundColor: c.primary }]} />
          </View>
          <View style={styles.destInfo}>
            <Text style={[styles.destLabel, { color: mutedText }]} numberOfLines={1}>
              {t('select_ride_type')}
            </Text>
            {destination && (
              <Text style={[styles.destText, { color: c.ink }]} numberOfLines={1}>
                {destination}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={onDismiss}
            style={[styles.dismissBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderColor }]}
            activeOpacity={0.75}
          >
            <ChevronDown size={16} color={mutedText} />
          </TouchableOpacity>
        </View>

        {/* ── Ride option cards ── */}
        <View style={styles.optionsWrap}>
          {serviceType === 'car' ? (
            carCategories.map((cat, index) => {
              const style = TIER_STYLES[index % TIER_STYLES.length];
              const eta = estimate?.eta;
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
                        : (isDark ? '#1e1e32' : '#ffffff'),
                      borderColor: isSelected ? style.accent : borderColor,
                      borderWidth: isSelected ? 1.5 : 1,
                    },
                  ]}
                >
                  {/* Icon */}
                  <View style={[
                    styles.optionIcon,
                    { backgroundColor: isSelected ? style.accentBg : (isDark ? '#2c2c46' : '#f2f2f5') },
                  ]}>
                    <Car size={22} color={isSelected ? style.accent : mutedText} strokeWidth={1.8} />
                  </View>

                  {/* Info */}
                  <View style={styles.optionInfo}>
                    <Text style={[styles.optionName, { color: isSelected ? style.accent : c.ink }]}>
                      {cat.name}
                    </Text>
                    {eta != null && !estimateLoading && (
                      <View style={styles.etaRow}>
                        <Clock size={10} color={mutedText} />
                        <Text style={[styles.etaText, { color: mutedText }]}>
                          {eta} {t('min')}
                        </Text>
                      </View>
                    )}
                    {estimateLoading && (
                      <View style={styles.etaRow}>
                        <Clock size={10} color={mutedText} />
                        <Text style={[styles.etaText, { color: mutedText }]}>–</Text>
                      </View>
                    )}
                  </View>

                  {/* Price */}
                  <View style={styles.priceZone}>
                    {estimateLoading ? (
                      <ActivityIndicator size="small" color={style.accent} />
                    ) : (
                      <>
                        <Text style={[styles.priceCurrency, { color: isSelected ? style.accent : mutedText }]}>
                          {t('egp')}
                        </Text>
                        <Text style={[styles.priceValue, { color: isSelected ? style.accent : c.ink }]}>
                          {cat.price != null ? cat.price.toFixed(0) : '—'}
                        </Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            (() => {
              const meta = SINGLE_META[serviceType as 'scooter' | 'delivery'];
              const isSelected = selected === 'standard';
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
                        : (isDark ? '#1e1e32' : '#ffffff'),
                      borderColor: isSelected ? meta.accent : borderColor,
                      borderWidth: isSelected ? 1.5 : 1,
                    },
                  ]}
                >
                  <View style={[
                    styles.optionIcon,
                    { backgroundColor: isSelected ? meta.accentBg : (isDark ? '#2c2c46' : '#f2f2f5') },
                  ]}>
                    <IconComp size={22} color={isSelected ? meta.accent : mutedText} strokeWidth={1.8} />
                  </View>
                  <View style={styles.optionInfo}>
                    <Text style={[styles.optionName, { color: isSelected ? meta.accent : c.ink }]}>
                      {serviceType === 'scooter' ? t('scooter') : t('delivery')}
                    </Text>
                    {singleEstimate?.eta != null && !estimateLoading && (
                      <View style={styles.etaRow}>
                        <Clock size={10} color={mutedText} />
                        <Text style={[styles.etaText, { color: mutedText }]}>
                          {singleEstimate.eta} {t('min')}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.priceZone}>
                    {estimateLoading ? (
                      <ActivityIndicator size="small" color={meta.accent} />
                    ) : (
                      <>
                        <Text style={[styles.priceCurrency, { color: isSelected ? meta.accent : mutedText }]}>
                          {t('egp')}
                        </Text>
                        <Text style={[styles.priceValue, { color: isSelected ? meta.accent : c.ink }]}>
                          {singleEstimate?.price != null ? singleEstimate.price.toFixed(0) : '—'}
                        </Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })()
          )}

          {/* Delivery recipient fields */}
          {isDelivery && (
            <View style={styles.recipientBlock}>
              <TextInput
                style={[styles.recipientInput, {
                  borderColor,
                  backgroundColor: isDark ? '#1e1e32' : '#f8f8fb',
                  color: c.ink,
                }]}
                value={recipientName}
                onChangeText={onRecipientNameChange}
                placeholder={t('recipient_name')}
                placeholderTextColor={mutedText}
              />
              <TextInput
                style={[styles.recipientInput, {
                  borderColor,
                  backgroundColor: isDark ? '#1e1e32' : '#f8f8fb',
                  color: c.ink,
                }]}
                value={recipientPhone}
                onChangeText={onRecipientPhoneChange}
                placeholder={t('recipient_phone')}
                placeholderTextColor={mutedText}
                keyboardType="phone-pad"
              />
            </View>
          )}
        </View>

        {/* ── Payment method ── */}
        {onPaymentMethodChange && (
          <View style={styles.paymentSection}>
            <Text style={[styles.paymentLabel, { color: mutedText }]}>
              {t('payment_method_label')}
            </Text>

            {walletAvailable ? (
              <View style={[styles.segmentTrack, { backgroundColor: isDark ? '#1e1e32' : '#f2f2f5', borderColor }]}>
                <Animated.View
                  style={[
                    styles.segmentHighlight,
                    {
                      left: paymentAnim.interpolate({ inputRange: [0, 1], outputRange: ['3%', '50%'] }),
                    },
                  ]}
                >
                  <LinearGradient colors={c.gradientPrimary} style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} />
                </Animated.View>

                <TouchableOpacity
                  onPress={() => { Haptics.selectionAsync(); onPaymentMethodChange('cash'); }}
                  activeOpacity={0.82}
                  style={styles.segmentBtn}
                >
                  <Banknote size={15} color={paymentMethod !== 'wallet' ? '#ffffff' : mutedText} />
                  <Text style={[styles.segmentText, {
                    color: paymentMethod !== 'wallet' ? '#ffffff' : mutedText,
                  }]}>
                    {t('payment_methods_cash')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { Haptics.selectionAsync(); onPaymentMethodChange('wallet'); }}
                  activeOpacity={0.82}
                  style={styles.segmentBtn}
                >
                  <Wallet size={15} color={paymentMethod === 'wallet' ? '#ffffff' : mutedText} />
                  <Text style={[styles.segmentText, {
                    color: paymentMethod === 'wallet' ? '#ffffff' : mutedText,
                  }]}>
                    {t('payment_methods_wallet')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.cashOnlyPill, { backgroundColor: isDark ? '#1e1e32' : '#f2f2f5', borderColor }]}>
                <Banknote size={15} color={mutedText} />
                <Text style={[styles.segmentText, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)' }]}>
                  {t('payment_methods_cash')}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Confirm / Find Driver button ── */}
        <TouchableOpacity
          style={[styles.confirmWrap, { opacity: canConfirm && !confirming ? 1 : 0.45 }]}
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
            style={styles.confirmBtn}
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
      </View>
    </Animated.View>
  );
}

export const RideOptionsSheet = memo(RideOptionsSheetBase);

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 28,
    zIndex: 999,
  },
  sheetSurface: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 16,
  },

  // Destination header row
  destRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 14,
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
    gap: 10,
  },
  routeIndicator: { alignItems: 'center', gap: 0, width: 10 },
  routeDot: { width: 8, height: 8, borderRadius: 4 },
  routeLine: { width: 1.5, height: 14, marginVertical: 2, borderRadius: 1 },
  routeSquare: { width: 8, height: 8, borderRadius: 2 },
  destInfo: { flex: 1 },
  destLabel: { fontSize: 11, fontWeight: '500' as any, letterSpacing: 0.2 },
  destText: { fontSize: 13.5, fontWeight: '600' as any, marginTop: 2 },
  dismissBtn: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  // Option cards
  optionsWrap: { paddingHorizontal: 16, gap: 8, marginBottom: 14 },
  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 0,
  },
  optionIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  optionInfo: { flex: 1, gap: 4 },
  optionName: { fontSize: 15.5, fontWeight: '700' as any, letterSpacing: -0.2 },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  etaText: { fontSize: 12, fontWeight: '500' as any },
  priceZone: { alignItems: 'flex-end', gap: 1 },
  priceCurrency: { fontSize: 11, fontWeight: '600' as any },
  priceValue: { fontSize: 22, fontWeight: '800' as any, letterSpacing: -0.8 },

  // Recipient
  recipientBlock: { gap: 8, marginTop: 2 },
  recipientInput: {
    height: 48, borderRadius: Radius.lg, borderWidth: 1,
    paddingHorizontal: Spacing.md, fontSize: 14,
  },

  // Payment
  paymentSection: { paddingHorizontal: 16, marginBottom: 14, gap: 8 },
  paymentLabel: { fontSize: 11, fontWeight: '600' as any, letterSpacing: 0.6, textTransform: 'uppercase' as any },
  segmentTrack: {
    flexDirection: 'row', height: 50, borderRadius: 16, padding: 4, borderWidth: 1,
  },
  segmentHighlight: {
    position: 'absolute', top: 4, bottom: 4, width: '47%', borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  segmentBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  segmentText: { fontSize: 13.5, fontWeight: '600' as any },
  cashOnlyPill: {
    height: 48, borderRadius: 14, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },

  // Confirm
  confirmWrap: { marginHorizontal: 16 },
  confirmBtn: {
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
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
});
