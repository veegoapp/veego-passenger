import { memo, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
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
}

/* ─── Shared primitives ──────────────────────────────────────────────────── */
function PrimaryButton({
  onPress, disabled, children,
}: { onPress?: () => void; disabled?: boolean; children: React.ReactNode }) {
  const { colors: c } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.88}
      style={[
        styles.primaryBtn,
        { backgroundColor: disabled ? (c.isDark ? '#2a2a40' : '#c8c8d0') : c.primary },
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
  paymentMethod = 'cash', onPaymentMethodChange, walletAvailable,
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
          {/* ── Sheet title ── */}
          <View style={{ marginBottom: 16 }}>
            <Text style={[styles.sheetTitle, { color: c.ink }]}>{t('select_ride_type')}</Text>
            <Text style={[styles.sheetSubtitle, { color: mutedCol }]}>{'Prices include taxes and fees'}</Text>
          </View>

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
                    <View style={[
                      styles.optionIconH,
                      { backgroundColor: active ? (isDark ? 'rgba(30,30,40,0.25)' : 'rgba(30,30,40,0.08)') : surfaceBg },
                    ]}>
                      <Car size={20} color={active ? primaryCol : mutedCol} strokeWidth={1.8} />
                    </View>
                    <Text style={[styles.optionNameH, { color: c.ink }]} numberOfLines={1}>{cat.name}</Text>
                    {estimate?.eta != null && !estimateLoading ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Clock size={10} color={mutedCol} strokeWidth={2} />
                        <Text style={[styles.etaTextH, { color: mutedCol }]}>{estimate.eta} {t('min')}</Text>
                      </View>
                    ) : estimateLoading ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Clock size={10} color={mutedCol} strokeWidth={2} />
                        <Text style={[styles.etaTextH, { color: mutedCol }]}>–</Text>
                      </View>
                    ) : null}
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
                  implying it's payable today. */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => { Haptics.selectionAsync(); onPaymentMethodChange('cash'); }}
                  activeOpacity={0.82}
                  style={[
                    styles.payCard,
                    {
                      flex: 1,
                      backgroundColor: paymentMethod === 'cash'
                        ? (isDark ? 'rgba(30,30,40,0.18)' : 'rgba(30,30,40,0.04)')
                        : cardBg,
                      borderColor: paymentMethod === 'cash' ? primaryCol : borderCol,
                    },
                  ]}
                >
                  <Banknote size={18} color={paymentMethod === 'cash' ? primaryCol : mutedCol} strokeWidth={1.8} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.payLabel, { color: c.ink }]}>{t('payment_methods_cash')}</Text>
                    <Text style={[styles.paySub, { color: mutedCol }]} numberOfLines={1}>{t('pay_driver')}</Text>
                  </View>
                  {paymentMethod === 'cash' ? <Check size={16} color={primaryCol} strokeWidth={2.4} /> : null}
                </TouchableOpacity>

                <View
                  style={[
                    styles.payCard,
                    { flex: 1, opacity: 0.55, backgroundColor: surfaceBg, borderColor: borderCol },
                  ]}
                >
                  <CreditCard size={18} color={mutedCol} strokeWidth={1.8} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.payLabel, { color: mutedCol }]}>{t('payment_methods_card')}</Text>
                    <View style={[styles.soonBadge, { backgroundColor: borderCol }]}>
                      <Text style={[styles.soonBadgeText, { color: mutedCol }]}>{t('soon')}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Wallet balance toggle — applies wallet funds alongside the
                  primary method above instead of competing with it as a
                  third selectable chip. Maps onto the same 'cash' | 'wallet'
                  paymentMethod state/callback the backend already expects. */}
              {walletAvailable && (
                <View style={[styles.walletRow, { backgroundColor: surfaceBg, borderColor: borderCol, marginTop: 8 }]}>
                  <View style={[styles.walletIcon, { backgroundColor: cardBg, borderColor: borderCol }]}>
                    <Wallet size={16} color={primaryCol} strokeWidth={1.8} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.payLabel, { color: c.ink }]}>{t('payment_methods_wallet')}</Text>
                    <Text style={[styles.paySub, { color: mutedCol }]} numberOfLines={1}>{'Apply wallet balance'}</Text>
                  </View>
                  <Switch
                    value={paymentMethod === 'wallet'}
                    onValueChange={(val) => {
                      Haptics.selectionAsync();
                      onPaymentMethodChange(val ? 'wallet' : 'cash');
                    }}
                    trackColor={{ false: borderCol, true: primaryCol }}
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
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>
                    {'Find Driver'}
                  </Text>
                  {selectedPrice != null ? (
                    <Text style={[styles.primaryBtnText, { opacity: 0.7 }]}>
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
    position: 'absolute', bottom: 0, left: 0, right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
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
    width: 40, height: 5, borderRadius: 3,
    alignSelf: 'center', marginBottom: 20,
  },

  sheetTitle: {
    fontSize: 22, fontWeight: '700', letterSpacing: -0.44,
  },
  sheetSubtitle: {
    fontSize: 14, marginTop: 4,
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
    width: 128, borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 14,
    alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 0,
  },
  optionIconH: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
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
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  walletIcon: {
    width: 32, height: 32, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  primaryBtn: {
    height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 6,
  },
  primaryBtnText: {
    fontSize: 15.5, fontWeight: '600',
    color: '#ffffff', letterSpacing: -0.15,
  },
});
