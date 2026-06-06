import { useCallback } from 'react';
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

interface UsePromosResult {
  promos: PromoCard[];
  loading: boolean;
  validateCode: (code: string, orderAmount?: number) => Promise<{ valid: boolean; discount?: string; message?: string }>;
  validatePromo: (code: string) => Promise<{ valid: boolean; discount?: string; message?: string }>;
}

export function usePromos(): UsePromosResult {
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

  return { promos: [], loading: false, validateCode, validatePromo };
}
