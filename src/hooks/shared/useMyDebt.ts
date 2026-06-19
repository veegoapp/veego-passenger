/**
 * useMyDebt — fetches the passenger's outstanding cash debt and offence count.
 *
 * Per §13.1 and §21.7: frontends MUST check this on launch and show a persistent
 * banner when hasDebt === true.  New bookings are blocked server-side when
 * walletBalance < 0 — surfacing the debt proactively gives a clear UX reason.
 */
import { useState, useEffect, useCallback } from 'react';
import { getMyDebt } from '../../api/shuttleService';
import type { DebtInfo } from '@/constants/data';

export interface UseMyDebtResult {
  debt: DebtInfo | null;
  loading: boolean;
  refresh: () => void;
}

export function useMyDebt(): UseMyDebtResult {
  const [debt, setDebt] = useState<DebtInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDebt = useCallback(async () => {
    setLoading(true);
    try {
      const info = await getMyDebt();
      setDebt(info);
    } catch {
      // Silent — a network error on this optional check should never block the app
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
