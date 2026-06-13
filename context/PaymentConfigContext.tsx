import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useMemo, useRef,
} from 'react';
import api from '@/src/api/client';
import { tokenStore } from '@/src/api/client';
import { getSocket } from '@/src/api/socket';
import { onAuthEvent } from '@/src/api/authEvents';
import { SOCKET_EVENTS } from '@/src/constants/socketEvents';

export interface WalletFeature {
  isEnabled: boolean;
  displayMode: 'live' | 'coming_soon' | 'unavailable' | 'maintenance';
  unavailableMessage: string;
}

export interface PaymentMethods {
  cash: boolean;
  wallet: boolean;
  card: boolean;
}

const DEFAULT_WALLET_FEATURE: WalletFeature = {
  isEnabled: false,
  displayMode: 'coming_soon',
  unavailableMessage: 'Wallet is coming soon',
};

const DEFAULT_PAYMENT_METHODS: PaymentMethods = {
  cash: true,
  wallet: false,
  card: false,
};

type PaymentConfigContextType = {
  walletFeature: WalletFeature;
  paymentMethods: PaymentMethods;
  isLoading: boolean;
};

const PaymentConfigContext = createContext<PaymentConfigContextType>({
  walletFeature: DEFAULT_WALLET_FEATURE,
  paymentMethods: DEFAULT_PAYMENT_METHODS,
  isLoading: false,
});

export function PaymentConfigProvider({ children }: { children: React.ReactNode }) {
  const [walletFeature, setWalletFeature] = useState<WalletFeature>(DEFAULT_WALLET_FEATURE);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethods>(DEFAULT_PAYMENT_METHODS);
  const [isLoading, setIsLoading] = useState(false);

  const isMounted = useRef(true);
  const socketListenerAttached = useRef(false);

  const fetchConfig = useCallback(async () => {
    if (!isMounted.current) return;
    setIsLoading(true);
    try {
      const [wfRes, pmRes] = await Promise.allSettled([
        api.get('/config/wallet-feature'),
        api.get('/config/payment-methods'),
      ]);

      if (wfRes.status === 'fulfilled' && isMounted.current) {
        const d = wfRes.value.data?.data ?? wfRes.value.data;
        if (d && typeof d.isEnabled === 'boolean') {
          setWalletFeature({
            isEnabled: d.isEnabled,
            displayMode: d.displayMode ?? 'coming_soon',
            unavailableMessage: d.unavailableMessage ?? 'Wallet is coming soon',
          });
        }
      }

      if (pmRes.status === 'fulfilled' && isMounted.current) {
        const d = pmRes.value.data?.data ?? pmRes.value.data;
        if (d && typeof d === 'object') {
          setPaymentMethods({
            cash:   typeof d.cash   === 'boolean' ? d.cash   : true,
            wallet: typeof d.wallet === 'boolean' ? d.wallet : false,
            card:   typeof d.card   === 'boolean' ? d.card   : false,
          });
        }
      }
    } catch {
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, []);

  function attachSocket() {
    if (socketListenerAttached.current) return;
    socketListenerAttached.current = true;

    getSocket().then((sock) => {
      sock.on(SOCKET_EVENTS.WALLET_FEATURE_CHANGED, (data: any) => {
        if (!isMounted.current) return;
        setWalletFeature({
          isEnabled:        typeof data.isEnabled === 'boolean' ? data.isEnabled : DEFAULT_WALLET_FEATURE.isEnabled,
          displayMode:      data.displayMode      ?? DEFAULT_WALLET_FEATURE.displayMode,
          unavailableMessage: data.unavailableMessage ?? DEFAULT_WALLET_FEATURE.unavailableMessage,
        });
      });

      sock.on(SOCKET_EVENTS.PAYMENT_METHODS_CHANGED, (data: any) => {
        if (!isMounted.current) return;
        setPaymentMethods({
          cash:   typeof data.cash   === 'boolean' ? data.cash   : false,
          wallet: typeof data.wallet === 'boolean' ? data.wallet : false,
          card:   typeof data.card   === 'boolean' ? data.card   : false,
        });
      });
    }).catch(() => {});
  }

  function detachSocket() {
    if (!socketListenerAttached.current) return;
    socketListenerAttached.current = false;
    getSocket().then((sock) => {
      sock.off(SOCKET_EVENTS.WALLET_FEATURE_CHANGED);
      sock.off(SOCKET_EVENTS.PAYMENT_METHODS_CHANGED);
    }).catch(() => {});
  }

  useEffect(() => {
    isMounted.current = true;

    tokenStore.getToken(tokenStore.TOKEN_KEY).then((token) => {
      if (!isMounted.current) return;
      if (token) {
        fetchConfig();
        attachSocket();
      }
    }).catch(() => {});

    const unsubLogin = onAuthEvent('auth:login', () => {
      if (!isMounted.current) return;
      fetchConfig();
      attachSocket();
    });

    const unsubLogout = onAuthEvent('auth:logout', () => {
      if (!isMounted.current) return;
      detachSocket();
      setWalletFeature(DEFAULT_WALLET_FEATURE);
      setPaymentMethods(DEFAULT_PAYMENT_METHODS);
    });

    return () => {
      isMounted.current = false;
      unsubLogin();
      unsubLogout();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(
    () => ({ walletFeature, paymentMethods, isLoading }),
    [walletFeature, paymentMethods, isLoading],
  );

  return (
    <PaymentConfigContext.Provider value={value}>
      {children}
    </PaymentConfigContext.Provider>
  );
}

export function usePaymentConfig() {
  return useContext(PaymentConfigContext);
}
