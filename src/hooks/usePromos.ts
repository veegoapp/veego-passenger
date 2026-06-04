import { useState, useEffect, useCallback } from 'react';
import type { ComponentType } from 'react';
import api from '../api/client';
import { Sparkles, Wallet, Gift, Star, Tag } from 'lucide-react-native';

export interface PromoCard {
  code: string;
  titleEn: string;
  titleAr: string;
  subtitleEn: string;
  subtitleAr: string;
  discount: string;
  expiresEn: string;
  expiresAr: string;
  color: string;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

const COLORS = ['#55c49a', '#4d9ef6', '#d95c35', '#a855f7', '#f59e0b'];
const ICONS = [Sparkles, Wallet, Gift, Star, Tag];

function mapApiPromo(p: any, idx: number): PromoCard {
  const discountValue = p.discountValue ?? p.discount_value ?? p.discount ?? p.value ?? 0;
  const discountType = p.discountType ?? p.discount_type ?? p.type ?? '';
  const discountStr =
    discountType === 'percentage' || discountType === 'percent'
      ? `${discountValue}%`
      : `${discountValue} EGP`;

  let expiresEn = '—';
  let expiresAr = '—';
  const expiryRaw = p.expiryDate ?? p.expiry_date ?? p.expiresAt ?? p.validUntil ?? '';
  if (expiryRaw) {
    const d = new Date(expiryRaw);
    if (!isNaN(d.getTime())) {
      expiresEn = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      expiresAr = d.toLocaleDateString('ar-EG', { month: 'long', day: 'numeric', year: 'numeric' });
    } else {
      expiresEn = expiryRaw;
      expiresAr = expiryRaw;
    }
  }

  return {
    code: p.code ?? p.promoCode ?? p.promo_code ?? '',
    titleEn: p.titleEn ?? p.title ?? p.name ?? p.description ?? '',
    titleAr: p.titleAr ?? p.title ?? p.name ?? p.description ?? '',
    subtitleEn: p.subtitleEn ?? p.subtitle ?? p.shortDescription ?? '',
    subtitleAr: p.subtitleAr ?? p.subtitle ?? p.shortDescription ?? '',
    discount: discountStr,
    expiresEn,
    expiresAr,
    color: p.color ?? COLORS[idx % COLORS.length],
    icon: p.icon ?? ICONS[idx % ICONS.length],
  };
}

interface UsePromosResult {
  promos: PromoCard[];
  loading: boolean;
  validateCode: (code: string, orderAmount?: number) => Promise<{ valid: boolean; discount?: string; message?: string }>;
}

export function usePromos(): UsePromosResult {
  const [promos, setPromos] = useState<PromoCard[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPromos = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/promo/codes');
      const list = Array.isArray(data) ? data : data.promos ?? data.codes ?? data.data ?? data.items ?? [];
      setPromos(list.map(mapApiPromo));
    } catch {
      setPromos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPromos(); }, [fetchPromos]);

  const validateCode = useCallback(async (code: string, orderAmount: number) => {
    try {
      const { data } = await api.post('/promo/validate', { code, orderAmount });
      const valid = data.valid ?? data.isValid ?? data.is_valid ?? data.success ?? true;
      const discountValue = data.discountValue ?? data.discount_value ?? data.discount ?? data.value ?? '';
      const discountType = data.discountType ?? data.discount_type ?? data.type ?? '';
      const discountStr =
        typeof discountValue === 'number'
          ? discountType === 'percentage' || discountType === 'percent'
            ? `${discountValue}%`
            : `${discountValue} EGP`
          : String(discountValue);
      return { valid: Boolean(valid), discount: discountStr, message: data.message };
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404 || status === 400 || status === 422) {
        return { valid: false, message: e?.response?.data?.error ?? e?.response?.data?.message ?? 'Invalid promo code' };
      }
      return { valid: false, message: 'Could not validate code. Please try again.' };
    }
  }, []);

  return { promos, loading, validateCode };
}
