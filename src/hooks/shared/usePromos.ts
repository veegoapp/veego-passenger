import { useCallback, useState, useEffect } from 'react';
import type { ComponentType } from 'react';
import api from '../../api/client';
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

interface UsePromosResult {
  promos: PromoCard[];
  loading: boolean;
  validateCode: (code: string, orderAmount?: number) => Promise<{ valid: boolean; discount?: string; message?: string }>;
  validatePromo: (code: string) => Promise<{ valid: boolean; discount?: string; message?: string }>;
}

const ICON_MAP: Record<string, ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  sparkles: Sparkles,
  wallet: Wallet,
  gift: Gift,
  star: Star,
  tag: Tag,
};

function mapIcon(raw: string | undefined): ComponentType<{ size?: number; color?: string; strokeWidth?: number }> {
  if (!raw) return Tag;
  const key = raw.toLowerCase();
  return ICON_MAP[key] ?? Tag;
}

function mapPromoCard(item: any): PromoCard {
  return {
    code: item.code ?? item.promoCode ?? '',
    titleEn: item.titleEn ?? item.title ?? item.name ?? '',
    titleAr: item.titleAr ?? item.titleEn ?? item.title ?? '',
    subtitleEn: item.subtitleEn ?? item.description ?? '',
    subtitleAr: item.subtitleAr ?? item.subtitleEn ?? item.description ?? '',
    discount: item.discount ?? item.discountValue ?? '',
    expiresEn: item.expiresEn ?? item.expiresAt ?? item.expiry ?? '',
    expiresAr: item.expiresAr ?? item.expiresEn ?? item.expiresAt ?? '',
    color: item.color ?? '#55c49a',
    icon: mapIcon(item.icon),
  };
}

export function usePromos(): UsePromosResult {
  const [promos, setPromos] = useState<PromoCard[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get('/promo/available')
      .then(({ data }) => {
        if (cancelled) return;
        const raw = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
        setPromos(raw.map(mapPromoCard));
      })
      .catch((e: any) => {
        const status = e?.response?.status;
        if (status === 403 || status === 404) {
          // admin-only or not found — silently return empty
        } else {
          console.warn('[usePromos] GET /promo error:', e?.message ?? e);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const validateCode = useCallback(async (code: string, _orderAmount?: number) => {
    try {
      const { data } = await api.post('/promo/validate', { code });
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

  const validatePromo = useCallback((code: string) => validateCode(code), [validateCode]);

  return { promos, loading, validateCode, validatePromo };
}
