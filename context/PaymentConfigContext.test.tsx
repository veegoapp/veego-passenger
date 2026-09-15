import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { PaymentConfigProvider, usePaymentConfig } from './PaymentConfigContext';

jest.mock('@/src/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn() },
  tokenStore: { getToken: jest.fn(), TOKEN_KEY: 'veego_access_token' },
}));

jest.mock('@/src/api/socket', () => {
  let currentSocket: any = null;
  return {
    getSocket: jest.fn(async () => {
      if (!currentSocket) currentSocket = { on: jest.fn(), off: jest.fn() };
      return currentSocket;
    }),
    __setSocket: (socket: any) => { currentSocket = socket; },
    __reset: () => { currentSocket = null; },
  };
});

jest.mock('@/src/api/authEvents', () => {
  const listeners: Record<string, Set<any>> = { 'auth:login': new Set(), 'auth:logout': new Set() };
  return {
    onAuthEvent: (event: string, cb: any) => {
      listeners[event].add(cb);
      return () => listeners[event].delete(cb);
    },
    __emit: (event: string) => { listeners[event]?.forEach((cb) => cb()); },
    __reset: () => { listeners['auth:login'].clear(); listeners['auth:logout'].clear(); },
  };
});

const api = jest.requireMock('@/src/api/client').default;
const { tokenStore } = jest.requireMock('@/src/api/client');
const socketMock = jest.requireMock('@/src/api/socket');
const authEventsMock = jest.requireMock('@/src/api/authEvents');

function makeFakeSocket() {
  const listeners = new Map<string, Set<any>>();
  return {
    on: (event: string, cb: any) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(cb);
    },
    off: (event: string, cb: any) => { listeners.get(event)?.delete(cb); },
    __emit: (event: string, payload: any) => { listeners.get(event)?.forEach((cb) => cb(payload)); },
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

let currentUnmount: (() => Promise<void>) | null = null;

async function setupHook() {
  const rendered = await renderHook(() => usePaymentConfig(), {
    wrapper: ({ children }) => <PaymentConfigProvider>{children}</PaymentConfigProvider>,
  });
  currentUnmount = rendered.unmount;
  return rendered;
}

const paymentMethod = {
  key: 'cash', name: 'Cash', nameAr: 'كاش', isEnabled: true,
};

describe('PaymentConfigContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    socketMock.__reset();
    authEventsMock.__reset();
    tokenStore.getToken.mockResolvedValue(null);
    api.get.mockResolvedValue({ data: { data: null } });
  });

  afterEach(async () => {
    if (currentUnmount) {
      await act(async () => { await currentUnmount!(); });
      currentUnmount = null;
    }
  });

  it('fetches wallet feature + payment methods on mount when a token already exists', async () => {
    tokenStore.getToken.mockResolvedValue('existing-token');
    api.get.mockImplementation((url: string) => {
      if (url === '/config/wallet-feature') {
        return Promise.resolve({ data: { data: { isEnabled: true, displayMode: 'live', unavailableMessage: '' } } });
      }
      if (url === '/config/payment-methods') {
        return Promise.resolve({ data: { data: [paymentMethod] } });
      }
      return Promise.resolve({ data: {} });
    });

    const { result } = await setupHook();
    await flush();

    expect(result.current.walletFeature).toMatchObject({ isEnabled: true, displayMode: 'live' });
    expect(result.current.paymentMethods).toEqual([paymentMethod]);
    expect(result.current.isLoading).toBe(false);
  });

  it('stays on the safe coming_soon wallet default and skips the fetch when there is no token', async () => {
    const { result } = await setupHook();
    await flush();

    expect(api.get).not.toHaveBeenCalled();
    expect(result.current.walletFeature).toMatchObject({ isEnabled: false, displayMode: 'coming_soon' });
    expect(result.current.paymentMethods).toEqual([]);
  });

  it('fetches on auth:login after starting with no token', async () => {
    const { result } = await setupHook();
    await flush();
    expect(api.get).not.toHaveBeenCalled();

    api.get.mockImplementation((url: string) => {
      if (url === '/config/wallet-feature') {
        return Promise.resolve({ data: { data: { isEnabled: true, displayMode: 'live', unavailableMessage: '' } } });
      }
      return Promise.resolve({ data: { data: [paymentMethod] } });
    });
    await act(async () => { authEventsMock.__emit('auth:login'); });
    await flush();

    expect(result.current.walletFeature.isEnabled).toBe(true);
    expect(result.current.paymentMethods).toEqual([paymentMethod]);
  });

  it('auth:logout resets both wallet feature and payment methods to their safe defaults', async () => {
    tokenStore.getToken.mockResolvedValue('existing-token');
    api.get.mockImplementation((url: string) => {
      if (url === '/config/wallet-feature') {
        return Promise.resolve({ data: { data: { isEnabled: true, displayMode: 'live', unavailableMessage: '' } } });
      }
      return Promise.resolve({ data: { data: [paymentMethod] } });
    });

    const { result } = await setupHook();
    await flush();
    expect(result.current.paymentMethods).toHaveLength(1);

    await act(async () => { authEventsMock.__emit('auth:logout'); });

    expect(result.current.walletFeature).toMatchObject({ isEnabled: false, displayMode: 'coming_soon' });
    expect(result.current.paymentMethods).toEqual([]);
  });

  it('ignores a wallet-feature response missing isEnabled instead of corrupting state', async () => {
    tokenStore.getToken.mockResolvedValue('existing-token');
    api.get.mockImplementation((url: string) => {
      if (url === '/config/wallet-feature') return Promise.resolve({ data: { data: { displayMode: 'live' } } });
      return Promise.resolve({ data: { data: [] } });
    });

    const { result } = await setupHook();
    await flush();

    expect(result.current.walletFeature).toMatchObject({ isEnabled: false, displayMode: 'coming_soon' });
  });

  it('one endpoint failing (Promise.allSettled) does not block the other from loading', async () => {
    tokenStore.getToken.mockResolvedValue('existing-token');
    api.get.mockImplementation((url: string) => {
      if (url === '/config/wallet-feature') return Promise.reject(new Error('wallet config down'));
      return Promise.resolve({ data: { data: [paymentMethod] } });
    });

    const { result } = await setupHook();
    await flush();

    expect(result.current.walletFeature).toMatchObject({ isEnabled: false, displayMode: 'coming_soon' });
    expect(result.current.paymentMethods).toEqual([paymentMethod]);
  });

  it('applies a real-time wallet:feature:changed socket update', async () => {
    tokenStore.getToken.mockResolvedValue('existing-token');
    api.get.mockResolvedValue({ data: { data: null } });
    const socket = makeFakeSocket();
    socketMock.__setSocket(socket);

    const { result } = await setupHook();
    await flush();

    await act(async () => {
      socket.__emit('wallet:feature:changed', { isEnabled: true, displayMode: 'live', unavailableMessage: '' });
    });

    expect(result.current.walletFeature).toMatchObject({ isEnabled: true, displayMode: 'live' });
  });

  it('applies a real-time payment:methods:changed socket update, replacing the list', async () => {
    tokenStore.getToken.mockResolvedValue('existing-token');
    api.get.mockResolvedValue({ data: { data: [] } });
    const socket = makeFakeSocket();
    socketMock.__setSocket(socket);

    const { result } = await setupHook();
    await flush();

    await act(async () => {
      socket.__emit('payment:methods:changed', [paymentMethod, { ...paymentMethod, key: 'wallet', name: 'Wallet' }]);
    });

    expect(result.current.paymentMethods).toHaveLength(2);
  });

  it('ignores a non-array payment:methods:changed payload instead of wiping the list', async () => {
    tokenStore.getToken.mockResolvedValue('existing-token');
    api.get.mockImplementation((url: string) => {
      if (url === '/config/payment-methods') return Promise.resolve({ data: { data: [paymentMethod] } });
      return Promise.resolve({ data: { data: null } });
    });
    const socket = makeFakeSocket();
    socketMock.__setSocket(socket);

    const { result } = await setupHook();
    await flush();
    expect(result.current.paymentMethods).toHaveLength(1);

    await act(async () => {
      socket.__emit('payment:methods:changed', { garbage: true });
    });

    expect(result.current.paymentMethods).toHaveLength(1);
  });
});
