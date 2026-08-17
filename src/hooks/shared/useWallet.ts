import { useState, useEffect, useCallback } from 'react';
import type { ComponentType } from 'react';
import api from '../../api/client';
import { WalletBalanceSchema, TransactionItemSchema, checkContract } from '../../api/schemas';
import { Bus, Car, Bike as ScooterIcon, PlusCircle, RefreshCw, ArrowUp, Tag, Ticket, CreditCard } from 'lucide-react-native';
import { en as i18nEn } from '../../../constants/i18n/en';
import { ar as i18nAr } from '../../../constants/i18n/ar';

export interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  /** Raw transaction kind from the backend (deposit/payment/refund/bonus),
   *  when available — drives the type label in the detail view. Falls back
   *  to a credit/debit-derived guess when the backend doesn't send one. */
  kind: 'deposit' | 'payment' | 'refund' | 'bonus';
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  amount: number;
  dateAr: string;
  dateEn: string;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

const ICON_MAP: Record<string, ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  shuttle: Bus,
  car: Car,
  scooter: ScooterIcon,
  recharge: PlusCircle,
  top_up: PlusCircle,
  topup: PlusCircle,
  refund: RefreshCw,
  transfer: ArrowUp,
  promo: Tag,
  booking: Ticket,
  ride: Car,
};

// Raw shape of a wallet transaction as returned by GET /wallet/transactions.
// Field-name fallbacks below are unchanged existing behavior — this type
// only documents the boundary, it does not enforce a stricter shape.
interface RawTransaction {
  id?: string | number;
  transactionType?: string;
  category?: string;
  type?: string;
  amount?: number;
  createdAt?: string;
  date?: string;
  description?: string;
  descriptionAr?: string;
  title?: string;
  titleEn?: string;
  titleAr?: string;
  subDescription?: string;
  subDescriptionAr?: string;
  subtitleEn?: string;
  subtitleAr?: string;
  note?: string;
}

function detectKind(t: RawTransaction): Transaction['kind'] {
  const type = (t.transactionType ?? t.category ?? t.type ?? '').toLowerCase();
  if (type.includes('deposit') || type.includes('recharge') || type.includes('top')) return 'deposit';
  if (type.includes('refund')) return 'refund';
  if (type.includes('bonus')) return 'bonus';
  if (type.includes('payment') || type.includes('booking')) return 'payment';
  return detectCredit(t) ? 'deposit' : 'payment';
}

function detectCredit(t: RawTransaction): boolean {
  const type = (t.transactionType ?? t.type ?? '').toLowerCase();
  if (type.includes('credit') || type.includes('recharge') || type.includes('top') || type.includes('refund')) return true;
  if (type.includes('debit') || type.includes('payment') || type.includes('booking')) return false;
  return (t.amount ?? 0) > 0;
}

function iconForTx(t: RawTransaction): ComponentType<{ size?: number; color?: string; strokeWidth?: number }> {
  const type = (t.transactionType ?? t.category ?? t.type ?? '').toLowerCase();
  for (const key of Object.keys(ICON_MAP)) {
    if (type.includes(key)) return ICON_MAP[key];
  }
  return detectCredit(t) ? PlusCircle : CreditCard;
}

function formatDate(raw: string | undefined): { en: string; ar: string } {
  if (!raw) return { en: '—', ar: '—' };
  const d = new Date(raw);
  if (isNaN(d.getTime())) return { en: raw, ar: raw };
  return {
    en:
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ', ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    ar:
      d.toLocaleDateString('ar-EG', { month: 'long', day: 'numeric' }) +
      '، ' +
      d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
  };
}

function mapTransaction(t: RawTransaction): Transaction {
  const isCredit = detectCredit(t);
  const date = formatDate(t.createdAt ?? t.date ?? '');
  return {
    id: String(t.id ?? `${t.createdAt ?? t.date ?? ''}_${t.amount ?? 0}_${t.transactionType ?? t.type ?? ''}`),
    type: isCredit ? 'credit' : 'debit',
    kind: detectKind(t),
    titleEn: t.description ?? t.title ?? t.titleEn ?? (isCredit ? i18nEn.tx_wallet_recharge : i18nEn.tx_trip_payment),
    titleAr: t.descriptionAr ?? t.titleAr ?? t.description ?? (isCredit ? i18nAr.tx_wallet_recharge : i18nAr.tx_trip_payment),
    subtitleEn: t.subDescription ?? t.subtitleEn ?? t.note ?? '',
    subtitleAr: t.subDescriptionAr ?? t.subtitleAr ?? t.note ?? '',
    amount: Math.abs(t.amount ?? 0),
    dateEn: date.en,
    dateAr: date.ar,
    icon: iconForTx(t),
  };
}

interface UseWalletResult {
  balance: number;
  spent: number;
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useWallet(): UseWalletResult {
  const [balance, setBalance] = useState<number>(0);
  const [spent, setSpent] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [walletRes, txRes] = await Promise.allSettled([
        api.get('/wallet'),
        api.get('/wallet/transactions'),
      ]);

      if (walletRes.status === 'fulfilled') {
        const d = walletRes.value.data;
        checkContract('Wallet balance', d, WalletBalanceSchema);
        // Backend confirmed: only `balance` field is returned by GET /wallet.
        const bal = d.balance ?? 0;
        setBalance(typeof bal === 'number' ? bal : parseFloat(bal) || 0);
        const spentVal = d.spent ?? d.monthlySpent ?? d.spentThisMonth ?? 0;
        setSpent(typeof spentVal === 'number' ? spentVal : parseFloat(spentVal) || 0);
      }

      if (txRes.status === 'fulfilled') {
        const d = txRes.value.data;
        const list: any[] = Array.isArray(d)
          ? d
          : d.transactions ?? d.data ?? d.items ?? [];
        if (__DEV__ && list.length > 0) checkContract('Wallet transaction', list[0], TransactionItemSchema);
        setTransactions(list.map(mapTransaction));
      }
    } catch (e: any) {
      setError(
        e?.response?.data?.error ??
          e?.response?.data?.message ??
          e?.message ??
          'Failed to load wallet',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  return { balance, spent, transactions, loading, error, refresh: fetchWallet };
}
