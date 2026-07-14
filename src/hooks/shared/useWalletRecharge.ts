import { useCallback, useRef, useState } from 'react';
import api from '../../api/client';
import type { PaymobCheckoutOutcome } from '../../../components/wallet/PaymobCheckoutModal';

export type RechargeStatus =
  | 'idle'          // nothing in progress
  | 'initiating'    // creating the Paymob session
  | 'checkout'      // WebView open, waiting on the user
  | 'confirming'    // checkout finished, polling the wallet balance
  | 'confirmed'     // balance increase observed — real success
  | 'failed'        // Paymob reported failure, or initiate/session errored
  | 'cancelled'     // user closed the checkout before any result
  | 'timeout';      // checkout reported success/pending but the webhook hasn't landed yet

interface RechargeState {
  status: RechargeStatus;
  amountEGP: number | null;
  iframeUrl: string | null;
  merchantOrderId: string | null;
  confirmedBalance: number | null;
  errorMessage: string | null;
}

const INITIAL_STATE: RechargeState = {
  status: 'idle',
  amountEGP: null,
  iframeUrl: null,
  merchantOrderId: null,
  confirmedBalance: null,
  errorMessage: null,
};

// Paymob's webhook is asynchronous and can lag a few seconds behind the
// checkout page's own redirect, so wallet-balance confirmation is retried
// rather than trusted on the first read. ~16s covers normal webhook latency;
// beyond that we stop polling and surface a "still processing" state instead
// of a false failure (the balance will simply update next time /wallet is read).
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 8;
const BALANCE_EPSILON = 0.01;

async function fetchBalance(): Promise<number> {
  const { data } = await api.get('/wallet');
  const bal = data?.balance ?? data?.walletBalance ?? 0;
  return typeof bal === 'number' ? bal : parseFloat(bal) || 0;
}

function extractErrorMessage(e: any, fallback: string): string {
  return (
    e?.response?.data?.error ??
    e?.response?.data?.message ??
    e?.message ??
    fallback
  );
}

/**
 * Drives the passenger wallet top-up flow against the existing, already
 * HMAC-verified Paymob backend (`POST /payments/paymob/initiate` with
 * `type: "wallet_topup"`, credited by the server webhook). This hook never
 * calls the admin-only `POST /wallet/topup` endpoint, and never touches ride
 * or booking payment logic.
 */
export function useWalletRecharge() {
  const [state, setState] = useState<RechargeState>(INITIAL_STATE);
  const baselineBalanceRef = useRef<number | null>(null);
  const amountRef = useRef<number | null>(null);
  const pollAbortRef = useRef(false);

  const reset = useCallback(() => {
    pollAbortRef.current = true;
    amountRef.current = null;
    baselineBalanceRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  const pollForConfirmation = useCallback(async (amountEGP: number) => {
    const baseline = baselineBalanceRef.current ?? 0;

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      if (pollAbortRef.current) return;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      if (pollAbortRef.current) return;

      try {
        const balance = await fetchBalance();
        if (balance >= baseline + amountEGP - BALANCE_EPSILON) {
          setState((prev) => ({ ...prev, status: 'confirmed', confirmedBalance: balance }));
          return;
        }
      } catch {
        // Transient read failure — keep retrying until attempts run out.
      }
    }

    if (!pollAbortRef.current) {
      setState((prev) => ({ ...prev, status: 'timeout' }));
    }
  }, []);

  const startRecharge = useCallback(async (amountEGP: number) => {
    pollAbortRef.current = false;
    amountRef.current = amountEGP;
    setState({ ...INITIAL_STATE, status: 'initiating', amountEGP });

    try {
      // Baseline is read fresh (not from any cached UI state) right before
      // creating the Paymob session, so the confirmation check below can't
      // be fooled by a balance change that already happened earlier.
      const baseline = await fetchBalance();
      baselineBalanceRef.current = baseline;

      const { data } = await api.post('/payments/paymob/initiate', {
        amountEGP,
        type: 'wallet_topup',
      });

      const iframeUrl: string | undefined = data?.iframeUrl;
      const merchantOrderId: string | undefined = data?.merchantOrderId;
      if (!iframeUrl) throw new Error('Paymob did not return a checkout URL');

      setState((prev) => ({ ...prev, status: 'checkout', iframeUrl, merchantOrderId: merchantOrderId ?? null }));
    } catch (e: any) {
      setState((prev) => ({
        ...prev,
        status: 'failed',
        errorMessage: extractErrorMessage(e, 'Failed to start Paymob checkout'),
      }));
    }
  }, []);

  const handleCheckoutClose = useCallback((outcome: PaymobCheckoutOutcome) => {
    if (outcome === 'cancelled') {
      // The user closed our checkout view manually — this is never treated
      // as success by itself. But Paymob's own in-page result screen can
      // report success without triggering a navigation we can observe (e.g.
      // some 3D-Secure return flows), so before declaring "cancelled" we do
      // one quick, real balance check rather than assume anything either way.
      const amountEGP = amountRef.current;
      const baseline = baselineBalanceRef.current;
      if (amountEGP == null || baseline == null) {
        setState((prev) => ({ ...prev, status: 'cancelled' }));
        return;
      }
      setState((prev) => ({ ...prev, status: 'confirming' }));
      fetchBalance()
        .then((balance) => {
          if (balance >= baseline + amountEGP - BALANCE_EPSILON) {
            setState((prev) => ({ ...prev, status: 'confirmed', confirmedBalance: balance }));
          } else {
            setState((prev) => ({ ...prev, status: 'cancelled' }));
          }
        })
        .catch(() => {
          setState((prev) => ({ ...prev, status: 'cancelled' }));
        });
      return;
    }
    if (outcome === 'error' || outcome === 'failed') {
      setState((prev) => ({ ...prev, status: 'failed' }));
      return;
    }

    // outcome is 'success' or 'pending' per Paymob's redirect — this is only
    // a hint that the checkout finished, not confirmation of a wallet credit.
    setState((prev) => ({ ...prev, status: 'confirming' }));
    const amountEGP = amountRef.current;
    if (amountEGP != null) {
      pollForConfirmation(amountEGP);
    }
  }, [pollForConfirmation]);

  return {
    status: state.status,
    amountEGP: state.amountEGP,
    iframeUrl: state.iframeUrl,
    merchantOrderId: state.merchantOrderId,
    confirmedBalance: state.confirmedBalance,
    errorMessage: state.errorMessage,
    startRecharge,
    handleCheckoutClose,
    reset,
  };
}
