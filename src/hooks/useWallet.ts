import { useState, useEffect, useCallback } from 'react';
import type { ComponentType } from 'react';
import api from '../api/client';
import { Bus, Car, Bike, PlusCircle, RefreshCw, ArrowUp, Tag, Ticket, CreditCard } from 'lucide-react-native';

export interface Transaction {
  id: string;
  type: 'credit' | 'debit';
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
  bike: Bike,
  recharge: PlusCircle,
  top_up: PlusCircle,
  topup: PlusCircle,
  refund: RefreshCw,
  transfer: ArrowUp,
  promo: Tag,
  booking: Ticket,
  ride: Car,
};

function detectCredit(t: any): boolean {
  const type = (t.transactionType ?? t.transaction_type ?? t.type ?? '').toLowerCase();
  if (type.includes('credit') || type.includes('recharge') || type.includes('top') || type.includes('refund')) return true;
  if (type.includes('debit') || type.includes('payment') || type.includes('booking')) return false;
  return (t.amount ?? 0) > 0;
}

function iconForTx(t: any): ComponentType<{ size?: number; color?: string; strokeWidth?: number }> {
  const type = (t.transactionType ?? t.transaction_type ?? t.category ?? t.type ?? '').toLowerCase();
  for (const key of Object.keys(ICON_MAP)) {
    if (type.includes(key)) return ICON_MAP[key];
  }
  return detectCredit(t) ? PlusCircle : CreditCard;
}

function formatDate(raw: string): { en: string; ar: string } {
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

function mapTransaction(t: any): Transaction {
  const isCredit = detectCredit(t);
  const date = formatDate(t.createdAt ?? t.created_at ?? t.date ?? '');
  return {
    id: String(t.id ?? t._id ?? Math.random()),
    type: isCredit ? 'credit' : 'debit',
    titleEn: t.description ?? t.title ?? t.titleEn ?? (isCredit ? 'Wallet recharge' : 'Trip payment'),
    titleAr: t.descriptionAr ?? t.titleAr ?? t.description ?? (isCredit ? 'شحن رصيد' : 'دفع رحلة'),
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
  recharge: (amount: number) => Promise<{ success: boolean; error?: string }>;
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
        api.get('/wallet/balance'),
        api.get('/wallet/transactions'),
      ]);

      if (walletRes.status === 'fulfilled') {
        const d = walletRes.value.data;
        const bal = d.balance ?? d.walletBalance ?? d.wallet_balance ?? d.amount ?? 0;
        setBalance(typeof bal === 'number' ? bal : parseFloat(bal) || 0);
        const spentVal = d.spent ?? d.monthlySpent ?? d.spentThisMonth ?? d.total_spent ?? 0;
        setSpent(typeof spentVal === 'number' ? spentVal : parseFloat(spentVal) || 0);
      }

      if (txRes.status === 'fulfilled') {
        const d = txRes.value.data;
        const list: any[] = Array.isArray(d)
          ? d
          : d.transactions ?? d.data ?? d.items ?? [];
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

  const recharge = useCallback(async (amount: number, paymentMethod: string = 'wallet') => {
    try {
      await api.post('/wallet/topup', { amount, paymentMethod });
      await fetchWallet();
      return { success: true };
    } catch (e: any) {
      const error =
        e?.response?.data?.error ??
        e?.response?.data?.message ??
        e?.message ??
        'Top-up failed';
      return { success: false, error };
    }
  }, [fetchWallet]);

  return { balance, spent, transactions, loading, error, refresh: fetchWallet, recharge };
}
