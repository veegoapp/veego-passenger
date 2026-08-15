import { memo, useRef, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Animated,
  ActivityIndicator, TextInput, ScrollView, Switch,
} from 'react-native';
import {
  Car, Bike as ScooterIcon, Package,
  Banknote, Wallet, CreditCard, Check,
  Clock, ChevronDown, ArrowRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { Animation } from '@/constants/animations';

/* ─── Types (unchanged) ──────────────────────────────────────────────────── */
interface RideCategoryOption { slug: string; name: string; price: number }
interface RideEstimate { categories: RideCategoryOption[]; eta: number }
interface SingleEstimate { price: number; eta: number }

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
  walletBalance?: number;
}

// Fixed brand treatment for the payment/CTA controls below — charcoal +
// metallic gold, independent of the app's light/dark theme tokens.
const GOLD = '#D5B23D';
const CHARCOAL = '#1C1C1E';
const CHARCOAL_SURFACE = '#26262A';

// Real car photos per catalog category (economy / economy_plus / comfort),
// shown large and frameless in the ride option cards below — falls back to
// the generic Car icon for any slug the backend adds later without a photo.
const CATEGORY_IMAGES: Record<string, ReturnType<typeof require>> = {
  economy: require('../../assets/images/vehicles/category/economy.png'),
  economy_plus: require('../../assets/images/vehicles/category/economy-plus.png'),
  comfort: require('../../assets/images/vehicles/category/comfort.png'),
};

/* ─── Shared primitives ──────────────────────────────────────────────────── */
function PrimaryButton({
  onPress, disabled, children,
}: { onPress?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.88}
      style={[
        styles.primaryBtn,
        disabled
          ? { backgroundColor: CHARCOAL_SURFACE, borderColor: 'rgba(255,255,255,0.08)' }
          : { backgroundColor: GOLD, borderColor: '#B8952E' },
      ]}
    >
      {children}
    </TouchableOpacity>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
function RideOptionsSheetBase({
  visible, destination, selected, onSelect, onConfirm, onDismiss,
  estimate, estimateLoading, confirming,
  serviceType = 'car', singleEstimate,
  recipientName, recipientPhone, onRecipientNameChange, onRecipientPhoneChange,
  paymentMethod = 'cash', onPaymentMethodChange, walletAvailable, walletBalance,
}: RideOptionsSheetProps) {
  const { colors: c, t, isRTL } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const carCategories = estimate?.categories ?? [];
  const isDelivery = serviceType === 'delivery';

  const isDark = c.isDark;
  const cardBg    = c.white;
  const surfaceBg = c.surfaceMuted;
  const borderCol = c.border;
  const mutedCol  = c.inkSoft;
  const primaryCol = c.primary;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      ...Animation.spring.sheet,
      mass: 0.8,
    }).start();
  }, [visible]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });

  const selectedCategory = selected && serviceType === 'car'
    ? carCategories.find((cat) => cat.slug === selected)
    : undefined;
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

  const recipientReady = !isDelivery || (!!recipientName?.trim() && !!recipientPhone?.trim());
  const canConfirm = !!selected && recipientReady && !confirming;
  const walletHasFunds = (walletBalance ?? 0) > 0;

  /* ── Option icon ── */
  const OptionIcon = serviceType === 'scooter' ? ScooterIcon : serviceType === 'delivery' ? Package : Car;

  return (
    <Animated.View
      style={[styles.sheet, { opacity: slideAnim, transform: [{ translateY }] }]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View style={[styles.sheetSurface, { backgroundColor: cardBg, paddingBottom: insets.bottom + 20 }]}>
        {/* Drag handle */}
        <View style={[styles.handle, { backgroundColor: borderCol }]} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Trip row ── */}
          {destination ? (
            <View style={[styles.tripRow, { backgroundColor: surfaceBg, borderColor: borderCol }]}>
              <View style={styles.tripDots}>
                <View style={[styles.tripDotRound, { backgroundColor: mutedCol }]} />
                <View style={[styles.tripDotLine, { backgroundColor: borderCol }]} />
                <View style={[styles.tripDotSquare, { backgroundColor: primaryCol }]} />
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={[styles.tripAddr, { color: mutedCol }]} numberOfLines={1}>{t('your_location')}</Text>
                <Text style={[styles.tripDest, { color: c.ink }]} numberOfLines={1}>{destination}</Text>
              </View>
              <TouchableOpacity
                onPress={onDismiss}
                style={[styles.dismissBtn, { backgroundColor: surfaceBg, borderColor: borderCol }]}
                activeOpacity={0.75}
              >
                <ChevronDown size={16} color={mutedCol} />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* ── Ride option cards ── */}
          {serviceType === 'car' ? (
            // Horizontal selector strip — compact cards side-by-side instead
            // of a tall vertical stack, so the sheet stays short even with
            // several categories.
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.optionScrollContent}
              style={{ marginBottom: 16 }}
            >
              {carCategories.map((cat) => {
                const active = selected === cat.slug;
                return (
                  <TouchableOpacity
                    key={cat.slug}
                    onPress={() => { Haptics.selectionAsync(); onSelect(cat.slug); }}
                    activeOpacity={0.82}
                    style={[
                      styles.optionCardH,
                      {
                        backgroundColor: active
                          ? (isDark ? 'rgba(30,30,40,0.18)' : 'rgba(30,30,40,0.04)')
                          : cardBg,
                        borderColor: active ? primaryCol : borderCol,
                        borderWidth: active ? 1.5 : 1,
                      },
                    ]}
                  >
                    {active && (
                      <View style={[styles.checkBadge, { backgroundColor: primaryCol }]}>
                        <Check size={10} color="#ffffff" strokeWidth={3} />
                      </View>
                    )}
                    {CATEGORY_IMAGES[cat.slug] ? (
                      <Image
                        source={CATEGORY_IMAGES[cat.slug]}
                        style={styles.optionImageH}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={[
                        styles.optionIconH,
                        { backgroundColor: active ? (isDark ? 'rgba(30,30,40,0.25)' : 'rgba(30,30,40,0.08)') : surfaceBg },
                      ]}>
                        <Car size={20} color={active ? primaryCol : mutedCol} strokeWidth={1.8} />
                      </View>
                    )}
                    <Text style={[styles.optionNameH, { color: c.ink }]} numberOfLines={1}>{cat.name}</Text>
                    {estimateLoading ? (
                      <ActivityIndicator size="small" color={primaryCol} />
                    ) : (
                      <Text style={[styles.priceValueH, { color: c.ink }]} numberOfLines={1}>
                        {cat.price != null ? cat.price.toFixed(2) : '—'}
                        <Text style={[styles.priceCurrencyH, { color: mutedCol }]}> {t('egp')}</Text>
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View style={{ gap: 8, marginBottom: 16 }}>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); onSelect('standard'); }}
                activeOpacity={0.82}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: selected === 'standard'
                      ? (isDark ? 'rgba(30,30,40,0.18)' : 'rgba(30,30,40,0.04)')
                      : cardBg,
                    borderColor: selected === 'standard' ? primaryCol : borderCol,
                    borderWidth: selected === 'standard' ? 1.5 : 1,
                  },
                ]}
              >
                <View style={[
                  styles.optionIcon,
                  { backgroundColor: selected === 'standard' ? (isDark ? 'rgba(30,30,40,0.25)' : 'rgba(30,30,40,0.08)') : surfaceBg },
                ]}>
                  <OptionIcon size={20} color={selected === 'standard' ? primaryCol : mutedCol} strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.optionName, { color: c.ink }]}>
                    {serviceType === 'scooter' ? t('scooter') : t('delivery')}
                  </Text>
                  {singleEstimate?.eta != null && !estimateLoading ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} color={mutedCol} strokeWidth={2} />
                      <Text style={[styles.etaText, { color: mutedCol }]}>{singleEstimate.eta} {t('min')}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {estimateLoading ? (
                    <ActivityIndicator size="small" color={primaryCol} />
                  ) : (
                    <>
                      <Text style={[styles.priceValue, { color: c.ink }]}>
                        {singleEstimate?.price != null ? singleEstimate.price.toFixed(2) : '—'}
                      </Text>
                      <Text style={[styles.priceCurrency, { color: mutedCol }]}>{t('egp')}</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Delivery recipient fields ── */}
          {isDelivery && (
            <View style={{ gap: 8, marginBottom: 16 }}>
              <TextInput
                style={[styles.recipientInput, { borderColor: borderCol, backgroundColor: surfaceBg, color: c.ink }]}
                value={recipientName}
                onChangeText={onRecipientNameChange}
                placeholder={t('recipient_name')}
                placeholderTextColor={mutedCol}
              />
              <TextInput
                style={[styles.recipientInput, { borderColor: borderCol, backgroundColor: surfaceBg, color: c.ink }]}
                value={recipientPhone}
                onChangeText={onRecipientPhoneChange}
                placeholder={t('recipient_phone')}
                placeholderTextColor={mutedCol}
                keyboardType="phone-pad"
              />
            </View>
          )}

          {/* ── Payment section ── */}
          {onPaymentMethodChange && (
            <View style={{ marginBottom: 16 }}>
              <Text style={[styles.sectionLabel, { color: mutedCol }]}>{t('payment_method_label')}</Text>

              {/* Cash / Card — primary method, side-by-side. Card has no
                  payment gateway wired into ride requests yet, so it's
                  shown disabled with a "coming soon" badge rather than
                  implying it's payable today. Solid charcoal/gold fills
                  per the brand theme instead of theme-token outlines. */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => { Haptics.selectionAsync(); onPaymentMethodChange('cash'); }}
                  activeOpacity={0.82}
                  style={[
                    styles.payCard,
                    {
                      flex: 1,
                      backgroundColor: paymentMethod === 'cash' ? CHARCOAL : CHARCOAL_SURFACE,
                      borderColor: paymentMethod === 'cash' ? GOLD : 'rgba(255,255,255,0.08)',
                      borderWidth: paymentMethod === 'cash' ? 2 : 1,
                    },
                  ]}
                >
                  <Banknote size={18} color={paymentMethod === 'cash' ? GOLD : '#8A8A8E'} strokeWidth={1.8} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.payLabel, { color: paymentMethod === 'cash' ? '#ffffff' : '#B0B0B5' }]}>{t('payment_methods_cash')}</Text>
                    <Text style={[styles.paySub, { color: '#8A8A8E' }]} numberOfLines={1}>{t('pay_driver')}</Text>
                  </View>
                  {paymentMethod === 'cash' ? <Check size={16} color={GOLD} strokeWidth={2.4} /> : null}
                </TouchableOpacity>

                <View
                  style={[
                    styles.payCard,
                    { flex: 1, backgroundColor: CHARCOAL_SURFACE, borderColor: 'rgba(255,255,255,0.08)' },
                  ]}
                >
                  <CreditCard size={18} color="#6E6E73" strokeWidth={1.8} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.payLabel, { color: '#6E6E73' }]}>{t('payment_methods_card')}</Text>
                    <View style={[styles.soonBadge, { backgroundColor: 'rgba(213,178,61,0.15)' }]}>
                      <Text style={[styles.soonBadgeText, { color: GOLD }]}>{t('soon')}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Wallet balance toggle — compact inline row. Applies wallet
                  funds alongside the primary method above instead of
                  competing with it as a third selectable chip; maps onto
                  the same 'cash' | 'wallet' paymentMethod state/callback
                  the backend already expects. Switch is gated on the live
                  balance from GET /wallet, not just the feature flag. */}
              {walletAvailable && (
                <View
                  style={[
                    styles.walletRow,
                    {
                      backgroundColor: CHARCOAL_SURFACE,
                      borderColor: paymentMethod === 'wallet' ? GOLD : 'rgba(255,255,255,0.08)',
                      borderWidth: paymentMethod === 'wallet' ? 2 : 1,
                      marginTop: 8,
                      opacity: walletHasFunds ? 1 : 0.5,
                    },
                  ]}
                >
                  <Wallet size={16} color={walletHasFunds ? GOLD : '#6E6E73'} strokeWidth={1.8} />
                  <Text style={[styles.payLabel, { color: '#ffffff', flex: 1 }]}>{t('payment_methods_wallet')}</Text>
                  <Text style={[styles.walletBalanceText, { color: '#B0B0B5' }]} numberOfLines={1}>
                    {'Balance: '}{walletBalance ?? 0} {t('egp')}
                  </Text>
                  <Switch
                    value={paymentMethod === 'wallet'}
                    disabled={!walletHasFunds}
                    onValueChange={(val) => {
                      if (!walletHasFunds) return;
                      Haptics.selectionAsync();
                      onPaymentMethodChange(val ? 'wallet' : 'cash');
                    }}
                    trackColor={{ false: '#3A3A3C', true: GOLD }}
                    thumbColor="#ffffff"
                  />
                </View>
              )}
            </View>
          )}

          {/* ── Confirm button ── */}
          <PrimaryButton onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onConfirm(); }} disabled={!canConfirm}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {confirming ? (
                <ActivityIndicator size="small" color={canConfirm ? CHARCOAL : '#8A8A8E'} />
              ) : (
                <>
                  <Text style={[styles.primaryBtnText, { color: canConfirm ? CHARCOAL : '#8A8A8E' }]}>
                    {'Find Driver'}
                  </Text>
                  {selectedPrice != null ? (
                    <Text style={[styles.primaryBtnText, { color: canConfirm ? CHARCOAL : '#8A8A8E', opacity: 0.7 }]}>
                      · {selectedPrice.toFixed(2)} {t('egp')}
                    </Text>
                  ) : null}
                </>
              )}
            </View>
          </PrimaryButton>
        </ScrollView>
      </View>
    </Animated.View>
  );
}

export const RideOptionsSheet = memo(RideOptionsSheetBase);

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 28,
    zIndex: 999,
  },
  sheetSurface: {
    borderRadius: 28,
    paddingTop: 10,
    overflow: 'hidden',
  },
  handle: {
    width: 40, height: 5, borderRadius: 3,
    alignSelf: 'center', marginBottom: 20,
  },

  tripRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 14,
    marginBottom: 16,
  },
  tripDots: { alignItems: 'center', gap: 2, paddingTop: 2 },
  tripDotRound: { width: 8, height: 8, borderRadius: 4 },
  tripDotLine: { width: 1, height: 20, marginVertical: 2 },
  tripDotSquare: { width: 8, height: 8, borderRadius: 2 },
  tripAddr: { fontSize: 13, fontWeight: '500' },
  tripDest: { fontSize: 13, fontWeight: '600' },
  dismissBtn: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 0,
  },
  optionIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  optionName: {
    fontSize: 15, fontWeight: '600', letterSpacing: -0.15,
  },
  seatBadge: {
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  seatText: { fontSize: 11, fontWeight: '500' },
  etaText: { fontSize: 12, fontWeight: '500' },
  priceValue: {
    fontSize: 15, fontWeight: '700', letterSpacing: -0.2,
  },
  priceCurrency: { fontSize: 11, fontWeight: '600', marginTop: 1 },

  /* ── Horizontal category selector cards (Task 1) ── */
  optionScrollContent: {
    gap: 10, paddingRight: 4,
  },
  optionCardH: {
    width: 156, borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 12,
    alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 0,
  },
  optionIconH: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  optionImageH: {
    width: 136, height: 80, marginBottom: 2,
  },
  optionNameH: {
    fontSize: 13, fontWeight: '600', letterSpacing: -0.1,
    textAlign: 'center',
  },
  etaTextH: { fontSize: 11, fontWeight: '500' },
  priceValueH: {
    fontSize: 14, fontWeight: '700', letterSpacing: -0.1, marginTop: 2,
  },
  priceCurrencyH: { fontSize: 10, fontWeight: '600' },
  checkBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },

  recipientInput: {
    height: 48, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, fontSize: 14,
  },

  sectionLabel: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: 8,
  },
  payCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  payLabel: { fontSize: 14, fontWeight: '600' },
  paySub: { fontSize: 12, marginTop: 1 },
  soonBadge: {
    alignSelf: 'flex-start', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2, marginTop: 3,
  },
  soonBadgeText: { fontSize: 10, fontWeight: '600' },

  walletRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  walletBalanceText: {
    fontSize: 12, fontWeight: '600', marginRight: 4,
  },

  primaryBtn: {
    height: 56, borderRadius: 16, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 6,
  },
  primaryBtnText: {
    fontSize: 15.5, fontWeight: '700', letterSpacing: -0.15,
  },
});
