import { useMemo } from 'react';
import { View, Text, ScrollView, SafeAreaView, Modal } from 'react-native';
import { CreditCard, Banknote, Wallet } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { usePaymentConfig } from '@/context/PaymentConfigContext';
import { Spacing } from '@/constants/spacing';
import { makeStyles, ModalHeader } from './shared';

function PaymentMethodIcon({ iconKey, color }: { iconKey?: string | null; color: string }) {
  const size = 20;
  switch (iconKey) {
    case 'banknote': return <Banknote size={size} color={color} />;
    case 'wallet':   return <Wallet size={size} color={color} />;
    default:         return <CreditCard size={size} color={color} />;
  }
}

export function PaymentMethodsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors: c, t, language } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { paymentMethods } = usePaymentConfig();
  const isAr = language === 'ar';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <ModalHeader title={t('payment_title')} onClose={onClose} />
        <ScrollView contentContainerStyle={styles.modalScroll}>
          {paymentMethods.map((method) => (
            <View key={method.key} style={styles.cardRow}>
              <View style={styles.cardIconBox}>
                <PaymentMethodIcon iconKey={method.icon} color={c.ink} />
              </View>
              <View style={styles.cardLabel}>
                <Text style={styles.cardName}>{isAr ? method.nameAr : method.name}</Text>
                {(isAr ? method.descriptionAr : method.description) ? (
                  <Text style={styles.cardSub}>{isAr ? method.descriptionAr : method.description}</Text>
                ) : null}
              </View>
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>{t('active')}</Text>
              </View>
            </View>
          ))}
          {paymentMethods.length === 0 && (
            <Text style={[styles.cardSub, { textAlign: 'center', marginTop: Spacing.xl }]}>
              {t('no_payment_methods')}
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
