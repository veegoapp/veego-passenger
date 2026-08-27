import { memo, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  ActivityIndicator, TextInput, ScrollView, Switch,
} from 'react-native';
import {
  Car, Bike as ScooterIcon, Package,
  Banknote, Wallet, CreditCard,
  Clock, ChevronDown,
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

// ── "C · Split Panel" fixed palette (matches the approved design) ────────────
const C_PANEL = '#14151A';
const C_CARD = '#FFFFFF';
const C_INK = '#14151A';
const C_INK_SOFT = '#6B7178';
const C_CAP = '#9AA0A6';
const C_HAIR = '#EEF0F1';
const C_SURF = '#F6F7F8';
const C_TEAL = '#0E9F8E';
const C_MINT = '#3DDC97';

/* ─── Main component ─────────────────────────────────────────────────────── */
function RideOptionsSheetBase({
  visible, destination, selected, onSelect, onConfirm, onDismiss,
  estimate, estimateLoading, confirming,
  serviceType = 'car', singleEstimate,
  recipientName, recipientPhone, onRecipientNameChange, onRecipientPhoneChange,
  paymentMethod = 'cash', onPaymentMethodChange, walletAvailable, walletBalance,
}: RideOptionsSheetProps) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const carCategories = estimate?.categories ?? [];
  const isDelivery = serviceType === 'delivery';

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
    if (selected === 'standard') return singleEstimate?.price ?? null;
    return selectedCategory?.price ?? null;
  })();

  const recipientReady = !isDelivery || (!!recipientName?.trim() && !!recipientPhone?.trim());
  const canConfirm = !!selected && recipientReady && !confirming;
  const walletHasFunds = (walletBalance ?? 0) > 0;

  const OptionIcon = serviceType === 'scooter' ? ScooterIcon : serviceType === 'delivery' ? Package : Car;

  return (
    <Animated.View
      style={[styles.sheet, { opacity: slideAnim, transform: [{ translateY }] }]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <View style={styles.sheetSurface}>
        {/* ── Dark header (trip row) ── */}
        <View style={styles.header}>
          <View style={styles.handle} />
          <View style={styles.tripRow}>
            <View style={styles.tripDots}>
              <View style={styles.tripDotRound} />
              <View style={styles.tripDotLine} />
              <View style={styles.tripDotSquare} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.tripCap}>{t('your_location')}</Text>
              <Text style={styles.tripDest} numberOfLines={1}>{destination ?? ''}</Text>
            </View>
            <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn} activeOpacity={0.75}>
              <ChevronDown size={16} color="#B7BBC2" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── White body ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.body}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 18 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Category selector ── */}
          {serviceType === 'car' ? (
            <View style={styles.tileRow}>
              {carCategories.map((cat) => {
                const active = selected === cat.slug;
                return (
                  <TouchableOpacity
                    key={cat.slug}
                    onPress={() => { Haptics.selectionAsync(); onSelect(cat.slug); }}
                    activeOpacity={0.85}
                    style={[styles.tile, active ? styles.tileActive : null]}
                  >
                    <Text style={[styles.tileName, { color: active ? '#ffffff' : C_INK }]} numberOfLines={1}>{cat.name}</Text>
                    {estimateLoading ? (
                      <ActivityIndicator size="small" color={active ? '#ffffff' : C_TEAL} />
                    ) : (
                      <Text style={[styles.tilePrice, { color: active ? '#ffffff' : C_INK }]} numberOfLines={1}>
                        {cat.price != null ? Math.round(cat.price) : '—'}
                        <Text style={[styles.tileCur, active ? { color: 'rgba(255,255,255,0.8)' } : null]}> {t('egp')}</Text>
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={{ marginBottom: 16 }}>
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync(); onSelect('standard'); }}
                activeOpacity={0.85}
                style={[styles.singleRow, selected === 'standard' ? styles.singleRowActive : null]}
              >
                <View style={[styles.singleIcon, { backgroundColor: selected === 'standard' ? 'rgba(14,159,142,0.12)' : C_SURF }]}>
                  <OptionIcon size={20} color={selected === 'standard' ? C_TEAL : C_INK_SOFT} strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.singleName}>
                    {serviceType === 'scooter' ? t('scooter') : t('delivery')}
                  </Text>
                  {singleEstimate?.eta != null && !estimateLoading ? (
                    <View style={styles.etaRow}>
                      <Clock size={11} color={C_INK_SOFT} strokeWidth={2} />
                      <Text style={styles.etaTxt}>{singleEstimate.eta} {t('min')}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {estimateLoading ? (
                    <ActivityIndicator size="small" color={C_TEAL} />
                  ) : (
                    <>
                      <Text style={styles.singlePrice}>{singleEstimate?.price != null ? singleEstimate.price.toFixed(2) : '—'}</Text>
                      <Text style={styles.singleCur}>{t('egp')}</Text>
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
                style={styles.recipientInput}
                value={recipientName}
                onChangeText={onRecipientNameChange}
                placeholder={t('recipient_name')}
                placeholderTextColor={C_CAP}
              />
              <TextInput
                style={styles.recipientInput}
                value={recipientPhone}
                onChangeText={onRecipientPhoneChange}
                placeholder={t('recipient_phone')}
                placeholderTextColor={C_CAP}
                keyboardType="phone-pad"
              />
            </View>
          )}

          {/* ── Payment section ── */}
          {onPaymentMethodChange && (
            <View style={{ marginBottom: 16 }}>
              <View style={styles.payTabs}>
                <TouchableOpacity
                  onPress={() => { Haptics.selectionAsync(); onPaymentMethodChange('cash'); }}
                  activeOpacity={0.8}
                  style={[styles.payTab, paymentMethod === 'cash' ? styles.payTabActive : null]}
                >
                  <Banknote size={15} color={paymentMethod === 'cash' ? C_INK : C_CAP} strokeWidth={1.8} />
                  <Text style={[styles.payTabTxt, { color: paymentMethod === 'cash' ? C_INK : C_CAP }]}>
                    {t('payment_methods_cash')}
                  </Text>
                </TouchableOpacity>
                <View style={[styles.payTab, { opacity: 0.55 }]}>
                  <CreditCard size={15} color={C_CAP} strokeWidth={1.8} />
                  <Text style={[styles.payTabTxt, { color: C_CAP }]}>{t('payment_methods_card')}</Text>
                  <View style={styles.soonBadge}><Text style={styles.soonTxt}>{t('soon')}</Text></View>
                </View>
              </View>

              {walletAvailable && (
                <View
                  style={[
                    styles.walletRow,
                    {
                      borderColor: paymentMethod === 'wallet' ? C_TEAL : C_HAIR,
                      borderWidth: paymentMethod === 'wallet' ? 1.5 : 1,
                      opacity: walletHasFunds ? 1 : 0.5,
                    },
                  ]}
                >
                  <Wallet size={15} color={walletHasFunds ? C_TEAL : C_CAP} strokeWidth={1.8} />
                  <Text style={styles.walletLabel}>{t('payment_methods_wallet')}</Text>
                  <Text style={styles.walletBal} numberOfLines={1}>{'Balance: '}{walletBalance ?? 0} {t('egp')}</Text>
                  <Switch
                    value={paymentMethod === 'wallet'}
                    disabled={!walletHasFunds}
                    onValueChange={(val) => {
                      if (!walletHasFunds) return;
                      Haptics.selectionAsync();
                      onPaymentMethodChange(val ? 'wallet' : 'cash');
                    }}
                    trackColor={{ false: '#DDE0E3', true: C_TEAL }}
                    thumbColor="#ffffff"
                  />
                </View>
              )}
            </View>
          )}

          {/* ── Confirm ── */}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onConfirm(); }}
            disabled={!canConfirm}
            activeOpacity={0.9}
            style={[styles.confirmBtn, { opacity: canConfirm ? 1 : 0.5 }]}
          >
            {confirming ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.confirmTxt}>{'Find Driver'}</Text>
                {selectedPrice != null ? (
                  <Text style={styles.confirmPrice}>· {selectedPrice.toFixed(2)} {t('egp')}</Text>
                ) : null}
              </View>
            )}
          </TouchableOpacity>
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
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 28,
    zIndex: 999,
  },
  sheetSurface: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: C_CARD,
  },

  /* ── Dark header ── */
  header: {
    backgroundColor: C_PANEL,
    paddingTop: 10, paddingBottom: 18, paddingHorizontal: 20,
  },
  handle: {
    width: 40, height: 5, borderRadius: 3,
    alignSelf: 'center', marginBottom: 16, backgroundColor: '#3A3B40',
  },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tripDots: { alignItems: 'center', paddingTop: 2 },
  tripDotRound: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: C_MINT },
  tripDotLine: { width: 1.5, height: 18, backgroundColor: '#333640', marginVertical: 3 },
  tripDotSquare: { width: 8, height: 8, borderRadius: 2, backgroundColor: C_MINT },
  tripCap: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: C_CAP },
  tripDest: { fontSize: 16, fontWeight: '800', color: '#ffffff', marginTop: 6 },
  dismissBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)',
  },

  body: { backgroundColor: C_CARD },

  /* ── Category tiles ── */
  tileRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  tile: {
    flex: 1, borderRadius: 16,
    paddingHorizontal: 6, paddingVertical: 14,
    alignItems: 'center', backgroundColor: C_SURF,
  },
  tileActive: { backgroundColor: C_TEAL },
  tileName: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  tilePrice: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  tileCur: { fontSize: 10, fontWeight: '700', color: C_CAP },

  /* ── Single option (scooter / delivery) ── */
  singleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: C_SURF, borderWidth: 1, borderColor: 'transparent',
  },
  singleRowActive: { borderColor: C_TEAL, backgroundColor: '#ffffff' },
  singleIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  singleName: { fontSize: 15, fontWeight: '800', color: C_INK, letterSpacing: -0.15 },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  etaTxt: { fontSize: 12, fontWeight: '600', color: C_INK_SOFT },
  singlePrice: { fontSize: 15, fontWeight: '800', color: C_INK },
  singleCur: { fontSize: 11, fontWeight: '700', color: C_CAP },

  recipientInput: {
    height: 48, borderRadius: 12, borderWidth: 1, borderColor: C_HAIR,
    backgroundColor: C_SURF, paddingHorizontal: 14, fontSize: 14, color: C_INK,
  },

  /* ── Payment ── */
  payTabs: { flexDirection: 'row', gap: 24 },
  payTab: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingBottom: 8 },
  payTabActive: { borderBottomWidth: 2, borderBottomColor: C_INK },
  payTabTxt: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  soonBadge: { borderRadius: 4, borderWidth: 1, borderColor: C_HAIR, paddingHorizontal: 5, paddingVertical: 2 },
  soonTxt: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5, color: C_CAP },
  walletRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: C_SURF, marginTop: 14,
  },
  walletLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: C_INK },
  walletBal: { fontSize: 13, fontWeight: '700', color: C_CAP, marginRight: 4 },

  /* ── Confirm ── */
  confirmBtn: {
    height: 54, borderRadius: 15, backgroundColor: C_INK,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  confirmTxt: { color: '#ffffff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  confirmPrice: { color: C_MINT, fontSize: 15, fontWeight: '800' },
});
