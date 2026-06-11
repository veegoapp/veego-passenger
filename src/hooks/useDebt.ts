import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';

export interface DebtInfo {
  hasDebt: boolean;
  amount: number;
  offenceCount: number;
}

interface UseDebtResult {
  debt: DebtInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useDebt(): UseDebtResult {
  const [debt, setDebt] = useState<DebtInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDebt = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/shuttle/my-debt');
      setDebt({
        hasDebt: data.hasDebt ?? false,
        amount: data.amount ?? data.debtAmount ?? data.debt ?? 0,
        offenceCount: data.offenceCount ?? data.offenses ?? data.absences ?? 0,
      });
    } catch {
      setDebt(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDebt();
  }, [fetchDebt]);

  return { debt, loading, refresh: fetchDebt };
}
