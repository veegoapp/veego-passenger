import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { Typography } from '@/constants/typography';
import { Spacing } from '@/constants/spacing';
import { Radius } from '@/constants/radius';

// Matches the fixed charcoal/gold brand treatment used on the Trip
// Complete screen this modal is opened from (TripCompletedSheet).
const GOLD = '#D5B23D';
const CHARCOAL = '#1C1C1E';
const CARD_BORDER = 'rgba(255,255,255,0.08)';

interface FareBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
  /** Original trip price before any promo discount. */
  grossFare: number | null;
  /** EGP amount knocked off by a promo code — omitted when 0/null. */
  promoDiscount: number | null;
  /** Portion of the fare paid from the passenger's wallet — omitted when 0/null. */
  walletDeduction: number | null;
  /** Cash still owed to the driver in person — 0 for wallet-paid rides. */
  netCashPayable: number | null;
}

/** Itemized fare receipt ("View Details") shared by TripCompletedSheet and trip-tracking.tsx. */
export function FareBreakdownModal({
  visible, onClose, grossFare, promoDiscount, walletDeduction, netCashPayable,
}: FareBreakdownModalProps) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('fare_breakdown_title')}</Text>

          {grossFare != null && (
            <View style={styles.row}>
              <Text style={styles.label}>{t('gross_fare')}</Text>
              <Text style={styles.value}>{grossFare.toFixed(2)} {t('egp')}</Text>
            </View>
          )}
          {promoDiscount != null && promoDiscount > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>{t('promo_discount_line')}</Text>
              <Text style={[styles.value, { color: '#22c55e' }]}>-{promoDiscount.toFixed(2)} {t('egp')}</Text>
            </View>
          )}
          {walletDeduction != null && walletDeduction > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>{t('wallet_deduction_line')}</Text>
              <Text style={styles.value}>-{walletDeduction.toFixed(2)} {t('egp')}</Text>
            </View>
          )}
          <View style={[styles.row, styles.totalRow]}>
            <Text style={styles.totalLabel}>{t('net_cash_payable')}</Text>
            <Text style={styles.totalValue}>
              {netCashPayable != null ? `${netCashPayable.toFixed(2)} ${t('egp')}` : t('fare_unavailable')}
            </Text>
          </View>

          <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>{t('close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  card: {
    backgroundColor: CHARCOAL,
    borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: CARD_BORDER,
    paddingHorizontal: 20, paddingTop: 10,
  },
  handle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 18, backgroundColor: CARD_BORDER },
  title: { fontSize: 17, fontWeight: Typography.weight.bold, letterSpacing: -0.3, marginBottom: Spacing.sm, textAlign: 'center', color: '#ffffff' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  label: { fontSize: 14, color: '#B0B0B5' },
  value: { fontSize: 14, fontWeight: Typography.weight.medium, color: '#ffffff' },
  totalRow: { borderTopWidth: 1, borderTopColor: CARD_BORDER, marginTop: 4, paddingTop: 14 },
  totalLabel: { fontSize: 16, fontWeight: Typography.weight.bold, color: '#ffffff' },
  totalValue: { fontSize: 18, fontWeight: Typography.weight.bold, color: GOLD },
  closeBtn: {
    height: 50, borderRadius: Radius.lg, borderWidth: 1, borderColor: CARD_BORDER,
    backgroundColor: '#26262A',
    alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg,
  },
  closeBtnText: { fontSize: 15, fontWeight: Typography.weight.semibold, color: '#ffffff' },
});
